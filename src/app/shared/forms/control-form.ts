import { Directive, HostListener, Injector, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Validar } from '../../core/modelos/validar';
import { TIPOS } from './tipos';

/** Se aplica a todo input/select con formControlName:
 *  - marca el campo en rojo cuando es inválido (y la persona ya lo tocó o escribió);
 *  - con appTipo: limita los caracteres que se pueden escribir y fija maxlength, inputmode y rango de fechas. */
@Directive({
  selector: 'input[formControlName],select[formControlName]',
  host: {
    autocomplete: 'off',
    '[class.is-invalid]': 'invalido()',
    '[attr.maxlength]': 'maxlength()',
    '[attr.inputmode]': 'tipoDef()?.inputmode ?? null',
    '[attr.min]': 'tipoDef()?.min ?? null',
    '[attr.max]': 'tipoDef()?.max ?? null',
  },
})
export class ControlForm {
  private readonly inj = inject(Injector);
  readonly appTipo = input<string>();
  /** Límite de caracteres de los campos de texto libre (igual al del modelo). */
  readonly tipoMax = input<number>();

  protected tipoDef() {
    const t = this.appTipo();
    return t ? TIPOS[t] : undefined;
  }
  protected maxlength(): number | null {
    return this.tipoMax() ?? this.tipoDef()?.maxlength ?? null;
  }
  private get control() {
    return this.inj.get(NgControl).control;
  }
  protected invalido(): boolean {
    const c = this.control;
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  @HostListener('input', ['$event'])
  protected alEscribir(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    const filtro = this.tipoDef()?.filtro;
    if (!filtro) return;
    const limpio = Validar.filtrar(filtro, v);
    if (limpio !== v) this.control?.setValue(limpio);
  }
  @HostListener('blur')
  protected alSalir(): void {
    this.control?.markAsTouched();
  }
}
