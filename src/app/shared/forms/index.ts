import { ReactiveFormsModule } from '@angular/forms';
import { ModalMarco } from '../ui/modal';
import { Campo } from './campo';
import { ControlForm } from './control-form';

/** Piezas que usan todos los formularios modales. */
export const FORM_IMPORTS = [ReactiveFormsModule, ModalMarco, Campo, ControlForm] as const;
