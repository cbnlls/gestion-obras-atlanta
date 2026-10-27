/* Tipos del dominio. Describen la forma de los datos que guarda el Almacén
   (hoy en el navegador; cuando se migre a Supabase, cada interfaz corresponde a una tabla). */

/** Resultado de una operación de los modelos: {ok:true,...} o {ok:false,error,campo?}. */
export interface Fallo {
  ok: false;
  error: string;
  /** nombre del campo del formulario al que pertenece el error */
  campo?: string;
}
export type Res<T extends object = object> = ({ ok: true } & T) | Fallo;

/* ---------- usuarios y permisos ---------- */
export const ROLES = ['Administrador', 'Residente de obra', 'Supervisor', 'Solo lectura'] as const;
export type Rol = (typeof ROLES)[number];

export const MODULOS = [
  'Ficha técnica',
  'Valorizaciones',
  'Avance físico',
  'Calendario de obra',
  'Mano de obra',
  'Cartas de fianza',
  'Usuarios y roles',
] as const;
/** Módulos de la matriz de permisos (además existe «Aprobar calendario», que no es una pantalla). */
export type Modulo = (typeof MODULOS)[number] | 'Aprobar calendario';

/** E = editar · V = ver · N = sin acceso. Las columnas siguen el orden de ROLES. */
export type Nivel = 'E' | 'V' | 'N';
export type Permisos = Record<Modulo, Nivel[]>;

export interface Usuario {
  id: number;
  nombre: string;
  user: string;
  mail: string;
  rol: Rol;
  obras: 'all' | number[];
  activo: boolean;
}

export interface Sesion {
  nombre: string;
  rol: Rol | null;
  userId: number | null;
}

/* ---------- obras ---------- */
export const ESTADOS_OBRA = ['Por iniciar', 'En ejecución', 'Culminada'] as const;
export type EstadoObra = (typeof ESTADOS_OBRA)[number];

export const SISTEMAS = ['Precios unitarios', 'Suma alzada', 'Esquema mixto'] as const;
export type Sistema = (typeof SISTEMAS)[number];

export interface Ampliacion {
  id: number;
  dias: number;
  motivo: string;
  fecha: string;
  usuario: string;
  estado: string;
}

/* ---------- calendario valorizado ---------- */
export interface ItemCalendario {
  type: 'cap' | 'sub' | 'par';
  code: string;
  desc: string;
  und?: string;
  metrado?: number;
  pu?: number;
  /** solo las partidas: monto programado por mes ('AAAA-MM') */
  months?: Record<string, number>;
}

export type EstadoCalendario = 'Borrador' | 'Presentado' | 'Aprobado';

export interface EventoCalendario {
  id: number;
  fecha: string;
  hora: string;
  usuario: string;
  rol: string;
  accion: string;
  version: number;
  comentario: string;
}

export interface CalendarioEstado {
  estado: EstadoCalendario;
  version: number;
  historial: EventoCalendario[];
  lineaBase?: {
    fecha: string;
    version: number;
    plazo: number;
    usuario: string;
    datos: { cal: ItemCalendario[]; prog: Record<string, number> };
  };
}

export type EstadoPartida = 'sin_programar' | 'incompleta' | 'completa' | 'excede';

/* ---------- valorizaciones ---------- */
export const ESTADOS_VAL = ['Pendiente de revisión', 'Devuelta', 'Aprobada', 'Pagada'] as const;
export type EstadoVal = (typeof ESTADOS_VAL)[number];

/** Importes que escribe el usuario en una valorización. */
export interface Importes {
  vb: number;
  reaj: number;
  ded: number;
  advD: number;
  advM: number;
  fondo: number;
  pen: number;
}

export interface Oficial extends Importes {
  version: number;
  aprobadoPor: string;
  rol: string;
  fecha: string;
}

export interface Autor {
  usuario: string;
  rol: Rol | null;
  userId: number | null;
}

export interface EventoValorizacion {
  id: number;
  fecha: string;
  hora: string;
  usuario: string;
  rol: string;
  userId: number | null;
  accion: string;
  version: number;
  comentario: string;
  valoresAnteriores?: Record<string, unknown> | null;
  valoresNuevos?: Record<string, unknown> | null;
  valoresAprobados?: Oficial;
  estadoAnterior?: EstadoVal;
  estadoNuevo?: EstadoVal;
}

export interface Valorizacion extends Importes {
  n: number;
  key: string;
  dias: number;
  estado: EstadoVal;
  version: number;
  oficial: Oficial | null;
  historial: EventoValorizacion[];
  registradoPor: Autor | null;
}

/** Bloques I–VII calculados a partir de los importes. */
export interface Bloques {
  i: number;
  d: number;
  vn: number;
  amort: number;
  sub: number;
  igv: number;
  fact: number;
  rm: number;
  vl: number;
  pagar: number;
}

/* ---------- mano de obra ---------- */
export const CATEGORIAS = ['Peón', 'Oficial', 'Operario', 'Personal técnico'] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export const CONTRATOS = ['Por obra', 'Plazo fijo', 'Por servicio'] as const;
export type Contrato = (typeof CONTRATOS)[number];
export const MOTIVOS_CESE = ['Término de contrato', 'Renuncia', 'Fin de obra', 'Otro'] as const;
export type MotivoCese = (typeof MOTIVOS_CESE)[number];

export interface Trabajador {
  id: number;
  nombre: string;
  dni: string;
  cargo: string;
  cat: Categoria;
  ini: string;
  fin: string | null;
  mensual: number;
  contrato: Contrato;
  motivo?: MotivoCese;
}

export interface Pago {
  id: number;
  workerId: number;
  fecha: string;
  monto: number;
  obs: string;
}

/* ---------- cartas de fianza ---------- */
export const TIPOS_CARTA = ['Fiel cumplimiento', 'Adelanto directo', 'Adelanto para materiales'] as const;
export type TipoCarta = (typeof TIPOS_CARTA)[number];
export type EstadoCarta = 'Sustituida' | 'Vencida' | 'Por vencer' | 'Vigente';

export type TipoArchivo = 'pdf' | 'jpg' | 'png';

export interface DocumentoCarta {
  id: number;
  nombre: string;
  tipo: TipoArchivo;
  tamano: number;
  fecha: string;
  usuario: string;
}

export interface Carta {
  id: number;
  num: string;
  tipo: TipoCarta;
  banco: string;
  monto: number;
  emision: string;
  vence: string;
  docs: DocumentoCarta[];
  sustituida?: boolean;
}

/* ---------- obra ---------- */
export interface Obra {
  id: number;
  nombre: string;
  contrato: string;
  entidad: string;
  rucEntidad: string;
  contratista: string;
  monto: number;
  sistema: Sistema;
  adelantoPct: number;
  /** plazo contractual original, en días calendario */
  plazo: number;
  inicio: string;
  ampliaciones: Ampliacion[];
  /** programación mensual escrita a mano en Avance físico ('AAAA-MM' → monto) */
  programacion: Record<string, number>;
  calEstado: CalendarioEstado;
  estado: EstadoObra;
  residente: string;
  supervisor: string;
  data: {
    vals: Valorizacion[];
    cal: ItemCalendario[];
    workers: Trabajador[];
    pagos: Pago[];
    cartas: Carta[];
  };
}

/** Periodo mensual dentro del plazo de una obra. */
export interface Periodo {
  key: string;
  desde: string;
  hasta: string;
  dias: number;
}

/** Partida de detalle del calendario (tiene metrado, precio unitario y montos por mes). */
export type Partida = ItemCalendario & { type: 'par'; und: string; metrado: number; pu: number; months: Record<string, number> };
