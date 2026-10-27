import { Component, inject, signal, viewChild } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CartaModelo } from '../core/modelos/carta-modelo';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Carta, TIPOS_CARTA } from '../core/modelos/tipos';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';
import { SelectorArchivos } from '../shared/ui/selector-archivos';

/** Nueva carta de fianza (también se usa para renovar una existente). */
@Component({
  selector: 'app-modal-carta',
  imports: [...FORM_IMPORTS, SelectorArchivos],
  template: `
    <app-modal [titulo]="base ? 'Renovar carta de fianza' : 'Nueva carta de fianza'" ancho>
      <form [formGroup]="form" class="row g-3">
        <app-campo label="N.º de carta" req><input class="form-control" formControlName="num" appTipo="codigo" placeholder="Ej.: 0098765" /></app-campo>
        <app-campo label="Tipo de garantía" req>
          <select class="form-select" formControlName="tipo">
            <option value="">Seleccione...</option>
            @for (t of tipos; track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
        </app-campo>
        <app-campo label="Banco emisor" req><input class="form-control" formControlName="banco" appTipo="banco" placeholder="Ej.: BCP, BBVA..." /></app-campo>
        <app-campo label="Monto (S/)" req><div class="input-group"><span class="input-group-text">S/</span><input class="form-control" formControlName="monto" appTipo="importe+" placeholder="Ej.: 385,000.00" /></div></app-campo>
        <app-campo label="Fecha de emisión" req><input class="form-control" type="date" formControlName="emision" appTipo="fecha" /></app-campo>
        <app-campo label="Fecha de vencimiento" req><input class="form-control" type="date" formControlName="vence" appTipo="fecha" /></app-campo>
        <div class="col-12">
          <label class="form-label small fw-semibold mb-1">Documentos de la carta (opcional)</label>
          <app-selector-archivos />
        </div>
      </form>
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" [disabled]="ocupado()" [attr.aria-busy]="ocupado()" (click)="guardar()">
          @if (ocupado()) {
            <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Registrando…
          } @else {
            {{ base ? 'Registrar renovación' : 'Registrar carta' }}
          }
        </button>
      </div>
    </app-modal>
  `,
})
export class ModalCarta {
  protected readonly modal = inject(ModalServicio);
  private readonly obras = inject(ObraModelo);
  private readonly cartas = inject(CartaModelo);
  private readonly toast = inject(Toast);
  protected readonly tipos = TIPOS_CARTA;
  /** Carta que se renueva (null = carta nueva). */
  protected readonly base: Carta | null = this.modal.param<Carta>('base') ?? null;
  private readonly selector = viewChild.required(SelectorArchivos);
  /** Hay un guardado en curso: evita que un doble clic guarde dos veces. */
  protected readonly ocupado = signal(false);

  protected readonly form = new FormGroup({
    num: campo('codigo', { req: true }),
    tipo: campo(null, { req: true, valor: this.base?.tipo ?? '' }),
    banco: campo('banco', { req: true, valor: this.base?.banco ?? '' }),
    monto: campo('importe+', { req: true, valor: this.base ? String(this.base.monto) : '' }),
    emision: campo('fecha', { req: true }),
    vence: campo('fecha', { req: true }),
  });

  protected async guardar(): Promise<void> {
    if (this.ocupado() || !valido(this.form)) return;
    this.ocupado.set(true);
    try {
      const sel = await this.selector().listo();
      const malos = sel.filter((s) => !s.ok);
      if (malos.length) {
        this.toast.mostrar(`Hay ${malos.length} archivo(s) no válidos: ${malos[0].error} Elige otros archivos o quítalos.`);
        return;
      }
      const o = this.obras.activa();
      if (!o) return;
      const r = this.cartas.registrar(o, this.form.getRawValue(), this.base?.id);
      if (falla(r, this.form, this.toast)) return;
      const archivos = sel.map((s) => s.file);
      this.modal.cerrar(true);
      this.toast.mostrar('Carta de fianza registrada');
      if (archivos.length) {
        const g = await this.cartas.adjuntar(o, r.c.id, archivos);
        this.toast.mostrar(
          g.errores.length
            ? `Carta registrada, pero ${g.errores.length} documento(s) no se guardaron: ${g.errores[0].error} Puedes reintentarlo desde «Documentos».`
            : `Carta registrada con ${g.guardados.length} documento(s) guardado(s) en este navegador`,
        );
      }
    } finally {
      this.ocupado.set(false);
    }
  }
}
