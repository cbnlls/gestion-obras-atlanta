import { Component, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioModelo } from '../core/modelos/usuario-modelo';
import { Campo } from '../shared/forms/campo';
import { ControlForm } from '../shared/forms/control-form';
import { campo } from '../shared/forms/tipos';
import { falla, valido } from '../shared/forms/utiles';
import { Toast } from '../shared/servicios/toast';
import { Ico } from '../shared/ui/ico';

const BENEFICIOS = ['Monitoreo de avance en tiempo real', 'Alertas automáticas de vencimiento de garantías', 'Control centralizado de mano de obra', 'Dashboard con KPIs de todas tus obras'];

/** Inicio de sesión. LIMITACIÓN: la contraseña solo se exige, no se verifica; al migrar a Supabase se reemplaza por Supabase Auth. */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Campo, ControlForm, Ico],
  template: `
    <section class="row g-0 min-vh-100">
      <div class="col-lg-6 d-none d-lg-flex login-l">
        <div class="logo p-0"><span class="logo-ic"><app-ico n="logo" [s]="17" /></span>Atlanta EIRL.</div>
        <h1>Gestión integral<br />de obras</h1>
        <p class="lead">Valorizaciones, avance físico, personal y cartas de fianza en un solo lugar.</p>
        <ul class="checks">
          @for (t of beneficios; track t) {
            <li><span class="tick"><app-ico n="check" [s]="12" [sw]="2.6" /></span>{{ t }}</li>
          }
        </ul>
        <div class="login-foot">© 2026 Cimiento · Gestión de obras</div>
      </div>
      <div class="col-12 col-lg-6 d-flex align-items-center justify-content-center p-4">
        <form class="login-form" [formGroup]="form" (ngSubmit)="ingresar()" novalidate>
          <h2 class="h4 fw-bold mb-1">Bienvenido de vuelta</h2>
          <p class="text-body-secondary mb-4">Usa el correo con el que se te asignó</p>
          <app-campo label="Correo electrónico" col="d-block mb-3"><input class="form-control" id="l-mail" type="email" formControlName="mail" appTipo="correo" placeholder="correo@empresa.pe" autocomplete="username" /></app-campo>
          <app-campo label="Contraseña" col="d-block mb-4"><input class="form-control" id="l-pass" type="password" formControlName="pass" autocomplete="current-password" /></app-campo>
          <button class="btn btn-warning w-100 py-2" type="submit">Ingresar</button>
        </form>
      </div>
    </section>
  `,
})
export class Login {
  private readonly usuarios = inject(UsuarioModelo);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);
  protected readonly beneficios = BENEFICIOS;
  protected readonly form = new FormGroup({ mail: campo('correo', { req: true }), pass: campo(null, { req: true }) });

  protected ingresar(): void {
    if (!valido(this.form)) return;
    const r = this.usuarios.iniciarSesion(this.form.getRawValue().mail);
    if (falla(r, this.form, this.toast)) return;
    this.form.controls.pass.reset('');
    this.router.navigateByUrl('/dashboard');
  }
}
