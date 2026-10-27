import { Injectable, signal } from '@angular/core';

/** Tema claro/oscuro automático según el sistema. */
@Injectable({ providedIn: 'root' })
export class Tema {
  readonly oscuro = signal(false);

  iniciar(): void {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => {
      this.oscuro.set(mq.matches);
      document.documentElement.setAttribute('data-bs-theme', mq.matches ? 'dark' : 'light');
    };
    aplicar();
    mq.addEventListener?.('change', aplicar);
  }
}
