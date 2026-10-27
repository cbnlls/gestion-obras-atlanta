import { Injectable, inject } from '@angular/core';
import { daysTo, hoyIso } from '../utils/fechas';
import { r2 } from '../utils/formato';
import { Almacen } from './almacen';
import { ArchivoModelo } from './archivo-modelo';
import { Carta, DocumentoCarta, EstadoCarta, Obra, Res, TIPOS_CARTA, TipoCarta } from './tipos';
import { UsuarioModelo } from './usuario-modelo';
import { Validar } from './validar';

export interface DatosCarta {
  num: string;
  tipo: string;
  banco: string;
  monto: string;
  emision: string;
  vence: string;
}

/** Cartas de fianza: estados por fecha, alertas de vencimiento, totales y registro/renovación. */
@Injectable({ providedIn: 'root' })
export class CartaModelo {
  private readonly almacen = inject(Almacen);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly archivos = inject(ArchivoModelo);

  /** Se avisa cuando faltan 30 días o menos. */
  readonly DIAS_AVISO = 30;

  todas(o: Obra): Carta[] {
    return o.data.cartas;
  }
  estado(c: Carta): EstadoCarta {
    if (c.sustituida) return 'Sustituida';
    const d = daysTo(c.vence);
    if (d < 0) return 'Vencida';
    if (d <= this.DIAS_AVISO) return 'Por vencer';
    return 'Vigente';
  }
  vigentes(o: Obra): Carta[] {
    return o.data.cartas.filter((c) => ['Vigente', 'Por vencer'].includes(this.estado(c)));
  }
  totalGarantizado(o: Obra): number {
    return r2(this.vigentes(o).reduce((a, c) => a + c.monto, 0));
  }
  proximoVencimiento(o: Obra): string | null {
    const v = [...this.vigentes(o)].sort((a, b) => (a.vence < b.vence ? -1 : 1))[0];
    return v ? v.vence : null;
  }
  /** Carta que requiere atención: vencida primero, luego la que vence más pronto. */
  masUrgente(o: Obra): Carta | null {
    const ord = (a: Carta, b: Carta) => (a.vence < b.vence ? -1 : 1);
    return o.data.cartas.filter((c) => this.estado(c) === 'Vencida').sort(ord)[0] || o.data.cartas.filter((c) => this.estado(c) === 'Por vencer').sort(ord)[0] || null;
  }
  porId(o: Obra, id: string | number): Carta | undefined {
    return o.data.cartas.find((c) => String(c.id) === String(id));
  }

  /** baseId = carta que se sustituye (renovación). Los documentos se agregan después con adjuntar(). */
  registrar(o: Obra, d: DatosCarta, baseId?: string | number): Res<{ c: Carta }> {
    const a = this.usuarios.autorizar('Cartas de fianza');
    if (!a.ok) return a;
    const err = [
      ['num', Validar.codigo(d.num)],
      ['tipo', (TIPOS_CARTA as readonly string[]).includes(d.tipo) ? '' : 'Selecciona un tipo de garantía.'],
      ['banco', Validar.banco(d.banco)],
      ['monto', Validar.importe(d.monto, { positivo: true })],
      ['emision', Validar.fecha(d.emision)],
      ['vence', Validar.fecha(d.vence)],
    ].find((r) => r[1]);
    if (err) return { ok: false, campo: err[0], error: err[1] };
    if (d.vence <= d.emision) return { ok: false, campo: 'vence', error: 'El vencimiento debe ser posterior a la emisión.' };
    let base: Carta | undefined;
    if (baseId) {
      base = this.porId(o, baseId);
      if (!base) return { ok: false, error: 'La carta que se quiere renovar no existe.' };
      if (base.sustituida) return { ok: false, error: 'Esa carta ya fue sustituida por otra; renueva la carta vigente.' };
    }
    if (base) base.sustituida = true;
    const c: Carta = { id: this.almacen.nuevoId(), num: d.num.trim(), tipo: d.tipo as TipoCarta, banco: d.banco.trim(), monto: Validar.numero(d.monto), emision: d.emision, vence: d.vence, docs: [] };
    o.data.cartas.push(c);
    this.almacen.cambio();
    return { ok: true, c };
  }

  /* ---- documentos adjuntos ---- */
  documentos(c: Carta): DocumentoCarta[] {
    return c.docs || [];
  }
  /** Valida y guarda cada archivo (contenido en IndexedDB) y lo asocia a la carta. Un archivo que falla NO se asocia. */
  async adjuntar(o: Obra, cartaId: string | number, archivos: File[]): Promise<{ guardados: DocumentoCarta[]; errores: { nombre: string; error: string }[] }> {
    const a = this.usuarios.autorizar('Cartas de fianza');
    if (!a.ok) return { guardados: [], errores: [{ nombre: '', error: a.error }] };
    const c = this.porId(o, cartaId);
    if (!c) return { guardados: [], errores: [{ nombre: '', error: 'Carta no encontrada.' }] };
    if (!Array.isArray(c.docs)) c.docs = [];
    const guardados: DocumentoCarta[] = [];
    const errores: { nombre: string; error: string }[] = [];
    const s = this.usuarios.sesion();
    for (const f of archivos) {
      const r = await this.archivos.guardar(f);
      if (!r.ok) {
        errores.push({ nombre: f.name, error: r.error });
        continue;
      }
      const d: DocumentoCarta = { id: r.id, nombre: r.nombre, tipo: r.tipo, tamano: r.tamano, fecha: hoyIso(), usuario: s.nombre || '—' };
      c.docs.push(d);
      guardados.push(d);
    }
    this.almacen.cambio();
    return { guardados, errores };
  }
  /** Contenido original de un documento (para ver o descargar). */
  async abrirDocumento(o: Obra, cartaId: string | number, docId: string | number) {
    const a = this.usuarios.autorizar('Cartas de fianza', 'ver');
    if (!a.ok) return a;
    const c = this.porId(o, cartaId);
    const d = c && this.documentos(c).find((x) => String(x.id) === String(docId));
    if (!d) return { ok: false as const, error: 'Documento no encontrado en la carta.' };
    return this.archivos.obtener(d.id);
  }
}
