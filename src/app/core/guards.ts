import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Modulo } from './modelos/tipos';
import { UsuarioModelo } from './modelos/usuario-modelo';
import { Toast } from '../shared/servicios/toast';

/** Solo entra a la aplicación quien tiene sesión; si no, va al login. */
export const sesionGuard: CanActivateFn = () => inject(UsuarioModelo).haySesion() || inject(Router).createUrlTree(['/login']);

/** Quien ya tiene sesión no necesita ver el login. */
export const loginGuard: CanActivateFn = () => !inject(UsuarioModelo).haySesion() || inject(Router).createUrlTree(['/dashboard']);

/** El rol de la sesión debe poder ver el módulo de la pantalla. */
export const moduloGuard =
  (modulo: Modulo): CanActivateFn =>
  () => {
    if (inject(UsuarioModelo).puede(modulo, 'ver')) return true;
    inject(Toast).mostrar(`Tu rol no tiene acceso a «${modulo}».`);
    return inject(Router).createUrlTree(['/dashboard']);
  };
