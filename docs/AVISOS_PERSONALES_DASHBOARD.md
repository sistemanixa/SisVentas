# Avisos personales de bonificaciones y comisiones

## Alcance de la candidata v3.14.9

Inicio presenta el último reconocimiento reciente de cada tipo, su importe individual, estado, unidades/valor unitario cuando existen, fecha de novedad y mes de cómputo. El contador indica los otros movimientos recientes del mismo tipo, después de conciliar sus referencias. La acción abre Mi cuenta propia con el tipo seleccionado y la vista de historial; el retorno conserva filtros, scroll y foco.

Son avisos informativos. No conceden ni aprueban bonificaciones, no calculan otra comisión, no crean pagos y no calculan un neto salarial. Los importes de los movimientos guardados se conservan. El estado pendiente nunca se presenta como dinero autorizado para cobrar.

## Fuentes e identidad

- Se aprovechan el GET de CTA propia que ya ejecuta `renderDashMiCuenta` y la suscripción de Gastos ya autorizada. El aviso no inicia un lector propio.
- La última referencia CTA vive únicamente en memoria, ligada a Auth/UID, rol, revisión de permisos, sesión, vista de impersonación, empleado y generación de petición. La entrega de Gastos conserva el contexto de su productor; una consulta propia conserva además el empleado de su alcance.
- La conciliación usa claves CTA/Gasto y backlinks exactos. `legacyKey=ctaemp/empleado/movimiento` se interpreta y verifica dentro del empleado propio. El ID de un grupo con varios destinatarios no identifica un movimiento individual. Igualdad de importe, texto o mes no permite fusionar reconocimientos distintos.
- Vínculos cargados con beneficiario contradictorio, referencias incompatibles o estados/importes enfrentados quedan por confirmar. No se agregan detalles de otra persona al DTO. La ausencia de una contraparte no provoca un GET para buscarla.
- La visibilidad conserva la política personal vigente: aprobado, pago parcial y pagado; los pendientes requieren el permiso administrativo ya existente. Rechazados y anulados no generan un cartel de reconocimiento.

El lector compartido `_ctaEmpEstadoDesdeGasto` reconoce también la evidencia explícita de aprobación de una bonificación. Antes podía proyectar un bono ya concedido como `pendiente_pago`, y el filtro personal lo ocultaba. `pendiente_pago`, por sí solo, sigue sin probar aprobación. No se cambia el normalizador contable de Gastos ni se reescriben históricos.

## Fechas, pagos y errores

La ventana incluye hoy y las 29 fechas locales anteriores. Se usa la marca de aprobación válida; en su ausencia, la de creación; finalmente una fecha calendario de concesión válida. Se compara sólo el nivel utilizado entre espejos. Un pago posterior o una baja administrativa no renuevan la novedad. Fechas futuras no se muestran como recientes. El mes de cómputo es independiente, puede ser futuro y no se inventa desde otra fecha legacy.

Los pagos se toman del registro correspondiente, excluyendo los anulados. Los espejos no se suman ni se resuelven tomando el máximo. Se conserva la tolerancia canónica de un centavo y el sobrepago registrado; un estado contradictorio queda incompleto. Una marca manual antigua de pagado sin desglose informa esa limitación, sin inventar un importe abonado.

Carga, fallo y resultado vacío confirmado son estados diferentes. Si una fuente falla se retiran importes y acciones anteriores. Un subconjunto verificado puede mostrarse con advertencia de información incompleta. Logout, pérdida de permiso, cambio de contexto y limpieza eliminan la caché y sus acciones. Ocultar la pestaña retira la vista; volver sólo repinta el snapshot vigente, sin otra consulta del componente.

## Validación y límites

Las pruebas permanentes usan la aplicación activa. Cubren el alta real del flujo Bonus6 con gateway/guard/almacenamiento ficticios, pares con backlinks completos, comisiones legacy, varios beneficiarios, estados/pagos/anulaciones, centavos, fechas, orden de llegada, errores, revocación, Auth/sesión/vista/generación, filtro y retorno. La fixture visual contiene únicamente datos ficticios y bloquea conexiones con CSP `connect-src 'none'`.

En el mismo guion de dos cargas de Mi cuenta y entregas de Gastos, base8 y candidata9 conservan 4 invocaciones GET y 1 suscripción; el aviso agrega 0 escrituras. Es una comparación de invocaciones SDK en una fixture, no una medición de factura, tráfico real o latencia. Abrir y volver mediante la navegación normal conserva los lectores de CTA/Dashboard que ya existían; no se afirma que toda navegación sea de cero lecturas.

QA con navegador: 320/390/768/1280 píxeles, textos largos, columnas y ancho, teclado/acciones, carga/error/incompleto, retiro de permiso y limpieza. La acción de la fixture sólo confirma un callback local; el destino y retorno reales se validan con las funciones activas en memoria. No acredita un dispositivo físico, una operación financiera productiva ni una prueba física de gestos.

La auditoría general sigue abierta. El Dashboard aún tiene su lectura de la raíz de horas extra y sus puntos de recarga anteriores; Mi cuenta mantiene sus lectores y deduplicadores legacy. Las contrapartes temporalmente desfasadas se presentan como información por confirmar hasta la próxima carga normal de CTA. No se añaden consultas para resolverlas ni se promete una conciliación de todo el historial legacy sin referencias técnicas.

La candidata sólo requiere activos web. No necesita servidor, reglas, servicios, índices, migraciones, backfill, tareas por reloj ni cambios de permisos. Se prepara para revisión; publicar requiere una autorización posterior y el procedimiento vigente de Hosting/activos/aviso. Producción continúa en v3.14.8 hasta completar ese procedimiento.
