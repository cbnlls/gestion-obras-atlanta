import { Color } from './pill';

export const colorEstadoObra = (e: string): Color => (e === 'En ejecución' ? 'blue' : e === 'Culminada' ? 'green' : 'gray');
