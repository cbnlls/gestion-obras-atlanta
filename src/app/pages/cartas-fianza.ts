import { Component, TemplateRef, computed, effect, inject, viewChild } from '@angular/core';
import { Almacen } from '../core/modelos/almacen';
import { AlertasModelo } from '../core/modelos/alertas-modelo';
import { CartaModelo } from '../core/modelos/carta-modelo';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Carta, EstadoCarta } from '../core/modelos/tipos';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { daysTo } from '../core/utils/fechas';
import { fdate, fmt } from '../core/utils/formato';
import { ModalCarta } from '../modales/modal-carta';
import { ModalDocumentos } from '../modales/modal-documentos';
import { ModalServicio } from '../shared/servicios/modal';
import { Topbar } from '../shared/servicios/topbar';
import { CardHead } from '../shared/ui/card-head';
import { Ico } from '../shared/ui/ico';
import { Kpi } from '../shared/ui/kpi';
import { Color, Pill } from '../shared/ui/pill';
import { SinObra } from '../shared/ui/sin-obra';
import { Vacio } from '../shared/ui/vacio';

const COLOR: Record<EstadoCarta, Color> = { 'Por vencer': 'amber', Vigente: 'green', Vencida: 'red', Sustituida: 'gray' };

/** Cartas de fianza: garantías, fechas de vencimiento, renovación y documentos adjuntos. */
@Component({
  selector: 'app-cartas-fianza',
  imports: [CardHead, Ico, Kpi, Pill, SinObra, Vacio],
  template: `
    <ng-template #acciones>
      @if (v(); as x) {
        @if (x.puedeEd) {
          <button class="btn btn-warning" (click)="nueva()"><app-ico n="plus" [s]="14" /> Nueva carta</button>
        }
      }
    </ng-template>
    @if (v(); as x) {
      @if (!x.filas.length) {
        <div class="card">
          <app-vacio icono="shield" titulo="No hay cartas de fianza registradas" desc="Registra la carta de fiel cumplimiento y las de adelanto para activar las alertas de vencimiento.">
            @if (x.puedeEd) {
              <button class="btn btn-warning" (click)="nueva()"><app-ico n="plus" [s]="14" /> Nueva carta</button>
            }
          </app-vacio>
        </div>
      } @else {
        @for (a of x.avisos; track a.texto) {
          <div class="alert py-2 px-3 small mb-2" [class]="'alert-' + a.tipo" role="alert">{{ a.texto }}</div>
        }
        @if (x.urgente; as u) {
          <div class="alert d-flex align-items-center justify-content-between flex-wrap gap-2" [class]="u.vencida ? 'alert-danger' : 'alert-warning'" role="alert">
            <span class="d-flex align-items-center gap-2">
              <app-ico n="warn" [s]="16" />
              <span>La carta <b>{{ u.c.tipo }} ({{ u.c.num }})</b> {{ u.vencida ? 'venció hace ' + -u.d + ' día' + (-u.d === 1 ? '' : 's') : 'vence en ' + u.d + ' día' + (u.d === 1 ? '' : 's') }} — {{ fdate(u.c.vence) }}</span>
            </span>
            @if (x.puedeEd) {
              <button class="btn btn-sm btn-outline-secondary" (click)="renovar(u.c)">Renovar carta</button>
            }
          </div>
        }
        <div class="row g-3">
          <app-kpi lab="Total garantizado" [val]="'S/ ' + fmt(x.total)" oscuro col="col-12 col-md-4" />
          <app-kpi lab="Cartas vigentes" [val]="x.vigentes" col="col-6 col-md-4" />
          <app-kpi lab="Próximo vencimiento" [val]="x.proximo ? fdate(x.proximo) : '—'" col="col-6 col-md-4" />
        </div>
        <div class="card mt-3">
          <app-card-head titulo="Cartas de fianza">
            <div class="d-flex gap-2">
              @if (x.puedeEd) {
                <button class="btn btn-warning btn-sm" (click)="nueva()"><app-ico n="plus" [s]="13" /> Nueva carta</button>
              }
            </div>
          </app-card-head>
          <div class="table-responsive">
            <table class="table align-middle mb-0 tabla">
              <thead>
                <tr><th>Tipo</th><th>Banco</th><th class="text-end">Monto</th><th>Emitida</th><th>Vence</th><th class="text-end">Días</th><th>Estado</th><th>Documento</th><th class="text-end">Acciones</th></tr>
              </thead>
              <tbody>
                @for (f of x.filas; track f.c.id) {
                  <tr [class.row-warn]="f.e === 'Por vencer'" [class.row-venc]="f.e === 'Vencida'">
                    <td><b>{{ f.c.tipo }}</b><div class="small font-monospace text-body-secondary">N.º {{ f.c.num }}</div></td>
                    <td>{{ f.c.banco }}</td>
                    <td class="text-end font-monospace">S/ {{ fmt(f.c.monto) }}</td>
                    <td class="font-monospace">{{ fdate(f.c.emision) }}</td>
                    <td class="font-monospace" [class]="f.e === 'Por vencer' || f.e === 'Vencida' ? 'text-danger fw-semibold' : ''">{{ fdate(f.c.vence) }}</td>
                    <td class="text-end font-monospace">{{ f.e === 'Sustituida' ? '' : f.d }}</td>
                    <td><app-pill [color]="color(f.e)">{{ f.e }}</app-pill></td>
                    <td>
                      @if (!f.docs && !x.puedeEd) {
                        <i class="small text-body-secondary">Sin documentos</i>
                      } @else {
                        <button class="btn btn-sm btn-outline-secondary" (click)="documentos(f.c)"><app-ico n="file" [s]="12" /> Documentos@if (f.docs) { ({{ f.docs }}) }</button>
                      }
                    </td>
                    <td>
                      <div class="d-flex gap-1 justify-content-end">
                        @if (x.puedeEd && (f.e === 'Por vencer' || f.e === 'Vencida')) {
                          <button class="btn btn-sm btn-warning" (click)="renovar(f.c)">Renovar</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
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
export class CartasFianza {
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  private readonly cartas = inject(CartaModelo);
  private readonly alertas = inject(AlertasModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly modal = inject(ModalServicio);
  protected readonly fmt = fmt;
  protected readonly fdate = fdate;
  protected readonly color = (e: EstadoCarta): Color => COLOR[e];
  private readonly acciones = viewChild<TemplateRef<unknown>>('acciones');

  constructor() {
    const tb = inject(Topbar);
    effect(() => tb.fijar('Cartas de fianza', 'Garantías y fechas de vencimiento', this.acciones()));
  }

  protected readonly v = computed(() => {
    this.almacen.rev();
    const o = this.obras.activa();
    if (!o) return null;
    const u = this.cartas.masUrgente(o);
    return {
      puedeEd: this.usuarios.puede('Cartas de fianza', 'editar'),
      filas: this.cartas.todas(o).map((c) => ({ c, e: this.cartas.estado(c), d: daysTo(c.vence), docs: this.cartas.documentos(c).length })),
      avisos: this.alertas.avisosPlazo(o).filter((a) => a.area === 'fianza'),
      urgente: u ? { c: u, vencida: this.cartas.estado(u) === 'Vencida', d: daysTo(u.vence) } : null,
      total: this.cartas.totalGarantizado(o),
      vigentes: this.cartas.vigentes(o).length,
      proximo: this.cartas.proximoVencimiento(o),
    };
  });

  protected nueva(): void {
    this.modal.abrir(ModalCarta);
  }
  protected renovar(c: Carta): void {
    this.modal.abrir(ModalCarta, { base: c });
  }
  protected documentos(c: Carta): void {
    this.modal.abrir(ModalDocumentos, { cartaId: c.id });
  }
}
