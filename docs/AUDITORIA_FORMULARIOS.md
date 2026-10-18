# Formularios en tablet vertical y celular

18/10/2026. Candidata local v3.12.11, rama `codex/formularios-tablet`, desde `af19e317b133b4cd9b68fbc2dffaebb146101e2d`. Producción conserva v3.12.10. Sin publicar ni guardar operaciones reales.

## Criterio y cambios

Una regla de hasta900px forzaba las cuadrículas a una columna aunque hubiera ancho de tablet. `css/responsive-forms.css` aprovecha hasta dos columnas en vertical entre601 y1100px; la cuadrícula vuelve a una columna si el panel no admite campos de260px. Conserva campos full, textos largos y áreas de observaciones a todo el ancho. Cobranzas mantiene su distribución particular de seis columnas.

En teléfono se emparejan únicamente número/fecha, validez/vencimiento, fecha/hora y stock/mínimo, en los formularios identificados. El resto permanece a todo el ancho. No se reordena DOM ni foco, no se ocultan datos, no se reducen alturas de controles ni se cambian eventos, cálculos, validaciones o permisos. Los switches invisibles conservan su ancho mínimo en lugar de heredar el100% del campo.

Distribuidora tenía formulario y resumen de300px uno al lado del otro en tablet vertical, dejando campos excesivamente angostos. En esa orientación el resumen pasa debajo y los campos se distribuyen según el ancho disponible. Celular y escritorio mantienen sus reglas anteriores. Sin cambios a emisión, moneda, precios históricos o garantías.

## Mediciones de tablet820×1180

Altura de las cuadrículas de datos, no de la pantalla completa. Textos de prueba iguales; pueden variar por contenido y dispositivo.

| Formulario | Antes | Después |
|---|---:|---:|
| Presupuesto |583px|432px|
| Gasto |982px|604px|
| Equipo instalado |992px|617px|
| Informe, datos principales |668px|443px|
| Cliente, modal |784px|487px|
| Proveedor, modal |962px|591px|
| Empleado, modal |664px|368px|
| Producto, identidad |623px|548px|
| Producto, garantía |343px|204px|
| Kit |291px|216px|

## Comprobaciones y límites

- Aplicación completa ficticia:42 rutas en tablet y celular; nueve entradas a editores a820×1180,601×1000,390×844,320×844 y1136×900;27 ventanas en tablet y390px;16 solapas de Configuración. Se registran cuadrículas, dimensiones, desbordes y errores en el reporte de la herramienta. Abrir una ruta no equivale a completar todos sus formularios; Relevamientos solo tuvo recorrido de entrada y revisión de su distribución por pasos.
- Presupuesto ficticio:20 días calcula vencimiento07/11/2026 desde18/10/2026; observación y foco permanecen al alternar tablet, celular y escritorio. No se guardó presupuesto ni se actualizó catálogo.
- Proyectos: abrir/cancelar Nuevo proyecto en tablet y celular, sin guardar. Campos extensos e integrantes conservan su presentación; celular desplaza el diálogo internamente. Gastos personales: tarjeta manual ficticia, dos columnas en tablet y una en celular, cerrar y volver; sin guardar tarjeta ni importar PDF. No necesitaban cambios de CSS en este bloque.
- Distribuidora: abrir comprobante ficticio, pasar de remito a recibo, comprobar formulario y retorno en tablet/celular/escritorio. Descartar solo ese borrador RAM; no emitir ni guardar comprobantes.
- Pruebas vigentes, sintaxis y coherencia de versión se registran en CONTEXTO_ACTUAL. Las pruebas financieras existentes complementan el cambio visual; no se escribieron pruebas que solo repliquen el CSS.
- No se probó el teclado virtual, touch ni rotación en dispositivos físicos. Tampoco todas las combinaciones de roles, estados, formularios condicionales o escrituras financieras. El alcance es diseño adaptable y conservación de interacciones representativas.

## Repetir sin datos reales

`node scripts/dev-module-audit.cjs`, en loopback8786: Recorrer módulos, Recorrer editores, Recorrer ventanas y Recorrer configuración. Esperar a que termine cada recorrido antes del siguiente. Resultado de auditoría incluye `forms` con medidas por campo; conservar el reporte fuera de Git. La herramienta no carga SDK Firebase ni permite red remota.

Complementos ficticios: `dev-projects-flow.cjs` (8764), `dev-private-finance.cjs` (8765) y `dev-distributor-documents.cjs` (8763). Nunca reutilizar los recorridos sobre8766 ni producción. Evidencias y capturas permanecen en tmp, fuera de Git y Hosting.
