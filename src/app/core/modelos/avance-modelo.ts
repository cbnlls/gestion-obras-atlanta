import { Injectable, inject } from '@angular/core';
import { corte, mLabel } from '../utils/fechas';
import { fmt, r2 } from '../utils/formato';
import { Almacen } from './almacen';
import { CalendarioModelo } from './calendario-modelo';
import { Obra, Res, Valorizacion } from './tipos';
import { Plazo } from './plazo';
import { UsuarioModelo } from './usuario-modelo';
import { ValorizacionModelo } from './valorizacion-modelo';
import { Validar } from './validar';

export type ColorEtiqueta = 'blue' | 'green' | 'red' | 'amber' | 'gray';

export interface EstadoPeriodo {
  codigo: 'prog_incompleta' | 'val_aprobada' | 'sin_val' | 'val_pendiente' | 'completo';
  texto: string;
  color: ColorEtiqueta;
}

export interface FilaAvance {
  key: string;
  dias: number;
  n: number;
  /** ¿el usuario escribió el programado de este mes? */
  pDef: boolean;
  planVisible: boolean;
  pm: number;
  pa: number;
  pmPct: number;
  paPct: number;
  em: number | null;
  ea: number | null;
  emPct: number | null;
  eaPct: number | null;
  dif: number | null;
  estado: EstadoPeriodo;
  ref: { valor: number; base: string } | null;
  val: Valorizacion | null;
}

export interface Advertencia {
  tipo: 'danger' | 'warning';
  texto: string;
}

/** Avance físico.
 *  - PROGRAMADO MENSUAL: lo escribe el usuario en esta tabla (o.programacion). El calendario valorizado solo sirve de REFERENCIA.
 *    Nunca se reparte el monto contractual ni se copia nada automáticamente.
 *  - EJECUTADO: valorización BRUTA de la versión APROBADA de cada mes (v.oficial). Nunca el neto por pagar ni una propuesta sin aprobar.
 *  - Base de los porcentajes = monto contractual. DIF. (PTS) = % acumulado ejecutado − % acumulado programado. */
@Injectable({ providedIn: 'root' })
export class AvanceModelo {
  private readonly almacen = inject(Almacen);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly calendario = inject(CalendarioModelo);
  private readonly valorizaciones = inject(ValorizacionModelo);

  hayProgramacion(o: Obra): boolean {
    return Object.values(o.programacion || {}).some((v) => v > 0);
  }

  /** texto: lo que escribió el usuario; vacío = sin programar ese mes; 0 es un valor válido (mes sin trabajos). */
  setProgramado(o: Obra, key: string, texto: string): Res {
    const a = this.usuarios.autorizar('Avance físico');
    if (!a.ok) return a;
    if (this.calendario.bloqueado(o)) return { ok: false, error: 'El calendario está ' + o.calEstado.estado.toLowerCase() + '. Abre una nueva versión para modificarlo.' };
    if (!Plazo.meses(o).includes(key)) return { ok: false, error: 'Ese mes no pertenece al plazo de la obra.' };
    if (!o.programacion) o.programacion = {};
    if (Validar.vacio(texto)) {
      delete o.programacion[key];
      this.almacen.cambio();
      return { ok: true };
    }
    const e = Validar.importe(texto);
    if (e) return { ok: false, error: e };
    o.programacion[key] = r2(Validar.numero(texto));
    this.almacen.cambio();
    return { ok: true };
  }

  /** Estado informativo de un período (no es un error). */
  estadoPeriodo(def: boolean, v: Valorizacion | undefined): EstadoPeriodo {
    const ofi = !!(v && v.oficial);
    if (!def && !ofi) return { codigo: 'prog_incompleta', texto: 'Programación incompleta', color: 'gray' };
    if (!def && ofi) return { codigo: 'val_aprobada', texto: 'Aprobada · falta programar', color: 'amber' };
    if (!v) return { codigo: 'sin_val', texto: 'Sin valorización aprobada', color: 'gray' };
    if (!ofi) {
      const devuelta = v.estado === 'Devuelta';
      return { codigo: 'val_pendiente', texto: devuelta ? 'Valorización devuelta' : 'Valorización pendiente de aprobación', color: devuelta ? 'red' : 'amber' };
    }
    const mod = v.estado === 'Pendiente de revisión' || v.estado === 'Devuelta';
    return { codigo: 'completo', texto: mod ? 'Datos completos · modificación pendiente' : 'Datos completos', color: mod ? 'amber' : 'green' };
  }

  /** Una fila por período del plazo vigente. Siempre devuelve filas (la tabla es donde se escribe el programado). */
  filas(o: Obra): FilaAvance[] {
    const per = Plazo.periodosObra(o);
    const prog = o.programacion || {};
    const vals = this.valorizaciones.todas(o);
    let pa = 0;
    let ea = 0;
    let lastDef = -1;
    per.forEach((p, i) => {
      if (prog[p.key] != null) lastDef = i;
    });
    return per.map((p, i) => {
      const def = prog[p.key] != null;
      const m = def ? prog[p.key] : 0;
      pa = r2(pa + m);
      const v = vals.find((x) => x.key === p.key);
      const em = this.valorizaciones.ejecutado(v);
      if (em != null) ea = r2(ea + em);
      const paPct = o.monto ? (pa / o.monto) * 100 : 0;
      const eaPct = em != null && o.monto ? (ea / o.monto) * 100 : null;
      return {
        key: p.key,
        dias: p.dias,
        n: i + 1,
        pDef: def,
        planVisible: i <= lastDef,
        pm: m,
        pa,
        pmPct: o.monto ? (m / o.monto) * 100 : 0,
        paPct,
        em,
        ea: em != null ? ea : null,
        emPct: em != null && o.monto ? (em / o.monto) * 100 : null,
        eaPct,
        dif: em != null && def ? (eaPct as number) - paPct : null,
        estado: this.estadoPeriodo(def, v),
        ref: this.calendario.referenciaMes(o, p.key),
        val: v || null,
      };
    });
  }

  /** Ejecutado oficial vs programado a la fecha (en %). suficiente = hay programación registrada para comparar. */
  progreso(o: Obra): { ej: number; pr: number; dif: number | null; suficiente: boolean } {
    const rows = this.filas(o);
    const done = [...rows].reverse().find((r) => r.ea != null);
    const suf = this.hayProgramacion(o);
    const ref = done ? done.key : corte();
    const upto = rows.filter((r) => r.key <= ref);
    const ej = done ? (done.eaPct as number) : 0;
    const pr = suf && upto.length ? upto[upto.length - 1].paPct : 0;
    return { ej, pr, dif: suf && done ? ej - pr : null, suficiente: suf };
  }

  /** Aviso REAL: la programación que escribió el usuario supera el monto contractual (no avisa mientras se llena). */
  advertencias(o: Obra): Advertencia[] {
    const rows = this.filas(o);
    const out: Advertencia[] = [];
    const prog = o.programacion || {};
    if (Object.values(prog).some((v) => typeof v !== 'number' || !isFinite(v) || v < 0)) {
      out.push({ tipo: 'danger', texto: 'Hay un monto programado que no es un número válido. Revisa la columna PROG. MENS.' });
      return out;
    }
    const exc = rows.find((r) => r.pa > o.monto + 0.005);
    if (exc)
      out.push({
        tipo: 'danger',
        texto: `La programación acumulada (S/ ${fmt(exc.pa)}) supera el monto contractual (S/ ${fmt(o.monto)}) desde ${mLabel(exc.key)} ${exc.key.slice(0, 4)}: excedente de S/ ${fmt(exc.pa - o.monto)}. Revisa los montos programados hasta ese mes.`,
      });
    return out;
  }
}
