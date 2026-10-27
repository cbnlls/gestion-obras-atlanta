import { Component, input } from '@angular/core';

/** Encabezado de tarjeta con título, subtítulo y acciones proyectadas. */
@Component({
  selector: 'app-card-head',
  host: { style: 'display:contents' },
  template: `
    <div class="card-header bg-body d-flex justify-content-between align-items-center flex-wrap gap-2 py-3">
      <div>
        <h2 class="h6 fw-semibold mb-0"><ng-content select="[titulo]" />{{ titulo() }}</h2>
        @if (sub()) {
          <div class="small text-body-secondary">{{ sub() }}</div>
        }
      </div>
      <ng-content />
    </div>
  `,
})
export class CardHead {
  readonly titulo = input('');
  readonly sub = input('');
}
