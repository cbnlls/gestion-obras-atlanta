import { Component, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Almacen } from '../core/modelos/almacen';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { PersonalModelo } from '../core/modelos/personal-modelo';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { mLabel } from '../core/utils/fechas';
import { fdate, fmt } from '../core/utils/formato';
import { ModalCese } from '../modales/modal-cese';
import { ModalPago } from '../modales/modal-pago';
import { ModalTrabajador } from '../modales/modal-trabajador';
import { ModalServicio } from '../shared/servicios/modal';
import { Topbar } from '../shared/servicios/topbar';
import { CardHead } from '../shared/ui/card-head';
import { GraficoPersonal } from '../shared/ui/grafico';
import { Ico } from '../shared/ui/ico';
import { KpiB } from '../shared/ui/kpi';
import { Pill } from '../shared/ui/pill';
import { SinObra } from '../shared/ui/sin-obra';
import { Vacio } from '../shared/ui/vacio';

/** Mano de obra (padrón, pagos registrados y resumen mensual). El gasto de mano de obra NO se usa como avance físico. */
@Component({
  selector: 'app-mano-de-obra',
  imports: [CardHead, GraficoPersonal, Ico, KpiB, Pill, SinObra, Vacio],
  template: `
    <ng-template #acciones>
      @if (v(); as x) {
        @if (x.puedeEd) {
          @if (x.hayTrabajadores) {
            <button class="btn btn-outline-danger" (click)="modal.abrir(cese)">Cese de personal</button>
            <button class="btn btn-outline-secondary" (click)="modal.abrir(pago)"><app-ico n="plus" [s]="14" /> Registrar pago</button>
          }
          <button class="btn btn-warning" (click)="modal.abrir(trabajador)"><app-ico n="plus" [s]="14" /> Agregar trabajador</button>
        }
      }
    </ng-template>
    @if (v(); as x) {
      @if (!x.hayTrabajadores) {
        <div class="card">
          <app-vacio icono="users" titulo="Padrón vacío" desc="Agrega al primer trabajador de esta obra.">
            @if (x.puedeEd) {
              <button class="btn btn-warning" (click)="modal.abrir(trabajador)"><app-ico n="plus" [s]="14" /> Agregar trabajador</button>
            }
          </app-vacio>
        </div>
      } @else {
        <div class="row g-3">
          <app-kpi-b [val]="x.activos" lab="Personal activo" oscuro />
          <app-kpi-b [val]="x.operarios" lab="Operarios" />
          <app-kpi-b [val]="x.oficiales" lab="Oficiales" />
          <app-kpi-b [val]="x.peones" lab="Peones" />
        </div>
        <div class="row g-3 mt-1">
          <div class="col-xl-9">
            <div class="card">
              <app-card-head titulo="Padrón de personal">
                <input class="form-control form-control-sm" style="width:180px" placeholder="Buscar..." aria-label="Buscar trabajador" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
              </app-card-head>
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0 tabla">
                  <thead>
                    <tr><th>Trabajador</th><th>Cargo / cat.</th><th>F. inicio</th><th>F. fin</th><th class="text-end">Pago mensual</th><th class="text-end" title="Suma de los pagos registrados a este trabajador">Total pagado</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    @for (w of x.lista; track w.w.id) {
                      <tr>
                        <td><div class="fw-semibold">{{ w.w.nombre }}</div><div class="small font-monospace text-body-secondary">DNI {{ w.w.dni }}</div></td>
                        <td>{{ w.w.cargo }}<div class="small text-body-secondary">{{ w.w.cat }}</div></td>
                        <td class="font-monospace">{{ fdate(w.w.ini) }}</td>
                        <td class="font-monospace" [class.text-danger]="w.w.fin">{{ w.w.fin ? fdate(w.w.fin) : '—' }}</td>
                        <td class="text-end font-monospace">{{ fmt(w.w.mensual) }}</td>
                        <td class="text-end font-monospace"><b>{{ fmt(w.pagado) }}</b></td>
                        <td>
                          @if (w.activo) {
                            <app-pill color="green">Activo</app-pill>
                          } @else {
                            <app-pill color="gray">Cesó el {{ w.w.fin!.slice(8) }}/{{ w.w.fin!.slice(5, 7) }}</app-pill>
                          }
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="7" class="text-center text-body-secondary py-4">Sin resultados para «{{ busqueda() }}»</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="col-xl-3">
            <div class="card h-100">
              <app-card-head titulo="Personal por mes" />
              <div class="card-body">
                @if (x.porMes.length) {
                  <app-grafico-personal [datos]="x.porMes" />
                  <p class="small text-body-secondary mt-3 mb-0">Trabajadores al cierre de cada mes.</p>
                } @else {
                  <app-vacio icono="users" titulo="Sin historial" />
                }
              </div>
            </div>
          </div>
        </div>
        <div class="card mt-3">
          <app-card-head titulo="Resumen mensual de pagos" sub="Se calcula solo con los pagos registrados; no es avance físico" />
          <div class="table-responsive">
            <table class="table align-middle mb-0 tabla">
              <thead><tr><th>Mes y año</th><th class="text-end">Total pagado en el mes</th><th class="text-end">Total acumulado</th><th>Pagos que lo componen</th></tr></thead>
              <tbody>
                @for (m of x.resumen; track m.key) {
                  <tr>
                    <td class="fw-semibold">{{ mLabel(m.key) }} {{ m.key.slice(0, 4) }}</td>
                    <td class="text-end font-monospace">S/ {{ fmt(m.total) }}</td>
                    <td class="text-end font-monospace">S/ {{ fmt(m.acumulado) }}</td>
                    <td>
                      <details>
                        <summary class="small text-primary" style="cursor:pointer">{{ m.pagos.length }} pago{{ m.pagos.length === 1 ? '' : 's' }}</summary>
                        <table class="table table-sm mb-0 mt-2">
                          <thead><tr><th>Fecha</th><th>Trabajador</th><th>Observación</th><th class="text-end">Monto</th></tr></thead>
                          <tbody>
                            @for (p of m.pagos; track p.id) {
                              <tr><td class="font-monospace">{{ fdate(p.fecha) }}</td><td>{{ p.trabajador }}</td><td class="text-body-secondary">{{ p.obs || '—' }}</td><td class="text-end font-monospace">{{ fmt(p.monto) }}</td></tr>
                            }
                          </tbody>
                        </table>
                      </details>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="text-center text-body-secondary py-4">Todavía no hay pagos registrados. Total pagado: S/ {{ fmt(0) }}.</td></tr>
                }
                <tr class="tot-row"><td>Total general</td><td class="text-end font-monospace">S/ {{ fmt(x.total) }}</td><td colspan="2"></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      }
    } @else {
      <app-sin-obra />
    }
  `,
})
export class ManoDeObra {
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  private readonly personal = inject(PersonalModelo);
  private readonly usuarios = inject(UsuarioModelo);
  protected readonly modal = inject(ModalServicio);
  protected readonly trabajador = ModalTrabajador;
  protected readonly cese = ModalCese;
  protected readonly pago = ModalPago;
  protected readonly fmt = fmt;
  protected readonly fdate = fdate;
  protected readonly mLabel = mLabel;
  protected readonly busqueda = signal('');
  private readonly acciones = viewChild<TemplateRef<unknown>>('acciones');

  constructor() {
    const tb = inject(Topbar);
    effect(() => tb.fijar('Mano de obra', 'Padrón del personal de la obra', this.acciones()));
  }

  protected readonly v = computed(() => {
    this.almacen.rev();
    const o = this.obras.activa();
    if (!o) return null;
    const c = (cat: 'Operario' | 'Oficial' | 'Peón') => this.personal.contarCategoria(o, cat);
    return {
      puedeEd: this.usuarios.puede('Mano de obra', 'editar'),
      hayTrabajadores: this.personal.todos(o).length > 0,
      activos: this.personal.activos(o).length,
      operarios: c('Operario'),
      oficiales: c('Oficial'),
      peones: c('Peón'),
      porMes: this.personal.porMes(o),
      lista: this.personal.buscar(o, this.busqueda()).map((w) => ({ w, activo: this.personal.activo(w), pagado: this.personal.pagadoTrabajador(o, w) })),
      resumen: this.personal.resumenMensual(o),
      total: this.personal.totalPagado(o),
    };
  });
}
