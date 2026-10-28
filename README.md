# Gestión de obras · Angular

 **Angular 22** 

## Requisitos y comandos

Node.js lo exige Angular 22.

```bash
npm install
npm start          # http://localhost:4200
npm test           # 40 pruebas de la lógica (Vitest)
npm run build      # producción → dist/
```

## Estructura
```
src/app/
  core/
    modelos/     Reglas de negocio (antes js/modelos). Un servicio por modelo; no tocan la interfaz.
                 almacen.ts = ÚNICO lugar con los datos y la persistencia (localStorage)
    export/      Excel (ExcelJS, carga diferida) y exportación/importación de valorizaciones
    utils/       fechas, formato, descargas
    guards.ts    sesión y permiso por módulo
  shared/        Piezas reutilizables: modal, campos de formulario (validación), gráficos, KPI, etc.
  layout/        Menú lateral, barra superior y campana
  pages/         Una pantalla por archivo (antes js/vistas/paginas + controladores)
  modales/       Un formulario por archivo (antes js/vistas/modales)
```

Equivalencias: `Controlador` → eventos del componente · `VIEWS.x` → componente de `pages/` ·
`openModal` → `ModalServicio.abrir(Componente)` · `state` → signals del componente · `Almacen.guardar()` → `Almacen.cambio()`.

## Puntos de migración a Supabase

| Hoy (navegador) | Con Supabase |
|---|---|
| `Almacen.cargar()` / `guardar()` (localStorage) | Consultas y escrituras a tablas (obras, valorizaciones, cartas, trabajadores, usuarios…) |
| `UsuarioModelo.iniciarSesion()` (simulado) | Supabase Auth; `Usuario.rol` y `obras` pasan a una tabla de perfiles |
| `ArchivoModelo` (IndexedDB) | Supabase Storage |
| Permisos en `UsuarioModelo.autorizar()` | Repetir las mismas reglas como políticas RLS |
| Reglas de `ValorizacionModelo` (quién aprueba, versión oficial) | Repetirlas en la base de datos (funciones/triggers) |

Los modelos solo leen y modifican `Almacen` y llaman a `almacen.cambio()`; al conectar Supabase, los componentes no necesitan cambiar.

## Código eliminado respecto al proyecto original

Modo demostración (ya no hace falta: existe el administrador), compatibilidad con datos de versiones anteriores,
resumen económico (G.G./utilidad) sin pantalla que lo abriera, cuatro exportadores a Excel sin botón
(`libroAvance`, `libroCartas`, `libroPersonal`, `libroCalendario`), botón «Descargar» de la valorización (era un aviso),
opciones de reglas financieras nunca configurables, estado «En elaboración», funciones sin uso, selectores CSS huérfanos
y las librerías copiadas en `vendor/` (ahora vienen de npm).

## Integrantes del proyecto
- Cabanillas Rojas Stefany Fiorella
- Ochoa Uribe Luis Diego
- Ladi José Villanueva Colonia



