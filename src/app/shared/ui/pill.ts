import { Component, computed, input } from '@angular/core';

export type Color = 'blue' | 'green' | 'red' | 'amber' | 'gray';
const BADGE: Record<Color, string> = { blue: 'primary', green: 'success', red: 'danger', amber: 'warning', gray: 'secondary' };

/** Etiqueta de color: azul | verde | rojo | ámbar | gris. */
@Component({
  selector: 'app-pill',
  template: `<span [class]="clase()"><ng-content /></span>`,
})
export class Pill {
  readonly color = input<Color>('gray');
  protected readonly clase = computed(() => {
    const b = BADGE[this.color()] || 'secondary';
    return `badge bg-${b}-subtle text-${b}-emphasis border border-${b}-subtle fw-semibold`;
  });
}