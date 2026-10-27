import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { startWith } from 'rxjs';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Plazo } from '../core/modelos/plazo';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { Validar } from '../core/modelos/validar';
import { hoyIso } from '../core/utils/fechas';
import { fdate } from '../core/utils/formato';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

/** Ampliación de plazo (solo administrador; la regla está en ObraModelo). */
@Component({
  selector: 'app-modal-ampliacion',
  imports: [...FORM_IMPORTS],
  template: `
    <app-modal titulo="Registrar ampliación de plazo">
      @if (o) {
        <form [formGroup]="form" class="row g-3">
          <div class="col-12">
            <div class="alert alert-secondary py-2 px-3 mb-0 small">
              Plazo contractual original: <b>{{ o.plazo }} días</b> (fin {{ fdate(finOriginal) }}) · Plazo vigente actual: <b>{{ vigente }} días</b> (fin {{ fdate(finVigente) }})
            </div>
          </div>
          <app-campo label="Días adicionales" req><input class="form-control" formControlName="dias" appTipo="entero" placeholder="Ej.: 14" /></app-campo>
          <div class="col-md-6 small text-body-secondary align-self-end pb-2">
            @if (vista(); as v) {
              Nuevo plazo vigente: <b>{{ v.plazo }} días</b> · fin <b>{{ fdate(v.fin) }}</b>
            }
          </div>
          <app-campo label="Motivo de la ampliación" req s2><input class="form-control" formControlName="motivo" appTipo="texto" placeholder="Ej.: Lluvias extraordinarias que paralizaron la obra" /></app-campo>
          <div class="col-12 small text-body-secondary">
            Se registrará con la fecha de hoy ({{ fdate(hoy) }}) y a nombre de <b>{{ nombre }}</b>. El plazo y la fecha de fin originales no se modifican.
          </div>
        </form>
      }
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" (click)="guardar()">Registrar ampliación</button>
      </div>
    </app-modal>
  `,
})
export class ModalAmpliacion {
  protected readonly modal = inject(ModalServicio);
  private readonly obras = inject(ObraModelo);
  private readonly toast = inject(Toast);
  protected readonly fdate = fdate;
  protected readonly o = this.obras.activa();
  protected readonly nombre = inject(UsuarioModelo).sesion().nombre;
  protected readonly hoy = hoyIso();
  protected readonly finOriginal = this.o ? Plazo.finOriginal(this.o) : '';
  protected readonly vigente = this.o ? Plazo.plazoVigente(this.o) : 0;
  protected readonly finVigente = this.o ? Plazo.finVigente(this.o) : '';

  protected readonly form = new FormGroup({ dias: campo('entero', { req: true }), motivo: campo('texto', { req: true }) });
  private readonly dias = toSignal(this.form.controls.dias.valueChanges.pipe(startWith('')), { initialValue: '' });

  /** Nuevo plazo y fin mientras se escribe los días. */
  protected readonly vista = computed(() => {
    const d = this.dias();
    if (!this.o || Validar.entero(d, { min: 1, max: 3650 })) return null;
    const plazo = this.vigente + Number(d);
    return { plazo, fin: Plazo.fin(this.o.inicio, plazo) };
  });

  protected guardar(): void {
    if (!this.o || !valido(this.form)) return;
    const r = this.obras.registrarAmpliacion(this.o, this.form.getRawValue());
    if (falla(r, this.form, this.toast)) return;
    this.modal.cerrar();
    this.toast.mostrar(`Ampliación registrada: plazo vigente ${r.plazoVigente} días (fin ${fdate(r.finVigente)}). Revisa el calendario y las fianzas.`);
  }
}
