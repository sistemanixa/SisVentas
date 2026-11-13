# Comisiones: bloque local v3.20.9

Estado: Comisiones v3.20.9 publicada el 13/11/2026. Base: `b4a7e68d` (v3.20.8).

Web desde `260ccb13`: Hosting `aa434821f10c6f72`, con nueve activos comprobados byte a byte y marcador oficial actualizado. Servidor `cotizador-comisiones3209-0b67b0a7`, construido desde ese mismo commit sobre la imagen anterior, conserva los 16 accesos. Se aplicaron los seis validadores condicionales y dos índices; se renovaron las tres verificaciones técnicas de OT con las claves y configuración funcional existentes. La guardia temporal se liberó. El despliegue no registró operaciones comerciales.

Validación del paquete de servidor con su guard exacto y flags de producción: 13 casos de emulador aprobados. La revisión web autenticada confirmó listado y detalle de Comisiones en lectura, sin aprobaciones ni pagos de prueba. Estos resultados no equivalen a dar por terminados los circuitos optativos preparados del repositorio: la puerta posterior de esa fuente identificó fallos en propuestas de OT y eliminaciones, separados de esta imagen, que siguen bajo revisión.

## Un solo circuito

- El detalle consulta una venta autorizada y los originales puntuales de cada gasto/movimiento. La proyección económica elimina documentos e imágenes del transporte, sin modificar los campos del cálculo ni resolver costos faltantes con el catálogo.
- Agregar una persona conserva el modal y los porcentajes que el usuario está editando. Informa guardado y actualización; no vuelve a descargar el listado completo ni relee la venta después del alta.
- El alta exige seis fuentes verificadas, cuatro destinos exactos, claves deterministas y ausencia de comisiones heredadas para la misma persona/venta. La incertidumbre no provoca un segundo envío.
- Redistribuir usa originales, nunca DTOs del listado. Un pago o una modificación concurrente siguen produciendo conflicto y requieren actualizar explícitamente.
- «Quién comisiona» selecciona un empleado activo por su clave real. Guarda sólo el principal y una entrada de auditoría; no cambia autoría, acceso, importes, pagos ni comisiones previas.
- El evento de una asignación documental no genera comisiones. Los eventos financieros posteriores conservan la generación normal.

## Permisos al confirmar

Las comprobaciones del servidor se repiten antes de guardar. Además, una capacidad interna ligada a actor, propósito y operación permite que validadores condicionales propuestos rechacen una revocación justo antes del PATCH. Las capacidades no se aceptan desde el cliente y sus campos reservados se borran para los demás escritores.

El emulador aislado verificó 13 casos: reglas de referencia, candidato, repetición sin duplicados, denegación de roles y revocación tardía. Los ensayos usan resúmenes operacionales y no equivalen a activar todas las opciones de producción. La candidata agrega dos índices (`ventaFbKey`, `ventaId`) en la cuenta del empleado y seis validadores condicionales; conserva las concesiones existentes. No se aplicó a la base real. No activar sólo el frontend sin coordinar esos requisitos y el servidor.

## Comparación controlada

Una observación por versión, mismas demoras ficticias: lecturas 80 ms, generación mínima 240 ms y recarga antigua 180 ms. Se verificaron los hashes del módulo contra Git y la fuente actual.

| Medida del ejemplo | v3.20.8 | Local v3.20.9 |
|---|---:|---:|
| Apertura del detalle | 153 ms | 112 ms |
| Clic hasta participantes visibles | 521 ms | 339 ms |
| Lecturas de venta en abrir + agregar | 2 | 1 |
| Recargas del listado tras agregar | 1 | 0 |
| Lecturas puntuales totales del ensayo | 5 | 5 |

El flujo nuevo usa dos lecturas de originales para confirmar el nuevo participante. No se presenta esta observación como mejora estadística ni como latencia de la web real. La proyección reduce bytes al navegador, no la lectura original de RTDB ni su autorización.

## Revisión local

La demo estática usa los módulos reales de interfaz y el adaptador de redistribución sobre datos ficticios en memoria, con red externa bloqueada. Permite agregar, redistribuir, provocar un conflicto y asignar un principal. No se conecta a SisVentas ni ejecuta pagos o aprobaciones reales. Revisión visual en 390, 768 y 1280 píxeles; conflictos, doble clic, cambios de sesión y respuestas tardías se prueban por separado.

La puerta vigente completa terminó con 10.442 PASS, 0 FAIL, 0 cancelados y 52 SKIP (10.494 casos, exit0). El resultado y sus límites se registran en `CONTEXTO_ACTUAL.md`. Los respaldos de reglas, capturas, trazas y datos privados quedan fuera de Git. La revisión local no sustituye la verificación posterior de una publicación autorizada.

## Recuperación visible de intentos pendientes

Un ajuste posterior conserva y vuelve a presentar el mismo intento al restaurar la sesión, incluso si su capa fue retirada o su diálogo nativo se cerró. No consulta ni reenvía automáticamente. Regresión específica: 20 casos unitarios y 3 nativos de recuperación, más 23 nativos relacionados; sin fallos. El gate completo indicado arriba precede este ajuste. No se aprobó ninguna comisión real como prueba.

## Aprobación sin perder el detalle

El botón informa «Aprobando…» desde el inicio y bloquea dobles envíos. El detalle permanece abierto tanto ante errores como tras una aprobación confirmada. Para actualizar el resultado consulta únicamente el gasto y el movimiento afectados, sin recargar los historiales completos. Una respuesta tardía no puede reabrir un contexto retirado.

La sesión, el rol y los permisos se capturan antes de la confirmación y se vuelven a comprobar antes del comando. Cancelar conserva la comisión; una respuesta sin confirmación de guardado no se presenta como aprobada. Los porcentajes sin guardar requieren guardar la distribución antes de aprobar.

Regresión específica final: 82 casos del comando y compatibilidad, y 31 de interfaz con datos ficticios, sin fallos ni omisiones. Estas pruebas no registran aprobaciones o pagos reales. Las mediciones con demoras simuladas comprueban actividad visible y ausencia de recargas globales; no acreditan una reducción de latencia del servidor de producción.

## Preparación de publicación

La puerta completa posterior a recuperación y aprobación terminó con 10.534 casos: 10.482 aprobados, cero fallos y 52 omitidos. La preparación detectó que cuatro fuentes del servidor del checkout diferían de la imagen vigente; no se envió una compilación con esa base. La integración del servidor debe conservar íntegramente los recorridos publicados de Stock y OT y añadir únicamente las inserciones de Comisiones verificadas. El paquete remoto copia nueve archivos sobre el digest vigente, con comprobaciones de integridad previas.

El cambio de reglas también requiere renovar las verificaciones firmadas de entrega y eliminación de OT ligadas a sus hashes, manteniendo su configuración funcional. Compilar, preparar una revisión sin tráfico, activarla y publicar Hosting son estados separados; ni un commit ni esta documentación acreditan por sí mismos un despliegue.

La imagen de esta entrega se construyó desde `260ccb13`, sobre el digest vigente y con nueve archivos de Comisiones. Conserva el guard y runtime nativos de producción. La conciliación posterior del repositorio conserva además recorridos preparados de Accounts, History y H7; éstos permanecen optativos y no forman parte de la imagen ni se habilitan al publicar esta entrega. Las pruebas del emulador con el guard exacto corresponden al paquete construido, no a esos recorridos futuros.
