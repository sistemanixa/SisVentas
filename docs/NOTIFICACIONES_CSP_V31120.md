# Notificaciones y CSP · v3.11.20 publicada

Publicada desde daa07e224fc7f8316455657bddc7414e163796ac en Hosting 87d97f7e4a9e9d59; nueve activos, cabeceras, rutas privadas 404 y aviso de versión verificados. Servidor/reglas/DNS sin cambios.

## Corrección

Las acciones de los avisos ahora son destinos explícitos (presupuesto, OT, gasto, cuenta corriente, horas extra) y argumentos. Se retiraron las dos ejecuciones de new Function del módulo. El generador de la aplicación activa produce acciones estructuradas; la compatibilidad reconoce solamente las cinco formas exactas del cliente anterior y no evalúa expresiones. Un tipo desconocido no puede usar el campo antiguo para saltar la validación.

La lista deja de insertar identificadores dentro de instrucciones onclick. Utiliza atributos de datos escapados y un evento delegado limitado al contenedor. Los identificadores con comillas se tratan como texto. Abrir, marcar no leída, posponer, resolver y archivar conservan sus operaciones y no disparan además la tarjeta de fondo. No se editaron presupuestos anulados ni estados personales reales para probarlo.

Hosting retira unsafe-eval de la política efectiva. Mantiene unsafe-inline para los consumidores existentes: esto NO es una CSP estricta con nonces ni elimina los 768 eventos estáticos inventariados. No añade destinos, permisos, reportes externos ni envío de muestras de código. Es un endurecimiento concreto, no una declaración de seguridad absoluta.

## Evidencia

- Suite vigente: 1.766 pruebas aprobadas; nueve nuevas de acciones (cada una incluye múltiples variantes) y una de CSP. Funciones dinámicas deshabilitadas en la VM; rechazo de inyección y destinos desconocidos, compatibilidad anterior y operaciones delegadas.
- Servidor local scripts/dev-notification-actions.cjs, loopback 8762, archivos permitidos explícitos y datos ficticios. CSP de la prueba de Notificaciones bloquea scripts embebidos y eval; se recorrieron los cinco destinos, acción anterior y controles de estado. No carga Firebase. A ancho de iframe 390 px: documento interior de 375 px, sin desborde horizontal. No equivale a teclado físico.
- /dependencies usa las mismas versiones de SheetJS, html2canvas, html2pdf, PDF.js local y ZXing que la aplicación, bajo CSP sin eval. Excel generado en memoria, captura de documento ficticio, PDF generado en memoria, extracción de PDF sintético e inicialización del lector aprobadas, sin errores/warnings observados. No se importó ni descargó un documento bancario real. Inicializar el lector no reemplaza escanear una etiqueta física.
- Aplicación completa candidata local, mismo origen de sesión y servidor publicado19, CSP sin eval aplicada por meta solo para la prueba: arranque autenticado, Notificaciones (12 controles de abrir, cero onclick dinámicos y PP-0118 ausente), Cuenta corriente (223 filas en la tabla principal, filtro de esa sesión), Productos y Proyectos sin error observado. Gastos personales: ocho secciones disponibles, retorno elimina marco, sin infracciones CSP capturadas ni errores de consola. No se pulsaron acciones de notificaciones reales ni se guardaron operaciones comerciales.
- Sintaxis, diff y coherencia de índice/app/versiones/SW correctos. Cambios del servidor, reglas, DNS y datos: ninguno. Comisiones existentes e Ignacio no se modifican.

## Primera carga: medición adicional, sin cambio de contrato

Recargas autenticadas con activos almacenados muestran sesión disponible alrededor de 2,4 s y Dashboard completo alrededor de 8,7–9,0 s. Se usa el último estado de readiness después de registrar fuentes; no el aria-busy inicial antes de suscripciones. Son muestras locales de esta sesión/red, no garantía de rendimiento ni comparación controlada entre versiones.

La respuesta comercial contiene 1.084 ventas y 107 presupuestos. En una muestra, Ventas recibió cabeceras en 1.729 ms y completó lectura/JSON en otros 4.376 ms. Los campos items y factura aportaron 2.122.731 y 1.905.708 caracteres respectivamente; no son bytes comprimidos. No hubo bloqueos largos comparables con el defecto anterior de 6,4 s de CPU. Las respuestas sin cambios siguieron siendo 304. No se retiraron campos para aparentar mayor velocidad.

Antes de separar adjuntos hay que cubrir estos consumidores:

| Consumidor | Condición que debe conservar |
| --- | --- |
| confirmarVenta / ventasPagosPersistirGuardarVenta | Una edición conserva factura, pagos, costos y creador, incluso si un documento no se descargó. No persistir un DTO incompleto. |
| SVCommercialDocument.preserve / prepare / SVGuardedWrites | Línea base íntegra y detección de cambios concurrentes; hidratar antes de comparar, no sustituir lo faltante por null. |
| verComprobanteFacturaVenta / _abrirAdjuntoFacturaExterna | Original externo disponible bajo autorización vigente, con popup preparado dentro del clic para no romper móvil. |
| partial-invoices / refacturación / historial fiscal | Preservar todos los adjuntos de facturas adicionales y anteriores, importes y referencias. |
| imprimirVentaActual / imprimirVentaDesdeListado / exportaciones | Conservar representación, totales históricos y documentos requeridos, sin mostrar un parcial como completo. |

No habilitar paginación o proyección incompleta en este release. Próxima implementación debe versionar el contrato, recuperar detalle con autorización real, probar que edición/impresión/exportación no pierdan adjuntos y rechazar respuestas de otra sesión. No requiere reescribir históricos ni migrar archivos reales para probar el contrato. La medición cierra el diagnóstico de esta muestra, no la optimización de la historia completa.

Evidencia privada (solo métricas y fixtures) en C:/SisVentas/tmp: initial-audit20-*.json, csp-dependencies20.json/png. No publicar instrumentación ni páginas temporales del espejo.
