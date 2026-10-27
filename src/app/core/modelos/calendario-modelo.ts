import { Injectable, inject } from '@angular/core';
import { hoyIso, mShort, pad2 } from '../utils/fechas';
import { fmt, r2 } from '../utils/formato';
import { Almacen } from './almacen';
import { CalendarioEstado, EstadoPartida, ItemCalendario, Obra, Partida, Res } from './tipos';
import { Plazo } from './plazo';
import { UsuarioModelo } from './usuario-modelo';
import { MAX_IMPORTE, Validar } from './validar';

/** Textos del formulario «Agregar ítem». */
export interface DatosItem {
  tipo: string;
  cap: string;
  subc: string;
  desc: string;
  und: string;
  metrado: string;
  pu: string;
}

export interface EstadoDePartida {
  estado: EstadoPartida;
  parcial: number;
  programado: number;
  diferencia: number;
  pct: number;
  fueraDePlazo: string[];
}

export interface ProblemaCalendario {
  tipo: 'dato' | 'plazo' | 'excede';
  codigo: string;
  texto: string;
}

/** Calendario valorizado: capítulos (cap), subcapítulos (sub) y partidas de detalle (par).
 *  - El PARCIAL de una partida = metrado × precio unitario (sin IGV).
 *  - Cada partida guarda months:{'AAAA-MM':monto} con lo que el usuario programa para cada mes.
 *    Nunca se reparte nada automáticamente entre los meses ni se modifica lo que el usuario escribió.
 *  - Capítulos y subcapítulos solo SUMAN sus partidas de detalle (no tienen importes propios). */
@Injectable({ providedIn: 'root' })
export class CalendarioModelo {
  private readonly almacen = inject(Almacen);
  private readonly usuarios = inject(UsuarioModelo);

  readonly UNIDADES = ['m', 'm²', 'm³', 'kg', 't', 'und', 'glb', 'pza', 'jgo', 'hh', 'hm', 'día', 'mes', 'sem', 'lote', 'servicio'];
  /** Tolerancia de un centavo por redondeo. */
  readonly TOL = 0.01;

  items(o: Obra): ItemCalendario[] {
    return o.data.cal;
  }
  partidas(o: Obra): Partida[] {
    return o.data.cal.filter((r): r is Partida => r.type === 'par');
  }
  capitulos(o: Obra): ItemCalendario[] {
    return o.data.cal.filter((r) => r.type === 'cap');
  }
  subcapitulos(o: Obra, capCode: string): ItemCalendario[] {
    return o.data.cal.filter((r) => r.type === 'sub' && r.code.startsWith(capCode + '.'));
  }
  parcial(r: Partida): number {
    return r2(r.metrado * r.pu);
  }
  programadoMes(o: Obra, k: string): number {
    let m = 0;
    this.partidas(o).forEach((r) => {
      m += r.months[k] || 0;
    });
    return r2(m);
  }

  /** Subtotal de un capítulo o subcapítulo: suma SOLO las partidas de detalle que cuelgan de él. */
  subtotalesDe(o: Obra, code: string, ms: string[]): { parcial: number; porMes: Record<string, number> } {
    const porMes: Record<string, number> = {};
    let parcial = 0;
    this.partidas(o)
      .filter((r) => r.code.startsWith(code + '.'))
      .forEach((r) => {
        parcial += this.parcial(r);
        ms.forEach((k) => {
          porMes[k] = (porMes[k] || 0) + (r.months[k] || 0);
        });
      });
    ms.forEach((k) => {
      porMes[k] = r2(porMes[k] || 0);
    });
    return { parcial: r2(parcial), porMes };
  }

  /** Estado de la programación de una partida (para avisos claros):
   *  sin_programar: aún no tiene montos · incompleta: se está llenando (no es un error) · completa: cuadra con su parcial ·
   *  excede: lo programado supera el parcial (problema real). */
  estadoPartida(o: Obra, r: Partida, ms?: string[]): EstadoDePartida {
    ms = ms || Plazo.meses(o);
    const parcial = this.parcial(r);
    const prog = r2(ms.reduce((a, k) => a + (r.months[k] || 0), 0));
    const fuera = Object.keys(r.months).filter((k) => !ms!.includes(k));
    let estado: EstadoPartida = 'completa';
    if (prog === 0) estado = 'sin_programar';
    else if (prog < parcial - this.TOL) estado = 'incompleta';
    else if (prog > parcial + this.TOL) estado = 'excede';
    return { estado, parcial, programado: prog, diferencia: r2(prog - parcial), pct: parcial > 0 ? (prog / parcial) * 100 : 0, fueraDePlazo: fuera };
  }

  /** Revisa la integridad de los datos ANTES de avisar de nada: números válidos, códigos únicos, meses dentro del plazo.
   *  Los problemas son solo errores reales; el avance normal del llenado no genera ninguno. */
  diagnostico(o: Obra): { resumen: { total: number; completas: number; incompletas: number; sinProgramar: number; excedidas: number }; problemas: ProblemaCalendario[] } {
    const ms = Plazo.meses(o);
    const ps = this.partidas(o);
    const problemas: ProblemaCalendario[] = [];
    const esNum = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
    const vistos: Record<string, boolean> = {};
    this.items(o).forEach((r) => {
      if (vistos[r.code]) problemas.push({ tipo: 'dato', codigo: r.code, texto: `El código ${r.code} está repetido. Revisa los ítems del calendario.` });
      vistos[r.code] = true;
    });
    const res = { total: ps.length, completas: 0, incompletas: 0, sinProgramar: 0, excedidas: 0 };
    ps.forEach((r) => {
      const d = r.desc;
      if (!esNum(r.metrado) || !esNum(r.pu) || r.metrado < 0 || r.pu < 0 || Object.values(r.months).some((x) => !esNum(x) || x < 0)) {
        problemas.push({ tipo: 'dato', codigo: r.code, texto: `Partida ${r.code} «${d}»: tiene un metrado, precio unitario o monto mensual que no es un número válido. Revisa esos datos.` });
        return;
      }
      const e = this.estadoPartida(o, r, ms);
      if (e.fueraDePlazo.length)
        problemas.push({ tipo: 'plazo', codigo: r.code, texto: `Partida ${r.code} «${d}»: tiene monto en ${e.fueraDePlazo.map((k) => mShort(k)).join(', ')}, fuera de los meses del plazo vigente. Revisa o vuelve a registrar ese monto.` });
      if (e.estado === 'excede') {
        res.excedidas++;
        problemas.push({ tipo: 'excede', codigo: r.code, texto: `Partida ${r.code} «${d}»: lo programado (S/ ${fmt(e.programado)}) supera su parcial (S/ ${fmt(e.parcial)}) en S/ ${fmt(e.diferencia)}. Revisa los montos mensuales, el metrado o el P.U.` });
      } else if (e.estado === 'completa') res.completas++;
      else if (e.estado === 'incompleta') res.incompletas++;
      else res.sinProgramar++;
    });
    return { resumen: res, problemas };
  }

  /** Pagado a personal en el mes = suma de los pagos registrados en Mano de obra cuya fecha cae en ese mes. */
  pagadoPersonal(o: Obra, k: string): number {
    return r2(o.data.pagos.filter((p) => p.fecha && p.fecha.slice(0, 7) === k).reduce((a, p) => a + (Number(p.monto) || 0), 0));
  }

  /** Referencia mensual del calendario para quien registra la programación en Avance físico (costo directo del mes).
   *  Devuelve null si el mes no tiene montos o no pertenece al plazo. */
  referenciaMes(o: Obra, key: string): { valor: number; base: string } | null {
    if (!Plazo.meses(o).includes(key)) return null;
    const v = this.programadoMes(o, key);
    return v > 0 ? { valor: v, base: 'costo directo' } : null;
  }

  /* ---- ciclo de aprobación: Borrador → Presentado → Aprobado. Un calendario aprobado queda bloqueado (línea base) ---- */
  estado(o: Obra): CalendarioEstado {
    return o.calEstado;
  }
  bloqueado(o: Obra): boolean {
    return o.calEstado.estado !== 'Borrador';
  }
  private msgBloqueado(o: Obra): string {
    return 'El calendario está ' + o.calEstado.estado.toLowerCase() + '. Abre una nueva versión para modificarlo.';
  }
  private log(o: Obra, accion: string, comentario?: string): void {
    const s = o.calEstado;
    const d = new Date();
    s.historial.push({
      id: this.almacen.nuevoId(),
      fecha: hoyIso(),
      hora: pad2(d.getHours()) + ':' + pad2(d.getMinutes()),
      usuario: this.usuarios.sesion().nombre || '—',
      rol: this.almacen.sesion.rol || '—',
      accion,
      version: s.version,
      comentario: comentario || '',
    });
  }
  presentar(o: Obra): Res {
    const a = this.usuarios.autorizar('Calendario de obra');
    if (!a.ok) return a;
    const s = o.calEstado;
    if (s.estado !== 'Borrador') return { ok: false, error: 'Solo un calendario en borrador se puede presentar.' };
    if (!this.partidas(o).length && !Object.keys(o.programacion || {}).length) return { ok: false, error: 'Agrega partidas o montos mensuales antes de presentar el calendario.' };
    s.estado = 'Presentado';
    this.log(o, 'Calendario presentado');
    this.almacen.cambio();
    return { ok: true };
  }
  aprobar(o: Obra): Res {
    const a = this.usuarios.autorizar('Aprobar calendario');
    if (!a.ok) return a;
    const s = o.calEstado;
    if (s.estado !== 'Presentado') return { ok: false, error: 'Solo un calendario presentado se puede aprobar.' };
    s.estado = 'Aprobado';
    s.lineaBase = {
      fecha: hoyIso(),
      version: s.version,
      plazo: Plazo.plazoVigente(o),
      usuario: this.usuarios.sesion().nombre || '—',
      datos: JSON.parse(JSON.stringify({ cal: o.data.cal, prog: o.programacion || {} })),
    };
    this.log(o, 'Calendario aprobado (línea base)');
    this.almacen.cambio();
    return { ok: true };
  }
  observar(o: Obra, motivo: string): Res {
    const a = this.usuarios.autorizar('Aprobar calendario');
    if (!a.ok) return a;
    const s = o.calEstado;
    if (s.estado !== 'Presentado') return { ok: false, error: 'Solo un calendario presentado se puede observar.' };
    if (!motivo || motivo.trim().length < 5) return { ok: false, error: 'Escribe el motivo de la observación (mínimo 5 caracteres).' };
    s.estado = 'Borrador';
    this.log(o, 'Calendario observado', motivo.trim());
    this.almacen.cambio();
    return { ok: true };
  }
  nuevaVersion(o: Obra, motivo: string): Res {
    const a = this.usuarios.autorizar('Calendario de obra');
    if (!a.ok) return a;
    const s = o.calEstado;
    if (s.estado !== 'Aprobado') return { ok: false, error: 'Solo se puede abrir una nueva versión de un calendario aprobado.' };
    if (!motivo || motivo.trim().length < 5) return { ok: false, error: 'Escribe el motivo del cambio (mínimo 5 caracteres).' };
    s.version += 1;
    s.estado = 'Borrador';
    this.log(o, 'Nueva versión (reprogramación)', motivo.trim());
    this.almacen.cambio();
    return { ok: true };
  }

  /** texto = lo que escribió el usuario; vacío borra el monto del mes. */
  setMonto(o: Obra, code: string, key: string, texto: string): Res {
    const a = this.usuarios.autorizar('Calendario de obra');
    if (!a.ok) return a;
    if (this.bloqueado(o)) return { ok: false, error: this.msgBloqueado(o) };
    const r = this.partidas(o).find((x) => x.code === code);
    if (!r) return { ok: false, error: 'Partida no encontrada.' };
    if (!Plazo.meses(o).includes(key)) return { ok: false, error: 'Ese mes no pertenece al plazo de la obra.' };
    if (Validar.vacio(texto)) {
      delete r.months[key];
      this.almacen.cambio();
      return { ok: true };
    }
    const e = Validar.importe(texto);
    if (e) return { ok: false, error: e };
    const v = Validar.numero(texto);
    if (v > 0) r.months[key] = r2(v);
    else delete r.months[key];
    this.almacen.cambio();
    return { ok: true };
  }

  agregarItem(o: Obra, d: DatosItem): Res {
    const a = this.usuarios.autorizar('Calendario de obra');
    if (!a.ok) return a;
    if (this.bloqueado(o)) return { ok: false, error: this.msgBloqueado(o) };
    const cal = o.data.cal;
    const reglas: [string, string][] = [
      ['tipo', ['cap', 'sub', 'par'].includes(d.tipo) ? '' : 'Selecciona un tipo de ítem.'],
      ['desc', Validar.texto(d.desc, 200)],
    ];
    if (d.tipo !== 'cap') reglas.push(['cap', cal.some((r) => r.type === 'cap' && r.code === d.cap) ? '' : 'Selecciona un capítulo existente.']);
    if (d.tipo === 'par') {
      reglas.push(['subc', !cal.some((r) => r.type === 'sub' && r.code === d.subc) ? 'Selecciona un subcapítulo existente.' : String(d.subc).startsWith(d.cap + '.') ? '' : 'El subcapítulo no pertenece al capítulo elegido.']);
      reglas.push(['und', this.UNIDADES.includes(d.und) ? '' : 'Selecciona una unidad.']);
      reglas.push(['metrado', Validar.cantidad(d.metrado)]);
      reglas.push(['pu', Validar.importe(d.pu, { positivo: true })]);
      if (!Validar.cantidad(d.metrado) && !Validar.importe(d.pu, { positivo: true }))
        reglas.push(['pu', Validar.numero(d.metrado) * Validar.numero(d.pu) > MAX_IMPORTE ? 'El parcial (metrado × P.U.) supera el máximo que el sistema puede calcular con exactitud.' : '']);
    }
    const err = reglas.find((r) => r[1]);
    if (err) return { ok: false, campo: err[0], error: err[1] };
    const desc = d.desc.trim().toUpperCase();
    const lastIdx = (prefix: string): number => {
      let ix = -1;
      cal.forEach((r, i) => {
        if (r.code === prefix || r.code.startsWith(prefix + '.')) ix = i;
      });
      return ix;
    };
    const nextN = (prefix: string, len: number): string => {
      const ch = cal.filter((r) => (len === 0 ? r.type === 'cap' : r.code.startsWith(prefix + '.') && r.code.split('.').length === len));
      return pad2(ch.length ? Math.max(...ch.map((r) => +r.code.split('.').pop()!)) + 1 : 1);
    };
    if (d.tipo === 'cap') cal.push({ type: 'cap', code: nextN('', 0), desc });
    else if (d.tipo === 'sub') cal.splice(lastIdx(d.cap) + 1, 0, { type: 'sub', code: d.cap + '.' + nextN(d.cap, 2), desc });
    else
      cal.splice(lastIdx(d.subc) + 1, 0, {
        type: 'par',
        code: d.subc + '.' + nextN(d.subc, 3),
        desc,
        und: d.und,
        metrado: Validar.numero(d.metrado),
        pu: Validar.numero(d.pu),
        months: {},
      });
    this.almacen.cambio();
    return { ok: true };
  }
}
