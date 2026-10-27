import { FormGroup } from '@angular/forms';
import { Fallo } from '../../core/modelos/tipos';
import { Toast } from '../servicios/toast';

/** Muestra el error de un modelo: en el campo indicado (si existe en el formulario) o como aviso. Devuelve true si falló. */
export function falla(r: { ok: true } | Fallo, form: FormGroup, toast: Toast): r is Fallo {
  if (r.ok) return false;
  const c = r.campo ? form.get(r.campo) : null;
  if (c) {
    c.setErrors({ modelo: r.error });
    c.markAsTouched();
    document.querySelector<HTMLElement>(`app-modal [formControlName="${r.campo}"]`)?.focus();
  } else toast.mostrar(r.error);
  return true;
}

/** Valida el formulario completo al guardar: marca todos los campos y devuelve true si todo está bien. */
export function valido(form: FormGroup): boolean {
  form.markAllAsTouched();
  if (form.invalid) {
    document.querySelector<HTMLElement>('app-modal .is-invalid')?.focus();
    return false;
  }
  return true;
}
