import { Component, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Almacen } from '../core/modelos/almacen';
import { AlertasModelo } from '../core/modelos/alertas-modelo';
import { CalendarioModelo } from '../core/modelos/calendario-modelo';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Plazo } from '../core/modelos/plazo';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { Validar } from '../core/modelos/validar';
import { mShort } from '../core/utils/fechas';
import { fdate, fmt, r2 } from '../core/utils/formato';
import { ModalCalendarioItem } from '../modales/modal-calendario-item';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';
import { Topbar } from '../shared/servicios/topbar';
import { CardHead } from '../shared/ui/card-head';
import { Enfocar } from '../shared/ui/enfocar';
import { Ico } from '../shared/ui/ico';
import { SinObra } from '../shared/ui/sin-obra';
import { Vacio } from '../shared/ui/vacio';

const TAG: Record<string, string> = { Borrador: 'secondary', Presentado: 'warning', Aprobado: 'success' };
const num = (n: number): string => (n > 0 ? fmt(n) : '');

/** Calendario valorizado (= programación mensual).
 *  UNA sola tabla continua: ÍTEM | PARTIDA / DESCRIPCIÓN | UND | METRADO | P.U. | PARCIAL | un mes por columna.
 *  Capítulos y subcapítulos muestran la suma de sus partidas; al final van las filas con el total calculado de cada mes.
 *  Los periodos salen de Plazo (con los días reales de cada mes). Los montos mensuales los registra el usuario. */
@Component({
  selector: 'app-calendario',
  imports: [CardHead, Ico, SinObra, Vacio, Enfocar],
  template: `
    <ng-template #acciones>
      @if (v(); as x) {
        @if (x.puedeEd) {
          <button class="btn btn-outline-secondary" (click)="agregar()"><app-ico n="plus" [s]="14" /> Agregar ítem</button>
        }
        @if (x.estado === 'Borrador' && x.puedeEditar) {
          <button class="btn btn-outline-primary" (click)="ejecutar(cal.presentar(x.o), 'Calendario presentado para revisión')">Presentar calendario</button>
        }
        @if (x.estado === 'Presentado' && x.puedeAprobar) {
          <button class="btn btn-success" (click)="aprobar()">Aprobar</button>
          <button class="btn btn-outline-danger" (click)="observar()">Observar</button>
        }
        @if (x.estado === 'Aprobado' && x.puedeEditar) {
          <button class="btn btn-outline-secondary" (click)="nuevaVersion()">Nueva versión</button>
        }
      }
    </ng-template>
    @if (v(); as x) {
      <div class="card">
        <app-card-head [sub]="x.puedeEd ? 'Haz clic en un mes de una partida para registrar el monto programado (no se reparte automáticamente)' : x.estado === 'Borrador' ? 'Solo lectura' : 'Calendario ' + x.estado.toLowerCase() + ': no se puede modificar'">
          <span titulo>Calendario valorizado de obra <span class="badge" [class]="'text-bg-' + x.tag">{{ x.estado }} · v{{ x.version }}</span></span>
        </app-card-head>
        <div class="cal-scroll">
          @if (!x.filas.length) {
            <app-vacio icono="cal" titulo="Calendario vacío" desc="Agrega el primer capítulo para armar el calendario valorizado de esta obra.">
              @if (x.puedeEditar) {
                <button class="btn btn-warning" (click)="agregar()"><app-ico n="plus" [s]="14" /> Agregar ítem</button>
              }
            </app-vacio>
          } @else {
            <table class="cal" [style.width.px]="x.ancho">
              <colgroup>
                <col style="width:100px" /><col style="width:300px" /><col style="width:64px" /><col style="width:96px" /><col style="width:104px" /><col style="width:124px" />
                @for (p of x.per; track p.key) {
                  <col style="width:112px" />
                }
              </colgroup>
              <thead>
                <tr>
                  <th>ÍTEM</th><th>PARTIDA / DESCRIPCIÓN</th><th>UND</th><th class="r">METRADO</th><th class="r">P.U.</th><th class="r">PARCIAL</th>
                  @for (p of x.per; track p.key) {
                    <th class="m">{{ mShort(p.key) }}<div class="dias" [title]="fdate(p.desde) + ' al ' + fdate(p.hasta)">{{ p.dias }} d</div></th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (f of x.filas; track f.code) {
                  @if (f.type !== 'par') {
                    <tr [class]="f.type">
                      <td class="font-monospace code">{{ f.code }}</td><td class="desc">{{ f.desc }}</td><td></td><td></td><td></td>
                      <td class="num">{{ num(f.parcial) }}</td>
                      @for (m of f.meses; track $index) {
                        <td class="num">{{ num(m.v) }}</td>
                      }
                    </tr>
                  } @else {
                    <tr class="part">
                      <td class="font-monospace code">{{ f.code }}</td><td class="desc">{{ f.desc }}</td><td>{{ f.und }}</td>
                      <td class="num">{{ f.metrado ? fmt(f.metrado) : '' }}</td><td class="num">{{ f.pu ? fmt(f.pu) : '' }}</td>
                      <td class="num" [class.warn]="f.estado === 'excede'" [attr.title]="f.tip">
                        {{ fmt(f.parcial) }}
                        @switch (f.estado) {
                          @case ('excede') { <div class="pp bad">supera su parcial</div> }
                          @case ('incompleta') { <div class="pp">{{ f.pct }}% programado</div> }
                          @case ('completa') { <div class="pp ok">completa</div> }
                        }
                      </td>
                      @for (m of f.meses; track m.k) {
                        <td class="mc" [class]="m.v ? 'has' : 'nil'" [attr.tabindex]="x.puedeEd && !esEdicion(f.code, m.k) ? 0 : null" (click)="x.puedeEd && editar(f.code, m.k)" (keydown.enter)="x.puedeEd && editar(f.code, m.k)">
                          @if (esEdicion(f.code, m.k)) {
                            <input appEnfocar class="form-control form-control-sm text-end font-monospace" style="width:100px" inputmode="decimal" maxlength="15" [value]="texto" [attr.aria-label]="'Monto ' + mShort(m.k)"
                              (input)="alEscribir($event)" (keydown.enter)="cerrar(true); $event.stopPropagation()" (keydown.escape)="cerrar(false)" (blur)="cerrar(true)" (click)="$event.stopPropagation()" />
                          } @else {
                            {{ m.v ? fmt(m.v) : '—' }}
                          }
                        </td>
                      }
                    </tr>
                  }
                }
              </tbody>
              <tfoot>
                <tr class="eco eco-sub"><td></td><td class="desc">TOTAL MENSUAL (partidas)</td><td></td><td></td><td></td><td class="num">{{ num(x.cdTot) }}</td>@for (c of x.cdMes; track $index) {<td class="num">{{ num(c) }}</td>}</tr>
                <tr class="eco"><td></td><td class="desc">PAGO A PERSONAL (planilla)</td><td></td><td></td><td></td><td class="num">{{ num(x.paTot) }}</td>@for (c of x.pa; track $index) {<td class="num">{{ num(c) }}</td>}</tr>
                <tr class="eco eco-sub"><td></td><td class="desc">TOTAL MONTO PAGADO MENSUAL</td><td></td><td></td><td></td><td class="num">{{ num(x.paTot) }}</td>@for (c of x.pa; track $index) {<td class="num">{{ num(c) }}</td>}</tr>
              </tfoot>
            </table>
          }
        </div>
      </div>
      <div class="mt-2">
        @for (a of x.avisosPlazo; track a.texto) {
          <div class="alert py-2 px-3 small mb-2" [class]="'alert-' + a.tipo" role="alert">{{ a.texto }}</div>
        }
        @if (x.diag; as d) {
          @if (d.problemas.length) {
            <div class="alert alert-danger py-2 px-3 small mb-2" role="alert">
              <b>Revisa {{ d.problemas.length === 1 ? 'este problema' : d.problemas.length + ' problemas' }}:</b>
              <ul class="mb-0 ps-3">
                @for (p of d.problemas.slice(0, 3); track $index) {
                  <li>{{ p.texto }}</li>
                }
              </ul>
              @if (d.problemas.length > 3) {
                <details class="mt-1">
                  <summary>Ver {{ d.problemas.length - 3 }} más</summary>
                  <ul class="mb-0 ps-3">
                    @for (p of d.problemas.slice(3); track $index) {
                      <li>{{ p.texto }}</li>
                    }
                  </ul>
                </details>
              }
            </div>
          }
          <div class="small text-body-secondary px-1">
            Programación: {{ d.resumen.completas }} de {{ d.resumen.total }} partida{{ d.resumen.total === 1 ? '' : 's' }} completa{{ d.resumen.total === 1 ? '' : 's' }}@if (d.resumen.incompletas) { · {{ d.resumen.incompletas }} en proceso }@if (d.resumen.sinProgramar) { · {{ d.resumen.sinProgramar }} sin programar }.
          </div>
        }
      </div>
    } @else {
      <app-sin-obra />
    }
  `,
})
export class Calendario {
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  protected readonly cal = inject(CalendarioModelo);
  private readonly alertas = inject(AlertasModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly modal = inject(ModalServicio);
  private readonly toast = inject(Toast);
  protected readonly fmt = fmt;
  protected readonly fdate = fdate;
  protected readonly mShort = mShort;
  protected readonly num = num;

  private readonly acciones = viewChild<TemplateRef<unknown>>('acciones');
  /** Celda cuyo monto se está editando. */
  private readonly celda = signal<{ code: string; k: string } | null>(null);
  protected texto = '';

  protected readonly v = computed(() => {
    this.almacen.rev();
    const o = this.obras.activa();
    if (!o) return null;
    const st = this.cal.estado(o);
    const per = Plazo.periodosObra(o);
    const ms = per.map((p) => p.key);
    const items = this.cal.items(o);
    const cdMes = ms.map((k) => this.cal.programadoMes(o, k));
    const pa = ms.map((k) => this.cal.pagadoPersonal(o, k));
    const hayPartidas = this.cal.partidas(o).length > 0;
    return {
      o,
      estado: st.estado,
      version: st.version,
      tag: TAG[st.estado] || 'secondary',
      puedeEditar: this.usuarios.puede('Calendario de obra', 'editar'),
      puedeEd: this.usuarios.puede('Calendario de obra', 'editar') && !this.cal.bloqueado(o),
      puedeAprobar: this.usuarios.puede('Aprobar calendario', 'editar'),
      per,
      ancho: 100 + 300 + 64 + 96 + 104 + 124 + 112 * ms.length,
      filas: items.map((r) => {
        if (r.type !== 'par') {
          const s = this.cal.subtotalesDe(o, r.code, ms);
          return { type: r.type, code: r.code, desc: r.desc, und: '', metrado: 0, pu: 0, parcial: s.parcial, estado: '', pct: 0, tip: null as string | null, meses: ms.map((k) => ({ k, v: s.porMes[k] })) };
        }
        const p = r as import('../core/modelos/tipos').Partida;
        const e = this.cal.estadoPartida(o, p, ms);
        const tip = e.estado === 'excede' ? `Programado S/ ${fmt(e.programado)} · parcial S/ ${fmt(e.parcial)} · diferencia S/ ${fmt(e.diferencia)}` : e.estado === 'incompleta' ? `Programado S/ ${fmt(e.programado)} de S/ ${fmt(e.parcial)} (faltan S/ ${fmt(-e.diferencia)})` : null;
        return { type: 'par' as const, code: p.code, desc: p.desc, und: p.und || '', metrado: p.metrado, pu: p.pu, parcial: e.parcial, estado: e.estado as string, pct: Math.round(e.pct), tip, meses: ms.map((k) => ({ k, v: p.months[k] })) };
      }),
      cdMes,
      cdTot: r2(cdMes.reduce((a, x) => a + x, 0)),
      pa,
      paTot: r2(pa.reduce((a, x) => a + x, 0)),
      avisosPlazo: this.alertas.avisosPlazo(o).filter((a) => a.area === 'calendario'),
      diag: hayPartidas ? this.cal.diagnostico(o) : null,
    };
  });

  constructor() {
    const tb = inject(Topbar);
    effect(() => {
      const x = this.v();
      const sub = !x ? '' : x.estado === 'Borrador' ? 'Distribución mensual de partidas · en borrador, aún editable' : x.estado === 'Presentado' ? 'Presentado: pendiente de aprobación (bloqueado)' : 'Aprobado v' + x.version + ' · línea base (bloqueado)';
      tb.fijar('Calendario valorizado', sub, this.acciones());
    });
  }

  protected agregar(): void {
    this.modal.abrir(ModalCalendarioItem);
  }

  protected ejecutar(r: { ok: boolean; error?: string }, ok: string): void {
    this.toast.mostrar(r.ok ? ok : (r.error ?? ''));
  }
  protected aprobar(): void {
    const o = this.obras.activa();
    if (!o || !confirm('¿Aprobar el calendario? Quedará como línea base y bloqueado.')) return;
    this.ejecutar(this.cal.aprobar(o), 'Calendario aprobado (línea base)');
  }
  protected observar(): void {
    const o = this.obras.activa();
    const m = prompt('Motivo de la observación (mínimo 5 caracteres):');
    if (!o || m == null) return;
    this.ejecutar(this.cal.observar(o, m), 'Calendario observado: vuelve a borrador');
  }
  protected nuevaVersion(): void {
    const o = this.obras.activa();
    const m = prompt('Motivo del cambio (reprogramación, mínimo 5 caracteres):');
    if (!o || m == null) return;
    this.ejecutar(this.cal.nuevaVersion(o, m), 'Nueva versión abierta: el calendario está en borrador');
  }

  /* ---- edición de un monto dentro de la celda: Enter o clic fuera guarda, Escape cancela; el modelo valida el importe ---- */
  protected esEdicion(code: string, k: string): boolean {
    const c = this.celda();
    return !!c && c.code === code && c.k === k;
  }
  protected editar(code: string, k: string): void {
    const o = this.obras.activa();
    if (!o || this.celda()) return;
    if (!this.usuarios.puede('Calendario de obra', 'editar')) {
      this.toast.mostrar('Tu rol solo puede ver el calendario.');
      return;
    }
    if (this.cal.bloqueado(o)) {
      this.toast.mostrar('El calendario está ' + o.calEstado.estado.toLowerCase() + '. Abre una nueva versión para modificarlo.');
      return;
    }
    const cur = this.cal.partidas(o).find((r) => r.code === code)?.months[k];
    this.texto = cur ? String(cur) : '';
    this.celda.set({ code, k });
  }
  protected alEscribir(e: Event): void {
    const i = e.target as HTMLInputElement;
    const v = Validar.filtrar('importe', i.value);
    if (v !== i.value) i.value = v;
    this.texto = v;
  }
  protected cerrar(guardar: boolean): void {
    const c = this.celda();
    const o = this.obras.activa();
    if (!c || !o) return;
    this.celda.set(null);
    if (guardar) {
      const r = this.cal.setMonto(o, c.code, c.k, this.texto);
      if (!r.ok) this.toast.mostrar(r.error);
    }
  }
}
