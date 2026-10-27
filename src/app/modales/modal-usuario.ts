import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroup } from '@angular/forms';
import { startWith } from 'rxjs';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { ROLES } from '../core/modelos/tipos';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { FORM_IMPORTS } from '../shared/forms';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';

/** Invitar usuario.
 *  LIMITACIÓN: la contraseña solo se valida (mínimo 6 caracteres); no se guarda porque el inicio de sesión es simulado.
 *  Con Supabase, la cuenta se crea con Supabase Auth. */
@Component({
  selector: 'app-modal-usuario',
  imports: [...FORM_IMPORTS],
  template: `
    <app-modal titulo="Invitar usuario" ancho>
      <form [formGroup]="form" class="row g-3" autocomplete="off">
        <app-campo label="Nombre completo" req><input class="form-control" formControlName="nombre" appTipo="nombre" placeholder="Ej.: Patricia Vega Lozano" /></app-campo>
        <app-campo label="Correo electrónico" req><input class="form-control" formControlName="mail" appTipo="correo" placeholder="Ej.: nombre@empresa.pe" /></app-campo>
        <app-campo label="Nombre de usuario" req><input class="form-control" formControlName="user" appTipo="usuario" placeholder="Ej.: pvega" /></app-campo>
        <app-campo label="Rol" req>
          <select class="form-select" formControlName="rol">
            <option value="">Seleccione...</option>
            @for (r of roles; track r) {
              <option [value]="r">{{ r }}</option>
            }
          </select>
        </app-campo>
        <app-campo label="Contraseña" req><input class="form-control" type="password" formControlName="p1" autocomplete="new-password" placeholder="Mínimo 6 caracteres" /></app-campo>
        <app-campo label="Confirmar contraseña" req><input class="form-control" type="password" formControlName="p2" autocomplete="new-password" placeholder="Repite la contraseña" /></app-campo>
        <div class="fld col-12" [class.bad]="obrasFalta()">
          <label class="form-label small fw-semibold mb-1">Obras asignadas <span class="text-danger">*</span></label>
          <div class="chips d-flex flex-wrap gap-2 p-2 border rounded">
            @for (o of obras.todas(); track o.id) {
              <button type="button" class="btn btn-sm" [class]="seleccionada(o.id) ? 'btn-warning active' : 'btn-outline-secondary'" (click)="alternar(o.id)">{{ o.nombre }}</button>
            } @empty {
              <span class="small text-body-secondary">Aún no hay obras; podrás asignarlas después.</span>
            }
          </div>
          <div class="invalid-feedback">Selecciona al menos una obra.</div>
        </div>
        <div class="col-12">
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" role="switch" id="swAct" [checked]="activo()" (change)="activo.set($any($event.target).checked)" />
            <label class="form-check-label" for="swAct">{{ activo() ? 'Acceso activo' : 'Sin acceso' }}</label>
          </div>
        </div>
      </form>
      <div pie>
        <button type="button" class="btn btn-outline-secondary" (click)="modal.cerrar()">Cancelar</button>
        <button type="button" class="btn btn-warning" (click)="guardar()">Crear usuario</button>
      </div>
    </app-modal>
  `,
})
export class ModalUsuario {
  protected readonly modal = inject(ModalServicio);
  protected readonly obras = inject(ObraModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly toast = inject(Toast);
  protected readonly roles = ROLES;

  protected readonly seleccion = signal<number[]>([]);
  protected readonly activo = signal(true);
  private readonly intento = signal(false);

  protected readonly form = new FormGroup({
    nombre: campo('nombre', { req: true }),
    mail: campo('correo', { req: true }),
    user: campo('usuario', { req: true }),
    rol: campo(null, { req: true }),
    p1: campo(null, { req: true, validadores: [(c: AbstractControl) => (String(c.value).length >= 6 ? null : { tipo: 'Mínimo 6 caracteres.' })] }),
    p2: campo(null, { req: true, validadores: [(c: AbstractControl) => (c.value !== '' && c.value === c.parent?.get('p1')?.value ? null : { tipo: 'Las contraseñas no coinciden.' })] }),
  });
  private readonly rol = toSignal(this.form.controls.rol.valueChanges.pipe(startWith('')), { initialValue: '' });

  /** Todos los roles salvo Administrador (que ve todas las obras) necesitan al menos una obra, si ya existen obras. */
  private readonly necesitaObras = computed(() => this.obras.hay() && this.rol() !== 'Administrador');
  protected readonly obrasFalta = computed(() => this.intento() && this.necesitaObras() && !this.seleccion().length);

  constructor() {
    this.form.controls.p1.valueChanges.subscribe(() => this.form.controls.p2.updateValueAndValidity());
  }

  protected seleccionada(id: number): boolean {
    return this.seleccion().includes(id);
  }
  protected alternar(id: number): void {
    this.seleccion.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  protected guardar(): void {
    this.intento.set(true);
    const ok = valido(this.form);
    if (!ok || this.obrasFalta()) return;
    const v = this.form.getRawValue();
    const r = this.usuarios.invitar({ nombre: v.nombre, user: v.user, mail: v.mail, rol: v.rol, obras: this.seleccion(), activo: this.activo() });
    if (falla(r, this.form, this.toast)) return;
    this.modal.cerrar(true);
    this.toast.mostrar('Usuario creado');
  }
}
