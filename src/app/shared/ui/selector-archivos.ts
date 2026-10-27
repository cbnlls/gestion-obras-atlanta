import { Component, OnDestroy, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ArchivoModelo, TIPOS_ARCHIVO } from '../../core/modelos/archivo-modelo';
import { TipoArchivo } from '../../core/modelos/tipos';
import { Ico } from './ico';

export interface ArchivoElegido {
  file: File;
  ok: boolean;
  tipo?: TipoArchivo;
  error?: string;
  vista?: SafeUrl;
  url?: string;
}

export const AVISO_ARCHIVOS =
  'PDF, JPG o PNG de hasta 10 MB cada uno. Los archivos se guardan en este navegador (no en un servidor): solo estarán disponibles en este equipo y se pierden si se borran los datos del sitio. La revisión del tipo y tamaño que hace el navegador es preliminar y no garantiza que el archivo sea seguro.';

/** Elegir archivos: seleccionar NO guarda; solo se valida y se muestra el resultado (con vista previa de imágenes). */
@Component({
  selector: 'app-selector-archivos',
  imports: [Ico],
  template: `
    <input class="form-control" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" (change)="alSeleccionar($event)" aria-label="Documentos" />
    <div class="small mt-2">
      @if (validando() > 0) {
        <div class="text-body-secondary d-flex align-items-center gap-2" role="status">
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Revisando {{ validando() }} archivo{{ validando() === 1 ? '' : 's' }}…
        </div>
      } @else if (items().length) {
        @for (s of items(); track s.file; let i = $index) {
          <div class="d-flex align-items-start gap-2 py-1 border-bottom">
            @if (s.ok && s.vista) {
              <img [src]="s.vista" [alt]="'Vista previa de ' + s.file.name" class="img-thumbnail flex-shrink-0" style="width:48px;height:48px;object-fit:cover" />
            } @else {
              <span [class]="s.ok ? 'text-success' : 'text-danger'"><app-ico [n]="s.ok ? 'check' : 'x'" [s]="13" /></span>
            }
            <div class="flex-grow-1 text-break">
              <b>{{ s.file.name }}</b>
              <span class="text-body-secondary"> · @if (s.ok && s.tipo) { {{ etiqueta(s.tipo) }} · } {{ archivos.formatoTamano(s.file.size) }}</span>
              @if (!s.ok) {
                <div class="text-danger">{{ s.error }}</div>
              }
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary flex-shrink-0" (click)="quitar(i)" [attr.aria-label]="'Quitar ' + s.file.name + ' de la selección'"><app-ico n="x" [s]="12" /> Quitar</button>
          </div>
        }
        <div class="text-body-secondary mt-1">Seleccionados, aún sin guardar. La revisión del navegador es solo preliminar: el servidor deberá volver a validar cada archivo.</div>
      }
    </div>
    <div class="small text-body-secondary mt-1">{{ aviso }}</div>
  `,
})
export class SelectorArchivos implements OnDestroy {
  protected readonly archivos = inject(ArchivoModelo);
  private readonly san = inject(DomSanitizer);
  protected readonly aviso = AVISO_ARCHIVOS;

  readonly items = signal<ArchivoElegido[]>([]);
  readonly validando = signal(0);
  private trabajo: Promise<void> | null = null;
  private input: HTMLInputElement | null = null;

  protected etiqueta(t: TipoArchivo): string {
    return TIPOS_ARCHIVO[t].etiqueta;
  }

  protected async alSeleccionar(ev: Event): Promise<void> {
    this.input = ev.target as HTMLInputElement;
    const files = [...(this.input.files ?? [])];
    this.liberar();
    this.items.set([]);
    this.validando.set(files.length);
    const trabajo = (async () => {
      const res: ArchivoElegido[] = [];
      for (const f of files) {
        const v = await this.archivos.validar(f);
        const e: ArchivoElegido = { file: f, ok: v.ok, tipo: v.ok ? v.tipo : undefined, error: v.ok ? undefined : v.error };
        if (v.ok && (v.tipo === 'jpg' || v.tipo === 'png')) {
          try {
            e.url = URL.createObjectURL(f);
            e.vista = this.san.bypassSecurityTrustUrl(e.url);
          } catch {
            /* sin vista previa */
          }
        }
        res.push(e);
      }
      this.items.set(res);
      this.validando.set(0);
    })();
    this.trabajo = trabajo;
    await trabajo;
  }

  /** Espera a que termine la revisión de los archivos elegidos. */
  async listo(): Promise<ArchivoElegido[]> {
    if (this.trabajo) {
      await this.trabajo;
      this.trabajo = null;
    }
    return this.items();
  }

  /** Quita un archivo de la selección (todavía no guardado). */
  protected quitar(i: number): void {
    const sel = [...this.items()];
    if (!(i >= 0 && i < sel.length)) return;
    const [q] = sel.splice(i, 1);
    if (q.url) URL.revokeObjectURL(q.url);
    this.items.set(sel);
    if (!sel.length && this.input) this.input.value = ''; // el mismo archivo se puede volver a elegir
  }

  limpiar(): void {
    this.liberar();
    this.items.set([]);
    if (this.input) this.input.value = '';
  }
  private liberar(): void {
    this.items().forEach((s) => s.url && URL.revokeObjectURL(s.url));
  }
  ngOnDestroy(): void {
    this.liberar();
  }
}
