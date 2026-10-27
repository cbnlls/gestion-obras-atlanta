import { Component, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { PersonalModelo } from '../core/modelos/personal-modelo';
import { MOTIVOS_CESE } from '../core/modelos/tipos';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

/** Cese de personal. */
@Component({
  selector: 'app-modal-cese',
  imports: [...FORM_IMPORTS],
  template: `
    <app-modal titulo="Cese de personal">
      <form [formGroup]="form" class="row g-3">
        <app-campo label="Trabajador" req>
          <select class="form-select" formControlName="w">
            <option value="">Seleccione...</option>
            @for (w of activos; track w.id) {
              <option [value]="w.id">{{ w.nombre }}</option>
            }
          </select>
        </app-campo>
        <app-campo label="Motivo" req>
          <select class="form-select" formControlName="motivo">
            <option value="">Seleccione...</option>
            @for (m of motivos; track m) {
              <option [value]="m">{{ m }}</option>
            }
          </select>
        </app-campo>
        <app-campo label="Fecha de cese" req><input class="form-control" type="date" formControlName="fin" appTipo="fecha" /></app-campo>
      </form>
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" (click)="guardar()">Registrar cese</button>
      </div>
    </app-modal>
  `,
})
export class ModalCese {
  protected readonly modal = inject(ModalServicio);
  private readonly obras = inject(ObraModelo);
  private readonly personal = inject(PersonalModelo);
  private readonly toast = inject(Toast);
  protected readonly motivos = MOTIVOS_CESE;
  protected readonly activos = this.personal.activos(this.obras.activa()!);
  protected readonly form = new FormGroup({ w: campo(null, { req: true }), motivo: campo(null, { req: true }), fin: campo('fecha', { req: true }) });

  protected guardar(): void {
    const o = this.obras.activa();
    if (!o || !valido(this.form)) return;
    const v = this.form.getRawValue();
    const r = this.personal.cesar(o, v.w, v.fin, v.motivo);
    if (falla(r, this.form, this.toast)) return;
    this.modal.cerrar(true);
    this.toast.mostrar(`Cese registrado: ${r.w.nombre}`);
  }
}
