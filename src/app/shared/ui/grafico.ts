import { Component, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { Chart, Plugin } from 'chart.js/auto';
import { FilaAvance } from '../../core/modelos/avance-modelo';
import { MES3 } from '../../core/utils/fechas';
import { Tema } from '../servicios/tema';

const variable = (n: string): string => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** Escribe el valor encima de cada punto o barra de los datasets que tengan «etiqueta». */
const ETIQUETAS: Plugin = {
  id: 'etiquetas',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = "700 11px 'Inter',sans-serif";
    chart.data.datasets.forEach((ds: any, i) => {
      if (!ds.etiqueta) return;
      ctx.fillStyle = ds.etiquetaColor || '#b45309';
      chart.getDatasetMeta(i).data.forEach((p, k) => {
        const v = ds.data[k];
        if (v == null) return;
        ctx.fillText(ds.etiqueta(v), p.x, p.y - (ds.type === 'bar' ? 5 : 10));
      });
    });
    ctx.restore();
  },
};

function preparar(): void {
  Chart.defaults.font.family = "'Inter',system-ui,sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = variable('--bs-secondary-color') || '#6c757d';
}

/** Curva S: avance físico acumulado programado vs. ejecutado. */
@Component({
  selector: 'app-curva-s',
  template: `<div [style.height.px]="alto()" style="position:relative"><canvas #lienzo role="img" aria-label="Curva S: avance físico acumulado programado contra ejecutado"></canvas></div>`,
})
export class CurvaS {
  readonly filas = input.required<FilaAvance[]>();
  readonly alto = input(320);
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private readonly tema = inject(Tema);

  constructor() {
    effect((limpiar) => {
      const rows = this.filas();
      this.tema.oscuro(); // se vuelve a dibujar al cambiar de tema
      preparar();
      const borde = variable('--bs-border-color');
      const ambar = '#f59e0b';
      const gris = variable('--bs-secondary-color');
      const fondo = variable('--bs-body-bg');
      const chart = new Chart(this.lienzo().nativeElement, {
        data: {
          labels: rows.map((r) => [MES3[+r.key.slice(5, 7) - 1], r.dias + 'd']),
          datasets: [
            { type: 'bar', label: 'Programado mensual', data: rows.map((r) => (r.pDef ? +r.pmPct.toFixed(2) : null)), backgroundColor: borde, borderRadius: 3, order: 3 },
            { type: 'bar', label: 'Ejecutado mensual', data: rows.map((r) => (r.emPct == null ? null : +r.emPct.toFixed(2))), backgroundColor: ambar, borderRadius: 3, order: 4 },
            { type: 'line', label: 'Plan acumulado', data: rows.map((r) => (r.planVisible ? +r.paPct.toFixed(2) : null)), borderColor: gris, borderDash: [5, 4], borderWidth: 2, pointRadius: 0, order: 2 },
            {
              type: 'line', label: 'Real acumulado', data: rows.map((r) => (r.eaPct == null ? null : +r.eaPct.toFixed(2))), borderColor: ambar, borderWidth: 2.6, pointRadius: 4.5,
              pointBackgroundColor: fondo, pointBorderColor: ambar, pointBorderWidth: 2.6, order: 1,
              etiqueta: (v: number) => v.toFixed(1) + '%', etiquetaColor: variable('--accent-text') || '#b45309',
            } as any,
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          scales: { y: { min: 0, max: 100, ticks: { stepSize: 20, callback: (v) => v + '%' }, grid: { color: borde } }, x: { grid: { display: false } } },
          plugins: {
            legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y == null ? '—' : c.parsed.y.toFixed(2) + '%'}` } },
          },
        },
        plugins: [ETIQUETAS],
      });
      limpiar(() => chart.destroy());
    });
  }
}

/** Trabajadores al cierre de cada mes. */
@Component({
  selector: 'app-grafico-personal',
  template: `<div [style.height.px]="alto()" style="position:relative"><canvas #lienzo role="img" aria-label="Personal por mes"></canvas></div>`,
})
export class GraficoPersonal {
  readonly datos = input.required<{ lab: string; n: number }[]>();
  readonly alto = input(170);
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private readonly tema = inject(Tema);

  constructor() {
    effect((limpiar) => {
      const pers = this.datos();
      this.tema.oscuro();
      preparar();
      const chart = new Chart(this.lienzo().nativeElement, {
        type: 'bar',
        data: { labels: pers.map((p) => p.lab), datasets: [{ label: 'Trabajadores', data: pers.map((p) => p.n), backgroundColor: '#fbbf4a', borderRadius: 4, etiqueta: (v: number) => String(v), etiquetaColor: variable('--bs-body-color') } as any] },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: variable('--bs-border-color') }, grace: '15%' }, x: { grid: { display: false } } },
          plugins: { legend: { display: false } },
        },
        plugins: [ETIQUETAS],
      });
      limpiar(() => chart.destroy());
    });
  }
}
