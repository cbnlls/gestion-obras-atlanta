import { Injectable, inject } from '@angular/core';
import { daysTo, pad2 } from '../utils/fechas';
import { fdate } from '../utils/formato';
import { CartaModelo } from './carta-modelo';
import { CalendarioModelo } from './calendario-modelo';
import { ObraModelo } from './obra-modelo';
import { Obra } from './tipos';
import { Plazo } from './plazo';

export interface Aviso {
  area: 'calendario' | 'fianza';
  tipo: 'warning' | 'danger';
  texto: string;
}

/** Alertas y avisos: cartas de fianza por vencer, valorizaciones pendientes y efecto de las ampliaciones de plazo. */
@Injectable({ providedIn: 'root' })
export class AlertasModelo {
  private readonly obras = inject(ObraModelo);
  private readonly cartas = inject(CartaModelo);
  private readonly calendario = inject(CalendarioModelo);

  /** Texto de alerta de la obra (cartas de fianza), o null si no tiene. */
  alerta(o: Obra): string | null {
    if (o.estado === 'Culminada') return null;
    const cs = this.cartas.todas(o);
    const venc = cs.filter((c) => this.cartas.estado(c) === 'Vencida');
    if (venc.length) return venc.length === 1 ? 'Carta vencida' : venc.length + ' cartas vencidas';
    const pv = cs.filter((c) => this.cartas.estado(c) === 'Por vencer');
    if (pv.length) {
      const d = Math.min(...pv.map((c) => daysTo(c.vence)));
      return `Carta vence en ${d} día${d === 1 ? '' : 's'}`;
    }
    if (!cs.some((c) => c.tipo === 'Fiel cumplimiento' && !c.sustituida)) return 'Falta carta de fiel cumplimiento';
    return null;
  }

  /** Lista para la campana. */
  notificaciones(): { texto: string; obra: string; obraId: number }[] {
    const items: { texto: string; obra: string; obraId: number }[] = [];
    const todas = this.obras.todas();
    todas.forEach((o) => {
      const a = this.alerta(o);
      if (a) items.push({ texto: a, obra: o.nombre, obraId: o.id });
    });
    todas.forEach((o) =>
      o.data.vals.forEach((v) => {
        const t = `Valorización N.º ${pad2(v.n)}`;
        if (v.estado === 'Pendiente de revisión') items.push({ texto: `${t} pendiente de revisión`, obra: o.nombre, obraId: o.id });
        else if (v.estado === 'Devuelta') items.push({ texto: `${t} devuelta para corrección`, obra: o.nombre, obraId: o.id });
        else if (v.estado === 'Aprobada') items.push({ texto: `${t} aprobada, pendiente de pago`, obra: o.nombre, obraId: o.id });
      }),
    );
    return items;
  }

  /** Avisos que dependen de la ampliación de plazo. */
  avisosPlazo(o: Obra): Aviso[] {
    const out: Aviso[] = [];
    const vig = Plazo.plazoVigente(o);
    const fin = Plazo.finVigente(o);
    const cal = this.calendario.estado(o);
    const base = cal.lineaBase;
    if (base && base.plazo != null && base.plazo !== vig) {
      const dif = vig - base.plazo;
      out.push({
        area: 'calendario',
        tipo: 'warning',
        texto:
          cal.estado === 'Aprobado'
            ? `La obra tiene una ampliación de ${dif} días que la línea base aprobada no incluye. Abre una nueva versión del calendario para agregar los meses nuevos.`
            : `La línea base aprobada no incluye la ampliación de ${dif} días. La versión que presentes debe incluir los meses nuevos.`,
      });
    }
    o.data.cartas
      .filter((c) => ['Vigente', 'Por vencer'].includes(this.cartas.estado(c)) && c.vence < fin)
      .forEach((c) => {
        out.push({ area: 'fianza', tipo: 'danger', texto: `La carta ${c.num || ''} (${c.tipo}) vence el ${fdate(c.vence)}, antes del fin vigente de la obra (${fdate(fin)}). Debe extenderse o renovarse.` });
      });
    return out;
  }
}
