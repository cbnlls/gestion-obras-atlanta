import { Injectable, signal } from '@angular/core';

/** Aviso flotante (toast). */
@Injectable({ providedIn: 'root' })
export class Toast {
  readonly mensaje = signal('');
  readonly visible = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  mostrar(msg: string): void {
    this.mensaje.set(msg);
    this.visible.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.visible.set(false), 2800);
  }
}
