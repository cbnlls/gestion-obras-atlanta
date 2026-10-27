import { TestBed } from '@angular/core/testing';
import { Almacen, ADMIN_INICIAL } from './almacen';
import { AlertasModelo } from './alertas-modelo';
import { AvanceModelo } from './avance-modelo';
import { CalendarioModelo } from './calendario-modelo';
import { CartaModelo } from './carta-modelo';
import { ObraModelo, DatosObra } from './obra-modelo';
import { PersonalModelo } from './personal-modelo';
import { Plazo } from './plazo';
import { Obra, Rol } from './tipos';
import { UsuarioModelo } from './usuario-modelo';
import { ValorizacionModelo } from './valorizacion-modelo';
import { Validar } from './validar';

/* Estas pruebas replican la batería de lógica de la versión HTML/JS original para comprobar que la migración
   a Angular conserva las mismas reglas (fechas, permisos, calendario, avance, aprobación, pagos, persistencia). */

let A: Almacen, O: ObraModelo, U: UsuarioModelo, C: CalendarioModelo, V: ValorizacionModelo, AV: AvanceModelo, P: PersonalModelo, CA: CartaModelo, AL: AlertasModelo;

const sesion = (rol: Rol, nombre: string, userId: number | null = null) => {
  A.sesion = { nombre, rol, userId };
};
const reset = (rol: Rol = 'Administrador') => {
  A.reiniciar();
  sesion(rol, 'Ana Prueba');
};
const form = (o: Partial<DatosObra> = {}): DatosObra => ({
  nombre: 'Mejoramiento de pistas', contrato: '014-2026', entidad: 'Municipalidad Distrital', ruc: '20123456789',
  contratista: 'Constructora Atlanta E.I.R.L.', monto: '45000', sistema: 'Precios unitarios', adelanto: '10', plazo: '90',
  inicio: '2026-10-19', residente: '', supervisor: '', ...o,
});
const crear = (o?: Partial<DatosObra>): Obra => {
  const r = O.crear(form(o));
  if (!r.ok) throw new Error('no se creó la obra: ' + JSON.stringify(r));
  return r.obra;
};
const dVal = (o: Obra, key: string, vb: number, extra: Record<string, unknown> = {}) => ({
  n: 0, editando: false, key, dias: String(Plazo.diasPeriodo(o, key)), vb: String(vb), reaj: '0', ded: '0', advD: '0', advM: '0', fondo: '0', pen: '0', ...extra,
}) as any;
const okv = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  if (!r.ok) throw new Error('falló: ' + JSON.stringify(r));
  return r as any;
};
/** registra como Residente y aprueba como Supervisor (otra persona) */
const valAprobada = (o: Obra, key: string, vb: number, extra?: Record<string, unknown>) => {
  sesion('Residente de obra', 'Rita Residente', 101);
  const r = okv(V.registrar(o, dVal(o, key, vb, extra)));
  sesion('Supervisor', 'Sergio Supervisor', 102);
  okv(V.aprobar(o, r.val.n));
  sesion('Administrador', 'Ana Prueba');
  return r.val;
};
const valPendiente = (o: Obra, key: string, vb: number, extra?: Record<string, unknown>) => {
  sesion('Residente de obra', 'Rita Residente', 101);
  const r = okv(V.registrar(o, dVal(o, key, vb, extra)));
  sesion('Administrador', 'Ana Prueba');
  return r.val;
};
const item = (o: Obra, tipo: string, extra: Record<string, string>) =>
  okv(C.agregarItem(o, { tipo, cap: '', subc: '', desc: '', und: '', metrado: '', pu: '', ...extra }));
const armarCal = (o: Obra) => {
  item(o, 'cap', { desc: 'Obras provisionales' });
  item(o, 'sub', { cap: '01', desc: 'Construcciones' });
  item(o, 'par', { cap: '01', subc: '01.01', desc: 'Cartel', und: 'und', metrado: '3', pu: '2607.87' });
  item(o, 'par', { cap: '01', subc: '01.01', desc: 'Alquiler de almacén', und: 'mes', metrado: '6', pu: '6800' });
  item(o, 'sub', { cap: '01', desc: 'Instalaciones' });
  item(o, 'par', { cap: '01', subc: '01.02', desc: 'Agua', und: 'm²', metrado: '100', pu: '12.25' });
  item(o, 'cap', { desc: 'Movimiento de tierras' });
  item(o, 'sub', { cap: '02', desc: 'Trazo' });
  item(o, 'par', { cap: '02', subc: '02.01', desc: 'Replanteo', und: 'glb', metrado: '1', pu: '1000' });
  return o;
};
const sm = (o: Obra, c: string, k: string, v: string) => okv(C.setMonto(o, c, k, v));
const trab = { nombre: 'Juan Perez', dni: '12345678', cargo: 'Peón', cat: 'Peón', ini: '2026-10-20', mensual: '100', contrato: 'Por obra' };

beforeEach(() => {
  TestBed.configureTestingModule({});
  A = TestBed.inject(Almacen);
  A.persistir = false;
  O = TestBed.inject(ObraModelo);
  U = TestBed.inject(UsuarioModelo);
  C = TestBed.inject(CalendarioModelo);
  V = TestBed.inject(ValorizacionModelo);
  AV = TestBed.inject(AvanceModelo);
  P = TestBed.inject(PersonalModelo);
  CA = TestBed.inject(CartaModelo);
  AL = TestBed.inject(AlertasModelo);
  reset();
});

describe('Fechas, plazos y periodos', () => {
  it('19/10/2026 + 90 días → fin 16/01/2027; periodos 13/30/31/16', () => {
    const o = crear();
    expect(Plazo.finOriginal(o)).toBe('2027-01-16');
    const p = Plazo.periodosObra(o);
    expect(p.map((x) => x.key)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    expect(p.map((x) => x.dias)).toEqual([13, 30, 31, 16]);
    expect(p.reduce((a, x) => a + x.dias, 0)).toBe(90);
  });
  it('año bisiesto, mismo mes, 1 día y cambio de año', () => {
    expect(Plazo.periodos('2028-01-20', 60).map((x) => x.dias)).toEqual([12, 29, 19]);
    expect(Plazo.fin('2028-01-20', 60)).toBe('2028-03-19');
    expect(Plazo.periodos('2026-05-10', 10).map((x) => x.dias)).toEqual([10]);
    expect(Plazo.periodos('2026-05-10', 1).map((x) => x.dias)).toEqual([1]);
    expect(Plazo.fin('2026-12-31', 2)).toBe('2027-01-01');
    expect(Plazo.periodos('2026-03-20', 20).map((x) => x.dias)).toEqual([12, 8]);
  });
  it('el monto contractual NO se reparte entre los meses', () => {
    const o = crear({ monto: '45000', plazo: '120', inicio: '2026-11-02' });
    expect(Plazo.periodosObra(o).reduce((a, x) => a + x.dias, 0)).toBe(120);
    expect(AV.hayProgramacion(o)).toBe(false);
    expect(AV.filas(o).every((x) => x.pm === 0 && !x.pDef)).toBe(true);
    expect(Object.keys(o.programacion)).toHaveLength(0);
  });
});

describe('Validaciones', () => {
  it('DNI, RUC, nombres, correo, importes, porcentajes, enteros, contrato y fecha', () => {
    expect(Validar.dni('12345678')).toBe('');
    ['1234567', '123456789', '1234567a', '12 456 78', '', 'abcdefgh'].forEach((v) => expect(Validar.dni(v)).not.toBe(''));
    expect(Validar.filtrar('digitos', '12a3-4 5x678')).toBe('12345678');
    expect(Validar.ruc('20123456789')).toBe('');
    ['María José', 'Pérez-Gómez', "D'Angelo", 'Núñez', 'Ing. Carla Mendoza'].forEach((v) => expect(Validar.nombre(v)).toBe(''));
    ['Juan123', 'Ana@', 'M4ría', '<script>', 'J', 'Pedro_'].forEach((v) => expect(Validar.nombre(v)).not.toBe(''));
    expect(Validar.correo('ana.perez@empresa.pe')).toBe('');
    ['ana@', '@x.pe', 'ana@x', 'a b@x.pe', ''].forEach((v) => expect(Validar.correo(v)).not.toBe(''));
    ['0', '10', '1,250.50', '1250.5', '45000'].forEach((v) => expect(Validar.importe(v)).toBe(''));
    ['abc', '12abc', '-5', '1.234', '1,25', '1,2345.00', '.5', ''].forEach((v) => expect(Validar.importe(v)).not.toBe(''));
    expect(Validar.importe('0', { positivo: true })).not.toBe('');
    expect(Validar.importe('-3', { negativo: true })).toBe('');
    ['0', '10', '100', '12.5'].forEach((v) => expect(Validar.porcentaje(v)).toBe(''));
    ['101', '-1', 'abc', '10.555', ''].forEach((v) => expect(Validar.porcentaje(v)).not.toBe(''));
    ['1', '90', '3650'].forEach((v) => expect(Validar.entero(v, { max: 3650 })).toBe(''));
    ['0', '-3', '1.5', 'abc', '', '3651'].forEach((v) => expect(Validar.entero(v, { max: 3650 })).not.toBe(''));
    ['014-2026', '001.2026', 'CP-001-2026-MDE', '12/2026'].forEach((v) => expect(Validar.contrato(v)).toBe(''));
    ['abc', '014 2026', '--', '', ' '].forEach((v) => expect(Validar.contrato(v)).not.toBe(''));
    expect(Validar.fecha('2026-02-28')).toBe('');
    ['2026-02-30', '2026-13-01', '26-10-19', '', 'abc'].forEach((v) => expect(Validar.fecha(v)).not.toBe(''));
    expect(Validar.filtrar('nombre', 'Juan 123 Pérez!')).toBe('Juan Pérez');
    expect(Validar.filtrar('importe', '12a,3.4.5')).toBe('12,3.45');
    expect(Number.isNaN(Validar.numero('12abc'))).toBe(true);
    expect(Validar.numero('1,2,3')).toBeNaN();
    expect(Validar.numero('1,234.50')).toBe(1234.5);
    expect(Validar.nombre(null)).not.toBe('');
  });
  it('el modelo rechaza datos inválidos aunque el formulario no los detecte', () => {
    ([['monto', 'abc'], ['monto', '-1'], ['plazo', '0'], ['plazo', '9.5'], ['adelanto', '150'], ['contrato', 'x y'], ['inicio', '2026-02-30'], ['residente', 'Juan123'], ['nombre', ''], ['ruc', '123']] as const).forEach(([c, v]) => {
      const r = O.crear(form({ [c]: v }));
      expect([r.ok, r.ok ? '' : r.campo]).toEqual([false, c]);
    });
    expect(A.obras).toHaveLength(0);
  });
  it('cada obra guarda su RUC', () => {
    const o = crear({ ruc: '20123456789' });
    const o2 = crear({ ruc: '20987654321', contrato: '015-2026' });
    expect([o.rucEntidad, o2.rucEntidad]).toEqual(['20123456789', '20987654321']);
  });
});

describe('Ampliaciones de plazo', () => {
  it('90 días + 14 → vigente 104; el original no cambia', () => {
    const o = crear();
    okv(O.registrarAmpliacion(o, { dias: '14', motivo: 'Lluvias extraordinarias' }));
    expect([o.plazo, Plazo.plazoVigente(o)]).toEqual([90, 104]);
    expect(Plazo.finOriginal(o)).toBe('2027-01-16');
    expect(Plazo.finVigente(o)).toBe('2027-01-30');
    expect(o.ampliaciones[0]).toMatchObject({ dias: 14, motivo: 'Lluvias extraordinarias', usuario: 'Ana Prueba' });
    okv(O.registrarAmpliacion(o, { dias: '6', motivo: 'Adicional' }));
    expect(Plazo.plazoVigente(o)).toBe(110);
    expect(Plazo.periodosObra(o).reduce((a, x) => a + x.dias, 0)).toBe(110);
  });
  it('rechaza datos inválidos y respeta el límite del calendario', () => {
    const o = crear();
    [['0', 'x'], ['-5', 'x'], ['1.5', 'x'], ['abc', 'x'], ['', 'x'], ['5', ''], ['5', '   ']].forEach(([d, m]) => expect(O.registrarAmpliacion(o, { dias: d, motivo: m }).ok).toBe(false));
    expect(o.ampliaciones).toHaveLength(0);
    const larga = crear({ plazo: '3650', contrato: '020-2026' });
    for (let i = 0; i < 4; i++) O.registrarAmpliacion(larga, { dias: '3650', motivo: 'x' });
    expect(Plazo.periodosObra(larga).length).toBeLessThanOrEqual(Plazo.MAX_MESES);
  });
});

describe('Permisos por rol', () => {
  it('Solo lectura no puede modificar nada', () => {
    const o = crear();
    reset('Solo lectura');
    A.obras = [o];
    const bloqueado = (r: { ok: boolean; error?: string }) => {
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/permiso|administrador/i);
    };
    bloqueado(O.crear(form({ contrato: '999-2026' })));
    bloqueado(O.cambiarEstado(o, 'Culminada'));
    bloqueado(O.registrarAmpliacion(o, { dias: '5', motivo: 'x' }));
    bloqueado(V.registrar(o, dVal(o, '2026-10', 100)));
    bloqueado(C.agregarItem(o, { tipo: 'cap', cap: '', subc: '', desc: 'X', und: '', metrado: '', pu: '' }));
    bloqueado(P.agregar(o, trab));
    bloqueado(CA.registrar(o, { num: '1', tipo: 'Fiel cumplimiento', banco: 'BCP', monto: '10', emision: '2026-10-01', vence: '2027-01-01' }));
    bloqueado(U.invitar({ nombre: 'Ana Luz', user: 'aluz', mail: 'a@x.pe', rol: 'Solo lectura', obras: [], activo: true }));
    bloqueado(U.ciclarPermiso('Valorizaciones', 1));
    expect([o.data.vals.length, o.data.cartas.length, o.data.workers.length, o.ampliaciones.length, A.usuarios.length]).toEqual([0, 0, 0, 0, 1]);
  });
  it('Residente edita valorizaciones; Supervisor aprueba pero no edita mano de obra', () => {
    const o = crear();
    sesion('Residente de obra', 'Rita Residente');
    expect(V.registrar(o, dVal(o, '2026-10', 1000)).ok).toBe(true);
    expect(O.registrarAmpliacion(o, { dias: '5', motivo: 'x' }).ok).toBe(false);
    expect(O.cambiarEstado(o, 'Culminada').ok).toBe(false);
    expect(V.aprobar(o, 1).ok).toBe(false);
    sesion('Supervisor', 'Sergio Supervisor');
    expect(P.agregar(o, trab).ok).toBe(false);
    expect(V.aprobar(o, 1).ok).toBe(true);
  });
  it('la matriz: el Administrador no se modifica; los demás roles sí', () => {
    expect(U.ciclarPermiso('Valorizaciones', 0).ok).toBe(false);
    const antes = A.permisos['Valorizaciones'][3];
    expect(U.ciclarPermiso('Valorizaciones', 3).ok).toBe(true);
    expect(A.permisos['Valorizaciones'][3]).not.toBe(antes);
  });
});

describe('Inicio de sesión (simulado, un solo correo)', () => {
  it('solo entra admin@gmail.com mientras no se registren más usuarios', () => {
    U.cerrarSesion();
    expect(A.usuarios).toEqual([ADMIN_INICIAL]);
    expect(U.iniciarSesion('nada').ok).toBe(false);
    expect(U.iniciarSesion('luis@empresa.pe').ok).toBe(false);
    expect(U.iniciarSesion('ADMIN@gmail.com').ok).toBe(true);
    expect(A.sesion.rol).toBe('Administrador');
  });
  it('un usuario nuevo puede entrar si está activo; no se revoca al único admin', () => {
    U.iniciarSesion('admin@gmail.com');
    const u = okv(U.invitar({ nombre: 'Oscar Beltran', user: 'obeltran', mail: 'oscar@empresa.pe', rol: 'Solo lectura', obras: [], activo: true }));
    expect(U.invitar({ nombre: 'Otro Admin', user: 'admin', mail: 'x@x.pe', rol: 'Solo lectura', obras: [], activo: true }).ok).toBe(false);
    expect(U.alternarAcceso(1).ok).toBe(false);
    U.alternarAcceso(u.u.id);
    U.cerrarSesion();
    expect(U.iniciarSesion('oscar@empresa.pe').ok).toBe(false);
  });
});

describe('Mano de obra: pagos por mes y año', () => {
  it('acumula por mes y año; el total mensual no se escribe a mano', () => {
    const o = crear();
    const w1 = okv(P.agregar(o, { ...trab, nombre: 'Marco Huamán', dni: '42351890', cat: 'Operario', mensual: '3800' })).w;
    const w2 = okv(P.agregar(o, { ...trab, nombre: 'Diana Torres', dni: '48765430', cat: 'Personal técnico', mensual: '4200' })).w;
    expect(P.resumenMensual(o)).toEqual([]);
    const pago = (w: { id: number }, f: string, m: string) => okv(P.registrarPago(o, { w: w.id, fecha: f, monto: m, obs: '' }));
    pago(w1, '2026-11-05', '3800.50'); pago(w2, '2026-11-28', '4200'); pago(w1, '2026-12-05', '3800'); pago(w1, '2027-01-05', '3800'); pago(w2, '2026-01-10', '1000');
    const r = P.resumenMensual(o);
    expect(r.map((x) => x.key)).toEqual(['2026-01', '2026-11', '2026-12', '2027-01']);
    expect(r.map((x) => x.total)).toEqual([1000, 8000.5, 3800, 3800]);
    expect(r.map((x) => x.acumulado)).toEqual([1000, 9000.5, 12800.5, 16600.5]);
    expect(r[1].pagos.map((p) => [p.trabajador, p.monto])).toEqual([['Marco Huamán', 3800.5], ['Diana Torres', 4200]]);
    expect(P.totalPagado(o)).toBe(16600.5);
    expect(P.pagadoTrabajador(o, w1)).toBe(11400.5);
    expect(P.registrarPago(o, { w: w1.id, fecha: '2026-11-05', monto: '-5', obs: '' }).ok).toBe(false);
    expect(P.registrarPago(o, { w: 999, fecha: '2026-11-05', monto: '5', obs: '' }).ok).toBe(false);
    expect(o.data.pagos).toHaveLength(5);
  });
  it('cese: fecha y motivo válidos; DNI único', () => {
    const o = crear();
    const w = okv(P.agregar(o, trab)).w;
    expect(P.agregar(o, trab).ok).toBe(false);
    expect(P.cesar(o, w.id, '2026-10-01', 'Renuncia').ok).toBe(false);
    expect(P.cesar(o, w.id, '2026-11-01', 'Inventado').ok).toBe(false);
    expect(P.cesar(o, w.id, '2026-11-01', 'Renuncia').ok).toBe(true);
  });
});

describe('Calendario valorizado', () => {
  it('jerarquía y parciales: parcial = metrado × P.U.; las categorías solo suman partidas', () => {
    const o = armarCal(crear({ monto: '100000' }));
    expect(C.items(o).map((r) => r.code)).toEqual(['01', '01.01', '01.01.01', '01.01.02', '01.02', '01.02.01', '02', '02.01', '02.01.01']);
    expect(C.partidas(o).map((p) => C.parcial(p))).toEqual([7823.61, 40800, 1225, 1000]);
    const ms = Plazo.meses(o);
    expect(C.subtotalesDe(o, '01.01', ms).parcial).toBe(48623.61);
    expect(C.subtotalesDe(o, '01', ms).parcial).toBe(49848.61);
    expect(C.subtotalesDe(o, '02', ms).parcial).toBe(1000);
  });
  it('cada monto queda en su partida y mes; nada se reparte solo', () => {
    const o = armarCal(crear({ monto: '100000' }));
    const P_ = C.partidas(o);
    expect(P_.every((p) => Object.keys(p.months).length === 0)).toBe(true);
    sm(o, '01.01.01', '2026-10', '7,823.61'); sm(o, '01.01.02', '2026-10', '5000'); sm(o, '01.01.02', '2026-11', '6800.40');
    expect(P_[0].months).toEqual({ '2026-10': 7823.61 });
    expect(P_[1].months).toEqual({ '2026-10': 5000, '2026-11': 6800.4 });
    expect(C.programadoMes(o, '2026-10')).toBe(12823.61);
    expect(C.programadoMes(o, '2026-12')).toBe(0);
    sm(o, '01.01.02', '2026-11', '');
    expect(P_[1].months).toEqual({ '2026-10': 5000 });
    const antes = JSON.stringify(P_);
    C.diagnostico(o);
    expect(JSON.stringify(P_)).toBe(antes);
  });
  it('una partida que se está llenando NO es error; la que supera su parcial sí', () => {
    const o = armarCal(crear({ monto: '100000' }));
    const P_ = C.partidas(o);
    sm(o, '01.01.01', '2026-10', '7823.61'); sm(o, '01.01.02', '2026-10', '5000'); sm(o, '02.01.01', '2026-12', '1200');
    const ms = Plazo.meses(o);
    expect(P_.map((p) => C.estadoPartida(o, p, ms).estado)).toEqual(['completa', 'incompleta', 'sin_programar', 'excede']);
    const d = C.diagnostico(o);
    expect([d.resumen.completas, d.resumen.incompletas, d.resumen.sinProgramar, d.resumen.excedidas]).toEqual([1, 1, 1, 1]);
    expect(d.problemas).toHaveLength(1);
    expect(d.problemas[0].codigo).toBe('02.01.01');
    expect(d.problemas[0].texto).toMatch(/1,200\.00/);
    sm(o, '02.01.01', '2026-12', '1000');
    expect(C.diagnostico(o).problemas).toHaveLength(0);
  });
  it('datos inválidos y montos fuera del plazo se informan como tales', () => {
    const o = armarCal(crear({ monto: '100000' }));
    const P_ = C.partidas(o);
    P_[0].months['2026-05'] = 100;
    let d = C.diagnostico(o);
    expect(d.problemas[0].tipo).toBe('plazo');
    delete P_[0].months['2026-05'];
    P_[1].pu = NaN;
    d = C.diagnostico(o);
    expect(d.problemas.map((p) => p.tipo)).toEqual(['dato']);
  });
  it('importes mensuales: sin texto ni negativos; mes fuera del plazo rechazado; sin permiso no modifica', () => {
    const o = armarCal(crear({ monto: '100000' }));
    ['abc', '-5', '12abc', '1,25', '1.234'].forEach((v) => expect(C.setMonto(o, '01.01.01', '2026-10', v).ok).toBe(false));
    expect(C.setMonto(o, '01.01.01', '2026-05', '10').ok).toBe(false);
    sesion('Supervisor', 'Sergio', 102);
    expect(C.setMonto(o, '01.01.01', '2026-10', '10').ok).toBe(false);
    expect(C.partidas(o)[0].months).toEqual({});
  });
  it('la partida debe colgar de un subcapítulo del capítulo elegido', () => {
    const o = armarCal(crear({ monto: '100000' }));
    const base = { tipo: 'par', cap: '01', subc: '02.01', desc: 'X', und: 'm', metrado: '1', pu: '1' };
    expect(C.agregarItem(o, base).ok).toBe(false);
    expect(C.agregarItem(o, { ...base, subc: '01.01', metrado: '999999999999', pu: '999999999999' }).ok).toBe(false);
  });
  it('ciclo Borrador → Presentado → Aprobado bloquea y exige nueva versión', () => {
    const o = armarCal(crear({ monto: '100000' }));
    expect(C.aprobar(o).ok).toBe(false);
    okv(C.presentar(o));
    expect(C.setMonto(o, '01.01.01', '2026-10', '10').ok).toBe(false);
    expect(C.observar(o, 'no').ok).toBe(false);
    okv(C.observar(o, 'Falta detalle'));
    okv(C.presentar(o));
    okv(C.aprobar(o));
    expect(o.calEstado.lineaBase?.plazo).toBe(90);
    expect(C.nuevaVersion(o, 'x').ok).toBe(false);
    okv(C.nuevaVersion(o, 'Reprogramación'));
    expect([o.calEstado.estado, o.calEstado.version]).toEqual(['Borrador', 2]);
  });
  it('avisa cuando la ampliación no está en la línea base aprobada', () => {
    const o = armarCal(crear({ monto: '100000' }));
    okv(C.presentar(o)); okv(C.aprobar(o));
    expect(AL.avisosPlazo(o)).toEqual([]);
    okv(O.registrarAmpliacion(o, { dias: '14', motivo: 'Lluvias' }));
    const av = AL.avisosPlazo(o);
    expect(av).toHaveLength(1);
    expect(av[0].area).toBe('calendario');
  });
});

describe('Avance físico', () => {
  it('el programado se escribe a mano (validado y con permiso); el calendario solo es referencia', () => {
    const o = armarCal(crear({ monto: '100000' }));
    sm(o, '01.01.01', '2026-10', '7823.61');
    expect(AV.hayProgramacion(o)).toBe(false);
    expect(AV.filas(o)[0].pm).toBe(0);
    expect(AV.filas(o)[0].ref).toEqual({ valor: 7823.61, base: 'costo directo' });
    ['abc', '-5', '12abc', '1,25'].forEach((v) => expect(AV.setProgramado(o, '2026-10', v).ok).toBe(false));
    expect(AV.setProgramado(o, '2026-05', '10').ok).toBe(false);
    okv(AV.setProgramado(o, '2026-10', '10,000.50')); okv(AV.setProgramado(o, '2026-11', '0'));
    expect(o.programacion).toEqual({ '2026-10': 10000.5, '2026-11': 0 });
    const f = AV.filas(o);
    expect([f[0].pDef, f[1].pDef, f[2].pDef]).toEqual([true, true, false]);
    okv(AV.setProgramado(o, '2026-11', ''));
    expect(Object.keys(o.programacion)).toEqual(['2026-10']);
    sesion('Supervisor', 'Sergio', 102);
    expect(AV.setProgramado(o, '2026-10', '5').ok).toBe(false);
  });
  it('columnas calculadas: acumulados, porcentajes y DIF. (PTS)', () => {
    const o = crear({ monto: '100000' });
    [['2026-10', '10000'], ['2026-11', '40000'], ['2026-12', '30000'], ['2027-01', '20000']].forEach(([k, v]) => AV.setProgramado(o, k, v));
    valAprobada(o, '2026-10', 8000); valAprobada(o, '2026-11', 35000);
    const f = AV.filas(o);
    expect(f.map((x) => x.dias)).toEqual([13, 30, 31, 16]);
    expect(f.map((x) => x.pa)).toEqual([10000, 50000, 80000, 100000]);
    expect(f.map((x) => x.paPct)).toEqual([10, 50, 80, 100]);
    expect([f[0].em, f[0].eaPct, f[0].dif]).toEqual([8000, 8, 8 - 10]);
    expect([f[1].em, f[1].ea, f[1].eaPct, f[1].dif]).toEqual([35000, 43000, 43, 43 - 50]);
    expect([f[2].em, f[2].ea, f[2].eaPct, f[2].dif]).toEqual([null, null, null, null]);
    const p = AV.progreso(o);
    expect([p.ej, p.pr, p.dif, p.suficiente]).toEqual([43, 50, -7, true]);
  });
  it('estados del período', () => {
    const o = crear({ monto: '100000' });
    const est = () => AV.filas(o).map((f) => f.estado.codigo);
    expect(est()).toEqual(['prog_incompleta', 'prog_incompleta', 'prog_incompleta', 'prog_incompleta']);
    AV.setProgramado(o, '2026-10', '10000'); AV.setProgramado(o, '2026-11', '20000'); AV.setProgramado(o, '2026-12', '20000');
    expect(est()).toEqual(['sin_val', 'sin_val', 'sin_val', 'prog_incompleta']);
    valPendiente(o, '2026-10', 9000);
    expect(est()[0]).toBe('val_pendiente');
    expect(AV.filas(o)[0].em).toBeNull();
    valAprobada(o, '2026-11', 18000);
    expect(est()[1]).toBe('completo');
    valAprobada(o, '2027-01', 5000);
    expect(est()[3]).toBe('val_aprobada');
    sesion('Supervisor', 'Sergio', 102);
    V.aprobar(o, 1);
    sesion('Administrador', 'Ana Prueba');
    expect(est()[0]).toBe('completo');
  });
  it('solo la versión APROBADA alimenta el avance', () => {
    const o = crear({ monto: '100000' });
    valPendiente(o, '2026-10', 10000, { reaj: '500', ded: '200', advD: '2000', advM: '1000', fondo: '500', pen: '300' });
    expect(V.totalEjecutado(o)).toBe(0);
    expect(AV.filas(o)[0].em).toBeNull();
    sesion('Supervisor', 'Sergio', 102);
    okv(V.devolver(o, 1, 'Corregir metrados'));
    expect(AV.filas(o)[0].em).toBeNull();
    sesion('Administrador', 'Ana Prueba');
    okv(V.registrar(o, dVal(o, '2026-10', 10000, { n: 1, editando: true, reaj: '500', ded: '200', advD: '2000', advM: '1000', fondo: '500', pen: '300' })));
    sesion('Supervisor', 'Sergio', 102);
    okv(V.aprobar(o, 1));
    const c = V.calcularOficial(V.porNumero(o, 1)!)!;
    expect(c.pagar !== 10000 && c.vn !== 10000 && c.sub !== 10000).toBe(true);
    expect(AV.filas(o)[0].em).toBe(10000);
  });
  it('aviso real de exceso: solo si lo programado supera el monto contractual', () => {
    const o = crear({ monto: '100000' });
    AV.setProgramado(o, '2026-10', '10000');
    expect(AV.advertencias(o)).toEqual([]);
    AV.setProgramado(o, '2026-11', '90000');
    expect(AV.advertencias(o)).toEqual([]);
    AV.setProgramado(o, '2026-12', '5000');
    const a = AV.advertencias(o);
    expect(a).toHaveLength(1);
    expect(a[0].texto).toMatch(/105,000\.00/);
    expect(a[0].texto).toMatch(/Diciembre 2026/);
    o.programacion['2026-12'] = NaN;
    expect(AV.advertencias(o)[0].texto).toMatch(/no es un número válido/);
  });
});

describe('Valorizaciones: aprobación jerárquica', () => {
  it('registrar → «Pendiente de revisión» v1 con historial', () => {
    const o = crear();
    const v = valPendiente(o, '2026-10', 1000);
    expect([v.estado, v.version, v.oficial]).toEqual(['Pendiente de revisión', 1, null]);
    expect(v.historial).toHaveLength(1);
    expect(v.historial[0]).toMatchObject({ usuario: 'Rita Residente', rol: 'Residente de obra', accion: 'Registró y envió a revisión', version: 1 });
    expect(V.pendientesDePago(o)).toBe(0);
  });
  it('solo aprueban Supervisor y Administrador, nunca quien la registró (salvo el Administrador)', () => {
    const o = crear();
    valPendiente(o, '2026-10', 1000);
    sesion('Residente de obra', 'Rita Residente', 101);
    expect(V.aprobar(o, 1).ok).toBe(false);
    sesion('Solo lectura', 'Lola', 103);
    expect(V.aprobar(o, 1).ok).toBe(false);
    expect(V.devolver(o, 1, 'x').ok).toBe(false);
    sesion('Supervisor', 'Rita Residente', 101);
    const r = V.aprobar(o, 1);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/tú mismo/);
    sesion('Supervisor', 'Sergio Supervisor', 102);
    okv(V.registrar(o, dVal(o, '2026-11', 500)));
    expect(V.aprobar(o, 2).ok).toBe(false);
    sesion('Administrador', 'Ana Prueba');
    expect(V.aprobar(o, 2).ok).toBe(true);
    sesion('Supervisor', 'Sergio Supervisor', 102);
    expect(V.aprobar(o, 1).ok).toBe(true);
    expect(V.aprobar(o, 1).ok).toBe(false);
  });
  it('devolver exige motivo, deja constancia y no cambia la oficial', () => {
    const o = crear();
    valPendiente(o, '2026-10', 1000);
    sesion('Supervisor', 'Sergio', 102);
    expect(V.devolver(o, 1, '').ok).toBe(false);
    expect(V.devolver(o, 1, '   ').ok).toBe(false);
    okv(V.devolver(o, 1, 'Metrado de la partida 02 no coincide'));
    const v = V.porNumero(o, 1)!;
    expect(v.estado).toBe('Devuelta');
    expect(v.historial[1]).toMatchObject({ accion: 'Devolvió para corrección', comentario: 'Metrado de la partida 02 no coincide', usuario: 'Sergio' });
    expect(V.totalEjecutado(o)).toBe(0);
  });
  it('modificar una aprobada crea una versión nueva; la oficial sigue vigente hasta aprobarla', () => {
    const o = crear();
    const v = valAprobada(o, '2026-10', 1000);
    expect([v.estado, v.version, v.oficial!.vb, v.oficial!.version]).toEqual(['Aprobada', 1, 1000, 1]);
    sesion('Residente de obra', 'Rita Residente', 101);
    okv(V.registrar(o, dVal(o, '2026-10', 1500, { n: 1, editando: true })));
    expect([v.estado, v.version, v.vb, v.oficial!.vb, v.oficial!.version]).toEqual(['Pendiente de revisión', 2, 1500, 1000, 1]);
    expect(V.ejecutado(v)).toBe(1000);
    expect(V.hayCambiosSinAprobar(v)).toBe(true);
    sesion('Supervisor', 'Sergio', 102);
    okv(V.devolver(o, 1, 'Sin sustento'));
    expect(AV.filas(o)[0].em).toBe(1000);
    sesion('Residente de obra', 'Rita Residente', 101);
    okv(V.registrar(o, dVal(o, '2026-10', 1200, { n: 1, editando: true })));
    sesion('Supervisor', 'Sergio', 102);
    okv(V.aprobar(o, 1));
    expect([v.estado, v.oficial!.vb, v.oficial!.version]).toEqual(['Aprobada', 1200, 2]);
    expect(v.historial.map((h) => h.accion)).toEqual(['Registró y envió a revisión', 'Aprobó', 'Modificó (nueva versión, pendiente de revisión)', 'Devolvió para corrección', 'Modificó (nueva versión, pendiente de revisión)', 'Aprobó']);
    expect(v.historial.map((h) => h.version)).toEqual([1, 1, 2, 2, 2, 2]);
  });
  it('marcar como pagada: solo aprobadas y por aprobadores; una pagada no se modifica', () => {
    const o = crear();
    valPendiente(o, '2026-10', 1000);
    sesion('Supervisor', 'Sergio', 102);
    expect(V.marcarPagada(o, 1).ok).toBe(false);
    V.aprobar(o, 1);
    sesion('Residente de obra', 'Rita', 101);
    expect(V.marcarPagada(o, 1).ok).toBe(false);
    sesion('Supervisor', 'Sergio', 102);
    okv(V.marcarPagada(o, 1));
    expect(V.porNumero(o, 1)!.estado).toBe('Pagada');
    sesion('Residente de obra', 'Rita', 101);
    expect(V.registrar(o, dVal(o, '2026-10', 9, { n: 1, editando: true })).ok).toBe(false);
    expect(V.totalEjecutado(o)).toBe(1000);
  });
  it('reglas: período único y fijo, amortización y retenciones acotadas, acumulado ≤ contrato', () => {
    const o = crear({ monto: '10000' });
    okv(V.registrar(o, dVal(o, '2026-10', 1000)));
    expect(V.registrar(o, dVal(o, '2026-10', 100)).ok).toBe(false);
    expect(V.registrar(o, dVal(o, '2026-11', 100, { advD: '5000' })).ok).toBe(false);
    expect(V.registrar(o, dVal(o, '2026-11', 100, { fondo: '500' })).ok).toBe(false);
    expect(V.registrar(o, dVal(o, '2026-11', 9500)).ok).toBe(false);
    expect(V.registrar(o, dVal(o, '2026-11', 100, { n: 1, editando: true, key: '2026-11' })).ok).toBe(false);
    expect(V.registrar(o, dVal(o, '2026-05', 100)).ok).toBe(false);
    expect(V.registrar(o, dVal(o, '2026-11', 100, { dias: '31' })).ok).toBe(false);
  });
  it('notificaciones: pendientes de revisión y de pago', () => {
    const o = crear();
    valPendiente(o, '2026-10', 1000);
    valAprobada(o, '2026-11', 500);
    const tx = AL.notificaciones().map((x) => x.texto).join('|');
    expect(tx).toMatch(/N\.º 01 pendiente de revisión/);
    expect(tx).toMatch(/N\.º 02 aprobada, pendiente de pago/);
  });
  it('cálculo de bloques I–VII', () => {
    const c = V.calcular({ vb: 10000, reaj: 500, ded: 200, advD: 2000, advM: 1000, fondo: 500, pen: 300 });
    expect(c).toEqual({ i: 10500, d: 200, vn: 10300, amort: 3000, sub: 7300, igv: 1314, fact: 8614, rm: 800, vl: 9500, pagar: 7814 });
  });
});

describe('Cartas de fianza', () => {
  const carta = { num: '0098765', tipo: 'Fiel cumplimiento', banco: 'BCP', monto: '1000', emision: '2026-01-10', vence: '2099-01-10' };
  it('registrar, renovar y rechazos', () => {
    const o = crear();
    const c = okv(CA.registrar(o, carta)).c;
    expect(CA.estado(c)).toBe('Vigente');
    expect(CA.registrar(o, { ...carta, vence: '2026-01-10' }).ok).toBe(false);
    expect(CA.registrar(o, carta, 999).ok).toBe(false);
    expect(CA.registrar(o, { ...carta, banco: '' }, c.id).ok).toBe(false);
    expect(c.sustituida).toBeUndefined();
    const r = okv(CA.registrar(o, { ...carta, num: '2' }, c.id)).c;
    expect(CA.estado(c)).toBe('Sustituida');
    expect(CA.registrar(o, { ...carta, num: '3' }, c.id).ok).toBe(false);
    expect(CA.totalGarantizado(o)).toBe(1000);
    expect(CA.proximoVencimiento(o)).toBe(r.vence);
  });
  it('alertas: falta fiel cumplimiento / carta vencida', () => {
    const o = crear();
    expect(AL.alerta(o)).toBe('Falta carta de fiel cumplimiento');
    okv(CA.registrar(o, { ...carta, emision: '2020-01-01', vence: '2020-06-01' }));
    expect(AL.alerta(o)).toBe('Carta vencida');
    expect(CA.masUrgente(o)?.num).toBe('0098765');
  });
});

describe('Persistencia', () => {
  it('guardar y cargar conserva todo', () => {
    A.persistir = true;
    localStorage.removeItem(Almacen.CLAVE);
    const o = crear({ monto: '100000' });
    O.registrarAmpliacion(o, { dias: '14', motivo: 'Lluvias' });
    AV.setProgramado(o, '2026-10', '10000');
    const w = okv(P.agregar(o, { ...trab, nombre: 'Marco Huamán', dni: '42351890', mensual: '3800' })).w;
    P.registrarPago(o, { w: w.id, fecha: '2026-11-05', monto: '3800', obs: 'Nov' });
    valAprobada(o, '2026-10', 8000);
    valPendiente(o, '2026-11', 100);
    expect(A.guardar()).toBe(true);
    const antes = JSON.stringify(A.obras);
    A.obras = [];
    expect(A.cargar()).toBe(true);
    expect(JSON.stringify(A.obras)).toBe(antes);
    const o2 = A.obras[0];
    expect([Plazo.plazoVigente(o2), P.totalPagado(o2), o2.programacion['2026-10'], V.totalEjecutado(o2), o2.data.vals[1].estado]).toEqual([104, 3800, 10000, 8000, 'Pendiente de revisión']);
    expect(JSON.stringify(A.usuarios)).not.toMatch(/password|contraseña/i);
    localStorage.removeItem(Almacen.CLAVE);
    A.persistir = false;
  });
  it('datos malformados no rompen ni bloquean; lo ilegible se respalda', () => {
    localStorage.setItem(Almacen.CLAVE, '{no es json');
    expect(A.cargar()).toBe(false);
    expect(A.errorCarga).toBe(true);
    expect(localStorage.getItem(Almacen.CLAVE + '.respaldo')).toBe('{no es json');
    A.restaurar({ obras: [null, 5, { id: 1, nombre: 'x', monto: 1, plazo: 10, inicio: '2026-10-01' }], usuarios: [3], permisos: { Valorizaciones: ['N', 'E', 'X', 'E'] } });
    expect(A.obras).toHaveLength(1);
    expect(A.obras[0].data.vals).toEqual([]);
    expect(A.usuarios).toEqual([ADMIN_INICIAL]);
    expect(A.permisos['Valorizaciones']).toEqual(['E', 'E', 'E', 'V']);
    A.restaurar({ permisos: { Valorizaciones: ['N', 'E', 'V', 'E'] } });
    expect(A.permisos['Valorizaciones'][0]).toBe('E');
    localStorage.removeItem(Almacen.CLAVE);
    localStorage.removeItem(Almacen.CLAVE + '.respaldo');
  });
});
