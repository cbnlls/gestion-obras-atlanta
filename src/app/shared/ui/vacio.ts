import { Component, input } from '@angular/core';
import { Ico } from './ico';

/** Estado vacío: icono, título, descripción y (opcional) un botón proyectado. */
@Component({
  selector: 'app-vacio',
  imports: [Ico],
  template: `
    <div class="text-center text-body-secondary py-5 px-3">
      <div class="d-inline-flex align-items-center justify-content-center rounded-3 bg-body-secondary mb-3" style="width:44px;height:44px"><app-ico [n]="icono()" [s]="22" /></div>
      <div class="fw-semibold text-body fs-6">{{ titulo() }}</div>
      <p class="mb-0">{{ desc() }}</p>
      <div class="mt-3 d-flex gap-2 justify-content-center flex-wrap empty-slot"><ng-content /></div>
    </div>
  `,
  styles: `.empty-slot:empty{display:none!important}`,
})
export class Vacio {
  readonly icono = input('file');
  readonly titulo = input.required<string>();
  readonly desc = input('');
}
