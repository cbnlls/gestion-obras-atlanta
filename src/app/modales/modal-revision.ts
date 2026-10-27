import { Component, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { ValorizacionModelo } from '../core/modelos/valorizacion-modelo';
import { pad2 } from '../core/utils/fechas';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

/** Devolver una valorización para corrección (motivo obligatorio). */
@Component({
  selector: 'app-modal-revision',
  imports: [...FORM_IMPORTS],
  template: `
    <app-modal [titulo]="'Devolver valorización N.º ' + pad2(n)">
      <form [formGroup]="form" class="row g-3">
        <div class="col-12 small text-body-secondary">La valorización volverá a quien la registró para que la corrija. La versión oficial vigente (si existe) no cambia y el avance físico no se modifica.</div>
        <app-campo label="Motivo de la devolución" req s2><input class="form-control" formControlName="motivo" appTipo="texto" placeholder="Ej.: El metrado de la partida 02.01 no coincide con el informe de campo" /></app-campo>
      </form>
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" (click)="guardar()">Devolver</button>
      </div>
    </app-modal>
  `,
})
export class ModalRevision {
  protected readonly modal = inject(ModalServicio);
  private readonly obras = inject(ObraModelo);
  private readonly vals = inject(ValorizacionModelo);
  private readonly toast = inject(Toast);
  protected readonly pad2 = pad2;
  protected readonly n = this.modal.param<number>('n') ?? 0;
  protected readonly form = new FormGroup({ motivo: campo('texto', { req: true }) });

  protected guardar(): void {
    const o = this.obras.activa();
    if (!o || !valido(this.form)) return;
    const r = this.vals.devolver(o, this.n, this.form.getRawValue().motivo);
    if (falla(r, this.form, this.toast)) return;
    this.modal.cerrar(true);
    this.toast.mostrar('Valorización devuelta para corrección');
  }
}
