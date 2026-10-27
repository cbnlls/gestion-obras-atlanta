import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Almacen } from '../core/modelos/almacen';
import { AlertasModelo } from '../core/modelos/alertas-modelo';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Modulo } from '../core/modelos/tipos';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { ModalServicio } from '../shared/servicios/modal';
import { Topbar } from '../shared/servicios/topbar';
import { Ico } from '../shared/ui/ico';

interface ItemNav {
  ruta: string;
  etiqueta: string;
  ico: string;
  modulo?: Modulo;
}

const NAV: { seccion: string | null; items: ItemNav[] }[] = [
  { seccion: null, items: [{ ruta: 'dashboard', etiqueta: 'Dashboard', ico: 'grid' }, { ruta: 'obras', etiqueta: 'Mis obras', ico: 'grid' }] },
  {
    seccion: 'PROYECTO',
    items: [
      { ruta: 'ficha', etiqueta: 'Ficha técnica', ico: 'file', modulo: 'Ficha técnica' },
      { ruta: 'valorizaciones', etiqueta: 'Valorizaciones', ico: 'file', modulo: 'Valorizaciones' },
      { ruta: 'avance', etiqueta: 'Avance físico', ico: 'trend', modulo: 'Avance físico' },
      { ruta: 'calendario', etiqueta: 'Calendario', ico: 'cal', modulo: 'Calendario de obra' },
    ],
  },
  {
    seccion: 'CONTROL',
    items: [
      { ruta: 'mano', etiqueta: 'Mano de obra', ico: 'users', modulo: 'Mano de obra' },
      { ruta: 'cartas', etiqueta: 'Cartas de fianza', ico: 'shield', modulo: 'Cartas de fianza' },
    ],
  },
  { seccion: 'ADMIN', items: [{ ruta: 'usuarios', etiqueta: 'Usuarios y roles', ico: 'key', modulo: 'Usuarios y roles' }] },
];

/** Menú lateral (fijo en pantallas grandes, deslizable en celular), barra superior y campana de notificaciones. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, Ico],
  template: `
    <div class="app d-flex">
      <aside class="side offcanvas-lg offcanvas-start" [class.show]="menu()" tabindex="-1" aria-label="Menú principal">
        <div class="side-in">
          <div class="logo"><span class="logo-ic"><app-ico n="logo" [s]="17" /></span>Atlanta E.I.R.L</div>
          <div class="obra-box">
            <small>OBRA ACTIVA</small>
            <strong>{{ obra()?.nombre ?? 'Sin obra activa' }}</strong>
            <button routerLink="/obras">{{ obra() ? 'Cambiar obra →' : 'Crear una obra →' }}</button>
          </div>
          <nav class="side-nav" aria-label="Principal">
            @for (g of nav(); track $index) {
              @if (g.seccion) {
                <h4>{{ g.seccion }}</h4>
              }
              @for (i of g.items; track i.ruta) {
                <button [routerLink]="'/' + i.ruta" routerLinkActive="on" ariaCurrentWhenActive="page"><app-ico [n]="i.ico" [s]="15" />{{ i.etiqueta }}</button>
              }
            }
          </nav>
          <div class="me">
            <span class="avatar">{{ iniciales() }}</span>
            <div><b>{{ sesion().nombre }}</b><span>{{ sesion().rol }}</span></div>
            <button (click)="salir()">Salir</button>
          </div>
        </div>
      </aside>
      @if (menu()) {
        <div class="offcanvas-backdrop fade show d-lg-none" (click)="menu.set(false)"></div>
      }
      <div class="main d-flex flex-column flex-grow-1">
        <header class="topbar d-flex align-items-center gap-2 px-3 px-lg-4 py-2 bg-body border-bottom">
          <button class="btn btn-outline-secondary d-lg-none" aria-label="Abrir menú" (click)="menu.set(true)"><app-ico n="menu" [s]="16" /></button>
          <div class="flex-grow-1 min-w-0"><h1>{{ tb.titulo() }}</h1><p>{{ tb.sub() }}</p></div>
          <div class="d-flex gap-2 flex-wrap justify-content-end">
            @if (tb.acciones(); as t) {
              <ng-container [ngTemplateOutlet]="t" />
            }
          </div>
          <div class="dropdown" #dd>
            <button class="btn btn-outline-warning position-relative" aria-label="Notificaciones" [attr.aria-expanded]="campana()" (click)="campana.set(!campana())"><app-ico n="bell" [s]="15" /><span class="bell-dot"></span></button>
            <div class="dropdown-menu dropdown-menu-end shadow p-2" [class.show]="campana()" data-bs-popper="static" style="width:340px;max-width:calc(100vw - 2rem)">
              <h6 class="dropdown-header">Notificaciones</h6>
              @for (n of notificaciones(); track $index) {
                <div class="noti"><span class="dot"></span><div><b>{{ n.texto }}</b><small>{{ n.obra }}</small></div></div>
              } @empty {
                <p class="small text-body-secondary p-2 mb-0">No tienes alertas pendientes.</p>
              }
            </div>
          </div>
        </header>
        <main class="content flex-grow-1 overflow-auto p-3 p-lg-4" #contenido><router-outlet /></main>
      </div>
    </div>
  `,
})
export class Shell {
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly alertas = inject(AlertasModelo);
  private readonly modal = inject(ModalServicio);
  private readonly router = inject(Router);
  protected readonly tb = inject(Topbar);

  protected readonly menu = signal(false);
  protected readonly campana = signal(false);
  private readonly dd = viewChild.required<ElementRef<HTMLElement>>('dd');
  private readonly contenido = viewChild.required<ElementRef<HTMLElement>>('contenido');

  protected readonly obra = computed(() => (this.almacen.rev(), this.obras.activa()));
  protected readonly sesion = computed(() => (this.almacen.rev(), { ...this.usuarios.sesion() }));
  protected readonly iniciales = computed(() =>
    this.sesion().nombre.split(' ').map((x) => x[0] || '').join('').slice(0, 2).toUpperCase(),
  );
  /** Solo se muestran las pantallas que el rol puede ver. */
  protected readonly nav = computed(() => {
    this.almacen.rev();
    return NAV.map((g) => ({ seccion: g.seccion, items: g.items.filter((i) => !i.modulo || this.usuarios.puede(i.modulo, 'ver')) }));
  });
  protected readonly notificaciones = computed(() => (this.almacen.rev(), this.campana() ? this.alertas.notificaciones() : []));

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menu.set(false);
      this.campana.set(false);
      this.contenido().nativeElement.scrollTop = 0;
    });
  }

  @HostListener('document:click', ['$event'])
  protected clicFuera(e: MouseEvent): void {
    if (this.campana() && !this.dd().nativeElement.contains(e.target as Node)) this.campana.set(false);
  }

  protected salir(): void {
    this.usuarios.cerrarSesion();
    this.modal.cerrar();
    this.router.navigateByUrl('/login');
  }
}
