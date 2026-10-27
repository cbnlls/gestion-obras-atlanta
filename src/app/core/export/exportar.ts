import { Injectable, inject, signal } from '@angular/core';
import { hoyIso, mShort } from '../utils/fechas';
import { fmt } from '../utils/formato';
import { AvanceModelo } from '../modelos/avance-modelo';
import { CalendarioModelo } from '../modelos/calendario-modelo';
import { CartaModelo } from '../modelos/carta-modelo';
import { PersonalModelo } from '../modelos/personal-modelo';
import { Plazo } from '../modelos/plazo';
import { Obra } from '../modelos/tipos';
import { UsuarioModelo } from '../modelos/usuario-modelo';
import { ValorizacionModelo } from '../modelos/valorizacion-modelo';
import { ObraModelo } from '../modelos/obra-modelo';
import { ExcelServicio } from './excel';

export interface ValorizacionImportada {
  key: string;
  dias: string;
  vb: string;
  reaj: string;
  ded: string;
  advD: string;
  advM: string;
  fondo: string;
  pen: string;
}

/** Exportar a Excel (.xlsx) e importar valorizaciones.
 *  Toma los datos de los MODELOS (las mismas funciones que usan las pantallas, sin recalcular) y los entrega a ExcelServicio
 *  para darles formato. Solo exporta lo que el rol puede VER. Mientras se genera el archivo se bloquea la acción (evita descargas dobles). */
@Injectable({ providedIn: 'root' })
export class ExportarServicio {
  private readonly excel = inject(ExcelServicio);
  private readonly obras = inject(ObraModelo);
  private readonly usuarios = inject(UsuarioModelo);
  private readonly vals = inject(ValorizacionModelo);
  private readonly avance = inject(AvanceModelo);
  private readonly cartas = inject(CartaModelo);
  private readonly personal = inject(PersonalModelo);
  private readonly calendario = inject(CalendarioModelo);

  readonly ocupado = signal(false);

  /** Descarga el expediente completo de la obra activa. Devuelve el nombre del archivo; lanza un Error con el motivo si falla. */
  async exportarExpediente(): Promise<string> {
    if (this.ocupado()) throw new Error('Ya se está generando un archivo.');
    if (!this.usuarios.puede('Valorizaciones', 'ver')) throw new Error('Tu rol no tiene acceso a «Valorizaciones».');
    const o = this.obras.activa();
    if (!o) throw new Error('Selecciona una obra para exportar.');
    this.ocupado.set(true);
    try {
      await this.excel.cargar();
      const nombre = this.excel.archivo('Expediente-completo', o.contrato);
      this.excel.descargar(await this.excel.generar(this.libroExpediente(o)), nombre);
      return nombre;
    } finally {
      this.ocupado.set(false);
    }
  }

  private sub(o: Obra): string {
    return `${o.nombre} · Contrato ${o.contrato}`;
  }

  /** Hoja «Obra»: datos de identificación + quién y cuándo generó el reporte. */
  private hojaObra(wb: unknown, o: Obra, reporte: string): void {
    this.excel.hojaDatos(wb, 'Obra', reporte, [
      ['Obra', o.nombre], ['N.º de contrato', o.contrato], ['Entidad contratante', o.entidad], ['RUC de la entidad', o.rucEntidad],
      ['Contratista', o.contratista], ['Sistema de contratación', o.sistema], ['Monto contractual (S/)', o.monto, 'moneda'],
      ['Plazo vigente (días)', Plazo.plazoVigente(o), 'entero'], ['Inicio', o.inicio, 'fecha'], ['Fin vigente', Plazo.finVigente(o), 'fecha'],
      ['Estado de la obra', o.estado], ['Generado el', hoyIso(), 'fecha'], ['Generado por', this.usuarios.sesion().nombre || '—'],
    ]);
  }

  /** Valorizaciones e historial de trazabilidad. */
  private libroValorizaciones(o: Obra): unknown {
    const wb = this.excel.libro('Valorizaciones');
    this.hojaObra(wb, o, 'Valorizaciones');
    const vs = this.vals.todas(o);
    this.excel.hojaTabla(wb, {
      nombre: 'Valorizaciones', titulo: 'Resumen de valorizaciones', sub: this.sub(o),
      columnas: [
        { h: 'N.º', w: 8, f: 'entero' }, { h: 'Período', w: 12, f: 'texto' }, { h: 'Días', w: 8, f: 'entero' }, { h: 'Estado', w: 23, f: 'texto' }, { h: 'Versión propuesta', w: 14, f: 'entero' },
        { h: 'VB (S/)', w: 16, f: 'moneda' }, { h: 'Reajuste (S/)', w: 16, f: 'moneda' }, { h: 'Deducción (S/)', w: 16, f: 'moneda' }, { h: 'Amort. directa (S/)', w: 17, f: 'moneda' }, { h: 'Amort. materiales (S/)', w: 18, f: 'moneda' },
        { h: 'Fondo garantía (S/)', w: 17, f: 'moneda' }, { h: 'Penalidades (S/)', w: 16, f: 'moneda' }, { h: 'VN (S/)', w: 16, f: 'moneda' }, { h: 'IGV (S/)', w: 16, f: 'moneda' }, { h: 'Total factura (S/)', w: 17, f: 'moneda' }, { h: 'Monto a pagar (S/)', w: 17, f: 'moneda' },
        { h: 'VB oficial (S/)', w: 16, f: 'moneda' }, { h: 'Aprobado por', w: 24, f: 'texto' }, { h: 'Fecha aprobación', w: 16, f: 'fecha' },
      ],
      filas: vs.map((v) => {
        const c = this.vals.calcular(v);
        return [v.n, v.key, v.dias, v.estado, v.version, v.vb, v.reaj, v.ded, v.advD, v.advM, v.fondo, v.pen, c.vn, c.igv, c.fact, c.pagar, v.oficial ? v.oficial.vb : null, v.oficial ? v.oficial.aprobadoPor : '', v.oficial ? v.oficial.fecha : null];
      }),
      notas: ['La versión propuesta puede estar pendiente de revisión. Solo la versión oficial aprobada alimenta el avance físico.', 'Los cálculos exportados provienen del modelo de valorizaciones del sistema.'],
    });
    this.excel.hojaTabla(wb, {
      nombre: 'Historial', titulo: 'Historial de auditoría de valorizaciones', sub: this.sub(o),
      columnas: [
        { h: 'Valorización', w: 13, f: 'entero' }, { h: 'Fecha', w: 13, f: 'fecha' }, { h: 'Hora', w: 9, f: 'texto' }, { h: 'Usuario', w: 24, f: 'texto' }, { h: 'Rol', w: 18, f: 'texto' }, { h: 'Acción', w: 38, f: 'texto' },
        { h: 'Versión', w: 10, f: 'entero' }, { h: 'Motivo / comentario', w: 48, f: 'texto' }, { h: 'Valores anteriores', w: 55, f: 'texto' }, { h: 'Valores nuevos / aprobados', w: 55, f: 'texto' },
      ],
      filas: vs.flatMap((v) =>
        (v.historial || []).map((h) => [v.n, h.fecha, h.hora, h.usuario, h.rol, h.accion, h.version, h.comentario || '', h.valoresAnteriores ? JSON.stringify(h.valoresAnteriores) : '', h.valoresNuevos ? JSON.stringify(h.valoresNuevos) : h.valoresAprobados ? JSON.stringify(h.valoresAprobados) : '']),
      ),
      notas: ['La trazabilidad registra las acciones disponibles en el sistema. El almacenamiento actual es local al navegador y no equivale a una auditoría inviolable de servidor.'],
    });
    return wb;
  }

  /** Libro único de expediente con las hojas que el rol puede ver. */
  private libroExpediente(o: Obra): unknown {
    const wb = this.libroValorizaciones(o);
    const rows = this.avance.filas(o);
    const totalEj = this.vals.totalEjecutado(o);
    if (this.usuarios.puede('Avance físico', 'ver'))
      this.excel.hojaTabla(wb, {
        nombre: 'Avance físico', titulo: 'Avance físico: programado vs ejecutado', sub: this.sub(o),
        columnas: [
          { h: 'Período', w: 12, f: 'texto' }, { h: 'Días', w: 8, f: 'entero' }, { h: 'Programado mes (S/)', w: 18, f: 'moneda' }, { h: 'Programado acum. (S/)', w: 19, f: 'moneda' }, { h: '% prog. acum.', w: 14, f: 'pct' },
          { h: 'Ejecutado mes (S/)', w: 18, f: 'moneda' }, { h: 'Ejecutado acum. (S/)', w: 19, f: 'moneda' }, { h: '% ejec. acum.', w: 14, f: 'pct' }, { h: 'Estado', w: 36, f: 'texto' },
        ],
        filas: rows.map((r) => [r.key, r.dias, r.pDef ? r.pm : null, r.pDef || r.pa > 0 ? r.pa : null, r.pDef || r.pa > 0 ? r.paPct : null, r.em, r.ea, r.eaPct, r.estado.texto]),
        notas: [`Monto contractual: S/ ${fmt(o.monto)}. Total ejecutado aprobado: S/ ${fmt(totalEj)}.`, 'Los porcentajes de la hoja se exportan como porcentajes de Excel.'],
      });
    if (this.usuarios.puede('Cartas de fianza', 'ver'))
      this.excel.hojaTabla(wb, {
        nombre: 'Cartas de fianza', titulo: 'Cartas de fianza', sub: this.sub(o),
        columnas: [{ h: 'Tipo', w: 24, f: 'texto' }, { h: 'Número', w: 18, f: 'texto' }, { h: 'Banco', w: 24, f: 'texto' }, { h: 'Monto (S/)', w: 16, f: 'moneda' }, { h: 'Emisión', w: 14, f: 'fecha' }, { h: 'Vencimiento', w: 14, f: 'fecha' }, { h: 'Estado', w: 18, f: 'texto' }],
        filas: this.cartas.todas(o).map((c) => [c.tipo, c.num, c.banco, c.monto, c.emision, c.vence, this.cartas.estado(c)]),
        notas: ['Este libro contiene metadatos de cartas; los archivos adjuntos binarios no se incrustan en el Excel.'],
      });
    if (this.usuarios.puede('Mano de obra', 'ver'))
      this.excel.hojaTabla(wb, {
        nombre: 'Mano de obra', titulo: 'Padrón de mano de obra', sub: this.sub(o),
        columnas: [
          { h: 'Trabajador', w: 30, f: 'texto' }, { h: 'DNI', w: 14, f: 'texto' }, { h: 'Cargo', w: 24, f: 'texto' }, { h: 'Categoría', w: 18, f: 'texto' }, { h: 'Ingreso', w: 14, f: 'fecha' },
          { h: 'Cese', w: 14, f: 'fecha' }, { h: 'Pago mensual (S/)', w: 18, f: 'moneda' }, { h: 'Total pagado (S/)', w: 18, f: 'moneda' }, { h: 'Estado', w: 12, f: 'texto' },
        ],
        filas: this.personal.todos(o).map((w) => [w.nombre, w.dni, w.cargo, w.cat, w.ini, w.fin, w.mensual, this.personal.pagadoTrabajador(o, w), this.personal.activo(w) ? 'Activo' : 'Cesado']),
      });
    if (this.usuarios.puede('Calendario de obra', 'ver')) {
      const items = this.calendario.items(o);
      const periodos = Plazo.periodosObra(o);
      const meses = periodos.map((p) => p.key);
      this.excel.hojaTabla(wb, {
        nombre: 'Calendario', titulo: 'Calendario valorizado de obra', sub: this.sub(o),
        columnas: [
          { h: 'Ítem', w: 14, f: 'texto' }, { h: 'Partida / descripción', w: 46, f: 'texto' }, { h: 'Und.', w: 9, f: 'texto' }, { h: 'Metrado', w: 13, f: 'metrado' }, { h: 'P.U. (S/)', w: 14, f: 'moneda' }, { h: 'Parcial (S/)', w: 16, f: 'moneda' },
          ...periodos.map((p) => ({ h: `${mShort(p.key)} (${p.dias} d)`, w: 15, f: 'moneda' as const })),
        ],
        filas: items.map((r) => {
          if (r.type !== 'par') {
            const st = this.calendario.subtotalesDe(o, r.code, meses);
            return [r.code, r.desc, null, null, null, st.parcial, ...meses.map((k) => st.porMes[k] || null)];
          }
          const p = r as import('../modelos/tipos').Partida;
          return [p.code, p.desc, p.und, p.metrado || null, p.pu || null, this.calendario.parcial(p), ...meses.map((k) => p.months[k] || null)];
        }),
        notas: ['Capítulos y subcapítulos suman sus partidas de detalle. Los P.U. no incluyen IGV.'],
      });
    }
    return wb;
  }

  /** Descarga la plantilla para importar una valorización. */
  async plantillaImportacion(): Promise<void> {
    await this.excel.cargar();
    const wb = this.excel.libro('Plantilla de importación de valorización');
    this.excel.hojaTabla(wb, {
      nombre: 'Importar valorización', titulo: 'Plantilla para importar valorización', sub: 'Completa una fila por valorización. No cambies los encabezados.',
      columnas: [
        { h: 'Periodo', w: 14, f: 'texto' }, { h: 'Dias', w: 10, f: 'entero' }, { h: 'VB', w: 16, f: 'moneda' }, { h: 'Reajuste', w: 16, f: 'moneda' }, { h: 'Deduccion', w: 16, f: 'moneda' },
        { h: 'AdelantoDirecto', w: 18, f: 'moneda' }, { h: 'AdelantoMateriales', w: 20, f: 'moneda' }, { h: 'FondoGarantia', w: 18, f: 'moneda' }, { h: 'Penalidades', w: 16, f: 'moneda' },
      ],
      filas: [['2026-10', 30, 10000, 0, 0, 0, 0, 0, 0]],
      notas: ['Periodo debe usar AAAA-MM. Importes en soles, sin separador de moneda. La fila de ejemplo debe reemplazarse.'],
    });
    this.excel.descargar(await this.excel.generar(wb), 'Plantilla-importacion-valorizacion.xlsx');
  }

  /** Lee el Excel de una valorización (plantilla del sistema o archivo simple con encabezados en la fila 1). Lanza un Error si no es válido. */
  async leerValorizacion(file: File): Promise<ValorizacionImportada> {
    if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera el máximo de 10 MB.');
    const lib = await this.excel.cargar();
    const wb = new lib.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets.find((x: { name: string }) => /importar valorizaci[oó]n/i.test(x.name)) || wb.worksheets[0];
    if (!ws || ws.rowCount < 2) throw new Error('El archivo no contiene una fila de encabezados y una fila de datos.');
    const norm = (x: unknown) => String(x == null ? '' : x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let headers: Record<string, number> = {};
    ws.getRow(4).eachCell((c: { value: unknown }, i: number) => (headers[norm(c.value)] = i));
    // Admite la plantilla descargada (encabezados en fila 4) y archivos simples con encabezados en fila 1.
    let headerRow = 4;
    if (!Object.keys(headers).length || !('periodo' in headers)) {
      headers = {};
      ws.getRow(1).eachCell((c: { value: unknown }, i: number) => (headers[norm(c.value)] = i));
      headerRow = 1;
    }
    const aliases: Record<keyof ValorizacionImportada, string[]> = {
      key: ['periodo', 'mes'], dias: ['dias'], vb: ['vb', 'valorizacionbruta', 'montoejecutado'], reaj: ['reajuste', 'reaj'], ded: ['deduccion', 'ded'],
      advD: ['adelantodirecto', 'advd'], advM: ['adelantomateriales', 'advm'], fondo: ['fondogarantia', 'fondo'], pen: ['penalidades', 'pen'],
    };
    const idx = {} as Record<keyof ValorizacionImportada, number | undefined>;
    for (const [k, names] of Object.entries(aliases) as [keyof ValorizacionImportada, string[]][]) idx[k] = names.map((n) => headers[n]).find((i) => i != null);
    const missing = (['key', 'dias', 'vb'] as const).filter((k) => idx[k] == null);
    if (missing.length) throw new Error('Faltan columnas obligatorias: ' + missing.join(', ') + '. Descarga y usa la plantilla del sistema.');
    const row = ws.getRow(headerRow + 1);
    const val = (i?: number): unknown => {
      if (i == null) return '0';
      const v = row.getCell(i).value;
      return v && typeof v === 'object' && 'result' in (v as object) ? (v as { result: unknown }).result : (v ?? '0');
    };
    const d: ValorizacionImportada = {
      key: String(val(idx.key)).trim(), dias: String(val(idx.dias)), vb: String(val(idx.vb)), reaj: String(val(idx.reaj)), ded: String(val(idx.ded)),
      advD: String(val(idx.advD)), advM: String(val(idx.advM)), fondo: String(val(idx.fondo)), pen: String(val(idx.pen)),
    };
    if (!/^\d{4}-\d{2}$/.test(d.key)) throw new Error('El período debe tener formato AAAA-MM (ej.: 2026-10).');
    return d;
  }
}
