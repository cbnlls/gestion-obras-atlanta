import { Injectable, inject } from '@angular/core';
import { hoyIso, nextKey, pad2 } from '../utils/fechas';
import { fmt, r2 } from '../utils/formato';
import { Almacen } from './almacen';
import { Autor, Bloques, EventoValorizacion, Importes, Obra, Res, Valorizacion } from './tipos';
import { Plazo } from './plazo';
import { UsuarioModelo } from './usuario-modelo';
import { Validar } from './validar';

/** Única tasa de IGV del sistema. */
export const IGV = 0.18;
/** Roles con autoridad para aprobar una valorización. */
export const APROBADORES = ['Supervisor', 'Administrador'];
const CAMPOS: (keyof Importes)[] = ['vb', 'reaj', 'ded', 'advD', 'advM', 'fondo', 'pen'];

/** Textos del formulario de valorización. */
export interface DatosValorizacion {
  n: number;
  editando: boolean;
  key: string;
  dias: string;
  vb: string;
  reaj: string;
  ded: string;
  advD: string;
  advM: string;
  fondo: string;
  pen: string;
}

/** Valorizaciones: cálculo de los bloques I–VII, registro mensual y APROBACIÓN JERÁRQUICA.
 *  Qué es cada importe:
 *  - VB (valorización bruta) = valor de los TRABAJOS EJECUTADOS en el mes a precios del contrato. Es la base del avance físico.
 *  - VN = VB + reajuste − deducción (ajustes de precio, no avance físico).
 *  - Amortizaciones, retenciones, penalidades e IGV solo afectan el PAGO, no el trabajo ejecutado.
 *
 *  Flujo:
 *    1. Quien tiene permiso de EDITAR «Valorizaciones» registra o modifica → la valorización queda «Pendiente de revisión».
 *    2. Un aprobador (Supervisor o Administrador) la APRUEBA o la DEVUELVE con un motivo.
 *       Nadie aprueba lo que registró él mismo, salvo el Administrador.
 *    3. SOLO la versión aprobada (v.oficial) alimenta el avance físico y sus acumulados.
 *    4. Si se modifica una valorización ya aprobada, la nueva versión (propuesta) espera revisión y la oficial sigue vigente.
 *    5. Todo queda en v.historial (quién, cuándo, qué y por qué).
 *  Las reglas se validan AQUÍ (lógica de negocio). Con Supabase deben repetirse en la base de datos. */
@Injectable({ providedIn: 'root' })
export class ValorizacionModelo {
  private readonly almacen = inject(Almacen);
  private readonly usuarios = inject(UsuarioModelo);

  todas(o: Obra): Valorizacion[] {
    return o.data.vals;
  }
  porNumero(o: Obra, n: number): Valorizacion | undefined {
    return o.data.vals.find((v) => v.n === n);
  }

  /** Calcula los bloques a partir de los importes. */
  calcular(v: Importes): Bloques {
    const i = r2(v.vb + v.reaj);
    const vn = r2(i - v.ded);
    const amort = r2(v.advD + v.advM);
    const sub = r2(vn - amort);
    const igv = r2(sub * IGV);
    const fact = r2(sub + igv);
    const rm = r2(v.fondo + v.pen);
    return { i, d: v.ded, vn, amort, sub, igv, fact, rm, vl: r2(vn - rm), pagar: r2(fact - rm) };
  }
  /** Bloques de la versión OFICIAL (aprobada), o null si todavía no hay una. */
  calcularOficial(v: Valorizacion): Bloques | null {
    return v.oficial ? this.calcular(v.oficial) : null;
  }
  /** Valor de trabajos ejecutados OFICIAL del mes (base del avance físico): la valorización BRUTA aprobada. */
  ejecutado(v: Valorizacion | undefined | null): number | null {
    return v && v.oficial ? v.oficial.vb : null;
  }
  totalEjecutado(o: Obra): number {
    return r2(o.data.vals.reduce((a, v) => a + (this.ejecutado(v) || 0), 0));
  }
  /** Aprobadas que todavía no se pagan. */
  pendientesDePago(o: Obra): number {
    return o.data.vals.filter((v) => v.estado === 'Aprobada').length;
  }
  /** ¿La propuesta actual difiere de la versión oficial? */
  hayCambiosSinAprobar(v: Valorizacion): boolean {
    return !!v.oficial && (v.estado === 'Pendiente de revisión' || v.estado === 'Devuelta');
  }

  /* ---- permisos ---- */
  rolAprueba(): boolean {
    return APROBADORES.includes(this.usuarios.sesion().rol || '');
  }
  private esMismoUsuario(reg: Autor | null): boolean {
    if (!reg) return false;
    const s = this.usuarios.sesion();
    return reg.userId != null && s.userId != null ? reg.userId === s.userId : reg.usuario === s.nombre;
  }
  /** ¿Puede la sesión actual aprobar esta valorización? */
  puedeAprobar(v?: Valorizacion): Res {
    const a = this.usuarios.autorizar('Valorizaciones');
    if (!a.ok) return a;
    if (!this.rolAprueba()) return { ok: false, error: `Solo los roles ${APROBADORES.join(' y ')} pueden aprobar valorizaciones.` };
    if (v && v.estado !== 'Pendiente de revisión') return { ok: false, error: 'Solo se puede revisar una valorización que está pendiente de revisión.' };
    if (v && !this.usuarios.esAdministrador() && this.esMismoUsuario(v.registradoPor))
      return { ok: false, error: 'No puedes aprobar una valorización que tú mismo registraste: debe revisarla otra persona.' };
    return { ok: true };
  }

  private evento(v: Valorizacion, accion: string, comentario?: string, detalle: Partial<EventoValorizacion> = {}): void {
    const s = this.usuarios.sesion();
    const d = new Date();
    v.historial.push({
      id: this.almacen.nuevoId(),
      fecha: hoyIso(),
      hora: pad2(d.getHours()) + ':' + pad2(d.getMinutes()),
      usuario: s.nombre || '—',
      rol: s.rol || '—',
      userId: s.userId || null,
      accion,
      version: v.version,
      comentario: comentario || '',
      ...detalle,
    });
  }
  private snapshot(v: Valorizacion): Record<string, unknown> {
    const x: Record<string, unknown> = {};
    (['key', 'dias', ...CAMPOS, 'estado', 'version'] as (keyof Valorizacion)[]).forEach((k) => (x[k] = v[k] ?? null));
    return x;
  }
  private autor(): Autor {
    const s = this.usuarios.sesion();
    return { usuario: s.nombre, rol: s.rol, userId: s.userId };
  }

  /** Reglas prudenciales. No sustituyen las cláusulas del contrato ni la revisión profesional. */
  private validarReglasFinancieras(o: Obra, datos: Importes, nActual: number | null): Res {
    const c = this.calcular(datos);
    const limite = r2(Math.max(0, c.vn)) + 0.01;
    if (r2(datos.advD + datos.advM) > limite)
      return { ok: false, campo: 'advD', error: 'La amortización total supera el límite configurado (100% de VN). Verifica el saldo pendiente y las reglas del contrato.' };
    if (r2(datos.fondo + datos.pen) > limite)
      return { ok: false, campo: 'fondo', error: 'La suma de fondo de garantía y penalidades supera el límite configurado (100% de VN). Verifica las reglas del contrato.' };
    if (c.pagar < -0.01) return { ok: false, campo: 'pen', error: 'El cálculo produce un monto a pagar negativo. Revisa amortizaciones, retenciones y penalidades.' };
    if (Number(o.monto) > 0) {
      const acumulado = r2(o.data.vals.reduce((sum, v) => (v.n === nActual ? sum : sum + (Number(v.vb) || 0)), 0) + (Number(datos.vb) || 0));
      if (acumulado > Number(o.monto) + 0.01)
        return { ok: false, campo: 'vb', error: `El acumulado de valorización bruta sería S/ ${fmt(acumulado)}, superior al monto contractual de S/ ${fmt(Number(o.monto))}. Verifica el monto contractual y las valorizaciones previas.` };
    }
    return { ok: true };
  }

  /** Valores por defecto para una nueva valorización. */
  siguiente(o: Obra): { n: number; key: string; dias: number } {
    const vs = o.data.vals;
    const key = vs.length ? nextKey(vs[vs.length - 1].key) : Plazo.meses(o)[0];
    return { n: vs.length + 1, key, dias: Plazo.diasPeriodo(o, key) };
  }

  /** Registrar o modificar deja la valorización PENDIENTE DE REVISIÓN. */
  registrar(o: Obra, d: DatosValorizacion): Res<{ val: Valorizacion }> {
    const a = this.usuarios.autorizar('Valorizaciones');
    if (!a.ok) return a;
    const per = Plazo.periodo(o, d.key);
    const err = [
      ['periodo', per ? '' : 'El período no pertenece al plazo de la obra.'],
      ['dias', Validar.entero(d.dias, { min: 1, max: 366 }) || (per && Number(d.dias) > per.dias ? `El período solo tiene ${per.dias} días.` : '')],
      ['vb', Validar.importe(d.vb, { positivo: true })],
      ['reaj', Validar.importe(d.reaj, { negativo: true })],
      ['ded', Validar.importe(d.ded)],
      ['advD', Validar.importe(d.advD)],
      ['advM', Validar.importe(d.advM)],
      ['fondo', Validar.importe(d.fondo)],
      ['pen', Validar.importe(d.pen)],
    ].find((r) => r[1]);
    if (err) return { ok: false, campo: err[0], error: err[1] };
    const N = Validar.numero;
    const importes: Importes = { vb: N(d.vb), reaj: N(d.reaj), ded: N(d.ded), advD: N(d.advD), advM: N(d.advM), fondo: N(d.fondo), pen: N(d.pen) };
    const datos = { key: d.key, dias: Number(d.dias), ...importes };
    const reglas = this.validarReglasFinancieras(o, importes, d.editando ? d.n : null);
    if (!reglas.ok) return reglas;
    if (d.editando) {
      const v = this.porNumero(o, d.n);
      if (!v) return { ok: false, error: 'Valorización no encontrada.' };
      if (v.estado === 'Pagada') return { ok: false, error: 'Una valorización pagada no se puede modificar.' };
      if (d.key !== v.key) return { ok: false, campo: 'periodo', error: 'El período de una valorización registrada no se puede cambiar (ya existe una valorización por período).' };
      const antes = this.snapshot(v);
      Object.assign(v, datos);
      v.version = (v.oficial ? v.oficial.version : 0) + 1; // nueva versión propuesta
      v.estado = 'Pendiente de revisión';
      v.registradoPor = this.autor();
      this.evento(v, v.oficial ? 'Modificó (nueva versión, pendiente de revisión)' : 'Modificó y envió a revisión', '', { valoresAnteriores: antes, valoresNuevos: this.snapshot(v) });
      this.almacen.cambio();
      return { ok: true, val: v };
    }
    if (o.data.vals.some((x) => x.key === d.key)) return { ok: false, campo: 'periodo', error: 'Ya existe una valorización para ese período.' };
    const v: Valorizacion = { n: o.data.vals.length + 1, estado: 'Pendiente de revisión', version: 1, oficial: null, historial: [], registradoPor: this.autor(), ...datos };
    this.evento(v, 'Registró y envió a revisión', '', { valoresNuevos: this.snapshot(v) });
    o.data.vals.push(v);
    this.almacen.cambio();
    return { ok: true, val: v };
  }

  aprobar(o: Obra, n: number, comentario?: string): Res<{ val: Valorizacion }> {
    const v = this.porNumero(o, n);
    if (!v) return { ok: false, error: 'Valorización no encontrada.' };
    const p = this.puedeAprobar(v);
    if (!p.ok) return p;
    const s = this.usuarios.sesion();
    v.oficial = { vb: v.vb, reaj: v.reaj, ded: v.ded, advD: v.advD, advM: v.advM, fondo: v.fondo, pen: v.pen, version: v.version, aprobadoPor: s.nombre, rol: s.rol || '', fecha: hoyIso() };
    v.estado = 'Aprobada';
    this.evento(v, 'Aprobó', comentario, { valoresAprobados: { ...v.oficial } });
    this.almacen.cambio();
    return { ok: true, val: v };
  }

  devolver(o: Obra, n: number, motivo: string): Res<{ val: Valorizacion }> {
    const v = this.porNumero(o, n);
    if (!v) return { ok: false, error: 'Valorización no encontrada.' };
    const p = this.puedeAprobar(v);
    if (!p.ok) return p;
    const e = Validar.texto(motivo, 300);
    if (e) return { ok: false, campo: 'motivo', error: Validar.vacio(motivo) ? 'Indica el motivo de la devolución.' : e };
    const estadoAnterior = v.estado;
    v.estado = 'Devuelta';
    this.evento(v, 'Devolvió para corrección', motivo.trim(), { estadoAnterior, estadoNuevo: v.estado });
    this.almacen.cambio();
    return { ok: true, val: v };
  }

  marcarPagada(o: Obra, n: number): Res<{ val: Valorizacion }> {
    const a = this.usuarios.autorizar('Valorizaciones');
    if (!a.ok) return a;
    if (!this.rolAprueba()) return { ok: false, error: `Solo los roles ${APROBADORES.join(' y ')} pueden marcar una valorización como pagada.` };
    const v = this.porNumero(o, n);
    if (!v) return { ok: false, error: 'Valorización no encontrada.' };
    if (v.estado !== 'Aprobada') return { ok: false, error: 'Solo se puede marcar como pagada una valorización aprobada.' };
    const estadoAnterior = v.estado;
    v.estado = 'Pagada';
    this.evento(v, 'Marcó como pagada', '', { estadoAnterior, estadoNuevo: v.estado });
    this.almacen.cambio();
    return { ok: true, val: v };
  }
}
