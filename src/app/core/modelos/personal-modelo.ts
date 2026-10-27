import { Injectable, inject } from '@angular/core';
import { MES3, corte, hoy } from '../utils/fechas';
import { r2 } from '../utils/formato';
import { Almacen } from './almacen';
import { CATEGORIAS, CONTRATOS, Categoria, Contrato, MOTIVOS_CESE, MotivoCese, Obra, Pago, Res, Trabajador } from './tipos';
import { Plazo } from './plazo';
import { UsuarioModelo } from './usuario-modelo';
import { Validar } from './validar';

export interface DatosTrabajador {
  nombre: string;
  dni: string;
  cargo: string;
  cat: string;
  ini: string;
  mensual: string;
  contrato: string;
}

export interface DatosPago {
  w: string | number;
  fecha: string;
  monto: string;
  obs: string;
}

export interface ResumenMes {
  key: string;
  total: number;
  acumulado: number;
  pagos: (Pago & { trabajador: string })[];
}

/** Mano de obra: padrón de trabajadores, ceses y PAGOS registrados (resumen por mes y año).
 *  El gasto de mano de obra NO es avance físico. */
@Injectable({ providedIn: 'root' })
export class PersonalModelo {
  private readonly almacen = inject(Almacen);
  private readonly usuarios = inject(UsuarioModelo);

  todos(o: Obra): Trabajador[] {
    return o.data.workers;
  }
  porId(o: Obra, id: string | number): Trabajador | undefined {
    return o.data.workers.find((w) => String(w.id) === String(id));
  }
  activo(w: Trabajador): boolean {
    return !w.fin || new Date(w.fin + 'T12:00:00') > hoy();
  }
  activos(o: Obra): Trabajador[] {
    return o.data.workers.filter((w) => this.activo(w));
  }
  contarCategoria(o: Obra, cat: Categoria): number {
    return this.activos(o).filter((w) => w.cat === cat).length;
  }
  buscar(o: Obra, q: string): Trabajador[] {
    q = (q || '').trim().toLowerCase();
    return o.data.workers.filter((w) => !q || (w.nombre + ' ' + w.dni + ' ' + w.cargo).toLowerCase().includes(q));
  }
  /** Trabajadores al cierre de cada mes. */
  porMes(o: Obra): { lab: string; n: number }[] {
    const ws = o.data.workers;
    if (!ws.length) return [];
    const primero = ws.map((w) => w.ini.slice(0, 7)).sort()[0];
    return Plazo.meses(o)
      .filter((k) => k >= primero && k <= corte())
      .map((k) => ({ lab: MES3[+k.slice(5, 7) - 1], n: ws.filter((w) => w.ini.slice(0, 7) <= k && (!w.fin || w.fin.slice(0, 7) > k)).length }));
  }

  agregar(o: Obra, d: DatosTrabajador): Res<{ w: Trabajador }> {
    const a = this.usuarios.autorizar('Mano de obra');
    if (!a.ok) return a;
    const err = [
      ['nombre', Validar.nombre(d.nombre)],
      ['dni', Validar.dni(d.dni)],
      ['cargo', Validar.texto(d.cargo, 80)],
      ['cat', (CATEGORIAS as readonly string[]).includes(d.cat) ? '' : 'Selecciona una categoría.'],
      ['ini', Validar.fecha(d.ini)],
      ['contrato', (CONTRATOS as readonly string[]).includes(d.contrato) ? '' : 'Selecciona el tipo de contrato.'],
      ['mensual', Validar.importe(d.mensual, { positivo: true })],
    ].find((r) => r[1]);
    if (err) return { ok: false, campo: err[0], error: err[1] };
    if (o.data.workers.some((w) => w.dni === d.dni.trim())) return { ok: false, campo: 'dni', error: 'Ya existe un trabajador con ese DNI.' };
    const w: Trabajador = {
      id: this.almacen.nuevoId(),
      nombre: d.nombre.trim(),
      dni: d.dni.trim(),
      cargo: d.cargo.trim(),
      cat: d.cat as Categoria,
      ini: d.ini,
      fin: null,
      mensual: Validar.numero(d.mensual),
      contrato: d.contrato as Contrato,
    };
    o.data.workers.push(w);
    this.almacen.cambio();
    return { ok: true, w };
  }

  cesar(o: Obra, id: string | number, fin: string, motivo: string): Res<{ w: Trabajador }> {
    const a = this.usuarios.autorizar('Mano de obra');
    if (!a.ok) return a;
    const w = this.porId(o, id);
    if (!w) return { ok: false, campo: 'w', error: 'Trabajador no encontrado.' };
    const e = Validar.fecha(fin);
    if (e) return { ok: false, campo: 'fin', error: e };
    if (fin < w.ini) return { ok: false, campo: 'fin', error: 'La fecha de cese no puede ser anterior al ingreso.' };
    if (!(MOTIVOS_CESE as readonly string[]).includes(motivo)) return { ok: false, campo: 'motivo', error: 'Selecciona el motivo del cese.' };
    w.fin = fin;
    w.motivo = motivo as MotivoCese;
    this.almacen.cambio();
    return { ok: true, w };
  }

  /* ---- pagos ---- */
  registrarPago(o: Obra, d: DatosPago): Res<{ pago: Pago }> {
    const a = this.usuarios.autorizar('Mano de obra');
    if (!a.ok) return a;
    const w = this.porId(o, d.w);
    const err = [
      ['w', w ? '' : 'Selecciona un trabajador.'],
      ['fecha', Validar.fecha(d.fecha)],
      ['monto', Validar.importe(d.monto, { positivo: true })],
      ['obs', Validar.opc((v) => Validar.texto(v, 200))(d.obs)],
    ].find((r) => r[1]);
    if (err || !w) return { ok: false, campo: err ? err[0] : 'w', error: err ? err[1] : 'Selecciona un trabajador.' };
    const p: Pago = { id: this.almacen.nuevoId(), workerId: w.id, fecha: d.fecha, monto: Validar.numero(d.monto), obs: (d.obs || '').trim() };
    o.data.pagos.push(p);
    this.almacen.cambio();
    return { ok: true, pago: p };
  }
  pagadoTrabajador(o: Obra, w: Trabajador): number {
    return r2(o.data.pagos.filter((p) => p.workerId === w.id).reduce((a, p) => a + p.monto, 0));
  }
  totalPagado(o: Obra): number {
    return r2(o.data.pagos.reduce((a, p) => a + p.monto, 0));
  }
  /** Resumen por mes y año en orden cronológico. */
  resumenMensual(o: Obra): ResumenMes[] {
    const g: Record<string, Pago[]> = {};
    o.data.pagos.forEach((p) => {
      (g[p.fecha.slice(0, 7)] = g[p.fecha.slice(0, 7)] || []).push(p);
    });
    let acum = 0;
    return Object.keys(g)
      .sort()
      .map((k) => {
        const pagos = g[k].slice().sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id));
        const total = r2(pagos.reduce((a, p) => a + p.monto, 0));
        acum = r2(acum + total);
        return { key: k, total, acumulado: acum, pagos: pagos.map((p) => ({ ...p, trabajador: (this.porId(o, p.workerId) || { nombre: '—' }).nombre })) };
      });
  }
}
