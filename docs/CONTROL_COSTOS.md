# Control de consumo de SisVentas

## Publicación13.3 · 19/10/2026

Cotizador `cotizador-audit-e897dede` y web13.3 activos y verificados desde fuente `e897dede350f1f56795c60d657bad994f6a395a3`; mínimo0, CPU por solicitud, eventos activos y observador apagado. Sin recursos mínimos ni servicios nuevos. Construcción única79,725s en e2-standard-2; unos USD0,008 de compilación antes de franquicias, almacenamiento/transferencia aparte. No equivale a factura ni ahorro mensual medido. Estado técnico y reversión en CONTEXTO_ACTUAL; las secciones candidatas siguientes son antecedentes.

## Auditoría de alcance · 19/10/2026 · candidato13.3

Estado externo según CONTEXTO_ACTUAL: web13.2 y Cotizador
`cotizador-projects-66a77036`, mínimo0, CPU por solicitud, eventos activos y
observador continuo explícitamente apagado. Las secciones anteriores de
preparación/publicación que siguen conservan sus cifras y fechas históricas.

El [inventario de Cotizador](AUDITORIA_COTIZADOR.md) separa 15 familias de
operaciones. El candidato13.3 reduce el alcance de comprobar una venta puntual,
comparte cargas simultáneas y cancela continuaciones de vistas obsoletas. No
agrega servicios ni reserva permanente. No se midieron ahorro mensual, bytes
productivos ni facturación en esta revisión local; no atribuirle un importe.
La transacción laboral de raíz, los listados/opciones amplios y parte del
arranque permanecen pendientes. Cambios locales no prueban reducción aplicada.

## Comprobación manual · 19/10/2026

Producción vigente: Cotizador `cotizador-audit-518425db` (100% y14 accesos) y web13.0, como registra CONTEXTO_ACTUAL. Conserva mínimo0, cobro por solicitud y eventos de comisiones. Las revisiones de preparación que siguen son antecedentes, no un cambio de tráfico pendiente.

Se consultaron una vez el informe de facturación actualizado y cuatro series agregadas para una ventana de60min terminada10min antes. El acumulado visible mezcla gasto anterior y registro diferido; la hora incluye publicación, pruebas y navegación. La transferencia RTDB sigue requiriendo atribución, aunque el cómputo observado ya corresponde a solicitudes. Evidencia privada `consumo-20261019.private.json`; no hay nueva alarma, sondeo ni servicio creado para esta medición. No inferir costo mensual≤30 ni un corte exacto por dólar.

La verificación de acceso corresponde a cada solicitud iniciada por una acción o evento autorizado; no equivale a sondear historiales por reloj. Proyectos no contiene un temporizador de consultas. El candidato13.1 paraleliza dos lecturas de su autorización, sin cachear permisos ni reducir su cantidad. Resolver presupuestos vinculados todavía puede leer contexto comercial amplio: optimizarlo requiere conservar la visibilidad por responsable. La transacción laboral de raíz sigue pendiente. No anunciar esas reducciones como aplicadas.

## Actualización: reserva permanente retirada

Cotizador cotizador-events-b56470ce al100% y14 etiquetas, mínimo0 y CPU por solicitud. Los tres receptores Gen1 sólo reenvían eventos pequeños autenticados; entrega nativa probada y probeta retirada. Fuente b56470ceeee276c572f4315c4f2853f8010f3ff1, reversión cotizador-cost-ee5a02ed. No hay observador global activo en la revisión nueva. La reserva permanente descrita abajo corresponde a la preparación anterior y ya fue reemplazada.

Escenario comunicado antes de crear:3.000 eventos de10s≈USD1,22 cómputo Cotizador, más USD0–2 de receptores; transferencia, base, otros servicios, registros e imágenes aparte. No equivale a costo total ni límite exacto; pendiente medir consumo real posterior. Alertas30 y corte60 desde noviembre permanecen sin modificaciones. Octubre sigue operativo.

## Decisión del titular · 18/10/2026

- Mantener el sistema operativo durante octubre. No suspenderlo por el gasto ya acumulado.
- Avisos mensuales a USD15,21,27,30 y por proyección de USD30, para todos los servicios del proyecto SisVentas. Conservar el presupuesto anterior.
- Suspensión al recibir un aviso válido con costo mensual real de USD60 o más, **desde noviembre de2026**. No dar por activo el corte sólo por crear un presupuesto.
- Retirar consultas de datos por reloj sin una acción del usuario. Conservar autorización por operación, lectura inicial asociada al ingreso/navegación, eventos causados por cambios reales, reconexión y reintentos acotados de una operación concreta.
- Comisiones: el pago completo confirmado es el disparador; generación idempotente y participantes autorizados. No borrar, recalcular ni alterar comisiones existentes para probar. Verificar por separado la identidad inicial y los participantes al modificar esa regla; no confundir un cambio de responsable comercial con una modificación de beneficiarios.

## Candidato v3.12.19

Sin sondeo comercial cada15s, directorios cada30s, prueba de red cada10s, vigilancia HTTP/PWA por reloj, consulta automática horaria de cotización, latidos periódicos de presencia/métricas ni revisión periódica de notificaciones. Los intervalos que sólo dibujan una animación/reloj local o pertenecen a una operación que el usuario inició no equivalen a consultas de datos.

Los listados comerciales se actualizan al entrar, guardar o usar Sincronizar ahora. No prometer actualización espontánea de cambios remotos en una pantalla que queda inmóvil: el sondeo anterior se retiró. La autorización del servidor sigue vigente en cada operación. Usuarios conserva los eventos de cambio de directorio y de revocación. Los controles del SDK de Firebase y la renovación de sesión siguen siendo necesarios; no prometer cero tráfico de protocolo.

El observador de comisiones ya recibía eventos de ventas pagadas. Se elimina su recorrido completo de trabajos cada minuto: `commission-job-events.js` sólo programa reintentos de trabajos interrumpidos concretos, respeta reservas y límite de intentos y cancela al completar/quitar. El proceso existente permanece activo para recibirlos con navegadores cerrados. **Esto aún no elimina el costo de la instancia mínima permanentemente encendida.** No bajar sus instancias/CPU antes de reemplazar y verificar ese disparo.

No se agregó una caché de autorizaciones, ni una respuesta compartida entre usuarios, ni una nueva lectura automática de historiales para intentar ocultar el consumo.

## Corte por eventos de facturación

Código: `cloud-functions/cost-guard/`. Canal privado `sisventas-cost-guard-60`. Identidad exclusiva `sisventas-cost-guard`, del proyecto `nixa-sisventas`. Cuenta de facturación y presupuesto exactos se configuran por `COST_GUARD_BILLING_ACCOUNT` y `COST_GUARD_BUDGET_ID`; no obtenerlos de un mensaje arbitrario.

El controlador valida identidad del aviso, esquema, moneda USD, monto fijo60, costo real numérico y período mensual vigente. Ignora octubre, períodos anteriores/futuros, previsiones que aún no son gasto y presupuestos ajenos. Usa el mes de facturación de Google en America/Los_Angeles; no introduce un reloj de consultas en SisVentas.

Acción autorizada, al superar el umbral desde noviembre:

1. Deshabilitar la instancia RTDB de SisVentas mediante `instances.disable`, sin eliminarla ni cambiar sus reglas.
2. Poner en escala manual0 Cotizador, Asistente, emitirfactura y testtfapp. Quitar sus tags de tráfico: escala0 por sí sola deja accesibles las revisiones etiquetadas.
3. Esperar las operaciones de configuración y verificar el resultado. Guardar sólo metadata de tráfico para recuperación; nunca registrar entornos, secretos ni datos financieros.

Los roles versionados en `security/cost-guard-*.json` no permiten borrar recursos, alterar IAM ni desvincular facturación. El permiso para actualizar Cloud Run se vincula individualmente a los cuatro servicios, no a todos los servicios del proyecto. El permiso para suspender RTDB y leer operaciones está a nivel del proyecto. El titular aprobó expresamente esta identidad, recursos y permisos tras el bloqueo de la revisión automática.

Una base deshabilitada rechaza lecturas/escrituras incluso desde la consola. Mientras esté suspendido no habrá sincronización ni nuevas comisiones. La recuperación es manual por el titular: revisar costo/motivo, reactivar la instancia y restaurar escala/tráfico desde la metadata previa. No reactivar automáticamente al mes siguiente ni mediante un despliegue incidental. No desvincular la facturación como atajo: ese procedimiento puede terminar eliminando recursos.

## Costo y límites

Alertas por correo: sin cargo adicional de Cloud Billing. Estimación comunicada para el controlador: USD0–1/mes, con hasta200 avisos mensuales y ejecución de hasta un minuto por aviso, sin instancia mínima. No es un precio contratado, ni incluye la operación normal de los otros servidores, impuestos o servicios de IA externos. Verificar cuotas gratuitas compartidas, imágenes, compilaciones y consumo observado. Los cambios de código locales no acreditan un costo mensual futuro.

**No es un tope exacto de la factura.** Los avisos Pub/Sub llegan varias veces al día y tienen demora; pueden existir operaciones en curso, cobros tardíos y costos de conservación. Los caps nativos actuales no cubren RTDB y son por un servicio, no por todo SisVentas. No prometer que una suspensión por aviso cerrará la factura exactamente en USD60.

## Comprobación

- Suite vigente y casos `user-triggered-reads.test.cjs`, `commission-job-events.test.cjs`, `cost-guard.test.cjs` con datos ficticios.
- `npm ci` en el controlador y prueba opcional `node --test test/cost-guard-framework.integration.cjs`: HTTP loopback, aviso ficticio de octubre y obtención de credenciales bloqueada.
- Dependencias fijadas. Override de uuid11.1.1 para corregir el aviso de seguridad heredado de CloudEvents; probar el registro real y la serialización HTTP antes de desplegar. `npm audit --omit=dev` sin vulnerabilidades detectadas al preparar.
- Después del despliegue: verificar min0/max1, identidad, tópico, presupuesto exacto y log de aviso de octubre ignorado. Nunca probar una suspensión real usando un aviso falso elegible.
- Revisar transferencia/costo agregado antes/después; no descargar la base entera para medirla. Detalles de facturación y evidencia privada quedan fuera de Git.

Fuentes: [presupuestos y avisos](https://docs.cloud.google.com/billing/docs/how-to/budgets), [precio de Cloud Billing](https://cloud.google.com/billing/v1/pricing), [avisos programáticos y demoras](https://docs.cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications), [deshabilitar RTDB](https://firebase.google.com/docs/reference/rest/database/database-management/rest/v1beta/projects.locations.instances/disable), [escala manual y tags](https://docs.cloud.google.com/run/docs/configuring/services/manual-scaling), [límites nativos](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps).

## Inventario funcional del ajuste urgente

Comparación de18 publicada con19 y 20 publicada. Se distingue cambio de comportamiento de eliminación de una función comercial. El ahorro no se consigue prometiendo que no habrá lecturas: ingreso, navegación, eventos, reconexión y autenticación aún requieren red.

| Función | Cambio y consecuencia | Estado |
|---|---|---|
| Ventas/Presupuestos | Sin consulta cada15s. Actualizan al entrar, guardar, Sincronizar ahora, regresar a la pestaña y reconectar. Cambios de otra PC no aparecen solos mientras la pantalla queda inmóvil |19 publicada |
| Directorios de usuarios/empleados/proveedores | Sin consulta cada30s. Lectura inicial, acciones/refresco y señales reales de directorio/rol;20 comparte solicitudes y descarta sesiones antiguas |19; barreras20 publicada |
| Indicador de conexión | Sin prueba HTTP cada10s. Conserva eventos offline/online, retorno y errores de operaciones. Una caída silenciosa sin evento puede detectarse en la siguiente acción |19 publicada |
| Avisos de vencimiento de presupuestos | Sin revisión horaria por reloj; revisión de ingreso/datos. Una pantalla inmóvil puede conservar el aviso hasta el siguiente refresco |19 publicada |
| Notificaciones | Sin revisión cada30s; eventos/datos, navegación/foco e inicio.20 evita bucles de reenvío de preferencias y conserva la decisión concurrente más nueva |19; recuperación20 publicada |
| Versiones de la web | Sin comprobación HTTP cada minuto ni actualización del Service Worker cada15min. Se mantienen apertura, aviso de publicación y comprobación de retorno/foco/red |19 publicada |
| Cotización del dólar | Sin actualización horaria de fondo. Actualizar ahora sigue; configuración diaria puede consultar al ingresar si venció. No se reescriben precios históricos |19 publicada |
| Catálogo público: cotización | Sin consulta cada minuto; al abrir/volver al catálogo. Puede conservar cotización anterior si permanece inmóvil |19 publicada |
| Presencia/conectados | Sin latidos ni escrituras por actividad.13.0 usa conexión cx1 confirmada y retiro propio seguro; claves antiguas mantienen TTL y clientes viejos deben actualizar para la semántica nueva |13.0 publicada |
| Estadísticas de uso de usuarios | Acumulación local por eventos, visibilidad y sesión, sin escritura cada30s.13.0 corrige el límite anterior de60s; no reconstruye históricos ni funciona como control de asistencia |13.0 publicada |
| Comisiones automáticas | Sin barrido global ni instancia permanentemente reservada. Tres eventos de pago/estado/habilitación entregan al servidor; conserva reglas, participantes, idempotencia y reintentos concretos. Funciona sin navegadores | Servidor activo |
| Arranque del servidor | Mínimo0 y cobro por solicitud; primera solicitud después de reposo puede tener arranque en frío | Servidor activo |
| Borradores | Captura periódica sólo local; envío por cambio, ordenado y sin bucle de rollback. La vista compartida no tiene latidos de borrador vacío |20 publicada |
| Lecturas de módulos/fichas |13.0 difiere ocho colecciones por pantalla, espera sus dependencias y recupera fuentes fallidas. Conserva una escucha y descarta fichas tardías por sesión/vista/revisión |13.0 publicada |
| Configuración Distribuidora | Consulta de Guaraní y configuración sólo al entrar/por acción, no desde Dashboard |20 publicada |
| Migraciones al leer | Ya no asigna legajos, migra porcentajes ni borra proveedores de mano de obra como consecuencia de cargar listas. Faltante de legajo se muestra sin inventarlo |20 publicada |
| Fechas automáticas |54 lugares más Caja usan fecha/mes local, no día UTC. No reescribe manuales ni históricos |20 publicada |
| Offline opcional | Protege caché/cola por sesión; continúa apagado por defecto, no se habilitó como sustituto de sincronización |20 publicada |
| Menú y carteles | Geometría estable de clic en menú; errores con semántica de alerta. Correcciones de interfaz sin eliminar operaciones |20 publicada |
| Presupuesto/alertas/corte | Añadidos avisos30 y corte60 desde noviembre. Una suspensión impide sincronizar/comisionar hasta revisión y reactivación manual; no limita exactamente la factura por demora de avisos | Controlador activo, octubre excluido |

No se retiraron ventas, presupuestos, cobros, cálculo de comisiones, stock, caja, PDF/IA ni permisos del servidor como medida de ahorro. Los datos existentes no se borraron ni recalcularon para probar.13.0 reduce la carga inicial y corrige carreras de fichas; las dependencias compartidas todavía cargan al ingresar. Continúan pendientes transacciones laborales de raíz y otros recorridos de la auditoría. Cada cambio futuro debe conservar este inventario y registrar regresiones reales, no asumir que menos consultas equivale a misma experiencia.

Continuación local13.0: la pérdida de precisión de métricas se reprodujo y corrigió sin restaurar escrituras por reloj. También se corrige orden de respuestas al abrir fichas.2.123 pruebas aprobadas; estos cambios posteriores no están en20 publicada. No se reconstruyen métricas históricas que no se registraron.

Corte13.0 publicado y verificado el19/10/2026: presencia moderna por conexión con retiro propio seguro, ocho colecciones a demanda por pantalla y omisión de PUT en reenvíos laborales ya confirmados. Las claves de presencia antiguas conservan TTL y las operaciones laborales nuevas todavía leen/transaccionan raíz; no se retiraron formularios ni controles financieros. Métricas siguen sin reloj remoto y fichas tardías se descartan. Fuente y evidencia efectiva en CONTEXTO_ACTUAL.

## Medición agregada posterior al corte de eventos

Consulta única de métricas existentes el18/10/2026 local (19/10 00:21UTC), sin leer registros comerciales ni crear monitores. Ventanas de20min: antes23:20–23:40UTC, después23:55–00:15UTC. El tráfico y las pruebas difieren entre ventanas; no son un experimento controlado ni una proyección mensual.

| Métrica | Antes | Después | Interpretación |
|---|---:|---:|---|
| Tiempo facturable de Cotizador, instancias agregadas |3.043,952s |35,6s | Observación favorable; muestra reserva previa/múltiples instancias y solicitudes nuevas, no porcentaje de ahorro mensual |
| Solicitudes de Cotizador |11 |44 | La actividad cambió entre ventanas |
| Bytes enviados RTDB (incluye protocolo/cifrado) |18.109.669 |135.398.027 | Persisten ráfagas grandes; no afirmar resuelto consumo de base |
| Payload RTDB |16.829.760 |134.972.308 | No representa por sí solo todo lo facturable |

Las series RTDB son dispersas (puntos sólo cuando hay actividad), y las métricas tienen demora. La revisión anterior llega a0s facturables en su último punto23:57UTC; la revisión por eventos tiene0s en00:20UTC. Son puntos de medición, no garantía de apagado permanente. El período posterior incluye cargas reales de interfaz autorizadas; no se atribuye toda transferencia a un endpoint sin traza correlacionada. Falta observar días normales y la factura consolidada. Evidencia privada cost-postcut-metrics*.private.json, fuera de Git.

Fuentes de definición: [uso RTDB](https://firebase.google.com/docs/database/usage/monitor-usage), [métricas Cloud Run](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z#run). No se cambió infraestructura ni facturación con esta lectura.
