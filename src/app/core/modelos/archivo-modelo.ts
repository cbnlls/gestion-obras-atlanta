import { Injectable, inject } from '@angular/core';
import { Almacen } from './almacen';
import { TipoArchivo } from './tipos';

export const TIPOS_ARCHIVO: Record<TipoArchivo, { etiqueta: string; ext: string[]; mimes: string[]; firma: number[] }> = {
  pdf: { etiqueta: 'PDF', ext: ['pdf'], mimes: ['application/pdf'], firma: [0x25, 0x50, 0x44, 0x46] },
  jpg: { etiqueta: 'JPG', ext: ['jpg', 'jpeg'], mimes: ['image/jpeg'], firma: [0xff, 0xd8, 0xff] },
  png: { etiqueta: 'PNG', ext: ['png'], mimes: ['image/png'], firma: [0x89, 0x50, 0x4e, 0x47] },
};

export type ResValidacion = { ok: true; tipo: TipoArchivo } | { ok: false; error: string };

/** Archivos adjuntos (documentos de las cartas de fianza).
 *  DÓNDE SE GUARDAN: en IndexedDB del navegador, con el contenido original. Los datos del documento (nombre, tipo, tamaño,
 *  fecha) se guardan en la carta; el contenido, aquí. LIMITACIÓN: el archivo queda SOLO en este navegador y equipo.
 *  PUNTO DE MIGRACIÓN A SUPABASE: guardar() y obtener() pasan a usar Supabase Storage. */
@Injectable({ providedIn: 'root' })
export class ArchivoModelo {
  private readonly almacen = inject(Almacen);
  readonly DB = 'gestionObras.ng.archivos';
  readonly STORE = 'archivos';
  /** 10 MB por archivo. */
  readonly MAX_BYTES = 10 * 1024 * 1024;

  disponible(): boolean {
    try {
      return typeof indexedDB !== 'undefined' && !!indexedDB;
    } catch {
      return false;
    }
  }
  formatoTamano(b: number): string {
    return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB';
  }
  private tipoPorExt(nombre: string): TipoArchivo | null {
    const i = nombre.lastIndexOf('.');
    const e = i < 0 ? '' : nombre.slice(i + 1).toLowerCase();
    return (Object.keys(TIPOS_ARCHIVO) as TipoArchivo[]).find((k) => TIPOS_ARCHIVO[k].ext.includes(e)) || null;
  }
  private leer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as ArrayBuffer);
      r.onerror = () => rej(new Error('No se pudo leer el archivo.'));
      r.readAsArrayBuffer(blob);
    });
  }

  /** Valida extensión, tamaño, tipo MIME y contenido real. */
  async validar(file: File): Promise<ResValidacion> {
    const n = file && file.name ? file.name : '(sin nombre)';
    const tipo = this.tipoPorExt(n);
    if (!tipo) return { ok: false, error: `«${n}»: solo se permiten archivos PDF, JPG o PNG.` };
    if (!(file.size > 0)) return { ok: false, error: `«${n}» está vacío.` };
    if (file.size > this.MAX_BYTES) return { ok: false, error: `«${n}» pesa ${this.formatoTamano(file.size)} y el máximo permitido es ${this.formatoTamano(this.MAX_BYTES)}.` };
    const T = TIPOS_ARCHIVO[tipo];
    if (file.type && !T.mimes.includes(file.type)) return { ok: false, error: `«${n}»: el tipo del archivo (${file.type}) no corresponde a su extensión.` };
    try {
      const cab = new Uint8Array(await this.leer(file.slice(0, 8)));
      if (!T.firma.every((b, i) => cab[i] === b)) return { ok: false, error: `«${n}»: el contenido no es un ${T.etiqueta} válido (el archivo puede estar dañado o tener otra extensión).` };
    } catch {
      return { ok: false, error: `«${n}»: no se pudo leer el archivo.` };
    }
    return { ok: true, tipo };
  }

  private abrir(): Promise<IDBDatabase> {
    return new Promise((res, rej) => {
      let q: IDBOpenDBRequest;
      try {
        q = indexedDB.open(this.DB, 1);
      } catch {
        rej(new Error('No se pudo abrir el almacén de archivos del navegador.'));
        return;
      }
      q.onupgradeneeded = () => {
        if (!q.result.objectStoreNames.contains(this.STORE)) q.result.createObjectStore(this.STORE, { keyPath: 'id' });
      };
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(new Error('No se pudo abrir el almacén de archivos del navegador.'));
    });
  }
  private tx<T>(modo: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
    return this.abrir().then(
      (db) =>
        new Promise<T | undefined>((res, rej) => {
          const t = db.transaction(this.STORE, modo);
          let out: T | undefined;
          const rq = fn(t.objectStore(this.STORE));
          if (rq) rq.onsuccess = () => (out = rq.result as T);
          t.oncomplete = () => {
            db.close();
            res(out);
          };
          t.onabort = t.onerror = () => {
            const e = t.error;
            db.close();
            rej(e && e.name === 'QuotaExceededError' ? new Error('QUOTA') : e || new Error('Error al escribir en el navegador.'));
          };
        }),
    );
  }

  /** Guarda el contenido original. */
  async guardar(file: File): Promise<{ ok: true; id: number; nombre: string; tipo: TipoArchivo; tamano: number } | { ok: false; error: string }> {
    if (!this.disponible()) return { ok: false, error: 'Este navegador no permite guardar archivos (IndexedDB no está disponible). El documento NO se guardó.' };
    const v = await this.validar(file);
    if (!v.ok) return v;
    try {
      const buffer = await this.leer(file);
      const id = this.almacen.nuevoId();
      await this.tx('readwrite', (st) => st.put({ id, nombre: file.name, mime: file.type || TIPOS_ARCHIVO[v.tipo].mimes[0], tamano: file.size, buffer }));
      return { ok: true, id, nombre: file.name, tipo: v.tipo, tamano: file.size };
    } catch (e) {
      const msg = (e as Error).message;
      return { ok: false, error: msg === 'QUOTA' ? `No hay espacio suficiente en el navegador para guardar «${file.name}». Libera espacio o usa un archivo más pequeño.` : `No se pudo guardar «${file.name}»: ${msg}` };
    }
  }

  /** Devuelve el archivo original. */
  async obtener(id: number): Promise<{ ok: true; blob: Blob; nombre: string } | { ok: false; error: string }> {
    if (!this.disponible()) return { ok: false, error: 'Este navegador no permite leer los archivos guardados.' };
    try {
      const r = await this.tx<{ buffer: ArrayBuffer; mime: string; nombre: string }>('readonly', (st) => st.get(id));
      if (!r) return { ok: false, error: 'El archivo no está en este navegador (se guardó en otro equipo o se borraron los datos del sitio).' };
      return { ok: true, blob: new Blob([r.buffer], { type: r.mime }), nombre: r.nombre };
    } catch (e) {
      return { ok: false, error: 'No se pudo leer el archivo guardado: ' + (e as Error).message };
    }
  }
}
