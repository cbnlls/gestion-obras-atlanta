import { Component, computed, effect, inject, signal } from '@angular/core';
import { Almacen } from '../core/modelos/almacen';
import { AvanceModelo, FilaAvance } from '../core/modelos/avance-modelo';
import { CalendarioModelo } from '../core/modelos/calendario-modelo';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { ValorizacionModelo } from '../core/modelos/valorizacion-modelo';
import { Validar } from '../core/modelos/validar';
import { MES3, mShort, pad2 } from '../core/utils/fechas';
import { fmt, r2 } from '../core/utils/formato';
import { Toast } from '../shared/servicios/toast';
import { Topbar } from '../shared/servicios/topbar';
import { CardHead } from '../shared/ui/card-head';
import { Enfocar } from '../shared/ui/enfocar';
import { CurvaS } from '../shared/ui/grafico';
import { Ico } from '../shared/ui/ico';
import { Pill } from '../shared/ui/pill';
import { SinObra } from '../shared/ui/sin-obra';
import { Vacio } from '../shared/ui/vacio';

/** Avance físico (Curva S y cuadro por período).
 *  PROG. MENS. lo escribe el usuario (el calendario valorizado es solo la referencia). Todo lo demás se calcula:
 *  el EJECUTADO sale de la valorización BRUTA de la versión APROBADA de cada mes. Base de % = monto contractual.
 *  DIF. (PTS) = % acumulado ejecutado − % acumulado programado. */
@Component({
  selector: 'app-avance-fisico',
  imports: [CardHead, CurvaS, Ico, Pill, SinObra, Vacio, Enfocar],
  template: `
    @if (v(); as x) {
      <div class="d-grid gap-3">
        @for (a of x.avisos; track a.texto) {
          <div class="alert py-2 px-3 small mb-0 d-flex align-items-center gap-2" [class]="'alert-' + a.tipo" role="alert"><app-ico n="warn" [s]="15" /><span>{{ a.texto }}</span></div>
        }
        <div class="card">
          <app-card-head titulo="Curva S — avance físico acumulado" sub="Programado vs. ejecutado (% del monto contractual)" />
          <div class="card-body">
            @if (x.hayProg) {
              <app-curva-s [filas]="x.rows" [alto]="340" />
            } @else {
              <app-vacio icono="trend" titulo="Falta la programación mensual" desc="Escribe el monto programado de cada mes en la columna PROG. MENS. del cuadro (usa como referencia el calendario valorizado). La Curva S se dibuja con esos datos." />
            }
          </div>
        </div>
        <div class="card">
          <app-card-head titulo="Cuadro de avance por período" [sub]="x.puedeEd ? 'Escribe el monto programado de cada mes. El ejecutado sale solo de las valorizaciones APROBADAS (valorización bruta)' : 'El ejecutado sale solo de las valorizaciones aprobadas (valorización bruta)'" />
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0 tabla">
              <thead>
                <tr>
                  <th>Per.</th><th>Mes</th><th class="text-center">Días</th><th class="text-end">PROG. MENS.</th><th class="text-end">PROG. ACUM.</th><th class="text-end">% MENS.</th><th class="text-end">% ACUM.</th>
                  <th class="text-end">EJEC. MENS.</th><th class="text-end">EJEC. ACUM.</th><th class="text-end">% MENS.</th><th class="text-end">% ACUM.</th>
                  <th class="text-end" title="% acumulado ejecutado − % acumulado programado, en puntos porcentuales">DIF. (PTS)</th><th>Estado del período</th>
                </tr>
              </thead>
              <tbody>
                @for (r of x.rows; track r.key) {
                  <tr>
                    <td class="font-monospace text-body-secondary">{{ pad2(r.n) }}</td>
                    <td>{{ mes(r) }}</td>
                    <td class="text-center font-monospace">{{ r.dias }}</td>
                    <td class="text-end font-monospace tint-g" [class.edit-prog]="x.puedeEd" [attr.title]="x.puedeEd ? 'Haz clic para escribir el monto programado' : null" [attr.tabindex]="x.puedeEd && editando() !== r.key ? 0 : null" (click)="editar(r.key)" (keydown.enter)="editar(r.key)">
                      @if (editando() === r.key) {
                        <input appEnfocar class="form-control form-control-sm text-end font-monospace" style="width:120px" inputmode="decimal" maxlength="15" [value]="texto" [attr.aria-label]="'Monto programado ' + mShort(r.key)"
                          (input)="alEscribir($event)" (keydown.enter)="cerrar(true); $event.stopPropagation()" (keydown.escape)="cerrar(false)" (blur)="cerrar(true)" (click)="$event.stopPropagation()" />
                      } @else {
                        @if (r.pDef) {
                          {{ fmt(r.pm) }}
                        } @else {
                          <span class="text-body-secondary">{{ x.puedeEd ? 'Ingresar' : '—' }}</span>
                        }
                        @if (r.ref; as ref) {
                          <div class="ref" [title]="'Referencia del calendario valorizado (' + ref.base + ')'">Cal.: {{ fmt(ref.valor) }}</div>
                        }
                      }
                    </td>
                    <td class="text-end font-monospace tint-g">{{ r.pDef || r.pa > 0 ? fmt(r.pa) : '—' }}</td>
                    <td class="text-end font-monospace tint-g">{{ r.pDef ? r.pmPct.toFixed(2) + '%' : '—' }}</td>
                    <td class="text-end font-monospace tint-g">
                      @if (r.pDef || r.pa > 0) {
                        <b>{{ r.paPct.toFixed(2) }}%</b>
                      } @else {
                        —
                      }
                    </td>
                    <td class="text-end font-monospace tint-y">
                      @if (r.em != null) {
                        {{ fmt(r.em) }}
                        @if (r.estado.codigo === 'completo' && r.estado.texto.includes('modificación') && r.val?.oficial; as of) {
                          <div class="ref">oficial v{{ of.version }}</div>
                        }
                      } @else if (r.estado.codigo === 'val_pendiente') {
                        <span class="text-body-secondary">Pendiente</span>
                      } @else {
                        —
                      }
                    </td>
                    <td class="text-end font-monospace tint-y">{{ r.ea != null ? fmt(r.ea) : '—' }}</td>
                    <td class="text-end font-monospace tint-y">{{ r.emPct != null ? r.emPct.toFixed(2) + '%' : '—' }}</td>
                    <td class="text-end font-monospace tint-y">{{ r.eaPct != null ? r.eaPct.toFixed(2) + '%' : '—' }}</td>
                    <td class="text-end font-monospace" [class]="r.dif == null ? '' : r.dif >= 0 ? 'text-success fw-semibold' : 'text-danger fw-semibold'">{{ dif(r) }}</td>
                    <td><app-pill [color]="r.estado.color">{{ r.estado.texto }}</app-pill></td>
                  </tr>
                }
                <tr class="tot">
                  <td colspan="3">TOTAL</td>
                  <td class="text-end font-monospace gd">{{ fmt(x.tProg) }}</td><td class="text-end font-monospace gd">{{ fmt(x.tProg) }}</td>
                  <td class="text-end font-monospace gd">{{ x.tPct.toFixed(2) }}%</td><td class="text-end font-monospace gd">{{ x.tPct.toFixed(2) }}%</td>
                  <td class="text-end font-monospace bd">{{ x.last ? fmt(x.tEj) : '—' }}</td><td class="text-end font-monospace bd">{{ x.last ? fmt(x.tEj) : '—' }}</td>
                  <td class="text-end font-monospace bd">{{ x.last ? x.last.eaPct!.toFixed(2) + '%' : '—' }}</td><td class="text-end font-monospace bd">{{ x.last ? x.last.eaPct!.toFixed(2) + '%' : '—' }}</td>
                  <td class="text-end font-monospace bd">{{ x.last && x.hayProg ? dif(x.last) : '—' }}</td><td class="bd"></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-body small text-body-secondary pt-2">Monto contractual: S/ {{ fmt(x.o.monto) }} · Programado registrado: S/ {{ fmt(x.tProg) }} ({{ x.tPct.toFixed(2) }}%). Un período sin valorización aprobada no cuenta como ejecución: se muestra «—», no S/ 0.00.</div>
        </div>
      </div>
    } @else {
      <app-sin-obra />
    }
  `,
})
export class AvanceFisico {
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  private readonly avance = inject(AvanceModelo);
  private readonly calendario = inject(CalendarioModelo);
  private readonly vals = inject(ValorizacionModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly toast = inject(Toast);
  protected readonly fmt = fmt;
  protected readonly pad2 = pad2;
  protected readonly mShort = mShort;

  /** Mes cuya celda de PROG. MENS. se está editando. */
  protected readonly editando = signal<string | null>(null);
  protected texto = '';

  constructor() {
    const tb = inject(Topbar);
    effect(() => tb.fijar('Avance físico', 'Programado vs ejecutado'));
  }

  protected readonly v = computed(() => {
    this.almacen.rev();
    const o = this.obras.activa();
    if (!o) return null;
    const rows = this.avance.filas(o);
    const tProg = r2(rows.reduce((a, r) => a + r.pm, 0));
    return {
      o,
      rows,
      hayProg: this.avance.hayProgramacion(o),
      puedeEd: this.usuarios.puede('Avance físico', 'editar') && !this.calendario.bloqueado(o),
      avisos: this.avance.advertencias(o),
      tProg,
      tPct: o.monto ? (tProg / o.monto) * 100 : 0,
      tEj: this.vals.totalEjecutado(o),
      last: [...rows].reverse().find((r) => r.ea != null) ?? null,
    };
  });

  protected mes(r: FilaAvance): string {
    return `${MES3[+r.key.slice(5, 7) - 1]}-${r.key.slice(2, 4)}`;
  }
  protected dif(r: FilaAvance): string {
    return r.dif == null ? '—' : `${r.dif >= 0 ? '+' : '−'}${Math.abs(r.dif).toFixed(2)}`;
  }

  /** Edición en la propia celda: Enter o clic fuera guarda, Escape cancela; el modelo valida el importe. */
  protected editar(key: string): void {
    const o = this.obras.activa();
    if (!o || this.editando()) return;
    if (!this.usuarios.puede('Avance físico', 'editar')) {
      this.toast.mostrar('Tu rol solo puede ver el avance físico.');
      return;
    }
    if (this.calendario.bloqueado(o)) {
      this.toast.mostrar('El calendario está ' + o.calEstado.estado.toLowerCase() + ': el programado ya no se puede modificar.');
      return;
    }
    const cur = (o.programacion || {})[key];
    this.texto = cur != null ? String(cur) : '';
    this.editando.set(key);
  }
  protected alEscribir(e: Event): void {
    const i = e.target as HTMLInputElement;
    const v = Validar.filtrar('importe', i.value);
    if (v !== i.value) i.value = v;
    this.texto = v;
  }
  protected cerrar(guardar: boolean): void {
    const k = this.editando();
    const o = this.obras.activa();
    if (!k || !o) return;
    this.editando.set(null);
    if (guardar) {
      const r = this.avance.setProgramado(o, k, this.texto);
      if (!r.ok) this.toast.mostrar(r.error);
    }
  }
}
