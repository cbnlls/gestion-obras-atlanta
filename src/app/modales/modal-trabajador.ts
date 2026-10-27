import { Component, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { PersonalModelo } from '../core/modelos/personal-modelo';
import { CATEGORIAS, CONTRATOS } from '../core/modelos/tipos';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

/** Agregar un trabajador al padrón. */
@Component({
  selector: 'app-modal-trabajador',
  imports: [...FORM_IMPORTS],
  template: `
    <app-modal titulo="Agregar trabajador">
      <form [formGroup]="form" class="row g-3">
        <app-campo label="Nombre completo" req><input class="form-control" formControlName="nombre" appTipo="nombre" placeholder="Ej.: Marco Huamán Díaz" /></app-campo>
        <app-campo label="DNI" req><input class="form-control" formControlName="dni" appTipo="dni" placeholder="8 dígitos" /></app-campo>
        <app-campo label="Cargo" req><input class="form-control" formControlName="cargo" appTipo="texto" [tipoMax]="80" placeholder="Ej.: Albañil, Capataz..." /></app-campo>
        <app-campo label="Categoría" req>
          <select class="form-select" formControlName="cat">
            <option value="">Seleccione...</option>
            @for (c of categorias; track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </app-campo>
        <app-campo label="Fecha de ingreso" req><input class="form-control" type="date" formControlName="ini" appTipo="fecha" /></app-campo>
        <app-campo label="Contrato" req>
          <select class="form-select" formControlName="contrato">
            <option value="">Seleccione...</option>
            @for (c of contratos; track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </app-campo>
        <app-campo label="Pago mensual pactado (S/)" req><div class="input-group"><span class="input-group-text">S/</span><input class="form-control" formControlName="mensual" appTipo="importe+" placeholder="Ej.: 3,800.00" /></div></app-campo>
      </form>
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" (click)="guardar()">Agregar</button>
      </div>
    </app-modal>
  `,
})
export class ModalTrabajador {
  protected readonly modal = inject(ModalServicio);
  private readonly obras = inject(ObraModelo);
  private readonly personal = inject(PersonalModelo);
  private readonly toast = inject(Toast);
  protected readonly categorias = CATEGORIAS;
  protected readonly contratos = CONTRATOS;
  protected readonly form = new FormGroup({
    nombre: campo('nombre', { req: true }),
    dni: campo('dni', { req: true }),
    cargo: campo('texto', { req: true, max: 80 }),
    cat: campo(null, { req: true }),
    ini: campo('fecha', { req: true }),
    contrato: campo(null, { req: true }),
    mensual: campo('importe+', { req: true }),
  });

  protected guardar(): void {
    const o = this.obras.activa();
    if (!o || !valido(this.form)) return;
    const r = this.personal.agregar(o, this.form.getRawValue());
    if (falla(r, this.form, this.toast)) return;
    this.modal.cerrar(true);
    this.toast.mostrar('Trabajador agregado al padrón');
  }
}
