/* Utilidades de fechas y meses (los meses se identifican como 'AAAA-MM').
   «Hoy» se calcula en cada llamada: si la pestaña queda abierta después de medianoche, los sellos de fecha,
   los días para vencer y el mes en curso no se quedan en el día en que se cargó la página. */

export const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MES3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const pad2 = (n: number | string): string => String(n).padStart(2, '0');

/** Hoy al mediodía (hora local): evita saltos de día por cambios de horario. */
export function hoy(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}
export function hoyIso(): string {
  const t = hoy();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}
/** Mes en curso ('AAAA-MM'). */
export const corte = (): string => hoyIso().slice(0, 7);

/** Días desde hoy hasta una fecha ISO (negativo si ya pasó). */
export const daysTo = (iso: string): number => Math.round((new Date(iso + 'T12:00:00').getTime() - hoy().getTime()) / 86400000);

export const mLabel = (k: string): string => MES[+k.slice(5, 7) - 1];
export const mShort = (k: string): string => MES3[+k.slice(5, 7) - 1] + '-' + k.slice(2, 4);
export const nextKey = (k: string): string => {
  let y = +k.slice(0, 4);
  let m = +k.slice(5, 7) + 1;
  if (m > 12) {
    m = 1;
    y++;
  }
  return y + '-' + pad2(m);
};
/** En UTC: sin problemas de zona horaria. */
export const daysInMonth = (k: string): number => new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0)).getUTCDate();
