import { AbstractControl, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Validar } from '../../core/modelos/validar';

/* Cada campo puede declarar un «tipo» (dni, ruc, nombre, importe...). Ese tipo define:
   - qué caracteres se pueden escribir (filtro al escribir),
   - atributos HTML (maxlength, inputmode),
   - la regla de validación (la MISMA de los modelos: Validar.*), que se aplica al escribir y al guardar. */
export interface TipoCampo {
  filtro: string | null;
  regla: string;
  maxlength?: number;
  inputmode?: string;
  min?: string;
  max?: string;
}

export const TIPOS: Record<string, TipoCampo> = {
  dni: { filtro: 'digitos', regla: 'dni', maxlength: 8, inputmode: 'numeric' },
  ruc: { filtro: 'digitos', regla: 'ruc', maxlength: 11, inputmode: 'numeric' },
  nombre: { filtro: 'nombre', regla: 'nombre', maxlength: 80 },
  correo: { filtro: 'correo', regla: 'correo', maxlength: 254, inputmode: 'email' },
  usuario: { filtro: 'usuario', regla: 'usuario', maxlength: 30 },
  contrato: { filtro: 'contrato', regla: 'contrato', maxlength: 30 },
  codigo: { filtro: 'codigo', regla: 'codigo', maxlength: 25 },
  banco: { filtro: null, regla: 'banco', maxlength: 40 },
  importe: { filtro: 'importe', regla: 'importe', maxlength: 15, inputmode: 'decimal' },
  'importe+': { filtro: 'importe', regla: 'importe+', maxlength: 15, inputmode: 'decimal' },
  'importe±': { filtro: 'importe-signo', regla: 'importe±', maxlength: 16, inputmode: 'decimal' },
  cantidad: { filtro: 'cantidad', regla: 'cantidad', maxlength: 14, inputmode: 'decimal' },
  porcentaje: { filtro: 'porcentaje', regla: 'porcentaje', maxlength: 6, inputmode: 'decimal' },
  entero: { filtro: 'entero', regla: 'entero', maxlength: 6, inputmode: 'numeric' },
  fecha: { filtro: null, regla: 'fecha', min: '2000-01-01', max: '2100-12-31' }, // mismo rango que Validar.fecha
  texto: { filtro: null, regla: 'texto', maxlength: 300 },
};

const REGLAS: Record<string, (v: string, max?: number) => string> = {
  dni: Validar.dni,
  ruc: Validar.ruc,
  nombre: Validar.nombre,
  correo: Validar.correo,
  usuario: Validar.usuario,
  contrato: Validar.contrato,
  codigo: Validar.codigo,
  banco: Validar.banco,
  importe: (v) => Validar.importe(v),
  'importe+': (v) => Validar.importe(v, { positivo: true }),
  'importe±': (v) => Validar.importe(v, { negativo: true }),
  cantidad: Validar.cantidad,
  porcentaje: (v) => Validar.porcentaje(v),
  entero: (v) => Validar.entero(v, { max: 3650 }),
  fecha: Validar.fecha,
  texto: (v, max) => Validar.texto(v, max || 300), // el límite de cada campo debe coincidir con el del modelo
};

/** Validador de un tipo de campo: un campo vacío es válido aquí (la obligatoriedad se valida aparte). */
export function validadorTipo(tipo: string, max?: number): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = String(c.value ?? '').trim();
    if (v === '') return null;
    const msg = REGLAS[TIPOS[tipo].regla](v, max);
    return msg ? { tipo: msg } : null;
  };
}

export const requerido: ValidatorFn = (c) => (String(c.value ?? '').trim() === '' ? { requerido: true } : null);

/** Crea el control de un campo de texto de un formulario. */
export function campo(tipo?: string | null, o: { req?: boolean; max?: number; valor?: string; validadores?: ValidatorFn[] } = {}): FormControl<string> {
  const v: ValidatorFn[] = [];
  if (o.req) v.push(requerido);
  if (tipo) v.push(validadorTipo(tipo, o.max));
  if (o.validadores) v.push(...o.validadores);
  return new FormControl(o.valor ?? '', { nonNullable: true, validators: v });
}
