import { Injectable } from '@angular/core';
import { hoyIso } from '../utils/fechas';
import { abrirBlob } from '../utils/descargas';

type Formato = 'texto' | 'moneda' | 'metrado' | 'pct' | 'pts' | 'fecha' | 'entero';

export interface ColumnaExcel {
  h: string;
  w?: number;
  f?: Formato;
  al?: 'left' | 'right' | 'center';
}
export interface TablaExcel {
  nombre: string;
  titulo: string;
  sub?: string;
  columnas: ColumnaExcel[];
  filas: unknown[][];
  total?: unknown[] | null;
  notas?: string[];
}

const FORMATOS: Record<string, string> = { moneda: '#,##0.00', metrado: '#,##0.000', pct: '0.00%', pts: '+0.00;-0.00;0.00', fecha: 'dd/mm/yyyy', entero: '#,##0' };
const MAX_CELDA = 32767; // límite de caracteres de una celda de Excel
const COLOR = { cab: 'FFF59E0B', cabTxt: 'FF1F2937', borde: 'FFD1D5DB', tot: 'FFFEF3C7', gris: 'FF6B7280' };

/** Exportación a Excel (.xlsx) con ExcelJS. Este servicio SOLO da formato: no calcula nada.
 *  - ExcelJS se carga la primera vez que se exporta o importa (no pesa en el arranque de la aplicación).
 *  - No se escriben fórmulas: todo son valores. texto() antepone una comilla a los textos que empiezan con = + - @
 *    (o tabulación / retorno) para que nunca se interpreten como fórmula.
 *  - Las fechas se escriben como fechas reales en UTC (sin desfase por zona horaria) y los importes como números. */
@Injectable({ providedIn: 'root' })
export class ExcelServicio {
  private lib: any = null;

  /** Carga ExcelJS una sola vez. */
  async cargar(): Promise<any> {
    if (!this.lib) {
      const m: any = await import('exceljs');
      this.lib = m.default?.Workbook ? m.default : m;
    }
    return this.lib;
  }

  /* ---- valores seguros ---- */
  texto(v: unknown): string {
    if (v == null) return '';
    let s = String(v);
    if (/^[=+\-@]/.test(s.trimStart()) || /^[\t\r]/.test(s)) s = "'" + s;
    return s.length > MAX_CELDA ? s.slice(0, MAX_CELDA - 1) + '…' : s;
  }
  /** 'AAAA-MM-DD' → Date en UTC; null si no es una fecha real. */
  fecha(iso: unknown): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
  }
  private numero(v: unknown): number | null {
    return typeof v === 'number' && isFinite(v) ? v : null;
  }
  /** Valor de una celda según el formato de su columna. null = celda vacía (sin dato; no es 0). */
  valor(v: unknown, f?: Formato | null): string | number | Date | null {
    if (f === 'fecha') return this.fecha(v);
    if (f === 'texto' || f == null) return v == null || v === '' ? null : this.texto(v);
    const n = this.numero(v);
    return n == null ? null : f === 'pct' ? n / 100 : n; // pct: se recibe en puntos (12.5) y se guarda como fracción (0.125)
  }
  /** Nombre de archivo seguro: sin caracteres que Windows/macOS no admiten. */
  archivo(base: string, contrato?: string): string {
    const lim = (t: unknown) => String(t || '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return [lim(base), lim(contrato), hoyIso()].filter(Boolean).join('_') + '.xlsx';
  }

  /* ---- construcción ---- */
  libro(titulo: string): any {
    const wb = new this.lib.Workbook();
    wb.creator = 'Cimiento · Gestión de obras';
    wb.title = titulo;
    wb.created = new Date();
    return wb;
  }
  private borde() {
    const c = { style: 'thin', color: { argb: COLOR.borde } };
    return { top: c, left: c, bottom: c, right: c };
  }
  private encabezado(ws: any, titulo: string, sub?: string): void {
    ws.getCell('A1').value = this.texto(titulo);
    ws.getCell('A1').font = { bold: true, size: 14 };
    if (sub) {
      ws.getCell('A2').value = this.texto(sub);
      ws.getCell('A2').font = { color: { argb: COLOR.gris } };
    }
  }
  /** Hoja de pares «dato → valor». pares: [[etiqueta, valor, formato]] */
  hojaDatos(wb: any, nombre: string, titulo: string, pares: [string, unknown, Formato?][]): any {
    const ws = wb.addWorksheet(nombre);
    this.encabezado(ws, titulo, '');
    ws.columns = [{ width: 30 }, { width: 52 }];
    pares.forEach(([e, v, f], i) => {
      const r = 4 + i;
      const a = ws.getCell(r, 1);
      const b = ws.getCell(r, 2);
      a.value = this.texto(e);
      a.font = { bold: true };
      b.value = this.valor(v, f || 'texto');
      if (f && FORMATOS[f]) b.numFmt = FORMATOS[f];
      b.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      a.border = b.border = this.borde();
    });
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return ws;
  }
  /** Hoja de tabla con encabezado fijo, filtros, fila de totales opcional y notas al pie. */
  hojaTabla(wb: any, { nombre, titulo, sub, columnas, filas, total, notas }: TablaExcel): any {
    const ws = wb.addWorksheet(nombre);
    const HR = 4;
    const n = columnas.length;
    this.encabezado(ws, titulo, sub);
    ws.columns = columnas.map((c) => ({ width: c.w || 14 }));
    columnas.forEach((c, i) => {
      const x = ws.getCell(HR, i + 1);
      x.value = this.texto(c.h);
      x.font = { bold: true, color: { argb: COLOR.cabTxt } };
      x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.cab } };
      x.alignment = { horizontal: c.al || (c.f && c.f !== 'texto' && c.f !== 'fecha' ? 'right' : 'left'), vertical: 'middle', wrapText: true };
      x.border = this.borde();
    });
    ws.getRow(HR).height = 30;
    const pinta = (fila: unknown[], r: number, esTotal: boolean) =>
      fila.forEach((v, i) => {
        const c = columnas[i];
        const x = ws.getCell(r, i + 1);
        x.value = this.valor(v, c.f);
        if (c.f && FORMATOS[c.f]) x.numFmt = FORMATOS[c.f];
        x.alignment = { horizontal: c.al || (c.f === 'fecha' ? 'center' : c.f && c.f !== 'texto' ? 'right' : 'left'), vertical: 'top', wrapText: c.f === 'texto' || c.f == null };
        x.border = this.borde();
        if (esTotal) {
          x.font = { bold: true };
          x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.tot } };
        }
      });
    filas.forEach((f, i) => pinta(f, HR + 1 + i, false));
    let fin = HR + filas.length;
    if (total) {
      fin++;
      pinta(total, fin, true);
    }
    ws.views = [{ state: 'frozen', ySplit: HR, xSplit: 0 }]; // encabezado siempre visible
    if (filas.length) ws.autoFilter = { from: { row: HR, column: 1 }, to: { row: HR + filas.length, column: n } };
    (notas || []).forEach((t, i) => {
      const x = ws.getCell(fin + 2 + i, 1);
      x.value = this.texto(t);
      x.font = { italic: true, color: { argb: COLOR.gris } };
    });
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${HR}:${HR}` };
    return ws;
  }

  /* ---- salida ---- */
  async generar(wb: any): Promise<Blob> {
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  descargar(blob: Blob, nombre: string): void {
    abrirBlob(blob, nombre, true);
  }
}
