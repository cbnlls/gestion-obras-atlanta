import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** Enfoca y selecciona el contenido de un campo al aparecer (edición dentro de una celda). */
@Directive({ selector: 'input[appEnfocar]' })
export class Enfocar {
  constructor() {
    const el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      el.focus();
      el.select();
    });
  }
}
