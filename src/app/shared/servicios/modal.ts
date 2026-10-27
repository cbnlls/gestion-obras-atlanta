import { Injectable, Type, signal } from '@angular/core';

export interface ModalActivo {
  componente: Type<unknown>;
  inputs: Record<string, unknown>;
}

/** Un solo formulario modal abierto a la vez. abrir() devuelve lo que el formulario entregue al cerrarse. */
@Injectable({ providedIn: 'root' })
export class ModalServicio {
  readonly actual = signal<ModalActivo | null>(null);
  private resolver?: (v: unknown) => void;

  abrir<T = unknown>(componente: Type<unknown>, inputs: Record<string, unknown> = {}): Promise<T | undefined> {
    this.cerrar();
    return new Promise((res) => {
      this.resolver = res as (v: unknown) => void;
      this.actual.set({ componente, inputs });
    });
  }
  /** Parámetro con que se abrió el formulario actual (los formularios lo leen al crearse). */
  param<T>(nombre: string): T | undefined {
    return this.actual()?.inputs[nombre] as T | undefined;
  }
  cerrar(valor?: unknown): void {
    const r = this.resolver;
    this.resolver = undefined;
    this.actual.set(null);
    r?.(valor);
  }
}
