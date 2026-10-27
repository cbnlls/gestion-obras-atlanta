import { Injectable, inject } from '@angular/core';
import { hoyIso } from '../utils/fechas';
import { Almacen } from './almacen';
import { ESTADOS_OBRA, EstadoObra, Obra, Res, SISTEMAS, Sistema, Ampliacion } from './tipos';
import { Plazo } from './plazo';
import { UsuarioModelo } from './usuario-modelo';
import { Validar } from './validar';

/** Textos del formulario «Nueva obra». */
export interface DatosObra {
  nombre: string;
  contrato: string;
  entidad: string;
  ruc: string;
  contratista: string;
  monto: string;
  sistema: string;
  adelanto: string;
  plazo: string;
  inicio: string;
  residente: string;
  supervisor: string;
}

/** Obras: crear, seleccionar la obra activa, cambiar estado y registrar ampliaciones de plazo.
 *  Regla: los modelos NO tocan el DOM ni llaman a toast/render. */
@Injectable({ providedIn: 'root' })
export class ObraModelo {
  private readonly almacen = inject(Almacen);
  private readonly usuarios = inject(UsuarioModelo);

  todas(): Obra[] {
    return this.almacen.obras;
  }
  hay(): boolean {
    return this.almacen.obras.length > 0;
  }
  activa(): Obra | null {
    return this.almacen.obras.find((o) => o.id === this.almacen.obraActivaId) || this.almacen.obras[0] || null;
  }
  seleccionar(id: number): Obra | null {
    this.almacen.obraActivaId = id;
    this.almacen.cambio();
    return this.activa();
  }
  contar(estado: EstadoObra): number {
    return this.almacen.obras.filter((o) => o.estado === estado).length;
  }
  presupuestoTotal(): number {
    return this.almacen.obras.reduce((a, o) => a + o.monto, 0);
  }

  crear(d: DatosObra): Res<{ obra: Obra }> {
    const a = this.usuarios.autorizar('Ficha técnica');
    if (!a.ok) return a;
    const err = [
      ['nombre', Validar.texto(d.nombre, 200)],
      ['contrato', Validar.contrato(d.contrato)],
      ['entidad', Validar.texto(d.entidad, 150)],
      ['ruc', Validar.ruc(d.ruc)],
      ['contratista', Validar.texto(d.contratista, 150)],
      ['monto', Validar.importe(d.monto, { positivo: true })],
      ['adelanto', Validar.porcentaje(d.adelanto)],
      ['plazo', Validar.entero(d.plazo, { min: 1, max: 3650 })],
      ['inicio', Validar.fecha(d.inicio)],
      ['residente', Validar.opc(Validar.nombre)(d.residente)],
      ['supervisor', Validar.opc(Validar.nombre)(d.supervisor)],
    ].find((r) => r[1]);
    if (err) return { ok: false, campo: err[0], error: err[1] };
    if (!(SISTEMAS as readonly string[]).includes(d.sistema)) return { ok: false, campo: 'sistema', error: 'Selecciona un sistema de contratación.' };
    const o: Obra = this.almacen.normalizarObra({
      id: Math.max(0, ...this.almacen.obras.map((x) => x.id)) + 1,
      nombre: d.nombre.trim(),
      contrato: d.contrato.trim(),
      entidad: d.entidad.trim(),
      rucEntidad: d.ruc.trim(),
      contratista: d.contratista.trim(),
      monto: Validar.numero(d.monto),
      sistema: d.sistema as Sistema,
      adelantoPct: Number(d.adelanto),
      plazo: Number(d.plazo),
      inicio: d.inicio,
      estado: Plazo._t(d.inicio) > Plazo._t(hoyIso()) ? 'Por iniciar' : 'En ejecución',
      residente: (d.residente || '').trim(),
      supervisor: (d.supervisor || '').trim(),
    } as Obra);
    this.almacen.obras.push(o);
    this.almacen.obraActivaId = o.id;
    this.almacen.cambio();
    return { ok: true, obra: o };
  }

  cambiarEstado(o: Obra, estado: string): Res {
    const a = this.usuarios.autorizar('Ficha técnica');
    if (!a.ok) return a;
    if (!(ESTADOS_OBRA as readonly string[]).includes(estado)) return { ok: false, campo: 'estado', error: 'Estado no válido.' };
    o.estado = estado as EstadoObra;
    this.almacen.cambio();
    return { ok: true };
  }

  /** d: {dias, motivo} (textos del formulario). Solo el administrador puede registrarla. */
  registrarAmpliacion(o: Obra, d: { dias: string; motivo: string }): Res<{ ampliacion: Ampliacion; plazoVigente: number; finVigente: string }> {
    if (!this.usuarios.esAdministrador()) return { ok: false, error: 'Solo el administrador puede registrar ampliaciones de plazo.' };
    const e = [
      ['dias', Validar.entero(d.dias, { min: 1, max: 3650 })],
      ['motivo', Validar.texto(d.motivo, 300)],
    ].find((r) => r[1]);
    if (e) return { ok: false, campo: e[0], error: e[1] };
    const nuevo = Plazo.plazoVigente(o) + Number(d.dias);
    const fin = Plazo.fin(o.inicio, nuevo);
    if ((+fin.slice(0, 4) - +o.inicio.slice(0, 4)) * 12 + (+fin.slice(5, 7) - +o.inicio.slice(5, 7)) + 1 > Plazo.MAX_MESES)
      return { ok: false, campo: 'dias', error: `Con esa ampliación el plazo vigente sería de ${nuevo} días (más de ${Plazo.MAX_MESES} meses), que el calendario no puede representar.` };
    const a: Ampliacion = {
      id: this.almacen.nuevoId(),
      dias: Number(d.dias),
      motivo: String(d.motivo).trim(),
      fecha: hoyIso(),
      usuario: this.usuarios.sesion().nombre,
      estado: 'Aprobada',
    };
    o.ampliaciones.push(a);
    this.almacen.cambio();
    return { ok: true, ampliacion: a, plazoVigente: Plazo.plazoVigente(o), finVigente: Plazo.finVigente(o) };
  }
}
