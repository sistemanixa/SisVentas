# Listados comerciales y carga inicial

## Alcance preparado en v3.14.3, sin publicar

Base local `b1a4960399356640f0bfceee51aa853cd4a92f58`, rama
`codex/listados-historial-acotado`. Conserva las bonificaciones independientes
con mes de cómputo y la eliminación confirmada de presupuestos de las candidatas
3.14.1/3.14.2. Producción sigue en3.14.0 y Cotizador
`cotizador-scoped19-9c6b3126`, según CONTEXTO_ACTUAL. No se modificaron servicios,
reglas, índices remotos, facturación ni registros comerciales para esta prueba.

## Trabajo que se evita

- Ventas resuelve únicamente los presupuestos de origen referenciados por las
  ventas, deduplicados y con un máximo de seis lecturas simultáneas. También
  preparar/reasignar una venta lee su origen puntual y reintenta de forma acotada
  si la referencia cambia durante la transacción. Se conservan responsable,
  autor original y auditoría histórica; una lectura fallida no produce una lista
  parcial presentada como completa.
- El lector condicional de las dos colecciones comerciales conserva sólo datos
  en memoria de la instancia, hasta8MiB por raíz. Cada solicitud sigue
  autorizándose y validando el ETag en RTDB. Un304 evita volver a descargar el
  JSON; un error no devuelve datos viejos. No hay caché de permisos, sondeos,
  servicio nuevo ni almacenamiento persistente. Las operaciones financieras,
  guardas de dependencias y fichas puntuales conservan sus lecturas SDK.
- Guardar un presupuesto con la proyección completa ya cargada utiliza el
  registro confirmado para actualizar las vistas, sin releer la colección.
  Si la carga inicial estaba incompleta, conserva el refresco que incorpora los
  demás registros. Sincronizar explícitamente, recuperar conexión y recibir
  cambios de otra sesión siguen funcionando. Un error de render posterior al
  acuse se informa como problema de vista, sin afirmar que falló el guardado.
- Los formularios de ficha e integrantes de Proyectos piden opciones básicas.
  El selector de presupuestos se consulta sólo al abrir Vincular. La lectura
  pendiente se puede cancelar, un fallo permite cerrar y reintentar, y una
  respuesta antigua no abre ni reemplaza un diálogo de otra sesión o ruta.
  El contrato anterior de opciones completas se conserva para clientes antiguos.

## Medición aislada

El arranque ahora confirma los permisos, restaura la ruta y prioriza sus fuentes
antes del arranque compartido. Observa el mismo estado de datos que la pantalla;
ya no declara éxito al llegar a3.200ms. El plazo de permisos es15s por intento,
con reintento explícito y guard de aplicación del resultado tardío. El GET del
SDK no puede abortarse: no se afirma que el transporte se haya cancelado.
Los datos conservan su propio plazo de error recuperable, que no corre mientras
se verifican permisos. Cambiar de sesión/rol/ruta no permite que una respuesta
anterior cierre la vista nueva. El mensaje queda visible también al restaurar
una sesión, con el mismo estilo oscuro y botón neutro.

Medición de planificación contra app3.14.2/base anterior, funciones reales y
reloj idéntico con fuentes ficticias idempotentes: OT300ms, Clientes100ms,
Productos150ms, Ventas7.000ms y Cobros4.000ms. Permisos:220→0ms; solicitud
OT:220→0ms; OT completa:520→300ms; retiro del inicio:3.420→300ms. El inicio
anterior se retiraba por su límite aunque faltaban fuentes comerciales; el
candidato termina cuando está completo el módulo requerido. Los retardos de
220ms y restauración de ruta2.100ms concurrían: no sumarlos como una demora.
Esto no mide la latencia de producción ni incluye Auth/session-assets previos.
Los tres módulos previos de sesión se conservaron: Compras participa de stock/OT
y los portales tienen sincronización de proveedores que necesita otra revisión.

Una comparación independiente posterior usa la fuente publicada exacta
`5175f354ec9d2ced9baca171eb6fc6f3c2d81d45` (3.14.0), treinta muestras alternadas
y tres calentamientos del entorno Node por operación, con200 presupuestos
ajenos grandes y la misma respuesta comercial. Incluye autorización real de la
función y serialización JSON instrumental de la DB ficticia; excluye preparar
la fixture, red, navegador, arranque de Cloud Run, facturación y caché ETag.

| Operación | p50 local antes → después | p95 local antes → después | Lecturas lógicas | Bytes JSON |
|---|---:|---:|---:|---:|
| Listar Ventas | 10,09 → 0,20ms | 15,06 → 0,31ms | 5 → 5 | 1.914.236 → 1.535 |
| Preparar venta | 7,54 → 0,23ms | 15,11 → 0,40ms | 8 → 5 | 1.915.077 → 1.303 |

Preparar conserva una transacción en ambos casos; todas las respuestas se
comparan y una discrepancia detiene el benchmark. Cero errores en esas muestras.
Cada muestra crea su DB/API en memoria: el calentamiento es de código Node,
no una instancia ni una caché de datos de producción. Estas cifras acreditan
menos trabajo local con esa fixture, no segundos ahorrados en la web. Script
y resultado privados: `C:/SisVentas/tmp/audit-independent-timing.{cjs,json}`.

Las observaciones externas de UI en producción14.0 indicaron navegación caliente
alrededor de1,3s y recargas con dos esperas: OT disponible antes de13s y Dashboard
con Ventas pendiente a20,9s, ya disponible en una observación a33,3s. Incluyen
automatización y huecos entre observaciones; no son tiempos de red ni medición
exacta del fin. No se comparan contra300ms ficticios para anunciar un ahorro real.

Comparación contra la fuente base con200 presupuestos sin relación y una venta
vinculada. Se utilizaron las mismas identidades, permisos y datos ficticios;
la representación resultante es idéntica.

| Operación | Lecturas get/on | Bytes JSON leídos | Transacciones |
|---|---:|---:|---:|
| Listar Ventas | 5 → 5 | 1.914.236 → 1.535 | 0 → 0 |
| Preparar venta | 5 → 5 | 1.914.004 → 1.303 | 1 → 1 |

Son bytes de `JSON.stringify(snapshot.val())`, incluidos perfiles/permisos,
sin protocolo, compresión ni respuesta de transacción. Esta comparación aísla
el recorte de orígenes, sin el lector condicional. No mide tiempo de red,
bytes facturados ni ahorro mensual. Muchos orígenes distintos agregan lecturas
puntuales; menos bytes no garantiza menor latencia en todos los conjuntos.

El emulador RTDB local comprobó el304 real y cambios entre dos instancias,
centavos/ítems/pagos/comisionados intactos, segregación de usuarios y revocación,
altas/bajas/reasignaciones y cambios del origen mientras Ventas responde304.
Todo utilizó una namespace demo y credenciales ficticias de loopback.

Validación final:3.249 aprobadas/27opt-in/0fallos en la puerta vigente (3.276
total),94/94 Cotizador y5/5 integración RTDB local. QA visual aislado de Proyectos
y arranque en escritorio y390x844, incluyendo cancelar/fallar/reintentar y OT
retenida13s. Cero conexiones comerciales y guardados reales en esos ejemplos.
Una expectativa estática que buscaba el arranque antiguo se reemplazó por una
prueba funcional: permisos pendientes o denegados no abren listeners; permisos
confirmados los abren una vez. No se alteró la protección para hacerla pasar.

## Límites que se conservan visibles

La primera lectura, una instancia nueva, una raíz modificada o una raíz mayor
al límite siguen descargando el historial de esa colección. No hay paginación
financiera ni sustitución de totales por una muestra reciente. Cuenta corriente,
comisiones, métricas, ranking y otros consumidores necesitan ese historial;
acotarlo exige proyecciones e índices completos propios, con pruebas separadas.
Un304 sigue teniendo solicitud y cómputo de autorización/filtrado/serialización.

Las mejoras de Cotizador requieren su publicación posterior autorizada. La web
local continúa usando el servidor publicado y no demuestra esta reducción en
producción. No se consultó facturación para atribuir un ahorro monetario.

Evidencia privada fuera de Git: `C:/SisVentas/tmp/listados-v3143-*`, incluyendo
script y JSON reproducibles del benchmark, suites y capturas de QA. La integración
RTDB opt-in se ejecuta con `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9027`
y `node --test test/commercial-collection-emulator.integration.cjs`; no acepta
otro destino.

## Continuación: confirmaciones, recurrencias y alcance pendiente

La revisión de las funciones activas encontró operaciones que devolvían antes de
su acuse: el aviso de éxito y el cierre no demostraban que la escritura hubiera
terminado. Se corrigieron Clientes, Agenda y los formularios simples de
Servicios/Eventos/Tickets, además de Equipos/Informes. Cada operación ocupa sus
controles, espera el resultado, conserva el formulario al fallar y evita que una
respuesta anterior cierre o bloquee un formulario nuevo. Los intentos de alta
retienen su clave en memoria para confirmar una respuesta perdida sin duplicar
el registro; no se promete recuperación de ese estado tras una recarga.

La sincronización de dirección desde Clientes procesa hasta seis OT a la vez,
con lectura/transacción de cada OT exacta, revalidando cliente, estado y domicilio
remotos. Conserva direcciones particulares y otros campos concurrentes. No es
una reducción de cada OT a un DTO: se descarga su registro completo para validar
el cambio. Un fallo detiene nuevos envíos y espera los ya iniciados antes de
informar la parte pendiente; no presenta un cliente confirmado como alta fallida.

Equipos captura identidad, archivos y usuario antes del envío. Espera subida,
URL y metadatos de cada foto, con dos archivos simultáneos, y conserva las fotos
pendientes para reintento. Si una espera excede20s no inicia más archivos del
lote: el SDK pendiente no se da por abortado. Los registros exactos conservan fotos e intervenciones
concurrentes. Imprimir Remito ya tenía lectura única: se preservó `onlyOnce`; se
corrigieron ventanas emergentes bloqueadas, respuesta fallida y cierre antes de
imprimir. Informe escapa los campos de texto al componer HTML de impresión y
limita los esquemas de la imagen; no se amplió CSP.

Otro hallazgo reproducido fue la creación de gastos fijos y de empleados al
recibir un snapshot de Gastos, aun con otra página abierta. Ahora recibir datos
no consulta reglas ni genera gastos. El gestor ofrece **Generar gastos del mes**,
lee los orígenes al pedirlo, presenta mes/cantidad/importe y exige confirmación.
El comando existente revalida reglas y destinos con sus controles de concurrencia
e idempotencia. Se conservan plantillas, pagos y comisiones; no se generó ningún
gasto real durante las pruebas.

Recibir Ventas tampoco ejecuta ahora la reparación de adicionales de OT sin
número. Esa función anterior podía escribir números, auditoría y vínculos al
procesar la lectura. Se conserva como código de mantenimiento sin invocación
automática; no se ejecutó una reparación sobre registros reales. Un eventual
acceso manual necesita un circuito específico con revisión de concurrencia y
confirmación, y permanece pendiente.

Se inventariaron por separado circuitos comerciales/maestros, finanzas/personal
y postventa/sistema. Las matrices privadas enlazan funciones, acciones,
transporte, ámbito, permisos, guardas, evidencia y pendientes. Contar handlers o
recorrer una pantalla no certifica todas sus acciones: los registros sin prueba
individual permanecen pendientes. La navegación del candidato se recorrió en
las 42 pantallas y 27 ventanas, en escritorio y viewport390×844, sin errores JS
ni desborde del documento en esos recorridos. La única operación de cada
recorrido de ventanas fue limpieza ficticia de typing del chat; no hubo conexión
comercial ni guardado real. No fue una prueba física de celular.

### Lecturas amplias que aún necesitan rediseño

| Circuito | Evidencia y límite | Siguiente paso seguro |
|---|---|---|
| Registrar cobro | Cinco GET lógicos para una venta en el ejemplo. La raíz Pagos pasó de7.853B con20 pagos ajenos a1.847.273B con5.000, sin cambiar el número de lecturas. | Índice invertido compatible con todas las referencias legacy, cobertura explícita y mantenimiento atómico de todos los escritores. |
| Alta administrativa de Gastos | Dos lecturas de la colección por preparación/hash y validación del gateway. Con5.000 gastos, alrededor de2,9MB JSON en cada lado del ejemplo. Edición exacta no requiere esa colección. | Completar cobertura canónica de identidades legacy antes de retirar detección de duplicados y CAS. |
| SAC y mantenimientos | Conservan lecturas amplias de Haberes/Gastos. El filtro de pantalla no limita el transporte. | Proyecciones e índices por operación, con validación de históricos y recibos. |
| Reportes/Estadísticas | Dependencias incompletas de readiness y repintado; permisos pueden negar fuentes auxiliares aunque permitan la pantalla. | Contrato por sección: espera para fuentes permitidas y estado sin acceso/incompleto para fuentes denegadas. No ampliar lectura para ocultar la demora. |
| Otros formularios/portales | Matrices con acciones aún sin reproducción individual, incluidas variantes de Compras, configuración, cascadas y mantenimiento. | Pruebas por acción con datos ficticios y medición de tamaño/esperas; no aprobar por analogía. |

Son bytes de JSON lógico, sin protocolo/compresión; no son bytes facturados ni
ahorro monetario. Reemplazar Pagos por tres queries de `ventaFbKey/ventaId/venta`
deja fuera referencias que el matcher vigente reconoce, incluidos aliases
originales y numéricos. Tener `.indexOn` no demuestra cobertura. Se conserva la
lectura amplia hasta poder activar un índice completo mediante un corte
específico: no se movió la misma descarga al servidor como supuesto ahorro.

El diseño privado `payment-membership-index-design.private.md` describe tokens
técnicos/exactos/dígitos, metadatos inversos, cobertura, recibo/fence, inventario
de escritores, reglas, preparación, corte y reversión. Es una propuesta, sin
implementación ni backfill ni activación. No se ejecutó contra la base real.

La publicación continúa pendiente. Este bloque mejora circuitos comprobados;
no declara resuelta toda la lentitud ni terminada la auditoría integral.

### SDK frío y verificación final del bloque

El emulador con SDK real detectó un falso conflicto: una transacción de edición
podía recibir `null` local con el registro aún existente. Un GET previo no
resolvió la prueba. El helper `svTransaccionConEstadoActual` mantiene una escucha
de la clave exacta durante el CAS y la retira al confirmar, fallar, cambiar
contexto o vencer20s. No utiliza un snapshot para reconstruir un registro
borrado. Se aplica también a sincronizar dirección de OT: el caso frío pasó de
cero falsas sincronizaciones a una confirmada, conservando nota y estado.

La suite final congelada aprobó3.405 casos, con27opt-in y cero fallos
(3.432total). Se comprobó que el SHA256 de app no cambió durante la ejecución:
`5c4cfcfbc2d9d211162bedc8844ed7a86e003fc3bfda0800fb8c25b424bc0f68`.
La matriz SDK local aprobó80/80 y el opt-in portable
`test/postventa-confirmed-emulator.integration.cjs`10/10, con reglas locales
exactas del corte19 y proyectos demo. Los conjuntos se solapan; no sumarlos.
La ampliación permitió reproducir y reparar la carrera snapshot/timeout antes
de congelar la fuente; una ejecución intermedia ajena detectó ese fallo y su
repetición final156/156 quedó registrada. No se debilitó la aserción para pasar.

Para repetir el opt-in: iniciar emulador RTDB en loopback y definir
`FIREBASE_DATABASE_EMULATOR_HOST`, `SV_RULES_TEST_FILE` (archivo privado absoluto,
hash normalizado978cea…) y `SV_EMULATOR_DEPENDENCIES` (package.json local con
Firebase/rules-unit-testing). El test exige esas condiciones, usa un proyecto
demo y no incluye reglas reales ni credenciales en Git. No certifica reglas
remotas por haber aprobado contra esa copia local.

### Guardado de Cliente: comparación y costo de protección

Benchmark contra la misma fuente publicada3.14.0, en esta PC/Node24.17.0:
24muestras alternadas por versión y flujo, tres calentamientos,20/200OT con12
relacionadas, domicilio igual/cambiado y VM nueva/reutilizada. Total384muestras,
cero errores, fuente candidata estable5c4cfcfb…0f68. VM nueva significa un
contexto/evaluación nuevos en el mismo proceso V8; la preparación se mide aparte.
No equivale al arranque frío de Cloud Run. No hay red, esperas artificiales,
Firebase SDK ni facturación; transporte en memoria e instrumentación JSON son
iguales en ambos lados. La llamada al renderer es sólo despacho, no pintura DOM.

Ejemplo:200OT, cambia domicilio, VM reutilizada, tiempos locales de la repetición
independiente conservada como evidencia final:

| Etapa desde pulsar Guardar | p50 antes → después | p95 antes → después |
|---|---:|---:|
| Acuse principal | 0,043 → 0,081ms | 0,239 → 0,229ms |
| Último acuse de transporte | 0,184 → 2,878ms | 1,180 → 8,968ms |
| Todos los transportes terminados | 0,185 → 2,878ms | 1,181 → 8,969ms |
| Aviso final | 0,219 → 2,936ms | 1,268 → 9,046ms |

El aviso final de Cliente anterior sí esperaba esos acuses en este flujo; lo
prematuro era el cierre y registro de actividad del formulario. Cerró antes del
acuse principal en192/192casos anteriores, frente a0/192del candidato. El retorno
`undefined` anterior no se tomó como tiempo de persistencia. El candidato despacha
actualización de lista después de confirmar; no agrega un GET para ese refresco.

No es una mejora de velocidad de ese guardado. Sin cambiar domicilio, ambos
conservan0lecturas y2commits/1.164B JSON enviado en el modelo. Cambiarlo con12OT
conserva14commits, pero agrega12escuchas puntuales más12entradas al transformador
CAS: son24snapshots instrumentales/42.248B JSON, **no24descargas de red observadas**.
El JSON de escrituras modelado pasa de2.565 a23.449B porque se transacciona la OT
completa. El máximo simultáneo baja12→6 y todas las escuchas se retiran, pero eso
no limita los bytes totales de muchas OT. Esta corrección protege una dirección
remota que antes se sobrescribía; su costo necesita evaluación separada y no se
presenta como ahorro ni garantía de no aumento por operación.

Un bug de instrumentación dejó `lastAckMs` nulo en un resultado anterior:
`extra.kind` sobrescribía la etiqueta ack. Se preservó ese resultado como inválido
para esa medida, se corrigió el registro y se repitieron las384muestras. El esquema2
exige un ack por commit, pending=0 al terminar y orden temporal
principal≤último≤todos. Se revisaron los384valores, todos numéricos. Evidencia final
congelada: `C:/SisVentas/tmp/client-save-final-reviewed-20261021.private.{cjs,json}`;
el script conserva su ruta original de salida al reproducirlo. No confundir esos
resultados con la reducción comercial medida en la sección anterior.
