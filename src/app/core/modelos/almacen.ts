import { Injectable, signal } from '@angular/core';
import { Obra, Permisos, Sesion, Usuario } from './tipos';

/** Único usuario con el que se puede entrar mientras no exista la base de datos (Supabase). */
export const ADMIN_INICIAL: Usuario = {
  id: 1,
  nombre: 'Administrador',
  user: 'admin',
  mail: 'admin@gmail.com',
  rol: 'Administrador',
  obras: 'all',
  activo: true,
};

const PERMISOS_INICIALES = (): Permisos => ({
  'Ficha técnica': ['E', 'V', 'V', 'V'],
  Valorizaciones: ['E', 'E', 'E', 'V'],
  'Avance físico': ['E', 'E', 'V', 'V'],
  'Calendario de obra': ['E', 'E', 'V', 'V'],
  'Aprobar calendario': ['E', 'N', 'E', 'N'],
  'Mano de obra': ['E', 'E', 'V', 'N'],
  'Cartas de fianza': ['E', 'V', 'V', 'N'],
  'Usuarios y roles': ['E', 'N', 'N', 'N'],
});

const esObjeto = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * Almacén de datos: único lugar donde viven los datos.
 * Hoy se guardan en el navegador (localStorage) para que no se pierdan al recargar; si localStorage no está
 * disponible, funciona solo en memoria.
 *
 * PUNTO DE MIGRACIÓN A SUPABASE: cargar() y guardar() son lo único que habla con el almacenamiento.
 * Los modelos (obra, valorización, etc.) solo leen y modifican estos arreglos y llaman a cambio().
 */
@Injectable({ providedIn: 'root' })
export class Almacen {
  static readonly VERSION = 1;
  static readonly CLAVE = 'gestionObras.ng.datos';

  /** false = solo memoria (pruebas). */
  persistir = true;

  obras: Obra[] = [];
  usuarios: Usuario[] = [{ ...ADMIN_INICIAL }];
  obraActivaId: number | null = null;
  sesion: Sesion = { nombre: '', rol: null, userId: null };
  permisos: Permisos = PERMISOS_INICIALES();

  errorCarga = false;
  errorGuardado = false;

  /** Cambia cada vez que se modifican datos: las pantallas la leen para volver a calcularse. */
  private readonly _rev = signal(0);
  readonly rev = this._rev.asReadonly();

  private _seq = 0;
  /** Identificador único y creciente (Date.now() solo no basta: dos registros en el mismo milisegundo repetirían el id). */
  nuevoId(): number {
    this._seq = Math.max(this._seq + 1, Date.now());
    return this._seq;
  }

  /** Avisa que los datos cambiaron: los guarda y vuelve a calcular las pantallas. */
  cambio(): void {
    this.guardar();
    this._rev.update((n) => n + 1);
  }
  /** Vuelve a calcular las pantallas sin guardar (cambio de sesión, cambio de día). */
  refrescar(): void {
    this._rev.update((n) => n + 1);
  }

  /** Completa los campos que falten en una obra leída del almacenamiento (datos dañados o incompletos). */
  normalizarObra(o: Obra): Obra {
    if (o.rucEntidad == null) o.rucEntidad = '';
    if (!Array.isArray(o.ampliaciones)) o.ampliaciones = [];
    if (!esObjeto(o.data)) (o as any).data = {};
    for (const k of ['vals', 'cal', 'workers', 'pagos', 'cartas'] as const) {
      if (!Array.isArray((o.data as any)[k])) (o.data as any)[k] = [];
    }
    o.data.cartas.forEach((c) => {
      if (!Array.isArray(c.docs)) c.docs = [];
    });
    o.data.vals.forEach((v) => {
      if (!Array.isArray(v.historial)) v.historial = [];
    });
    if (!esObjeto(o.programacion)) o.programacion = {};
    if (!esObjeto(o.calEstado)) o.calEstado = { estado: 'Borrador', version: 1, historial: [] };
    return o;
  }

  /** Restaura lo guardado ignorando entradas malformadas (no son objetos, permisos con valores desconocidos) en lugar de fallar.
   *  El rol Administrador (columna 0) siempre conserva «Editar»: es la regla del sistema y evita que un dato dañado bloquee a todos. */
  restaurar(d: unknown): void {
    const datos: Record<string, any> = esObjeto(d) ? d : {};
    this.obras = (Array.isArray(datos['obras']) ? datos['obras'] : []).filter(esObjeto).map((o) => this.normalizarObra(o as Obra));
    const usuarios = (Array.isArray(datos['usuarios']) ? datos['usuarios'] : []).filter(esObjeto) as Usuario[];
    this.usuarios = usuarios.length ? usuarios : [{ ...ADMIN_INICIAL }];
    this.obraActivaId = datos['obraActivaId'] == null ? null : datos['obraActivaId'];
    this.permisos = PERMISOS_INICIALES();
    if (esObjeto(datos['permisos'])) {
      (Object.keys(this.permisos) as (keyof Permisos)[]).forEach((m) => {
        const p = datos['permisos'][m];
        if (Array.isArray(p) && p.length === 4 && p.every((x) => ['E', 'V', 'N'].includes(x))) this.permisos[m] = ['E', p[1], p[2], p[3]];
      });
    }
  }

  /** Deja el almacén como recién instalado (solo el administrador inicial y ninguna obra). */
  reiniciar(): void {
    this.restaurar(null);
    this.sesion = { nombre: '', rol: null, userId: null };
    this.refrescar();
  }

  /** Si lo guardado no se puede leer, NO se descarta en silencio: se conserva una copia en CLAVE+'.respaldo'
   *  (el siguiente guardado reemplazaría el original) y se marca errorCarga para avisar a la persona. */
  cargar(): boolean {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(Almacen.CLAVE);
      if (!raw) return false;
      this.restaurar(JSON.parse(raw));
      return true;
    } catch {
      this.errorCarga = true;
      try {
        if (raw) localStorage.setItem(Almacen.CLAVE + '.respaldo', raw);
      } catch {
        /* sin espacio: no hay nada más que hacer */
      }
      return false;
    }
  }

  guardar(): boolean {
    if (!this.persistir) return false;
    try {
      localStorage.setItem(
        Almacen.CLAVE,
        JSON.stringify({ version: Almacen.VERSION, obras: this.obras, usuarios: this.usuarios, obraActivaId: this.obraActivaId, permisos: this.permisos }),
      );
      this.errorGuardado = false;
      return true;
    } catch {
      this.errorGuardado = true;
      return false;
    }
  }
}
