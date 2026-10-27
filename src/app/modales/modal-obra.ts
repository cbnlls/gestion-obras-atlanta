import { Component, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { SISTEMAS } from '../core/modelos/tipos';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

/** Nueva obra. La fecha de fin y los periodos los calcula Plazo al guardar. Todos los campos comienzan vacíos. */
@Component({
  selector: 'app-modal-obra',
  imports: [...FORM_IMPORTS],
  template: `
    <app-modal titulo="Nueva obra" ancho>
      <form [formGroup]="form" class="row g-3" (ngSubmit)="guardar()">
        <app-campo label="Nombre de la obra" req s2><input class="form-control" formControlName="nombre" appTipo="texto" [tipoMax]="200" placeholder="Ej.: Mejoramiento de pistas y veredas, Av. Los Álamos" /></app-campo>
        <app-campo label="N.º de contrato" req><input class="form-control" formControlName="contrato" appTipo="contrato" placeholder="Ej.: 014-2026" /></app-campo>
        <app-campo label="Sistema de contratación" req>
          <select class="form-select" formControlName="sistema">
            <option value="">Seleccione...</option>
            @for (s of sistemas; track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
        </app-campo>
        <app-campo label="Entidad contratante" req><input class="form-control" formControlName="entidad" appTipo="texto" [tipoMax]="150" placeholder="Ej.: Municipalidad Distrital de ..." /></app-campo>
        <app-campo label="RUC de la entidad contratante" req><input class="form-control" formControlName="ruc" appTipo="ruc" placeholder="11 dígitos (ej.: 20123456789)" /></app-campo>
        <app-campo label="Contratista" req><input class="form-control" formControlName="contratista" appTipo="texto" [tipoMax]="150" placeholder="Ej.: Constructora Atlanta E.I.R.L." /></app-campo>
        <app-campo label="Monto contractual (S/)" req><input class="form-control" formControlName="monto" appTipo="importe+" placeholder="Ej.: 3,850,000.00" /></app-campo>
        <app-campo label="Adelanto directo (%)"><input class="form-control" formControlName="adelanto" appTipo="porcentaje" placeholder="Ej.: 10 (vacío si no corresponde)" /></app-campo>
        <app-campo label="Plazo de ejecución (días calendario)" req><input class="form-control" formControlName="plazo" appTipo="entero" placeholder="Ej.: 90" /></app-campo>
        <app-campo label="Fecha de inicio" req><input class="form-control" type="date" formControlName="inicio" appTipo="fecha" /></app-campo>
        <app-campo label="Residente de obra"><input class="form-control" formControlName="residente" appTipo="nombre" placeholder="Ing. Nombre Apellido" /></app-campo>
        <app-campo label="Supervisor"><input class="form-control" formControlName="supervisor" appTipo="nombre" placeholder="Ing. Nombre Apellido" /></app-campo>
      </form>
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" (click)="guardar()">Crear obra</button>
      </div>
    </app-modal>
  `,
})
export class ModalObra {
  protected readonly modal = inject(ModalServicio);
  private readonly obras = inject(ObraModelo);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);
  protected readonly sistemas = SISTEMAS;

  protected readonly form = new FormGroup({
    nombre: campo('texto', { req: true, max: 200 }),
    contrato: campo('contrato', { req: true }),
    sistema: campo(null, { req: true }),
    entidad: campo('texto', { req: true, max: 150 }),
    ruc: campo('ruc', { req: true }),
    contratista: campo('texto', { req: true, max: 150 }),
    monto: campo('importe+', { req: true }),
    adelanto: campo('porcentaje'),
    plazo: campo('entero', { req: true }),
    inicio: campo('fecha', { req: true }),
    residente: campo('nombre'),
    supervisor: campo('nombre'),
  });

  protected guardar(): void {
    if (!valido(this.form)) return;
    const v = this.form.getRawValue();
    const r = this.obras.crear({ ...v, adelanto: v.adelanto || '0' });
    if (falla(r, this.form, this.toast)) return;
    this.modal.cerrar(r.obra);
    this.router.navigateByUrl('/obras');
    this.toast.mostrar('Obra creada y seleccionada como activa');
  }
}
