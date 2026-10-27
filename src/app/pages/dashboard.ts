import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Almacen } from '../core/modelos/almacen';
import { AlertasModelo } from '../core/modelos/alertas-modelo';
import { AvanceModelo } from '../core/modelos/avance-modelo';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Obra } from '../core/modelos/tipos';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { ValorizacionModelo } from '../core/modelos/valorizacion-modelo';
import { fmt, fmt0 } from '../core/utils/formato';
import { ModalObra } from '../modales/modal-obra';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';
import { Topbar } from '../shared/servicios/topbar';
import { Barra } from '../shared/ui/barra';
import { CardHead } from '../shared/ui/card-head';
import { colorEstadoObra } from '../shared/ui/colores';
import { CurvaS } from '../shared/ui/grafico';
import { Ico } from '../shared/ui/ico';
import { Kpi } from '../shared/ui/kpi';
import { Pill } from '../shared/ui/pill';
import { Vacio } from '../shared/ui/vacio';

@Component({
  selector: 'app-dashboard',
  imports: [Kpi, CardHead, CurvaS, Vacio, Pill, Barra, Ico],
  template: `
    @let v = vm();
    <div class="d-grid gap-3">
      <div class="row g-3">
        <app-kpi lab="Obras activas" [val]="v.activas" [sub]="v.total + ' obras en total'" ico="grid" oscuro />
        <app-kpi lab="Presupuesto" [val]="'S/ ' + (v.presupuesto / 1e6).toFixed(2) + 'M'" sub="Suma de contratos" ico="file" />
        <app-kpi lab="Avance promedio" [val]="v.promedio.toFixed(1) + '%'" sub="Obras en ejecución" ico="trend" />
        <app-kpi lab="Valorizaciones" [val]="v.pendientes" sub="Pendientes de pago" ico="bars" />
      </div>
      <div class="row g-3">
        <div class="col-xl-8">
          <div class="card h-100">
            <app-card-head titulo="Avance físico acumulado de la última obra visitada — Curva S" sub="Programado vs. ejecutado" />
            <div class="card-body">
              @if (v.filas) {
                <app-curva-s [filas]="v.filas" />
              } @else {
                <app-vacio icono="trend" titulo="Sin datos suficientes para la Curva S" desc="Registra la programación mensual en Avance físico. El avance ejecutado sale de las valorizaciones aprobadas." />
              }
            </div>
          </div>
        </div>
        <div class="col-xl-4">
          <div class="card h-100">
            <app-card-head titulo="Estado de obras" />
            <div class="pt-2">
              @for (s of v.estados; track s.l) {
                <div class="px-3 py-2">
                  <div class="d-flex justify-content-between small mb-1"><span>{{ s.l }}</span><b>{{ s.n }}</b></div>
                  <div class="progress" style="height:6px"><div class="progress-bar" [class]="'bg-' + s.color" [style.width.%]="v.total ? (s.n / v.total) * 100 : 0"></div></div>
                </div>
              }
            </div>
            <div class="m-3 p-3 border rounded-3 bg-body-tertiary">
              <div class="etiqueta mb-1">Total ejecutado (valorización bruta)</div>
              <div class="head fs-3 lh-1">S/ {{ fmt(v.ejecutado) }}</div>
              <div class="small text-body-secondary mb-2">de S/ {{ fmt(v.monto) }}</div>
              <div class="progress" style="height:6px"><div class="progress-bar bg-warning" [style.width.%]="v.monto ? min(100, (v.ejecutado / v.monto) * 100) : 0"></div></div>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <app-card-head titulo="Obras recientes" sub="Haz clic en una fila para ver la ficha técnica" />
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 tabla">
            <thead><tr><th>Nombre de la obra</th><th>Contrato</th><th>Estado</th><th class="text-end">Monto</th><th>Avance</th><th class="text-center">Alerta</th></tr></thead>
            <tbody>
              @for (f of v.filasObras; track f.o.id) {
                <tr class="fila-click" tabindex="0" (click)="seleccionar(f.o)" (keydown.enter)="seleccionar(f.o)">
                  <td><span class="fw-semibold text-primary">{{ f.o.nombre }}</span><div class="small text-body-secondary">{{ f.o.entidad }}</div></td>
                  <td class="font-monospace text-body-secondary">{{ f.o.contrato }}</td>
                  <td><app-pill [color]="colorEstado(f.o.estado)">{{ f.o.estado }}</app-pill></td>
                  <td class="text-end font-monospace">S/ {{ fmt0(f.o.monto) }}</td>
                  <td><app-barra [pct]="f.avance" [cls]="f.o.estado === 'Culminada' ? 'green' : ''" /></td>
                  <td class="text-center"><app-pill [color]="f.alerta ? 'amber' : 'gray'">{{ f.alerta ?? 'Sin alertas' }}</app-pill></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <app-vacio icono="grid" titulo="Aún no hay obras" desc="Crea tu primera obra para ver aquí el resumen.">
                      @if (puedeCrear()) {
                        <button class="btn btn-warning" (click)="modal.abrir(modalObra)"><app-ico n="plus" [s]="14" /> Nueva obra</button>
                      }
                    </app-vacio>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class Dashboard {
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  private readonly avance = inject(AvanceModelo);
  private readonly vals = inject(ValorizacionModelo);
  private readonly alertas = inject(AlertasModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);
  protected readonly modal = inject(ModalServicio);
  protected readonly modalObra = ModalObra;
  protected readonly fmt = fmt;
  protected readonly fmt0 = fmt0;
  protected readonly min = Math.min;
  protected readonly colorEstado = colorEstadoObra;

  constructor() {
    inject(Topbar).fijar('Dashboard', 'Resumen general de todas las obras');
  }

  protected readonly puedeCrear = computed(() => (this.almacen.rev(), this.usuarios.puede('Ficha técnica', 'editar')));

  protected readonly vm = computed(() => {
    this.almacen.rev();
    const todas = this.obras.todas();
    const o = this.obras.activa();
    const act = todas.filter((x) => x.estado === 'En ejecución');
    const cnt = (e: string) => todas.filter((x) => x.estado === e).length;
    return {
      total: todas.length,
      activas: act.length,
      presupuesto: this.obras.presupuestoTotal(),
      promedio: act.length ? act.reduce((a, x) => a + this.avance.progreso(x).ej, 0) / act.length : 0,
      pendientes: todas.reduce((a, x) => a + this.vals.pendientesDePago(x), 0),
      filas: o && this.avance.hayProgramacion(o) ? this.avance.filas(o) : null,
      ejecutado: o ? this.vals.totalEjecutado(o) : 0,
      monto: o ? o.monto : 0,
      estados: [
        { l: 'En ejecución', n: cnt('En ejecución'), color: 'warning' },
        { l: 'Por iniciar', n: cnt('Por iniciar'), color: 'primary' },
        { l: 'Culminadas', n: cnt('Culminada'), color: 'success' },
      ],
      filasObras: todas.map((x) => ({ o: x, avance: this.avance.progreso(x).ej, alerta: this.alertas.alerta(x) })),
    };
  });

  protected seleccionar(o: Obra): void {
    this.obras.seleccionar(o.id);
    this.toast.mostrar('Obra activa: ' + o.nombre);
    this.router.navigateByUrl('/ficha');
  }
}
