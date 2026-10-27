import { Routes } from '@angular/router';
import { loginGuard, moduloGuard, sesionGuard } from './core/guards';
import { Shell } from './layout/shell';

export const routes: Routes = [
  { path: 'login', canActivate: [loginGuard], loadComponent: () => import('./pages/login').then((m) => m.Login) },
  {
    path: '',
    component: Shell,
    canActivate: [sesionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard) },
      { path: 'obras', loadComponent: () => import('./pages/mis-obras').then((m) => m.MisObras) },
      { path: 'ficha', canActivate: [moduloGuard('Ficha técnica')], loadComponent: () => import('./pages/ficha-tecnica').then((m) => m.FichaTecnica) },
      { path: 'valorizaciones', canActivate: [moduloGuard('Valorizaciones')], loadComponent: () => import('./pages/valorizaciones').then((m) => m.Valorizaciones) },
      { path: 'avance', canActivate: [moduloGuard('Avance físico')], loadComponent: () => import('./pages/avance-fisico').then((m) => m.AvanceFisico) },
      { path: 'calendario', canActivate: [moduloGuard('Calendario de obra')], loadComponent: () => import('./pages/calendario').then((m) => m.Calendario) },
      { path: 'mano', canActivate: [moduloGuard('Mano de obra')], loadComponent: () => import('./pages/mano-de-obra').then((m) => m.ManoDeObra) },
      { path: 'cartas', canActivate: [moduloGuard('Cartas de fianza')], loadComponent: () => import('./pages/cartas-fianza').then((m) => m.CartasFianza) },
      { path: 'usuarios', canActivate: [moduloGuard('Usuarios y roles')], loadComponent: () => import('./pages/usuarios-roles').then((m) => m.UsuariosRoles) },
    ],
  },
  { path: '**', redirectTo: '' },
];
