import { Component, inject } from '@angular/core';
import { UsuarioModelo } from '../../core/modelos/usuario-modelo';
import { ModalServicio } from '../servicios/modal';
import { Vacio } from './vacio';
import { Ico } from './ico';
import { ModalObra } from '../../modales/modal-obra';

/** Se muestra en las pantallas que trabajan sobre la obra activa cuando todavía no hay ninguna. */
@Component({
  selector: 'app-sin-obra',
  imports: [Vacio, Ico],
  template: `
    <div class="card">
      <app-vacio icono="grid" titulo="Primero crea una obra" desc="Estas pantallas trabajan sobre la obra activa. Crea una desde «Mis obras».">
        @if (usuarios.puede('Ficha técnica', 'editar')) {
          <button class="btn btn-warning" (click)="modal.abrir(modalObra)"><app-ico n="plus" [s]="14" /> Nueva obra</button>
        }
      </app-vacio>
    </div>
  `,
})
export class SinObra {
  protected readonly usuarios = inject(UsuarioModelo);
  protected readonly modal = inject(ModalServicio);
  protected readonly modalObra = ModalObra;
}
