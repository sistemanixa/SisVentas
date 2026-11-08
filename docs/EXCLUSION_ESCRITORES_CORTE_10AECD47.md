# Exclusión de escritores durante el corte

Análisis local de la fuente `10aecd47a71954ccffb455c956c011bc90e62325`. No se observaron revisiones reales, no se cambiaron variables y no se certifica drenaje HTTP. El objetivo acotado es demostrar ausencia de escritores de las 17 fuentes del snapshot, aunque continúen solicitudes de lectura.

## Condiciones externas que todavía deben observarse

Enumerar accesos, etiquetas y revisiones efectivamente alcanzables, incluyendo fiscal y forwarders. No basta el porcentaje del servicio principal. Cada revisión anterior debe tener la condición API v2 inequívoca `revisionReason: RETIRED`; no aceptar `RETIRING`, `RESERVE`, `Active=false` ni una espera calculada. La interpretación de ese estado y la completitud del inventario pertenecen al observador de infraestructura, no a un booleano del llamador.

La nueva revisión debe corresponder al artefacto y código fijados, con valores efectivos leídos de su configuración. Cotizador requiere `LABOR_SCOPED_ENABLED=true`, `SV_COMMERCIAL_ADMISSION_PAUSED=true` y, durante la exclusión estricta, `LABOR_SCOPED_READ_ONLY=true`. Fiscal requiere `SV_FISCAL_ADMISSION_PAUSED=true` y `LABOR_SCOPED_READ_ONLY=true` después de conciliar los resultados pendientes. Mantener el gate SDK real `sdkAdmissionPaused=true` y comprobar guard vacío. Estas son precondiciones, no hechos productivos comprobados aquí.

## Recorridos que conservan actividad con admisión pausada

| Recorrido de la fuente fijada | Efecto posible | Protección necesaria |
| --- | --- | --- |
| Fiscal `vincular_emision`, index.js:189, antes del gate:347 | `resume` adjunta factura/NC, auditoría y marcador en ventas mediante guard | Tras conciliar jobs, fiscal `LABOR_SCOPED_READ_ONLY=true`; alternativamente `sv_labor_config/ready=false` impide su commit. La pausa fiscal sola **no** lo bloquea. |
| Fiscal consultas CUIT/comprobante/identidad/PDF antes del gate | Consulta proveedor; no escribe las 17 fuentes | Puede continuar, sin declararlo cero HTTP. |
| Fiscal emisión nueva después del gate | Gate devuelve 503 antes de `begin` y del proveedor | Variable efectiva de admisión pausada en todas las entradas. |
| Cotizador POST de pagos, ventas, gastos, comisiones, OT, usuarios y cuentas | Gate global index.js:2063 rechaza antes del servicio | Admisión pausada; `readOnly=true` añade veto en guard a los circuitos coordinados. |
| Cotizador `/laboral/operacion` bajo pausa | Usa `commercialAdmission.resolveReadOnly`: sólo lee recibo | No llama al `gateway.resolve` ordinario, que sí puede escribir recibo de cancelación. |
| Cotizador capacidades e Historial, excepciones POST del gate | Lecturas de configuración, identidad, originales y derivados | No necesitan ready=false para excluir mutaciones; pueden devolver incompleto durante freeze. |
| Proyectos GET `resumen=1` | Puede reparar listas mediante transacciones Admin | Gate lo bloquea expresamente. GET detalle/opciones y lista sin resumen son lecturas. Proyectos/listas están fuera de las 17 fuentes, pero tampoco se presentan como cero Admin SDK. |
| Eventos internos de comisiones | Método POST obligatorio; reserva/generación/error usan `laborRuntime.run` | POST pausado; `readOnly=true` rechaza el guard antes de trabajo. Forwarders antiguos también deben quedar excluidos por infraestructura. |
| Rutas de eliminación, OT y gastos llamadas con método distinto | Sus adaptadores o autorización exigen POST | Rechazo de método; no usar cambio de método como excepción al gate. |
| Finanzas personales POST, antes del gate global | Puede escribir su dominio privado y objetos | Fuera de las 17 fuentes. La pausa comercial **no** promete bloquearlo; no consultar ni modificarlo para el corte. |
| OAuth MercadoLibre GET/callback | Puede guardar tokens en `_integraciones_server` | Fuera de las 17 fuentes. No equivale a servidor globalmente sin escrituras. |

`ready=false` no detiene Admin SDK arbitrario. Sí veta los commits del guard y resulta necesario para la fase de freeze del contrato actual; no sustituye retirar escritores antiguos o comprobar los accesos no coordinados. `readOnly=true` se comprueba antes de adquirir el guard, salvo la operación interna `resolve`; bajo el gate HTTP se usa exclusivamente el comprobador de sólo lectura mencionado arriba.

## Secuencia mínima sin otra compilación de Cotizador

1. Mantener cerrada admisión HTTP y SDK. Conciliar todos los jobs fiscales existentes con su resultado durable y `venta.emisionesFiscales[operationId]`. La revisión fiscal que permite `resume` necesita todavía guard operativo y `readOnly=false`. No reemitir ni vencer una `despachada` por antigüedad.
2. Preparar una revisión **sólo de configuración**, desde la misma imagen aprobada, con fiscal pausado y `readOnly=true`; Cotizador pausado y `readOnly=true`. Esto requiere una activación autorizada independiente; no está ejecutado. No recompilar la imagen35 ni inventar que su `READ_ONLY=false` actual equivale a este estado.
3. Retirar entradas de todas las revisiones previas y observar `RETIRED`, incluidas las usadas para conciliar. Sólo entonces el veto de la nueva configuración cubre los escritores sobrevivientes. Releer jobs, marcadores y guard: cualquier ambigüedad bloquea.
4. Fijar `ready=false` mediante CAS observado, comprobar fuentes estables y continuar snapshot/derivados bajo la misma exclusión. No convertir esta evidencia en `activeRequests=0`: la conclusión permitida es exclusión de escritores identificados de las fuentes acotadas.
5. El verificador comercial requiere Cotizador `readOnly=false` para activar capacidades. Restaurarlo sólo en una revisión compatible todavía con admisión HTTP/SDK cerradas, verificando otra vez sus rutas y el retiro de la revisión anterior. Fiscal puede y debe permanecer `readOnly=true` durante instalación y aceptación; no abrir `resume` mientras se preparan derivados.
6. Reabrir únicamente con fuentes/derivados, jobs, artefactos y capacidades verificados. Restaurar capacidad fiscal de adjuntar al final, con protocolo nuevo compatible y sin registrar operaciones de prueba.

No es un ejecutor ni una autorización. La necesidad de una revisión de variables durante el corte debe incorporarse al plan operativo antes de la pausa; la disponibilidad de la imagen no demuestra que el cambio de variables ni el retiro de revisiones ya estén hechos.

## Huellas de código contrastadas

| Archivo | SHA256 de bytes Git en 10aecd47 |
| --- | --- |
| cotizador/index.js | 157125d7ce7d0755f5e159a2775ad28186ac97c415f5902d7914874547e4d405 |
| cotizador/commercial-admission.js | 5b8f2fd1d36d5e3bbca905fe5e1f0a6f1a3a8928fc1b83892979d71a382fd178 |
| cotizador/labor-guard.js | a28c5acd6baf8e169426fa03d2be829645d4ee32fb15113b49781b96d0ed62de |
| cotizador/labor-runtime.js | 2d1785b1ec8a92460108388027ab3970e4cf0cb2a3fcbef3a344ffe63bb24d06 |
| cloud-functions/emitir-factura/index.js | 089d33e27a75c242e7ddd042ef5c4722ff236953679991487f0fd89bd0632123 |
| cloud-functions/emitir-factura/labor-bridge.cjs | fac5c5cf60ddc2c336ad7b26d3e92bcbc6a0d9f5c297fa49ddc4b9283283c762 |

Las pruebas locales verifican esas huellas y el veto temprano real del guard. No sustituyen pruebas de transporte, configuración remota, estado `RETIRED`, completitud de inventario ni reconciliación fiscal.
