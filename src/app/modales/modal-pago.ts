import { Component, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { PersonalModelo } from '../core/modelos/personal-modelo';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

/** Registrar un pago a un trabajador (los totales mensuales se calculan solos). */
@Component({
  selector: 'app-modal-pago',
  imports: [...FORM_IMPORTS],
  template: `
    <app-modal titulo="Registrar pago">
      <form [formGroup]="form" class="row g-3">
        <app-campo label="Trabajador" req s2>
          <select class="form-select" formControlName="w">
            <option value="">Seleccione...</option>
            @for (w of trabajadores; track w.id) {
              <option [value]="w.id">{{ w.nombre }} (DNI {{ w.dni }})</option>
            }
          </select>
        </app-campo>
        <app-campo label="Fecha del pago" req><input class="form-control" type="date" formControlName="fecha" appTipo="fecha" /></app-campo>
        <app-campo label="Monto pagado (S/)" req><div class="input-group"><span class="input-group-text">S/</span><input class="form-control" formControlName="monto" appTipo="importe+" placeholder="Ej.: 3,800.00" /></div></app-campo>
        <app-campo label="Observación" s2><input class="form-control" formControlName="obs" appTipo="texto" [tipoMax]="200" placeholder="Ej.: Pago de octubre" /></app-campo>
      </form>
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" (click)="guardar()">Registrar pago</button>
      </div>
    </app-modal>
  `,
})
export class ModalPago {
  protected readonly modal = inject(ModalServicio);
  private readonly obras = inject(ObraModelo);
  private readonly personal = inject(PersonalModelo);
  private readonly toast = inject(Toast);
  protected readonly trabajadores = this.personal.todos(this.obras.activa()!);
  protected readonly form = new FormGroup({ w: campo(null, { req: true }), fecha: campo('fecha', { req: true }), monto: campo('importe+', { req: true }), obs: campo('texto', { max: 200 }) });

  protected guardar(): void {
    const o = this.obras.activa();
    if (!o || !valido(this.form)) return;
    const r = this.personal.registrarPago(o, this.form.getRawValue());
    if (falla(r, this.form, this.toast)) return;
    this.modal.cerrar(true);
    this.toast.mostrar('Pago registrado');
  }
}
