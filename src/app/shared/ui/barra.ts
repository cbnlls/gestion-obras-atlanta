import { Component, computed, input } from '@angular/core';

const BARRA: Record<string, string> = { '': 'warning', green: 'success', blue: 'primary' };

/** Barra de progreso con porcentaje. cls: '' (ámbar) | 'green' | 'blue'. */
@Component({
  selector: 'app-barra',
  template: `
    <div class="d-flex align-items-center gap-2" style="min-width:140px">
      <div class="progress flex-grow-1" style="height:6px" role="progressbar" [attr.aria-valuenow]="pct().toFixed(1)" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar" [class]="'bg-' + color()" [style.width.%]="ancho()"></div>
      </div>
      <span class="font-monospace small text-body-secondary text-end" style="width:46px">{{ pct().toFixed(1) }}%</span>
    </div>
  `,
})
export class Barra {
  readonly pct = input.required<number>();
  readonly cls = input('');
  protected readonly color = computed(() => BARRA[this.cls()] || 'warning');
  protected readonly ancho = computed(() => Math.min(100, this.pct()));
}
