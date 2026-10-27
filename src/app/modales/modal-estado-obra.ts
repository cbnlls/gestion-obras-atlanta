import { Component, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { ESTADOS_OBRA } from '../core/modelos/tipos';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

/** Cambiar el estado de la obra activa. */
@Component({
  selector: 'app-modal-estado-obra',
  imports: [...FORM_IMPORTS],
  template: `
    <app-modal titulo="Cambiar estado de la obra">
      <form [formGroup]="form" class="row g-3">
        <app-campo label="Estado" s2>
          <select class="form-select" formControlName="estado">
            @for (e of estados; track e) {
              <option [value]="e">{{ e }}</option>
            }
          </select>
        </app-campo>
      </form>
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" (click)="guardar()">Guardar</button>
      </div>
    </app-modal>
  `,
})
export class ModalEstadoObra {
  protected readonly modal = inject(ModalServicio);
  private readonly obras = inject(ObraModelo);
  private readonly toast = inject(Toast);
  protected readonly estados = ESTADOS_OBRA;
  protected readonly form = new FormGroup({ estado: campo(null, { valor: this.obras.activa()?.estado ?? '' }) });

  protected guardar(): void {
    const o = this.obras.activa();
    if (!o) return;
    const r = this.obras.cambiarEstado(o, this.form.getRawValue().estado);
    if (falla(r, this.form, this.toast)) return;
    this.modal.cerrar();
    this.toast.mostrar('Estado actualizado');
  }
}
