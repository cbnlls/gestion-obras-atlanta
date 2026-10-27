import { NgComponentOutlet } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Almacen } from './core/modelos/almacen';
import { hoyIso } from './core/utils/fechas';
import { ModalServicio } from './shared/servicios/modal';
import { Tema } from './shared/servicios/tema';
import { Toast } from './shared/servicios/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgComponentOutlet],
  template: `
    <router-outlet />
    @if (modal.actual(); as m) {
      <ng-container *ngComponentOutlet="m.componente" />
    }
    <div class="toast-container position-fixed bottom-0 start-50 translate-middle-x p-3">
      <div class="toast align-items-center text-bg-dark border-0" [class.show]="toast.visible()" role="status" aria-live="polite" aria-atomic="true">
        <div class="d-flex"><div class="toast-body">{{ toast.mensaje() }}</div></div>
      </div>
    </div>
  `,
})
export class App {
  protected readonly modal = inject(ModalServicio);
  protected readonly toast = inject(Toast);
  private readonly almacen = inject(Almacen);
  private avisoGuardado = false;
  private dia = hoyIso();

  constructor() {
    inject(Tema).iniciar();
    this.almacen.cargar();
    if (this.almacen.errorCarga) {
      this.toast.mostrar('No se pudieron leer los datos guardados en este navegador. Se conservó una copia de respaldo y se inició sin datos.');
    }
    // si la pestaña queda abierta de un día para otro, «hoy» y los días para vencer se actualizan con la siguiente acción
    ['click', 'keydown'].forEach((ev) =>
      document.addEventListener(
        ev,
        () => {
          if (hoyIso() !== this.dia) {
            this.dia = hoyIso();
            this.almacen.refrescar();
          }
        },
        true,
      ),
    );
    // aviso único si el navegador no deja guardar
    effect(() => {
      this.almacen.rev();
      if (this.almacen.persistir && this.almacen.errorGuardado && !this.avisoGuardado) {
        this.avisoGuardado = true;
        this.toast.mostrar('No se pudo guardar en este navegador (espacio lleno o bloqueado). Los cambios siguen en pantalla, pero se perderán al recargar.');
      }
      if (!this.almacen.errorGuardado) this.avisoGuardado = false;
    });
  }
}
