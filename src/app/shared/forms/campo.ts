import { Component, booleanAttribute, computed, contentChild, effect, input, signal } from '@angular/core';
import { NgControl } from '@angular/forms';

/** Un campo de formulario: etiqueta, control proyectado y mensaje de error.
 *  col: ancho en la grilla (col-md-6 por defecto). s2: fila completa. req: muestra el asterisco rojo. */
@Component({
  selector: 'app-campo',
  host: { '[class]': 'clase()' },
  template: `
    <div class="fld" [class.bad]="mostrar()">
      <label class="form-label small fw-semibold mb-1">{{ label() }}@if (req()) { <span class="text-danger"> *</span> }</label>
      <ng-content />
      <div class="invalid-feedback">{{ mensaje() }}</div>
    </div>
  `,
})
export class Campo {
  readonly label = input.required<string>();
  readonly req = input(false, { transform: booleanAttribute });
  readonly s2 = input(false, { transform: booleanAttribute });
  readonly col = input('col-md-6');

  private readonly ctrl = contentChild(NgControl);
  private readonly tick = signal(0);

  protected readonly clase = computed(() => (this.s2() ? 'col-12' : this.col()));

  constructor() {
    effect((limpiar) => {
      const c = this.ctrl()?.control;
      if (!c) return;
      const sub = c.events.subscribe(() => this.tick.update((n) => n + 1));
      limpiar(() => sub.unsubscribe());
    });
  }

  protected readonly mostrar = computed(() => {
    this.tick();
    const c = this.ctrl()?.control;
    return !!c && c.invalid && (c.touched || c.dirty);
  });
  protected readonly mensaje = computed(() => {
    this.tick();
    const e = this.ctrl()?.control?.errors;
    if (!e) return '';
    if (e['modelo']) return e['modelo'] as string;
    if (e['tipo']) return e['tipo'] as string;
    return 'Completa este campo.';
  });
}
