import { Component, booleanAttribute, ElementRef, HostListener, afterNextRender, inject, input, OnDestroy } from '@angular/core';
import { ModalServicio } from '../servicios/modal';

/** Marco de un formulario modal: título, cuerpo y pie (contenido con el atributo «pie»).
 *  Se cierra con la X, con Esc o haciendo clic fuera. */
@Component({
  selector: 'app-modal',
  template: `
    <div class="modal d-block show" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="mTitulo" (mousedown)="fuera($event)">
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" [class.modal-lg]="ancho()">
        <div class="modal-content">
          <div class="modal-header">
            <h1 class="modal-title fs-6 fw-bold" id="mTitulo">{{ titulo() }}</h1>
            <button type="button" class="btn-close" aria-label="Cerrar" (click)="modal.cerrar()"></button>
          </div>
          <div class="modal-body"><ng-content /></div>
          <div class="modal-footer bg-body-tertiary"><ng-content select="[pie]" /></div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop show"></div>
  `,
})
export class ModalMarco implements OnDestroy {
  protected readonly modal = inject(ModalServicio);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly titulo = input.required<string>();
  readonly ancho = input(false, { transform: booleanAttribute });

  constructor() {
    document.body.classList.add('modal-open');
    afterNextRender(() => {
      const f = this.el.nativeElement.querySelector<HTMLElement>('input:not([type=date]):not([readonly]):not([type=file]),select');
      f?.focus();
    });
  }
  ngOnDestroy(): void {
    document.body.classList.remove('modal-open');
  }
  protected fuera(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal')) this.modal.cerrar();
  }
  @HostListener('document:keydown.escape')
  protected esc(): void {
    this.modal.cerrar();
  }
}
