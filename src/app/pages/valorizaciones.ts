import { Component, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Almacen } from '../core/modelos/almacen';
import { ExportarServicio } from '../core/export/exportar';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Bloques, EstadoVal, Obra, Valorizacion } from '../core/modelos/tipos';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { APROBADORES, ValorizacionModelo } from '../core/modelos/valorizacion-modelo';
import { mLabel, pad2 } from '../core/utils/fechas';
import { fdate, fmt, r2 } from '../core/utils/formato';
import { ModalRevision } from '../modales/modal-revision';
import { ModalValorizacion } from '../modales/modal-valorizacion';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';
import { Topbar } from '../shared/servicios/topbar';
import { Barra } from '../shared/ui/barra';
import { Ico } from '../shared/ui/ico';
import { Pill, Color } from '../shared/ui/pill';
import { SinObra } from '../shared/ui/sin-obra';
import { Vacio } from '../shared/ui/vacio';

const COLOR_ESTADO: Record<EstadoVal, Color> = { 'Pendiente de revisión': 'amber', Devuelta: 'red', Aprobada: 'blue', Pagada: 'green' };

interface Bloque {
  cls: string;
  rn: string;
  t: string;
  filas: { l: string; v: number }[];
  nota?: string;
  total: number;
  col: string;
}

/** Valorizaciones (con flujo de aprobación).
 *  La tabla muestra la PROPUESTA vigente de cada valorización; el acumulado ejecutado y los totales incluyen SOLO versiones aprobadas
 *  (las que alimentan el avance físico). Las decisiones (aprobar, devolver, pagar) las valida ValorizacionModelo. */
@Component({
  selector: 'app-valorizaciones',
  imports: [Pill, Barra, Ico, Vacio, SinObra],
  template: `
    <ng-template #acciones>
      @if (v(); as x) {
        <div class="d-flex gap-2 flex-wrap">
          @if (x.puedeEditar) {
            <button class="btn btn-warning" (click)="nueva()"><app-ico n="plus" [s]="14" /> Nueva valorización</button>
          }
          <button class="btn btn-outline-secondary" [disabled]="exportar.ocupado()" [attr.aria-busy]="exportar.ocupado()" (click)="exportarTodo()">
            @if (exportar.ocupado()) {
              Generando Excel…
            } @else {
              <app-ico n="down" [s]="14" /> Exportar todo a Excel
            }
          </button>
          @if (x.puedeEditar) {
            <button class="btn btn-outline-primary" (click)="importar()">Importar Excel</button>
            <button class="btn btn-link btn-sm" (click)="plantilla()">Descargar plantilla</button>
          }
        </div>
      }
    </ng-template>
    @if (v(); as x) {
      @if (!x.filas.length) {
        <div class="card">
          <app-vacio icono="file" titulo="Aún no hay valorizaciones" desc="Registra la primera valorización de esta obra. Quedará pendiente de revisión hasta que la apruebe un Supervisor o el Administrador." />
        </div>
      } @else {
        <div class="card">
          <div class="table-responsive">
            <table class="table align-middle mb-0 tabla">
              <thead>
                <tr>
                  <th>N.º</th><th>Período</th><th class="text-end">Val. neta (VN)</th><th class="text-end">Amortización</th><th class="text-end">Subtotal</th>
                  <th class="text-end" title="Valor ejecutado acumulado: valorización bruta de las versiones aprobadas">Acum. ejecutado</th><th>Avance físico</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                @for (f of x.filas; track f.v.n) {
                  <tr>
                    <td class="font-monospace">{{ pad2(f.v.n) }}</td>
                    <td>{{ mLabel(f.v.key) }} {{ f.v.key.slice(0, 4) }}</td>
                    <td class="text-end font-monospace"><span [class.text-body-secondary]="f.gris">{{ fmt(f.c.vn) }}</span></td>
                    <td class="text-end font-monospace"><span [class.text-body-secondary]="f.gris">{{ fmt(f.c.amort) }}</span></td>
                    <td class="text-end font-monospace"><b [class.text-body-secondary]="f.gris">{{ fmt(f.c.sub) }}</b></td>
                    <td class="text-end font-monospace">{{ f.acum != null ? fmt(f.acum) : '—' }}</td>
                    <td>
                      @if (f.acum != null) {
                        <app-barra [pct]="(f.acum / x.o.monto) * 100" />
                      } @else {
                        <span class="text-body-secondary">Sin aprobar</span>
                      }
                    </td>
                    <td><app-pill [color]="color(f.v.estado)">{{ f.v.estado }}</app-pill> <span class="small text-body-secondary">v{{ f.v.version }}</span></td>
                    <td class="text-end"><button class="btn btn-sm" [class]="sel() === f.v.n ? 'btn-warning' : 'btn-outline-secondary'" (click)="alternar(f.v.n)">{{ sel() === f.v.n ? 'Cerrar' : 'Ver detalle' }}</button></td>
                  </tr>
                }
                <tr class="tot-row">
                  <td colspan="2">Total aprobado a la fecha</td>
                  <td class="text-end font-monospace">{{ x.hayOficial ? fmt(x.tVN) : '—' }}</td>
                  <td class="text-end font-monospace">{{ x.hayOficial ? fmt(x.tA) : '—' }}</td>
                  <td class="text-end font-monospace">{{ x.hayOficial ? fmt(x.tS) : '—' }}</td>
                  <td class="text-end font-monospace">{{ x.hayOficial ? fmt(x.last) : '—' }}</td>
                  <td class="font-monospace">{{ x.hayOficial ? ((x.o.monto ? (x.last / x.o.monto) * 100 : 0).toFixed(1) + '%') : '—' }}</td>
                  <td colspan="2"></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-body small text-body-secondary pt-2">Las columnas VN, amortización y subtotal muestran la propuesta vigente de cada valorización. El acumulado, el avance físico y los totales incluyen solo las versiones <b>aprobadas</b>.</div>
        </div>
        @if (x.detalle; as d) {
          <div class="card mt-3 overflow-hidden">
            <div class="vd-head">
              <span>Valorización N.º {{ pad2(d.v.n) }} — {{ mLabel(d.v.key) }} {{ d.v.key.slice(0, 4) }}</span>
              <button (click)="alternar(d.v.n)"><app-ico n="x" [s]="13" /> Cerrar</button>
            </div>
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 px-3 py-2 border-bottom bg-body-tertiary">
              <span class="d-flex align-items-center gap-2 flex-wrap">
                <b>{{ mLabel(d.v.key) }} {{ d.v.key.slice(0, 4) }}</b><span class="text-body-secondary">· {{ d.v.dias }} días ·</span>
                <app-pill [color]="color(d.v.estado)">{{ d.v.estado }}</app-pill> <span class="small text-body-secondary">v{{ d.v.version }}</span>
              </span>
              <span class="d-flex gap-2 align-items-center flex-wrap">
                @if (d.puedeAprobar) {
                  <button class="btn btn-sm btn-success" (click)="aprobar(d.v.n)">Aprobar</button>
                  <button class="btn btn-sm btn-outline-danger" (click)="devolver(d.v.n)">Devolver</button>
                } @else if (d.v.estado === 'Pendiente de revisión' && x.puedeEditar) {
                  <span class="small text-body-secondary">Esperando revisión de un {{ aprobadores }}.</span>
                }
                @if (d.v.estado === 'Aprobada' && x.puedeEditar && d.rolAprueba) {
                  <button class="btn btn-sm btn-outline-secondary" (click)="pagar(d.v.n)">Marcar como pagada</button>
                }
                @if (x.puedeEditar && d.v.estado !== 'Pagada') {
                  <button class="btn btn-sm btn-outline-secondary" (click)="editar(d.v)">{{ d.v.estado === 'Devuelta' ? 'Corregir' : d.v.oficial ? 'Modificar (nueva versión)' : 'Modificar' }}</button>
                }
              </span>
            </div>
            @if (d.devuelta; as e) {
              <div class="alert alert-danger py-2 px-3 small m-3 mb-0">Devuelta por {{ e.usuario }} ({{ e.rol }}) el {{ fdate(e.fecha) }}: «{{ e.comentario }}»</div>
            }
            @if (d.oficialVigente; as of) {
              <div class="alert alert-info py-2 px-3 small m-3 mb-0">
                Versión <b>oficial vigente</b> (v{{ of.o.version }}, aprobada por {{ of.o.aprobadoPor }}@if (of.o.fecha) { el {{ fdate(of.o.fecha) }} }): valor ejecutado (VB) S/ {{ fmt(of.o.vb) }} · VN S/ {{ fmt(of.c.vn) }} · subtotal S/ {{ fmt(of.c.sub) }}. Es la que cuenta en el avance físico hasta que se apruebe la versión propuesta (v{{ d.v.version }}).
              </div>
            }
            <div class="row g-3 p-3">
              @for (b of d.bloques; track b.rn) {
                <div [class]="b.col">
                  <div class="vb" [class]="b.cls">
                    <div class="vb-h"><b>{{ b.rn }}</b>{{ b.t }}</div>
                    <div class="vb-b">
                      @for (r of b.filas; track r.l) {
                        <div><span>{{ r.l }}</span><span>{{ r.v ? fmt(r.v) : '—' }}</span></div>
                      }
                      @if (b.nota) {
                        <p>{{ b.nota }}</p>
                      }
                    </div>
                    <div class="vb-t"><small>TOTAL</small><strong>S/ {{ fmt(b.total) }}</strong></div>
                  </div>
                </div>
              }
            </div>
            <div class="vsum">
              <div>
                <small>RESUMEN DE LA VALORIZACIÓN</small>
                <div class="items">
                  <div><small>VB</small><span style="color:#8bb4ff">S/ {{ fmt(d.c.i) }}</span></div>
                  <div><small>VN</small><span style="color:#5eead4">S/ {{ fmt(d.c.vn) }}</span></div>
                  <div><small>Total fact.</small><span style="color:#86efac">S/ {{ fmt(d.c.fact) }}</span></div>
                  <div><small>RM</small><span style="color:#fca5a5">S/ {{ fmt(d.c.rm) }}</span></div>
                  <div><small>VL</small><span style="color:#86efac">S/ {{ fmt(d.c.vl) }}</span></div>
                </div>
              </div>
              <div class="pay"><small>MONTO A PAGAR AL CONTRATISTA</small><strong>S/ {{ fmt(d.c.pagar) }}</strong></div>
            </div>
            <div class="px-3 pb-3">
              <div class="etiqueta mb-2">Historial de revisiones</div>
              @if (d.v.historial.length) {
                <div class="table-responsive">
                  <table class="table table-sm align-middle mb-0 tabla">
                    <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th class="text-center">Versión</th><th>Comentario</th></tr></thead>
                    <tbody>
                      @for (h of d.historial; track h.id) {
                        <tr>
                          <td class="font-monospace">{{ h.fecha ? fdate(h.fecha) + ' ' + (h.hora || '') : '—' }}</td>
                          <td>{{ h.usuario }}@if (h.rol) { <span class="small text-body-secondary"> ({{ h.rol }})</span> }</td>
                          <td>{{ h.accion }}</td>
                          <td class="text-center font-monospace">v{{ h.version }}</td>
                          <td class="text-body-secondary">{{ h.comentario || '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="small text-body-secondary">Sin movimientos.</div>
              }
            </div>
          </div>
        }
      }
    } @else {
      <app-sin-obra />
    }
  `,
})
export class Valorizaciones {
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  private readonly vals = inject(ValorizacionModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly modal = inject(ModalServicio);
  private readonly toast = inject(Toast);
  protected readonly exportar = inject(ExportarServicio);
  protected readonly fmt = fmt;
  protected readonly fdate = fdate;
  protected readonly pad2 = pad2;
  protected readonly mLabel = mLabel;
  protected readonly aprobadores = APROBADORES.join(' o ');
  protected readonly color = (e: EstadoVal): Color => COLOR_ESTADO[e] ?? 'gray';

  protected readonly sel = signal<number | null>(null);
  private readonly acciones = viewChild<TemplateRef<unknown>>('acciones');

  constructor() {
    const tb = inject(Topbar);
    effect(() => tb.fijar('Valorizaciones', 'Montos en soles · sin IGV en líneas', this.acciones()));
  }

  protected readonly v = computed(() => {
    this.almacen.rev();
    const o = this.obras.activa();
    if (!o) return null;
    const vs = this.vals.todas(o);
    let acum = 0;
    let tVN = 0;
    let tA = 0;
    let tS = 0;
    const filas = vs.map((v) => {
      const c = this.vals.calcular(v);
      const ofi = this.vals.calcularOficial(v);
      const ej = this.vals.ejecutado(v);
      if (ofi) {
        tVN += ofi.vn;
        tA += ofi.amort;
        tS += ofi.sub;
      }
      if (ej != null) acum = r2(acum + ej);
      return { v, c, acum: ej != null ? acum : null, gris: !!v.oficial && this.vals.hayCambiosSinAprobar(v) };
    });
    const hayOficial = vs.some((v) => v.oficial);
    const s = this.sel();
    const dv = vs.find((x) => x.n === s);
    return {
      o,
      filas,
      hayOficial,
      tVN,
      tA,
      tS,
      last: hayOficial ? acum : 0,
      puedeEditar: this.usuarios.puede('Valorizaciones', 'editar'),
      detalle: dv ? this.detalle(dv) : null,
    };
  });

  private detalle(v: Valorizacion) {
    const c = this.vals.calcular(v);
    const bloque = (cls: string, rn: string, t: string, filas: { l: string; v: number }[], total: number, col = 'col-md-6 col-xl-4', nota?: string): Bloque => ({ cls, rn, t, filas, total, col, nota });
    const dev = v.estado === 'Devuelta' ? [...v.historial].reverse().find((h) => /Devolvió/.test(h.accion)) : undefined;
    return {
      v,
      c,
      puedeAprobar: this.vals.puedeAprobar(v).ok,
      rolAprueba: this.vals.rolAprueba(),
      devuelta: dev ?? null,
      oficialVigente: v.oficial && this.vals.hayCambiosSinAprobar(v) ? { o: v.oficial, c: this.vals.calcularOficial(v) as Bloques } : null,
      historial: [...v.historial].reverse(),
      bloques: [
        bloque('blue', 'I', 'Valorización bruta', [{ l: 'Val. del periodo', v: v.vb }, { l: 'Reajuste', v: v.reaj }], c.i),
        bloque('purple', 'II', 'Deducción del reajuste', [{ l: 'Deducción (A)', v: v.ded }], c.d),
        bloque('teal', 'III', 'Valorización neta (VN = VB − A)', [], c.vn, undefined, 'VB + reajuste − deducción'),
        bloque('orange', 'IV', 'Amortización adelantos', [{ l: 'Adelanto directo', v: v.advD }, { l: 'Adelanto materiales', v: v.advM }], c.amort),
        bloque('green', 'V', 'Monto facturable', [{ l: 'Subtotal', v: c.sub }, { l: 'IGV 18%', v: c.igv }], c.fact),
        bloque('red', 'VI', 'Retenciones (RM)', [{ l: 'Fondo de garantía', v: v.fondo }, { l: 'Penalidades', v: v.pen }], c.rm),
        bloque('green', 'VII', 'Valorización líquida (VN − RM)', [], c.vl, 'col-md-12 col-xl-8', 'Valorización neta menos retenciones'),
      ],
    };
  }

  protected alternar(n: number): void {
    this.sel.update((s) => (s === n ? null : n));
  }

  private obra(): Obra | null {
    return this.obras.activa();
  }

  protected async nueva(): Promise<void> {
    const n = await this.modal.abrir<number>(ModalValorizacion);
    if (n) this.sel.set(n);
  }
  protected async editar(v: Valorizacion): Promise<void> {
    const n = await this.modal.abrir<number>(ModalValorizacion, { val: v });
    if (n) this.sel.set(n);
  }
  protected aprobar(n: number): void {
    const o = this.obra();
    if (!o) return;
    const r = this.vals.aprobar(o, n);
    this.toast.mostrar(r.ok ? `Valorización N.º ${pad2(n)} aprobada: ya cuenta en el avance físico` : r.error);
  }
  protected devolver(n: number): void {
    const o = this.obra();
    const v = o && this.vals.porNumero(o, n);
    const p = this.vals.puedeAprobar(v || undefined);
    if (!p.ok) {
      this.toast.mostrar(p.error);
      return;
    }
    this.modal.abrir(ModalRevision, { n });
  }
  protected pagar(n: number): void {
    const o = this.obra();
    if (!o) return;
    const r = this.vals.marcarPagada(o, n);
    this.toast.mostrar(r.ok ? `Valorización N.º ${pad2(n)} marcada como pagada` : r.error);
  }

  protected async exportarTodo(): Promise<void> {
    try {
      this.toast.mostrar(`Excel generado: ${await this.exportar.exportarExpediente()}`);
    } catch (e) {
      this.toast.mostrar('No se pudo generar el archivo Excel: ' + ((e as Error).message || 'error desconocido') + '. Inténtalo de nuevo.');
    }
  }
  protected async plantilla(): Promise<void> {
    try {
      await this.exportar.plantillaImportacion();
      this.toast.mostrar('Plantilla de importación descargada.');
    } catch (e) {
      this.toast.mostrar('No se pudo generar la plantilla Excel: ' + ((e as Error).message || 'error desconocido'));
    }
  }
  protected importar(): void {
    const o = this.obra();
    if (!o) {
      this.toast.mostrar('Selecciona una obra primero.');
      return;
    }
    if (!this.usuarios.puede('Valorizaciones', 'editar')) {
      this.toast.mostrar('Tu rol no puede importar valorizaciones.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const d = await this.exportar.leerValorizacion(file);
        const resumen = `Archivo: ${file.name}\nPeríodo: ${d.key}\nDías: ${d.dias}\nVB: S/ ${d.vb}\nReajuste: S/ ${d.reaj}\nDeducción: S/ ${d.ded}\nAdelanto directo: S/ ${d.advD}\nAdelanto materiales: S/ ${d.advM}\nFondo de garantía: S/ ${d.fondo}\nPenalidades: S/ ${d.pen}\n\n¿Validar y registrar esta valorización como pendiente de revisión?`;
        if (!confirm(resumen)) return;
        const r = this.vals.registrar(o, { n: this.vals.siguiente(o).n, editando: false, ...d });
        if (!r.ok) {
          this.toast.mostrar(r.error || 'La valorización no pasó las validaciones.');
          return;
        }
        this.sel.set(r.val.n);
        this.toast.mostrar('Valorización importada y enviada a revisión.');
      } catch (e) {
        this.toast.mostrar('No se pudo importar el Excel: ' + ((e as Error).message || 'archivo inválido'));
      }
    };
    input.click();
  }
}
