import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Almacen } from '../core/modelos/almacen';
import { ArchivoModelo, TIPOS_ARCHIVO } from '../core/modelos/archivo-modelo';
import { CartaModelo } from '../core/modelos/carta-modelo';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { DocumentoCarta } from '../core/modelos/tipos';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { fdate } from '../core/utils/formato';
import { abrirBlob } from '../core/utils/descargas';
import { ModalMarco } from '../shared/ui/modal';
import { Ico } from '../shared/ui/ico';
import { SelectorArchivos } from '../shared/ui/selector-archivos';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

/** Documentos de una carta de fianza: consultar, descargar y (con permiso) agregar.
 *  Seleccionar un archivo NO lo guarda: solo se guarda al pulsar «Guardar documentos» y pasar la validación. */
@Component({
  selector: 'app-modal-documentos',
  imports: [ModalMarco, Ico, SelectorArchivos],
  template: `
    <app-modal [titulo]="'Documentos · carta N.º ' + (vm()?.carta?.num ?? '') + ' (' + (vm()?.carta?.tipo ?? '') + ')'" ancho>
      @if (vm(); as v) {
        @if (v.docs.length) {
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0 tabla">
              <thead><tr><th>Archivo</th><th>Tipo</th><th class="text-end">Tamaño</th><th>Agregado</th><th class="text-end">Acciones</th></tr></thead>
              <tbody>
                @for (d of v.docs; track d.id) {
                  <tr>
                    <td class="text-break"><app-ico n="file" [s]="12" /> {{ d.nombre }}</td>
                    <td>{{ etiqueta(d) }}</td>
                    <td class="text-end font-monospace">{{ archivos.formatoTamano(d.tamano) }}</td>
                    <td class="small text-body-secondary">{{ fdate(d.fecha) }} · {{ d.usuario || '—' }}</td>
                    <td class="text-end text-nowrap">
                      <button class="btn btn-sm btn-outline-secondary" (click)="abrir(d, false)">Ver</button>
                      <button class="btn btn-sm btn-outline-secondary ms-1" (click)="abrir(d, true)"><app-ico n="down" [s]="12" /> Descargar</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="text-body-secondary py-2">Esta carta todavía no tiene documentos guardados.</div>
        }
        @if (v.puedeEditar) {
          <hr />
          <div class="etiqueta mb-2">Agregar documentos</div>
          <app-selector-archivos />
        }
      }
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cerrar</button>
        @if (vm()?.puedeEditar) {
          <button type="button" class="btn btn-warning" [disabled]="ocupado()" [attr.aria-busy]="ocupado()" (click)="guardar()">
            @if (ocupado()) {
              <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Guardando…
            } @else {
              Guardar documentos
            }
          </button>
        }
      </div>
    </app-modal>
  `,
})
export class ModalDocumentos {
  protected readonly modal = inject(ModalServicio);
  protected readonly archivos = inject(ArchivoModelo);
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  private readonly cartas = inject(CartaModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly toast = inject(Toast);
  protected readonly fdate = fdate;
  private readonly cartaId = this.modal.param<number>('cartaId') ?? 0;
  private readonly selector = viewChild(SelectorArchivos);
  protected readonly ocupado = signal(false);

  protected readonly vm = computed(() => {
    this.almacen.rev();
    const o = this.obras.activa();
    const carta = o ? this.cartas.porId(o, this.cartaId) : undefined;
    if (!carta) return null;
    return { carta, docs: this.cartas.documentos(carta), puedeEditar: this.usuarios.puede('Cartas de fianza', 'editar') };
  });

  protected etiqueta(d: DocumentoCarta): string {
    return TIPOS_ARCHIVO[d.tipo]?.etiqueta ?? d.tipo;
  }

  /** Ver (se abre en otra pestaña) o descargar el archivo ORIGINAL. */
  protected async abrir(d: DocumentoCarta, descargar: boolean): Promise<void> {
    const o = this.obras.activa();
    if (!o) return;
    const r = await this.cartas.abrirDocumento(o, this.cartaId, d.id);
    if (!r.ok) {
      this.toast.mostrar(r.error);
      return;
    }
    abrirBlob(r.blob, r.nombre, descargar);
  }

  protected async guardar(): Promise<void> {
    const sel0 = this.selector();
    const o = this.obras.activa();
    if (this.ocupado() || !sel0 || !o) return;
    this.ocupado.set(true);
    try {
      const sel = await sel0.listo();
      if (!sel.length) {
        this.toast.mostrar('Selecciona al menos un archivo.');
        return;
      }
      const malos = sel.filter((s) => !s.ok);
      if (malos.length) {
        this.toast.mostrar(`Hay ${malos.length} archivo(s) no válidos: ${malos[0].error}`);
        return;
      }
      const g = await this.cartas.adjuntar(o, this.cartaId, sel.map((s) => s.file));
      sel0.limpiar(); // la lista de documentos se actualiza sola
      if (g.errores.length) this.toast.mostrar(`Documentos: ${g.errores.length} documento(s) no se guardaron. ${g.errores[0].error}`);
      else if (g.guardados.length) this.toast.mostrar(`${g.guardados.length} documento(s) guardado(s) en este navegador`);
    } finally {
      this.ocupado.set(false);
    }
  }
}
