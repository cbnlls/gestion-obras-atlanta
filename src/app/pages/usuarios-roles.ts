import { Component, TemplateRef, computed, effect, inject, viewChild } from '@angular/core';
import { Almacen } from '../core/modelos/almacen';
import { ObraModelo } from '../core/modelos/obra-modelo';
import { Modulo, Nivel, ROLES, Usuario } from '../core/modelos/tipos';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { ModalUsuario } from '../modales/modal-usuario';
import { ModalServicio } from '../shared/servicios/modal';
import { Toast } from '../shared/servicios/toast';
import { Topbar } from '../shared/servicios/topbar';
import { CardHead } from '../shared/ui/card-head';
import { Ico } from '../shared/ui/ico';
import { Pill } from '../shared/ui/pill';

/** Filas de la matriz de permisos. */
const FILAS_MATRIZ: Modulo[] = ['Ficha técnica', 'Valorizaciones', 'Avance físico', 'Calendario de obra', 'Mano de obra', 'Cartas de fianza', 'Usuarios y roles'];
const ETIQUETA: Record<Nivel, string> = { E: 'Editar', V: 'Ver', N: 'Sin acceso' };
const CLASE: Record<Nivel, string> = { E: 'btn-warning', V: 'btn-outline-primary', N: 'btn-outline-secondary' };

@Component({
  selector: 'app-usuarios-roles',
  imports: [CardHead, Ico, Pill],
  template: `
    <ng-template #acciones>
      @if (v().puedeEd) {
        <button class="btn btn-warning" (click)="invitar()"><app-ico n="plus" [s]="14" /> Invitar usuario</button>
      }
    </ng-template>
    @let x = v();
    <div class="d-grid gap-3">
      <div class="card">
        <app-card-head titulo="Permisos por rol" sub="Clic en un permiso para cambiarlo. El rol Administrador no se modifica.">
          <div class="d-flex gap-2 small text-body-secondary align-items-center">
            <span class="badge text-bg-warning">Editar</span>
            <span class="badge border border-primary-subtle bg-primary-subtle text-primary-emphasis">Ver</span>
            <span class="badge border text-body-secondary">Sin acceso</span>
          </div>
        </app-card-head>
        <div class="table-responsive">
          <table class="table align-middle mb-0 tabla">
            <thead>
              <tr>
                <th>Módulo</th>
                @for (r of roles; track r) {
                  <th class="text-center">{{ r }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (m of x.matriz; track m.modulo) {
                <tr>
                  <td><b>{{ m.modulo }}</b></td>
                  @for (n of m.niveles; track $index) {
                    <td class="text-center">
                      <button class="btn btn-sm" [class]="clase[n]" style="min-width:84px" [disabled]="$index === 0 || !x.puedeEd" [attr.aria-label]="m.modulo + ', ' + roles[$index] + ': ' + etiqueta[n]" (click)="ciclar(m.modulo, $index)">{{ etiqueta[n] }}</button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <app-card-head titulo="Usuarios del sistema">
          @if (x.puedeEd) {
            <button class="btn btn-warning btn-sm" (click)="invitar()"><app-ico n="plus" [s]="13" /> Invitar usuario</button>
          }
        </app-card-head>
        <div class="table-responsive">
          <table class="table align-middle mb-0 tabla">
            <thead><tr><th>Nombre</th><th>Usuario</th><th>Correo</th><th>Rol</th><th>Obras</th><th class="text-end">Acceso</th></tr></thead>
            <tbody>
              @for (u of x.usuarios; track u.u.id) {
                <tr>
                  <td><b>{{ u.u.nombre }}</b></td>
                  <td class="font-monospace text-body-secondary">{{ u.u.user }}</td>
                  <td>{{ u.u.mail }}</td>
                  <td>{{ u.u.rol }}</td>
                  <td>
                    @if (u.todas) {
                      <span class="badge text-bg-secondary">Todas</span>
                    } @else {
                      @for (n of u.obras; track n) {
                        <span class="badge text-bg-light border text-truncate d-block text-start mb-1" style="max-width:220px">{{ n }}</span>
                      }
                    }
                  </td>
                  <td class="text-end text-nowrap">
                    <app-pill [color]="u.u.activo ? 'green' : 'red'">{{ u.u.activo ? 'Activo' : 'Sin acceso' }}</app-pill>
                    @if (x.puedeEd) {
                      <button class="btn btn-sm btn-link text-body-secondary" (click)="alternar(u.u)">{{ u.u.activo ? 'Revocar' : 'Activar' }}</button>
                    }
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
export class UsuariosRoles {
  private readonly almacen = inject(Almacen);
  private readonly obras = inject(ObraModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly modal = inject(ModalServicio);
  private readonly toast = inject(Toast);
  protected readonly roles = ROLES;
  protected readonly etiqueta = ETIQUETA;
  protected readonly clase = CLASE;
  private readonly acciones = viewChild<TemplateRef<unknown>>('acciones');

  constructor() {
    const tb = inject(Topbar);
    effect(() => tb.fijar('Usuarios y roles', 'Permisos y cuentas de usuario', this.acciones()));
  }

  protected readonly v = computed(() => {
    this.almacen.rev();
    const todas = this.obras.todas();
    return {
      puedeEd: this.usuarios.puede('Usuarios y roles', 'editar'),
      matriz: FILAS_MATRIZ.map((modulo) => ({ modulo, niveles: [...this.almacen.permisos[modulo]] })),
      usuarios: this.usuarios.todos().map((u) => ({
        u,
        todas: u.obras === 'all',
        obras: u.obras === 'all' ? [] : u.obras.map((id) => todas.find((o) => o.id === id)?.nombre).filter((n): n is string => !!n),
      })),
    };
  });

  protected ciclar(modulo: Modulo, rol: number): void {
    const r = this.usuarios.ciclarPermiso(modulo, rol);
    if (!r.ok) this.toast.mostrar(r.error);
  }
  protected alternar(u: Usuario): void {
    const r = this.usuarios.alternarAcceso(u.id);
    if (!r.ok) this.toast.mostrar(r.error);
  }
  protected invitar(): void {
    this.modal.abrir(ModalUsuario);
  }
}
