/* Plazos, fechas y periodos mensuales de una obra.
   ÚNICO lugar donde se calcula: fecha de fin, periodos del mes (con sus días) y plazo vigente con ampliaciones.
   Regla: el día de inicio cuenta como día 1; fin = inicio + (plazo − 1) días.
   Todo el cálculo es por días de calendario en UTC (sin problemas de zona horaria ni de horario de verano). */

import { daysInMonth, nextKey, pad2 } from '../utils/fechas';
import { Obra, Periodo } from './tipos';

type DatosPlazo = Pick<Obra, 'plazo' | 'inicio' | 'ampliaciones'>;

export const Plazo = {
  /** Periodos mensuales que se pueden representar (límite técnico de periodos(); más allá se perderían días sin avisar). */
  MAX_MESES: 240,

  _t(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  },
  sumarDias(iso: string, n: number): string {
    const t = new Date(Plazo._t(iso) + n * 86400000);
    return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate());
  },
  diasEntre: (a: string, b: string): number => Math.round((Plazo._t(b) - Plazo._t(a)) / 86400000),
  fin: (inicio: string, dias: number): string => Plazo.sumarDias(inicio, dias - 1),

  /** Periodos mensuales entre el inicio y el fin: la suma de días = plazo. */
  periodos(inicio: string, dias: number): Periodo[] {
    const fin = Plazo.fin(inicio, dias);
    const out: Periodo[] = [];
    let k = inicio.slice(0, 7);
    let g = 0;
    while (k <= fin.slice(0, 7) && g++ < Plazo.MAX_MESES) {
      const desde = k === inicio.slice(0, 7) ? inicio : k + '-01';
      const hasta = k === fin.slice(0, 7) ? fin : k + '-' + pad2(daysInMonth(k));
      out.push({ key: k, desde, hasta, dias: Plazo.diasEntre(desde, hasta) + 1 });
      k = nextKey(k);
    }
    return out;
  },

  /* datos originales del contrato (nunca se modifican) */
  finOriginal: (o: DatosPlazo): string => Plazo.fin(o.inicio, o.plazo),

  /* ampliaciones aprobadas y datos vigentes */
  diasAmpliados: (o: DatosPlazo): number => o.ampliaciones.reduce((a, x) => a + x.dias, 0),
  plazoVigente: (o: DatosPlazo): number => o.plazo + Plazo.diasAmpliados(o),
  finVigente: (o: DatosPlazo): string => Plazo.fin(o.inicio, Plazo.plazoVigente(o)),
  periodosObra: (o: DatosPlazo): Periodo[] => Plazo.periodos(o.inicio, Plazo.plazoVigente(o)),
  /** Meses ('AAAA-MM') de la obra según el plazo vigente. */
  meses: (o: DatosPlazo): string[] => Plazo.periodosObra(o).map((p) => p.key),
  periodo: (o: DatosPlazo, key: string): Periodo | null => Plazo.periodosObra(o).find((p) => p.key === key) || null,
  diasPeriodo(o: DatosPlazo, key: string): number {
    const p = Plazo.periodo(o, key);
    return p ? p.dias : daysInMonth(key);
  },
};
