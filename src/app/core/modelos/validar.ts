/* Validaciones: reglas ÚNICAS de formato, usadas por los formularios (al escribir y al guardar)
   y por los modelos (reglas de negocio). Cada regla devuelve '' si el valor es válido o el mensaje de error. */

const L = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const RE_NOMBRE = new RegExp(`^[${L}]+\\.?(?:(?: |['’\\-])[${L}]+\\.?)*$`);
const RE_BANCO = new RegExp(`^[${L}0-9][${L}0-9 .&\\-]*$`);
const RE_NOMBRE_FILTRO = new RegExp(`[^${L} '’.\\-]`, 'g');

/** Límite técnico de importes: 12 dígitos enteros + 2 decimales (igual que el maxlength de los formularios);
 *  evita perder precisión en los cálculos. */
export const MAX_IMPORTE = 999999999999.99;

export type Regla = (v: unknown) => string;

/** Texto recortado; null/undefined cuentan como vacío (String(null) daría el texto "null", que pasaría como válido). */
const s = (v: unknown): string => (v == null ? '' : String(v).trim());
const miles = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const Validar = {
  vacio: (v: unknown): boolean => v == null || String(v).trim() === '',

  /** Hace opcional una regla: si el campo está vacío es válido. */
  opc:
    (regla: Regla): Regla =>
    (v) =>
      Validar.vacio(v) ? '' : regla(v),

  dni: (v: unknown): string => (/^\d{8}$/.test(s(v)) ? '' : 'El DNI debe tener exactamente 8 dígitos.'),
  ruc: (v: unknown): string => (/^\d{11}$/.test(s(v)) ? '' : 'El RUC debe tener exactamente 11 dígitos.'),

  /** Nombres y apellidos: letras (con tildes y ñ), espacios, apóstrofo y guion; se admite "Ing." con punto. */
  nombre(v: unknown): string {
    const t = s(v);
    if (!t) return 'Completa este campo.';
    if (t.length < 2) return 'Escribe al menos 2 letras.';
    if (t.length > 80) return 'Máximo 80 caracteres.'; // mismo límite que el formulario
    return RE_NOMBRE.test(t) ? '' : 'Usa solo letras, espacios, apóstrofo o guion (sin números ni símbolos).';
  },

  correo(v: unknown): string {
    const t = s(v);
    if (!t) return 'Completa este campo.';
    /* parte local sin punto inicial/final ni dobles (máx. 64); etiquetas del dominio sin guion al inicio o al final */
    return t.length <= 254 &&
      /^(?=[^@]{1,64}@)[A-Za-z0-9_%+\-]+(?:\.[A-Za-z0-9_%+\-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/.test(t)
      ? ''
      : 'Ingresa un correo válido (ej.: nombre@dominio.com).';
  },

  usuario(v: unknown): string {
    if (Validar.vacio(v)) return 'Completa este campo.';
    return /^[A-Za-z0-9._-]{3,30}$/.test(s(v)) ? '' : 'Usa de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.';
  },

  contrato(v: unknown): string {
    const t = s(v);
    if (!t) return 'Completa este campo.';
    return t.length <= 30 && /^(?=.*\d)[A-Za-z0-9][A-Za-z0-9.\-/]*$/.test(t) ? '' : 'Usa números, letras y los separadores - . / (ej.: 014-2026).';
  },

  /** Número de carta, etc. */
  codigo(v: unknown): string {
    const t = s(v);
    if (!t) return 'Completa este campo.';
    return t.length <= 25 && /^[A-Za-z0-9][A-Za-z0-9.\-/]*$/.test(t) ? '' : 'Usa solo letras, números y los separadores - . /';
  },

  banco(v: unknown): string {
    const t = s(v);
    if (!t) return 'Completa este campo.';
    return t.length <= 40 && RE_BANCO.test(t) ? '' : 'Usa solo letras, números, espacios y . & -';
  },

  texto(v: unknown, max = 300): string {
    const t = s(v);
    if (!t) return 'Completa este campo.';
    return t.length > max ? `Máximo ${max} caracteres.` : '';
  },

  /** Importes: números con hasta 2 decimales; coma solo como separador de miles. */
  importe(v: unknown, o: { positivo?: boolean; negativo?: boolean; max?: number } = {}): string {
    const t = String(v == null ? '' : v).trim();
    if (!t) return 'Completa este campo.';
    const re = o.negativo ? /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/ : /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;
    if (/^-/.test(t) && !o.negativo) return 'No se permiten importes negativos.';
    if (!re.test(t)) return 'Ingresa un importe válido (solo números, hasta 2 decimales).';
    const n = Validar.numero(t);
    if (o.positivo && !(n > 0)) return 'El importe debe ser mayor a 0.';
    const max = o.max == null ? MAX_IMPORTE : o.max;
    if (Math.abs(n) > max) return `El importe no puede superar ${miles(max)}.`;
    return '';
  },

  /** Cantidades (metrados): hasta 3 decimales, mayores a 0. */
  cantidad(v: unknown): string {
    const t = String(v == null ? '' : v).trim();
    if (!t) return 'Completa este campo.';
    if (/^-/.test(t)) return 'No se permiten valores negativos.';
    if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,3})?$/.test(t)) return 'Ingresa un número válido (hasta 3 decimales).';
    const n = Validar.numero(t);
    if (!(n > 0)) return 'Debe ser mayor a 0.';
    return n > MAX_IMPORTE ? `La cantidad no puede superar ${miles(MAX_IMPORTE)}.` : '';
  },

  porcentaje(v: unknown, o: { min?: number; max?: number } = {}): string {
    const t = String(v == null ? '' : v).trim();
    const min = o.min == null ? 0 : o.min;
    const max = o.max == null ? 100 : o.max;
    if (!t) return 'Completa este campo.';
    if (!/^\d+(?:\.\d{1,2})?$/.test(t)) return 'Ingresa un porcentaje válido (solo números, hasta 2 decimales).';
    const n = +t;
    return n >= min && n <= max ? '' : `El porcentaje debe estar entre ${min} y ${max}.`;
  },

  entero(v: unknown, o: { min?: number; max?: number } = {}): string {
    const t = String(v == null ? '' : v).trim();
    const min = o.min == null ? 1 : o.min;
    const max = o.max == null ? 100000 : o.max;
    if (!t) return 'Completa este campo.';
    if (!/^\d+$/.test(t)) return 'Ingresa un número entero (sin decimales ni signos).';
    const n = +t;
    return n >= min && n <= max ? '' : `Debe estar entre ${min} y ${max}.`;
  },

  fecha(v: unknown): string {
    const t = String(v || '').trim();
    if (!t) return 'Completa este campo.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return 'Ingresa una fecha válida.';
    const [y, m, d] = t.split('-').map(Number);
    const f = new Date(Date.UTC(y, m - 1, d));
    return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d && y >= 2000 && y <= 2100 ? '' : 'Ingresa una fecha válida.';
  },

  /** Conversión estricta de texto a número (NaN si no es un importe válido).
   *  Los separadores de miles solo valen de 3 en 3 (1,234.50); "1,2,3" o "12,34" no se convierten en silencio. */
  numero(v: unknown): number {
    const t = String(v == null ? '' : v).trim();
    return /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(t) ? Number(t.replace(/,/g, '')) : NaN;
  },

  /** Filtros para limpiar lo que se escribe (la persona no puede introducir caracteres no permitidos). */
  filtrar(tipo: string | null | undefined, v: string): string {
    const unPunto = (m: string, i: number, t: string) => (t.indexOf('.') === i ? '.' : '');
    switch (tipo) {
      case 'digitos':
      case 'entero':
        return v.replace(/\D/g, '');
      case 'importe':
      case 'cantidad':
        return v.replace(/[^\d.,]/g, '').replace(/\./g, unPunto);
      case 'importe-signo':
        return v.replace(/[^\d.,-]/g, '').replace(/(?!^)-/g, '').replace(/\./g, unPunto);
      case 'porcentaje':
        return v.replace(/[^\d.]/g, '').replace(/\./g, unPunto);
      case 'nombre':
        return v.replace(RE_NOMBRE_FILTRO, '').replace(/ {2,}/g, ' ').replace(/^ /, '');
      case 'contrato':
      case 'codigo':
        return v.replace(/[^A-Za-z0-9.\-/]/g, '');
      case 'usuario':
        return v.replace(/[^A-Za-z0-9._-]/g, '');
      case 'correo':
        return v.replace(/\s/g, '');
      default:
        return v;
    }
  },
};
