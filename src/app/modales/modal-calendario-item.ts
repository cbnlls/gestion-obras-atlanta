import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { startWith } from 'rxjs';
import { CalendarioModelo } from '../core/modelos/calendario-modelo';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

const corto = (d: string) => (d.length > 38 ? d.slice(0, 38) + '…' : d);

/** Agregar un ítem al calendario: capítulo, subcapítulo o partida. */
@Component({
  selector: 'app-modal-calendario-item',
  imports: [...FORM_IMPORTS],
  template: `
    <app-modal titulo="Agregar ítem al calendario" ancho>
      <form [formGroup]="form" class="row g-3">
        <app-campo label="Tipo de ítem" req s2>
          <select class="form-select" formControlName="tipo">
            <option value="par">Partida — nivel 01.01.01...</option>
            <option value="sub">Subcapítulo — nivel 01.01</option>
            <option value="cap">Capítulo — nivel 01</option>
          </select>
        </app-campo>
        @if (tipo() !== 'cap') {
          <app-campo label="Capítulo padre" req>
            <select class="form-select" formControlName="cap">
              @for (c of capitulos; track c.code) {
                <option [value]="c.code">{{ c.code }} — {{ corto(c.desc) }}</option>
              }
            </select>
          </app-campo>
        }
        @if (tipo() === 'par') {
          <app-campo label="Subcapítulo padre" req>
            <select class="form-select" formControlName="subc">
              @for (s of subs(); track s.code) {
                <option [value]="s.code">{{ s.code }} — {{ corto(s.desc) }}</option>
              }
            </select>
          </app-campo>
        }
        <app-campo [label]="etiquetaDesc()" req s2><input class="form-control" formControlName="desc" appTipo="texto" [tipoMax]="200" placeholder="Ej.: Alquiler de almacén, oficina y caseta de guardianía" /></app-campo>
        @if (tipo() === 'par') {
          <app-campo label="Unidad" req>
            <select class="form-select" formControlName="und">
              <option value="">Seleccione...</option>
              @for (u of unidades; track u) {
                <option [value]="u">{{ u }}</option>
              }
            </select>
          </app-campo>
          <div class="col-md-6"></div>
          <app-campo label="Metrado total" req><input class="form-control" formControlName="metrado" appTipo="cantidad" placeholder="Ej.: 6" /></app-campo>
          <app-campo label="Precio unitario (S/, sin IGV)" req><input class="form-control" formControlName="pu" appTipo="importe+" placeholder="Ej.: 6,800.00" /></app-campo>
        }
      </form>
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" (click)="guardar()">Agregar al calendario</button>
      </div>
    </app-modal>
  `,
})
export class ModalCalendarioItem {
  protected readonly modal = inject(ModalServicio);
  private readonly obras = inject(ObraModelo);
  private readonly cal = inject(CalendarioModelo);
  private readonly toast = inject(Toast);
  protected readonly corto = corto;
  protected readonly unidades = this.cal.UNIDADES;

  private readonly o = this.obras.activa()!;
  protected readonly capitulos = this.cal.capitulos(this.o);

  protected readonly form = new FormGroup({
    tipo: campo(null, { req: true, valor: this.capitulos.length ? 'par' : 'cap' }),
    cap: campo(null, { req: true, valor: this.capitulos[0]?.code ?? '' }),
    subc: campo(null, { req: true }),
    desc: campo('texto', { req: true, max: 200 }),
    und: campo(null, { req: true }),
    metrado: campo('cantidad', { req: true }),
    pu: campo('importe+', { req: true }),
  });

  protected readonly tipo = toSignal(this.form.controls.tipo.valueChanges.pipe(startWith(this.form.controls.tipo.value)), { initialValue: this.form.controls.tipo.value });
  private readonly capSel = toSignal(this.form.controls.cap.valueChanges.pipe(startWith(this.form.controls.cap.value)), { initialValue: this.form.controls.cap.value });
  protected readonly subs = computed(() => this.cal.subcapitulos(this.o, this.capSel()));
  protected readonly etiquetaDesc = computed(() => {
    const t = this.tipo();
    return t === 'par' ? 'Descripción de la partida' : t === 'sub' ? 'Descripción del subcapítulo' : 'Descripción del capítulo';
  });

  constructor() {
    this.sincronizar();
    this.form.controls.tipo.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.sincronizar());
    this.form.controls.cap.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.sincronizar());
  }

  /** Activa solo los campos que corresponden al tipo y elige el primer subcapítulo del capítulo. */
  private sincronizar(): void {
    const f = this.form.controls;
    const t = f.tipo.value;
    const subs = this.cal.subcapitulos(this.o, f.cap.value);
    if (!subs.some((s) => s.code === f.subc.value)) f.subc.setValue(subs[0]?.code ?? '', { emitEvent: false });
    const activar = (c: { enable: (o: object) => void; disable: (o: object) => void }, on: boolean) => (on ? c.enable({ emitEvent: false }) : c.disable({ emitEvent: false }));
    activar(f.cap, t !== 'cap');
    activar(f.subc, t === 'par');
    [f.und, f.metrado, f.pu].forEach((c) => activar(c, t === 'par'));
  }

  protected guardar(): void {
    if (!valido(this.form)) return;
    const v = this.form.getRawValue();
    const r = this.cal.agregarItem(this.o, { tipo: v.tipo, cap: v.cap, subc: v.subc, desc: v.desc, und: v.und, metrado: v.metrado, pu: v.pu });
    if (falla(r, this.form, this.toast)) return;
    this.modal.cerrar(true);
    this.toast.mostrar('Ítem agregado al calendario');
  }
}
