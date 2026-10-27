import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { startWith } from 'rxjs';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Plazo } from '../core/modelos/plazo';
import { Obra, Valorizacion } from '../core/modelos/tipos';
import { ValorizacionModelo } from '../core/modelos/valorizacion-modelo';
import { mLabel, pad2 } from '../core/utils/fechas';
import { fdate, fmt, num } from '../core/utils/formato';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

/** Registrar o modificar una valorización (bloques I–VII con cálculo en vivo). Entrega el N.º de la valorización guardada. */
@Component({
  selector: 'app-modal-valorizacion',
  imports: [...FORM_IMPORTS],
  template: `
    <app-modal [titulo]="titulo" ancho>
      @if (o) {
        <form [formGroup]="form">
          <div class="row g-3 align-items-end">
            <app-campo label="Período" req col="col-md-4">
              <select class="form-select" formControlName="periodo">
                @for (k of keys; track k) {
                  <option [value]="k">{{ mLabel(k) }} {{ k.slice(0, 4) }}</option>
                }
              </select>
            </app-campo>
            <app-campo label="Días del período" req col="col-md-4"><input class="form-control" formControlName="dias" appTipo="entero" /></app-campo>
            <div class="col-md-4 small text-body-secondary pb-2">
              @if (rango(); as r) {
                Período del {{ fdate(r.desde) }} al {{ fdate(r.hasta) }} ({{ r.dias }} días)
              }
            </div>
            <div class="col-12 small text-body-secondary">
              La valorización quedará <b>pendiente de revisión</b>: solo cuenta en el avance físico cuando la apruebe un Supervisor o el Administrador. Solo el monto ejecutado es obligatorio. Los demás importes que no apliquen pueden quedar vacíos (se toman como 0.00).
            </div>
          </div>
          <div class="mb">
            <h6>Bloque I — Valorización bruta (VB)</h6>
            <div class="row g-2">
              <app-campo label="Monto ejecutado del mes (S/)" req s2>
                <div class="input-group"><span class="input-group-text">S/</span><input class="form-control" formControlName="vb" appTipo="importe+" placeholder="Ej.: 125,000.00" /></div>
              </app-campo>
            </div>
          </div>
          <div class="mb purple">
            <h6>Bloque II — Reajustes y deducciones</h6>
            <div class="row g-2">
              <app-campo label="Reajuste K (S/)"><div class="input-group"><span class="input-group-text">S/</span><input class="form-control" formControlName="reaj" appTipo="importe±" placeholder="0.00" /></div></app-campo>
              <app-campo label="Deducción que no corresponde al reajuste (S/)"><div class="input-group"><span class="input-group-text">S/</span><input class="form-control" formControlName="ded" appTipo="importe" placeholder="0.00" /></div></app-campo>
            </div>
          </div>
          <div class="mb teal">
            <h6>Bloque III — Valorización neta (VN = VB + R − D)</h6>
            <div class="row g-2">
              <app-campo label="Monto neto (S/)" s2><div class="input-group"><span class="input-group-text">S/</span><input class="form-control bg-body-secondary" [value]="fmt(c().vn)" readonly tabindex="-1" /></div></app-campo>
            </div>
          </div>
          <div class="mb orange">
            <h6>Bloque IV — Amortización por adelantos</h6>
            <div class="row g-2">
              <app-campo label="Adelanto directo (S/)"><div class="input-group"><span class="input-group-text">S/</span><input class="form-control" formControlName="advD" appTipo="importe" placeholder="0.00" /></div></app-campo>
              <app-campo label="Adelanto de materiales (S/)"><div class="input-group"><span class="input-group-text">S/</span><input class="form-control" formControlName="advM" appTipo="importe" placeholder="0.00" /></div></app-campo>
            </div>
          </div>
          <div class="mb green">
            <h6>Bloque V — Monto facturable (subtotal + IGV 18%)</h6>
            <div class="row g-2">
              <app-campo label="Subtotal (S/)"><div class="input-group"><span class="input-group-text">S/</span><input class="form-control bg-body-secondary" [value]="fmt(c().sub)" readonly tabindex="-1" /></div></app-campo>
              <app-campo label="IGV (18%) (S/)"><div class="input-group"><span class="input-group-text">S/</span><input class="form-control bg-body-secondary" [value]="fmt(c().igv)" readonly tabindex="-1" /></div></app-campo>
            </div>
          </div>
          <div class="row g-2">
            <div class="col-md-7">
              <div class="mb red h-100">
                <h6>Bloque VI — Retenciones (RM)</h6>
                <div class="row g-2">
                  <app-campo label="Fondo de garantía (S/)" col="col-6"><div class="input-group"><span class="input-group-text">S/</span><input class="form-control" formControlName="fondo" appTipo="importe" placeholder="0.00" /></div></app-campo>
                  <app-campo label="Penalidades (S/)" col="col-6"><div class="input-group"><span class="input-group-text">S/</span><input class="form-control" formControlName="pen" appTipo="importe" placeholder="0.00" /></div></app-campo>
                </div>
              </div>
            </div>
            <div class="col-md-5">
              <div class="mb green h-100">
                <h6>Bloque VII — Valorización líquida (VL = VN − RM)</h6>
                <div class="row g-2">
                  <app-campo label="Valorización líquida (S/)" s2><div class="input-group"><span class="input-group-text">S/</span><input class="form-control bg-body-secondary" [value]="fmt(c().vl)" readonly tabindex="-1" /></div></app-campo>
                </div>
              </div>
            </div>
          </div>
          <div class="pay-box"><div><b>Monto a pagar al contratista</b><small>Total factura − retenciones</small></div><strong>S/ {{ fmt(c().pagar) }}</strong></div>
        </form>
      }
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" (click)="guardar()">{{ val ? 'Guardar y enviar a revisión' : 'Registrar y enviar a revisión' }}</button>
      </div>
    </app-modal>
  `,
})
export class ModalValorizacion {
  protected readonly modal = inject(ModalServicio);
  /** Valorización que se modifica (null = nueva). */
  protected readonly val: Valorizacion | null = this.modal.param<Valorizacion>('val') ?? null;
  private readonly obras = inject(ObraModelo);
  private readonly vals = inject(ValorizacionModelo);
  private readonly toast = inject(Toast);
  protected readonly fdate = fdate;
  protected readonly fmt = fmt;
  protected readonly mLabel = mLabel;

  protected readonly o: Obra | null = this.obras.activa();
  private readonly sg = this.o ? this.vals.siguiente(this.o) : { n: 1, key: '', dias: 0 };
  private readonly n = this.val ? this.val!.n : this.sg.n;
  protected readonly keys: string[] = (() => {
    const key = this.val ? this.val!.key : this.sg.key;
    const ms = this.o ? Plazo.meses(this.o) : [];
    return ms.includes(key) ? ms : [...ms, key];
  })();
  protected readonly titulo = this.val
    ? `Modificar valorización N.º ${pad2(this.n)} (versión ${this.val!.oficial ? this.val!.oficial!.version + 1 : this.val!.version})`
    : `Registrar valorización N.º ${pad2(this.n)}`;

  protected readonly form = new FormGroup({
    periodo: campo(null, { req: true, valor: this.val ? this.val!.key : this.sg.key }),
    dias: campo('entero', { req: true, valor: String(this.val ? this.val!.dias : this.sg.dias) }),
    vb: campo('importe+', { req: true, valor: this.val ? String(this.val!.vb) : '' }),
    reaj: campo('importe±', { valor: this.val ? String(this.val!.reaj) : '' }),
    ded: campo('importe', { valor: this.val ? String(this.val!.ded) : '' }),
    advD: campo('importe', { valor: this.val ? String(this.val!.advD) : '' }),
    advM: campo('importe', { valor: this.val ? String(this.val!.advM) : '' }),
    fondo: campo('importe', { valor: this.val ? String(this.val!.fondo) : '' }),
    pen: campo('importe', { valor: this.val ? String(this.val!.pen) : '' }),
  });

  private readonly valores = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });

  /** Resultados calculados por el modelo mientras se escribe. */
  protected readonly c = computed(() => {
    this.valores();
    const v = this.form.getRawValue();
    return this.vals.calcular({ vb: num(v.vb), reaj: num(v.reaj), ded: num(v.ded), advD: num(v.advD), advM: num(v.advM), fondo: num(v.fondo), pen: num(v.pen) });
  });
  protected readonly rango = computed(() => {
    this.valores();
    return this.o ? Plazo.periodo(this.o, this.form.getRawValue().periodo) : null;
  });

  constructor() {
    if (this.val) this.form.controls.periodo.disable(); // el período de una valorización registrada no se cambia
    // al elegir otro período, se propone sus días reales
    this.form.controls.periodo.valueChanges.pipe(takeUntilDestroyed()).subscribe((k) => {
      if (this.o) this.form.controls.dias.setValue(String(Plazo.diasPeriodo(this.o, k)));
    });
  }

  protected guardar(): void {
    if (!this.o || !valido(this.form)) return;
    const v = this.form.getRawValue();
    const r = this.vals.registrar(this.o, {
      n: this.n,
      editando: !!this.val,
      key: v.periodo,
      dias: v.dias,
      vb: v.vb,
      reaj: v.reaj || '0',
      ded: v.ded || '0',
      advD: v.advD || '0',
      advM: v.advM || '0',
      fondo: v.fondo || '0',
      pen: v.pen || '0',
    });
    if (falla(r, this.form, this.toast)) return;
    this.modal.cerrar(r.val.n);
    this.toast.mostrar(`Valorización N.º ${pad2(r.val.n)} enviada a revisión (aún no cuenta en el avance físico)`);
  }
}
