import { Injectable, inject } from '@angular/core';
import { Almacen } from './almacen';
import { Modulo, Nivel, ROLES, Res, Rol, Usuario } from './tipos';
import { Validar } from './validar';

export interface DatosUsuario {
  nombre: string;
  user: string;
  mail: string;
  rol: string;
  obras: number[];
  activo: boolean;
}

/** Usuarios, roles, permisos por módulo y sesión.
 *  LIMITACIÓN: la sesión es SIMULADA. No se verifica contraseña y todo se ejecuta en el navegador, por lo que NO equivale
 *  a una autenticación segura de producción. Al migrar a Supabase, iniciarSesion() debe reemplazarse por Supabase Auth
 *  y las reglas de permisos repetirse como políticas RLS en la base de datos. */
@Injectable({ providedIn: 'root' })
export class UsuarioModelo {
  private readonly almacen = inject(Almacen);

  todos(): Usuario[] {
    return this.almacen.usuarios;
  }
  sesion() {
    return this.almacen.sesion;
  }
  esAdministrador(): boolean {
    return this.almacen.sesion.rol === 'Administrador';
  }
  /** ¿Hay una sesión iniciada? */
  haySesion(): boolean {
    return this.almacen.sesion.rol !== null;
  }

  /** Nivel del rol de la sesión en un módulo: 'E' editar · 'V' ver · 'N' sin acceso. */
  nivel(modulo: Modulo): Nivel {
    const ri = ROLES.indexOf(this.almacen.sesion.rol as Rol);
    const p = this.almacen.permisos[modulo];
    return ri < 0 || !p ? 'N' : p[ri];
  }
  puede(modulo: Modulo, accion: 'ver' | 'editar' = 'ver'): boolean {
    const n = this.nivel(modulo);
    return accion === 'editar' ? n === 'E' : n === 'E' || n === 'V';
  }
  /** Usado por TODAS las operaciones que modifican datos. */
  autorizar(modulo: Modulo, accion: 'ver' | 'editar' = 'editar'): Res {
    if (this.puede(modulo, accion)) return { ok: true };
    const rol = this.almacen.sesion.rol || 'sin sesión';
    return { ok: false, error: `Tu rol (${rol}) no tiene permiso para ${accion === 'editar' ? 'modificar' : 'ver'} «${modulo}».` };
  }

  /** Inicio de sesión simulado: el correo debe pertenecer a un usuario registrado con acceso activo. */
  iniciarSesion(correo: string): Res {
    const e = Validar.correo(correo);
    if (e) return { ok: false, campo: 'mail', error: e };
    const mail = correo.trim().toLowerCase();
    const u = this.almacen.usuarios.find((x) => x.mail.toLowerCase() === mail);
    if (!u) return { ok: false, campo: 'mail', error: 'Ese correo no está registrado en el sistema.' };
    if (!u.activo) return { ok: false, campo: 'mail', error: 'El acceso de este usuario está revocado.' };
    this.almacen.sesion = { nombre: u.nombre, rol: u.rol, userId: u.id };
    this.almacen.refrescar();
    return { ok: true };
  }
  cerrarSesion(): void {
    this.almacen.sesion = { nombre: '', rol: null, userId: null };
    this.almacen.refrescar();
  }

  /** Cada clic recorre: sin acceso → ver → editar. El rol Administrador no se modifica. */
  ciclarPermiso(modulo: Modulo, rolIdx: number): Res {
    const a = this.autorizar('Usuarios y roles');
    if (!a.ok) return a;
    if (rolIdx === 0) return { ok: false, error: 'El rol Administrador no se modifica.' };
    const p = this.almacen.permisos[modulo];
    if (!p) return { ok: false, error: 'Módulo no válido.' };
    const orden: Nivel[] = ['N', 'V', 'E'];
    p[rolIdx] = orden[(orden.indexOf(p[rolIdx]) + 1) % 3];
    this.almacen.cambio();
    return { ok: true };
  }

  invitar(d: DatosUsuario): Res<{ u: Usuario }> {
    const a = this.autorizar('Usuarios y roles');
    if (!a.ok) return a;
    const err = [
      ['nombre', Validar.nombre(d.nombre)],
      ['mail', Validar.correo(d.mail)],
      ['user', Validar.usuario(d.user)],
    ].find((r) => r[1]);
    if (err) return { ok: false, campo: err[0], error: err[1] };
    if (!(ROLES as readonly string[]).includes(d.rol)) return { ok: false, campo: 'rol', error: 'Selecciona un rol válido.' };
    if (d.rol !== 'Administrador') {
      const ids = Array.isArray(d.obras) ? d.obras : [];
      if (ids.some((id) => !this.almacen.obras.some((o) => o.id === id))) return { ok: false, campo: 'obras', error: 'Una de las obras asignadas no existe.' };
      if (this.almacen.obras.length && !ids.length) return { ok: false, campo: 'obras', error: 'Asigna al menos una obra a este usuario.' };
    }
    if (this.almacen.usuarios.some((u) => u.user.toLowerCase() === d.user.trim().toLowerCase())) return { ok: false, campo: 'user', error: 'Ese nombre de usuario ya existe.' };
    if (this.almacen.usuarios.some((u) => u.mail.toLowerCase() === d.mail.trim().toLowerCase())) return { ok: false, campo: 'mail', error: 'Ese correo ya está registrado.' };
    const u: Usuario = {
      id: this.almacen.nuevoId(),
      nombre: d.nombre.trim(),
      user: d.user.trim(),
      mail: d.mail.trim(),
      rol: d.rol as Rol,
      obras: d.rol === 'Administrador' ? 'all' : [...new Set(d.obras || [])],
      activo: !!d.activo,
    };
    this.almacen.usuarios.push(u);
    this.almacen.cambio();
    return { ok: true, u };
  }

  alternarAcceso(id: number): Res {
    const a = this.autorizar('Usuarios y roles');
    if (!a.ok) return a;
    const u = this.almacen.usuarios.find((x) => x.id === id);
    if (!u) return { ok: false, error: 'Usuario no encontrado.' };
    if (u.activo && u.rol === 'Administrador' && this.almacen.usuarios.filter((x) => x.activo && x.rol === 'Administrador').length <= 1)
      return { ok: false, error: 'No se puede revocar al único administrador activo.' };
    u.activo = !u.activo;
    this.almacen.cambio();
    return { ok: true };
  }
}
