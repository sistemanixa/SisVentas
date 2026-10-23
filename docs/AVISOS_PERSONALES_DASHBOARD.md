# Avisos personales de bonificaciones y comisiones

## Rediseño v3.14.11 · publicado el 23/10/2026

El titular pidió el mismo formato del aviso de aumento de valor hora: una franja
horizontal con icono, título alentador y acción a la derecha en computadora.
Bonificaciones y Comisiones aparecen por separado sólo si hay movimientos
recientes verificados del tipo correspondiente. Un resultado vacío confirmado
oculta el contenedor completo; no quedan tarjetas vacías ni botones sin destino.
En celular el botón pasa debajo del texto, conservando el área táctil.

Se conserva el primer movimiento ya ordenado por el modelo, su importe individual,
mes de cómputo, fecha y unidades cuando existen, más el contador de otros recientes.
El detalle completo sigue en Mi cuenta. No se suman reconocimientos ni se recalcula
el importe a partir de unidades. Los encabezados distinguen aprobación, pago
parcial, pago confirmado y marca manual sin desglose; un pendiente administrativo
no se presenta como dinero autorizado. Los datos, fechas y permisos del modelo
anterior permanecen iguales.

Carga, error y cobertura incompleta mantienen un mensaje neutral breve: ocultar un
tipo vacío no significa esconder fallos de lectura. Una transición retira los
handlers del aviso anterior; apertura y regreso conservan su tipo, filtros y foco.
El componente no añade consultas, almacenamiento, temporizadores ni escrituras.

La presentación está probada con datos ficticios y CSP sin conexiones en
320/390/768/1280: filas en escritorio, acción a la derecha, ajuste móvil sin
desborde, activación por Enter y recorrido Tab. Capturas y medición privadas en
`tmp/listings-next-private/notices11-ui`. La integración de la escucha de Mi cuenta
está validada por separado con fuentes reales sobre SDK/DOM ficticios y la puerta
vigente; su alcance y límites constan en CUENTA_EMPLEADO_ESCUCHA.md. No acredita
operaciones financieras productivas. La publicación11 está verificada por hashes
en el dominio real, con Service Worker y aviso oficial11. El Dashboard web se
comprobó con la sesión administrativa existente; aún falta una sesión destinataria
para verificar un aviso personal real sin crear datos de prueba. Detalles y
límites en CONTEXTO_ACTUAL.md.

## Antecedente: alcance inicial de la candidata v3.14.9

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

En el corte inicial9 la auditoría general seguía abierta: el Dashboard aún leía la raíz de horas extra y Mi cuenta mantenía sus lectores y deduplicadores legacy. La publicación10 sustituyó esa lectura de horas por el endpoint propio, como documenta HORAS_PERSONALES_DASHBOARD.md. Las contrapartes temporalmente desfasadas se presentan como información por confirmar hasta la próxima carga normal de CTA. No se añaden consultas para resolverlas ni se promete una conciliación de todo el historial legacy sin referencias técnicas.

La presentación sólo requiere activos web. No necesita servidor, reglas, servicios, índices, migraciones, backfill, tareas por reloj ni cambios de permisos. Publicar una nueva candidata requiere autorización posterior y el procedimiento vigente de Hosting/activos/aviso. El estado actual de producción y las tandas posteriores están en CONTEXTO_ACTUAL.md.
