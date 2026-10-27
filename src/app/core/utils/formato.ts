/* Utilidades de formato: dinero, números y fechas legibles */

export const fmt = (n: number | null | undefined): string =>
  n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt0 = (n: number): string => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

/** Redondeo a 2 decimales (centavos). */
export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Texto con posibles comas de miles → número (0 si no es válido). */
export const num = (s: unknown): number => {
  const v = parseFloat(String(s == null ? '' : s).replace(/,/g, ''));
  return isNaN(v) ? 0 : v;
};

/** 'AAAA-MM-DD' → 'DD/MM/AAAA'. */
export const fdate = (iso: string | null | undefined): string => (iso ? iso.split('-').reverse().join('/') : '—');
