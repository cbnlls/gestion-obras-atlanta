import { Component, TemplateRef, computed, effect, inject, viewChild } from '@angular/core';
import { Almacen } from '../core/modelos/almacen';
import { AvanceModelo } from '../core/modelos/avance-modelo';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Plazo } from '../core/modelos/plazo';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { fdate, fmt } from '../core/utils/formato';
import { ModalAmpliacion } from '../modales/modal-ampliacion';
import { ModalEstadoObra } from '../modales/modal-estado-obra';
import { ModalServicio } from '../shared/servicios/modal';
import { Topbar } from '../shared/servicios/topbar';
import { CardHead } from '../shared/ui/card-head';
import { colorEstadoObra } from '../shared/ui/colores';
import { Ico } from '../shared/ui/ico';
import { Pill } from '../shared/ui/pill';
import { SinObra } from '../shared/ui/sin-obra';

@Component({
  selector: 'app-ficha-tecnica',
  imports: [CardHead, Ico, Pill, SinObra],
  template: `
    <ng-template #acciones>
      @if (v(); as x) {
        @if (x.puedeEditar) {
          <button class="btn btn-outline-secondary" (click)="modal.abrir(estado)">Cambiar estado</button>
        }
        @if (x.esAdmin) {
          <button class="btn btn-warning" (click)="modal.abrir(ampliacion)"><app-ico n="plus" [s]="14" /> Registrar ampliación</button>
        }
      }
    </ng-template>
    @if (v(); as x) {
      @let o = x.o;
      @let pg = x.pg;
      <div class="d-grid gap-3">
        <div class="card hero-av">
          <div class="card-body p-4">
            <div class="d-flex align-items-end flex-wrap gap-4 mb-4">
              <div><div class="big">{{ pg.ej.toFixed(1) }}<em>%</em></div><small>EJECUTADO</small></div>
              <div><div class="mid">{{ pg.suficiente ? pg.pr.toFixed(1) + '%' : '—' }}</div><small>programado</small></div>
              @if (!pg.suficiente) {
                <div class="small text-body-secondary align-self-center" style="max-width:340px">Aún no hay programación mensual registrada: no se puede comparar el avance programado con el ejecutado.</div>
              } @else if (pg.dif == null) {
                <div class="small text-body-secondary align-self-center" style="max-width:340px">Aún no hay valorizaciones aprobadas para comparar con lo programado.</div>
              } @else if (pg.dif < 0) {
                <div class="neg">−{{ abs(pg.dif).toFixed(1) }} pts<small>diferencia de avance</small></div>
              } @else {
                <div class="pos">+{{ pg.dif.toFixed(1) }} pts<small>diferencia de avance</small></div>
              }
            </div>
            <div class="track">
              <div class="fill" [style.width.%]="min(100, pg.ej)"></div>
              @if (pg.suficiente) {
                <div class="mk" [style.left.%]="min(100, pg.pr)"><span>Prog. {{ pg.pr.toFixed(1) }}%</span></div>
              }
            </div>
            <div class="scale">
              @for (n of escala; track n) {
                <span>{{ n }}</span>
              }
            </div>
          </div>
        </div>
        <div class="card fbox overflow-hidden">
          <div class="row g-0 border-bottom">
            <div class="celda col-md-8 p-3"><div class="etiqueta">Obra</div><b>{{ o.nombre }}</b></div>
            <div class="celda col-md-4 p-3"><div class="etiqueta">Contrato</div><b>N.º {{ o.contrato }}</b></div>
          </div>
          <div class="row g-0 border-bottom">
            <div class="celda col-md-5 p-3"><div class="etiqueta">Entidad contratante</div><b>{{ o.entidad || '—' }}</b></div>
            <div class="celda col-md-3 p-3">
              <div class="etiqueta">RUC de la entidad</div>
              @if (o.rucEntidad) {
                <span class="font-monospace">{{ o.rucEntidad }}</span>
              } @else {
                <span class="text-warning-emphasis small">No registrado</span>
              }
            </div>
            <div class="celda col-md-4 p-3"><div class="etiqueta">Contratista</div><b>{{ o.contratista || '—' }}</b></div>
          </div>
          <div class="row g-0 border-bottom">
            <div class="celda col-md-4 p-3"><div class="etiqueta">Monto contractual</div><span class="font-monospace">S/ {{ fmt(o.monto) }}</span></div>
            <div class="celda col-md-4 p-3"><div class="etiqueta">Sistema de contratación</div><b>{{ o.sistema }}</b></div>
            <div class="celda col-md-4 p-3">
              <div class="etiqueta">Adelanto directo</div>
              @if (o.adelantoPct > 0) {
                <span class="font-monospace">S/ {{ fmt((o.monto * o.adelantoPct) / 100) }}</span> <span class="small text-body-secondary">({{ o.adelantoPct }}%)</span>
              } @else {
                <span class="text-body-secondary">No corresponde</span>
              }
            </div>
          </div>
          <div class="row g-0 border-bottom">
            <div class="celda col-md-3 p-3"><div class="etiqueta">Fecha de inicio</div><b>{{ fdate(o.inicio) }}</b></div>
            <div class="celda col-md-3 p-3"><div class="etiqueta">Plazo contractual original</div><b>{{ o.plazo }} días calendario</b></div>
            <div class="celda col-md-3 p-3"><div class="etiqueta">Fin contractual original</div><b>{{ fdate(x.finOriginal) }}</b></div>
            <div class="celda col-md-3 p-3"><div class="etiqueta">Estado</div><app-pill [color]="colorEstado(o.estado)">{{ o.estado }}</app-pill></div>
          </div>
          <div class="row g-0 border-bottom">
            <div class="celda col-md-4 p-3">
              <div class="etiqueta">Ampliaciones aprobadas</div>
              @if (o.ampliaciones.length) {
                <b>{{ o.ampliaciones.length }} · +{{ x.diasAmpliados }} días</b>
              } @else {
                <span class="text-body-secondary">Sin ampliaciones</span>
              }
            </div>
            <div class="celda col-md-4 p-3"><div class="etiqueta">Plazo vigente</div><b>{{ x.vigente }} días calendario</b></div>
            <div class="celda col-md-4 p-3"><div class="etiqueta">Fin vigente</div><b>{{ fdate(x.finVigente) }}</b></div>
          </div>
          <div class="row g-0 border-bottom">
            <div class="celda col-md-6 p-3"><div class="etiqueta">Residente de obra</div><b>{{ o.residente || '—' }}</b></div>
            <div class="celda col-md-6 p-3"><div class="etiqueta">Supervisor</div><b>{{ o.supervisor || '—' }}</b></div>
          </div>
        </div>
        <div class="card">
          <app-card-head titulo="Ampliaciones de plazo" sub="Historial: el plazo y el fin originales no se modifican" />
          @if (o.ampliaciones.length) {
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0 tabla">
                <thead><tr><th>Fecha de registro</th><th class="text-end">Días</th><th>Motivo</th><th>Registrada por</th><th>Estado</th></tr></thead>
                <tbody>
                  @for (a of o.ampliaciones; track a.id) {
                    <tr>
                      <td class="font-monospace">{{ fdate(a.fecha) }}</td>
                      <td class="text-end font-monospace">+{{ a.dias }}</td>
                      <td>{{ a.motivo }}</td>
                      <td>{{ a.usuario || '—' }}</td>
                      <td><app-pill color="green">{{ a.estado || 'Aprobada' }}</app-pill></td>
                    </tr>
                  }
                  <tr class="tot-row"><td>Total ampliado</td><td class="text-end font-monospace">+{{ x.diasAmpliados }}</td><td colspan="3"></td></tr>
                </tbody>
              </table>
            </div>
          } @else {
            <div class="card-body text-body-secondary">Esta obra no tiene ampliaciones de plazo aprobadas. El plazo vigente es el contractual original.</div>
          }
        </div>
      </div>
    } @else {
      <app-sin-obra />
    }
  `,
})
export class FichaTecnica {
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  private readonly avance = inject(AvanceModelo);
  private readonly usuarios = inject(UsuarioModelo);
  protected readonly modal = inject(ModalServicio);
  protected readonly estado = ModalEstadoObra;
  protected readonly ampliacion = ModalAmpliacion;
  protected readonly fmt = fmt;
  protected readonly fdate = fdate;
  protected readonly abs = Math.abs;
  protected readonly min = Math.min;
  protected readonly colorEstado = colorEstadoObra;
  protected readonly escala = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  private readonly acciones = viewChild<TemplateRef<unknown>>('acciones');

  protected readonly v = computed(() => {
    this.almacen.rev();
    const o = this.obras.activa();
    if (!o) return null;
    return {
      o,
      pg: this.avance.progreso(o),
      finOriginal: Plazo.finOriginal(o),
      finVigente: Plazo.finVigente(o),
      vigente: Plazo.plazoVigente(o),
      diasAmpliados: Plazo.diasAmpliados(o),
      puedeEditar: this.usuarios.puede('Ficha técnica', 'editar'),
      esAdmin: this.usuarios.esAdministrador(),
    };
  });

  constructor() {
    const tb = inject(Topbar);
    effect(() => tb.fijar('Ficha técnica', this.v()?.o.nombre ?? '', this.acciones()));
  }
}
