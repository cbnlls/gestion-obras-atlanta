import { Injectable, TemplateRef, signal } from '@angular/core';

/** Título, subtítulo y botones de acción de la barra superior; cada pantalla los fija al abrirse. */
@Injectable({ providedIn: 'root' })
export class Topbar {
  readonly titulo = signal('');
  readonly sub = signal('');
  readonly acciones = signal<TemplateRef<unknown> | null>(null);

  fijar(titulo: string, sub: string, acciones?: TemplateRef<unknown> | null): void {
    this.titulo.set(titulo);
    this.sub.set(sub);
    this.acciones.set(acciones ?? null);
  }
}
