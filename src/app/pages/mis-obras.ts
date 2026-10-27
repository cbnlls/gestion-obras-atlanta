import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Almacen } from '../core/modelos/almacen';
import { AlertasModelo } from '../core/modelos/alertas-modelo';
import { AvanceModelo } from '../core/modelos/avance-modelo';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Plazo } from '../core/modelos/plazo';
import { Obra } from '../core/modelos/tipos';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { fdate, fmt0 } from '../core/utils/formato';
import { ModalObra } from '../modales/modal-obra';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';
import { Topbar } from '../shared/servicios/topbar';
import { Barra } from '../shared/ui/barra';
import { colorEstadoObra } from '../shared/ui/colores';
import { Ico } from '../shared/ui/ico';
import { KpiB } from '../shared/ui/kpi';
import { Pill } from '../shared/ui/pill';
import { Vacio } from '../shared/ui/vacio';

type Filtro = 'todas' | 'ejec' | 'ini' | 'cul';
const ESTADO_FILTRO: Record<Exclude<Filtro, 'todas'>, string> = { ejec: 'En ejecución', ini: 'Por iniciar', cul: 'Culminada' };

@Component({
  selector: 'app-mis-obras',
  imports: [KpiB, Pill, Barra, Vacio, Ico],
  template: `
    @let v = vm();
    <div class="row g-3">
      <app-kpi-b [val]="v.total" lab="Total obras" oscuro />
      <app-kpi-b [val]="v.ejec" lab="En ejecución" />
      <app-kpi-b [val]="v.ini" lab="Por iniciar" />
      <app-kpi-b [val]="v.cul" lab="Culminadas" />
    </div>
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4">
      <ul class="nav nav-pills gap-1 bg-body border rounded-3 p-1">
        @for (t of v.tabs; track t.id) {
          <li class="nav-item"><button class="nav-link" [class.active]="filtro() === t.id" (click)="filtro.set(t.id)">{{ t.etiqueta }}</button></li>
        }
      </ul>
      @if (puedeCrear()) {
        <button class="btn btn-warning" (click)="modal.abrir(modalObra)"><app-ico n="plus" [s]="14" /> Nueva obra</button>
      }
    </div>
    <div class="d-grid gap-3 mt-3">
      @for (f of v.lista; track f.o.id) {
        <button type="button" class="card obra-card w-100 text-start" [class.border-warning]="v.activaId === f.o.id" (click)="seleccionar(f.o)">
          <div class="card-body">
            <div class="row align-items-center g-2 g-lg-3">
              <div class="col-12 col-lg-4">
                <div class="fw-semibold">{{ f.o.nombre }}</div>
                <div class="small text-body-secondary">Contrato {{ f.o.contrato }} · {{ f.termino }}</div>
              </div>
              <div class="col-6 col-lg-2"><app-pill [color]="colorEstado(f.o.estado)">{{ f.o.estado }}</app-pill></div>
              <div class="col-6 col-lg-2"><app-barra [pct]="f.avance" [cls]="f.o.estado === 'Culminada' ? 'green' : ''" /></div>
              <div class="col-6 col-lg-2 text-lg-end font-monospace fw-medium">S/ {{ fmt0(f.o.monto) }}</div>
              <div class="col-6 col-lg-2 text-lg-end"><app-pill [color]="f.alerta ? 'amber' : 'gray'">{{ f.alerta ?? 'Sin alertas' }}</app-pill></div>
            </div>
          </div>
        </button>
      } @empty {
        <div class="card">
          @if (v.total) {
            <app-vacio icono="grid" titulo="No hay obras en este estado" desc="Cambia el filtro o crea una obra nueva." />
          } @else {
            <app-vacio icono="grid" titulo="Aún no hay obras" desc="Crea tu primera obra para empezar a cargar valorizaciones, personal y cartas de fianza.">
              @if (puedeCrear()) {
                <button class="btn btn-warning" (click)="modal.abrir(modalObra)"><app-ico n="plus" [s]="14" /> Nueva obra</button>
              }
            </app-vacio>
          }
        </div>
      }
    </div>
  `,
})
export class MisObras {
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  private readonly avance = inject(AvanceModelo);
  private readonly alertas = inject(AlertasModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);
  protected readonly modal = inject(ModalServicio);
  protected readonly modalObra = ModalObra;
  protected readonly fmt0 = fmt0;
  protected readonly colorEstado = colorEstadoObra;
  protected readonly filtro = signal<Filtro>('todas');

  constructor() {
    inject(Topbar).fijar('Mis obras', 'Selecciona la obra activa o crea una nueva');
  }

  protected readonly puedeCrear = computed(() => (this.almacen.rev(), this.usuarios.puede('Ficha técnica', 'editar')));

  private termino(o: Obra): string {
    const fin = fdate(Plazo.finOriginal(o));
    return o.estado === 'Por iniciar' ? 'Inicio ' + fdate(o.inicio) : o.estado === 'Culminada' ? 'Terminada ' + fin : 'Término: ' + fin;
  }

  protected readonly vm = computed(() => {
    this.almacen.rev();
    const todas = this.obras.todas();
    const f = this.filtro();
    const c = (e: string) => this.obras.contar(e as never);
    const lista = todas.filter((o) => f === 'todas' || o.estado === ESTADO_FILTRO[f]);
    return {
      total: todas.length,
      ejec: c('En ejecución'),
      ini: c('Por iniciar'),
      cul: c('Culminada'),
      activaId: this.obras.activa()?.id,
      tabs: [
        { id: 'todas' as Filtro, etiqueta: `Todas (${todas.length})` },
        { id: 'ejec' as Filtro, etiqueta: `En ejecución (${c('En ejecución')})` },
        { id: 'ini' as Filtro, etiqueta: `Por iniciar (${c('Por iniciar')})` },
        { id: 'cul' as Filtro, etiqueta: `Culminadas (${c('Culminada')})` },
      ],
      lista: lista.map((o) => ({ o, termino: this.termino(o), avance: this.avance.progreso(o).ej, alerta: this.alertas.alerta(o) })),
    };
  });

  protected seleccionar(o: Obra): void {
    this.obras.seleccionar(o.id);
    this.toast.mostrar('Obra activa: ' + o.nombre);
    this.router.navigateByUrl('/ficha');
  }
}
