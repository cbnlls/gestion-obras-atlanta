import { Component, booleanAttribute, input } from '@angular/core';
import { Ico } from './ico';

/** Tarjeta KPI; dentro de una fila de grilla de Bootstrap. */
@Component({
  selector: 'app-kpi',
  imports: [Ico],
  host: { '[class]': 'col()' },
  template: `
    <div class="card kpi h-100" [class.kpi-dark]="oscuro()">
      <div class="card-body">
        @if (ico()) {
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="k-lab text-body-secondary">{{ lab() }}</span>
            <span class="k-ic bg-body-secondary text-body-secondary"><app-ico [n]="ico()" [s]="15" /></span>
          </div>
        } @else {
          <div class="k-lab text-body-secondary mb-3">{{ lab() }}</div>
        }
        <div class="k-val">{{ val() }}</div>
        @if (sub()) {
          <div class="small text-body-secondary mt-2">{{ sub() }}</div>
        }
      </div>
    </div>
  `,
})
export class Kpi {
  readonly lab = input.required<string>();
  readonly val = input.required<string | number>();
  readonly sub = input('');
  readonly ico = input('');
  readonly oscuro = input(false, { transform: booleanAttribute });
  readonly col = input('col-6 col-lg-3');
}

/** Tarjeta con un número grande y una etiqueta debajo. */
@Component({
  selector: 'app-kpi-b',
  host: { '[class]': 'col()' },
  template: `
    <div class="card kpi h-100" [class.kpi-dark]="oscuro()">
      <div class="card-body">
        <div class="k-val" style="font-size:34px">{{ val() }}</div>
        <div class="small text-body-secondary mt-3">{{ lab() }}</div>
      </div>
    </div>
  `,
})
export class KpiB {
  readonly lab = input.required<string>();
  readonly val = input.required<string | number>();
  readonly oscuro = input(false, { transform: booleanAttribute });
  readonly col = input('col-6 col-lg-3');
}
