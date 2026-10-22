# Cobros y altas de Gastos · candidata local 3.14.3

## Alcance y estado

Continuación del pedido de reducir las consultas de todo el historial, conservando
pagos, permisos y comisiones. Rama `codex/cobros-gastos-indices-atomicos`, desde
`8533dbbf64a3a74b3043a31f946d232270aafd60`. No se publicó la candidata, no se
preparó ningún índice real y no se cambiaron reglas, recursos ni datos comerciales.
Producción continúa en el estado documentado de 3.14.0/Cotizador
`cotizador-scoped19-9c6b3126`; este bloque no volvió a consultar Google Billing.

El registro/anulación de cobros y dos altas administrativas de gastos tienen
comandos puntuales candidatos. La compatibilidad anterior sólo se selecciona
antes de escribir, cuando el servidor informa que la capacidad está desactivada
o todavía no dispone de la ruta. Un rechazo, conflicto, desconexión o respuesta
incierta después de intentar el comando nunca dispara una segunda escritura
por el circuito viejo. Las capacidades no sustituyen permisos.

## Relaciones y atomicidad

El índice `sv_labor_indexes/paymentRefs_v1` deriva exclusivamente pertenencia
entre Pagos y Ventas. Reproduce el matcher publicado: prioridad de referencias
técnicas, seis referencias comerciales, alias originales y claves numéricas,
incluidos ceros iniciales. Incluye pagos anulados; no copia importes ni adjuntos.
No se reemplazó por tres consultas incompletas sobre campos modernos.

La cobertura guarda esquema, hash del matcher, generación, conteos, acumulador
de relaciones y secuencia. Los comandos exigen cobertura válida y verifican las
fuentes exactas autorizadas. Una cobertura ausente o
incompleta nunca se anuncia como lista ni se interpreta como ausencia de pagos.
El límite explícito es 100 ventas y 10.000 candidatos por operación, con hasta
seis lecturas simultáneas. Los errores no caen a una descarga histórica oculta.

El guard central deriva el delta del índice y lo incluye en el mismo PATCH que
pagos, resumen de venta, agrupación, comprobante, recibo y liberación del cerco.
No hay una cola diferida que deje el índice desactualizado. Los escritores
genéricos con cobertura activa no pueden crear cobros ni cambiar su economía.
Una normalización de referencias requiere propósito explícito de mantenimiento,
administrador autorizado y comparación de la imagen exacta anterior. Adjuntos
y bajas existentes siguen manteniendo el índice; esto no convierte cascadas de
múltiples comandos en una transacción global.

Al consultar, cada pago candidato se lee una vez como usuario y se reconstruyen
sus pertenencias. Se exige igualdad exacta entre pertenencias esperadas y
observadas dentro de los buckets consultados. Esto detecta miembros extra,
faltantes parciales, falsos enlaces y fuentes ausentes o incompatibles. Los
buckets y pagos compartidos por varias ventas se leen una sola vez.

La primera candidata leía también la inversa de cada pago sólo consultado.
La revisión de rendimiento retiró esa auditoría inversa redundante del camino
de cálculo, sin añadir huellas duplicadas al índice. Su corrupción aislada ya
no impide registrar otro pago y no se repara incidentalmente. El guard sigue
leyendo y validando la inversa real de **todo pago mutado**, incluido alta-null,
anulación, relaciones, adjuntos y bajas, antes del PATCH. No equivale a mantener
literalmente todas las comprobaciones anteriores ni a una auditoría global:
un pago ausente de todos los buckets consultados no se descubre con ese
prefiltro. La completitud depende del bootstrap verificado y de todos los
escritores coordinados. Se conservan límites y autorización por fuente.

Gastos reutiliza su índice de identidad laboral existente, sin otro backfill.
El alta rápida conserva su proyección reducida; la completa conserva cuenta de
empleado, movimiento, pagos y foto separada. Se verifican colisiones legacy y
se preserva la precisión guardada. No se extendió este contrato a editar gastos,
solicitudes personales o SAC.

## Contabilidad y autorización

Se conservó por separado la fórmula publicada de registrar y de anular. La
primera prioriza pagos globales válidos y, si faltan, el total guardado; la
segunda considera la presencia de pagos globales, aun anulados, antes de los
embebidos. Se conservaron sus posiciones de redondeo y límites. Esa diferencia
legacy preexistente no se modificó de manera silenciosa como optimización.

El primer acuse devuelve la proyección obtenida bajo el mismo cerco. Recuperar
una operación devuelve una vista actual identificada como tal, comprobada entre
dos secuencias y una segunda imagen de ventas; no ejecuta el cobro otra vez.

Perfil, rol, revisión y acciones se capturan por operación y se revalidan antes
del commit. La regla candidata comprueba además ese contexto en el propio
PATCH; no usa la copia Admin como autorización del usuario. Pérdida de acceso
rechaza la operación y un cambio concurrente requiere revisión. No se amplían
permisos de usuarios para evitar una lectura denegada.

La interfaz retiene ID, claves, importe, fecha, grupo y contenido del comprobante
durante un intento incierto; bloquea cambiarlo hasta consultar la confirmación.
El cierre de sesión conserva sólo metadatos sanitizados de recuperación en
sessionStorage, aislados por UID. No promete recuperación después de cerrar
la pestaña o borrar ese almacenamiento. El cobro confirmado se marca antes de
pasos secundarios y un fallo posterior no lo presenta como un cobro rechazado.
Las comisiones mantienen el circuito explícito e idempotente ya existente;
no se borraron, recalcularon ni generaron comisiones reales durante esta prueba.

## Activación pendiente

Las banderas `PAYMENT_SCOPED_ENABLED` y `ADMIN_EXPENSE_SCOPED_ENABLED` quedan
desactivadas por defecto y requieren el circuito laboral acotado. El módulo de
preparación de Pagos es puro y sin credenciales: planifica cobertura no lista y
sólo produce cobertura verificable tras comparar el índice completo releído.
Más de 8 MiB o 18.000 hojas exige preparación por etapas y un corte específico;
no activa un resultado parcial.

La candidata de reglas restringe el padre completo `sv_labor_indexes`, además
de Pagos. Por ello **todos los escritores laborales y fiscales que utilizan ese
padre deben actualizarse coordinadamente antes de marcar cobertura lista**,
incluido el paquete de emitirFactura. No alcanza con publicar la web o sólo
Cotizador. Antes de un corte: confirmar operaciones detenidas, reglas remotas
exactas y escritores, respaldo privado, plan de preparación y reversión, costo
informado y verificación del paquete. Ninguno de esos pasos externos se ejecutó
en este bloque local.

## Evidencia y límites

Puerta vigente final con R100/recibo: 3.671 pruebas, 3.644 aprobadas, 27 opt-in,
cero fallos. La primera congelación había dado3.621/27/0 en3.648casos.
La primera pasada encontró dos expectativas estáticas de los argumentos
retenidos y un fixture de empaquetado que omitía dos dependencias nuevas; se
actualizaron esos contratos y se repitió la puerta completa. No se alteró una
expectativa contable para obtener aprobación.
Tras integrar próximas fechas de tarjetas, CSS móvil y procedencia de tasa del
escenario, la puerta conjunta final dio3.694casos:3.667aprobados,27opt-in,0fallos.
Log privado `cobros-gastos-integrated-final-gate.private.log`. El cambio posterior
de app es una nota de Novedades; no cambia funciones financieras del benchmark.

Emulador RTDB real local: 35/35, con rutas HTTP y módulos reales, reglas
candidatas sobre la base local revisada `978cea4169880cd9b5d2782fbe17b7243a2fea562cb1737cb15292ebaa2e1782`.
Auth es ficticio y determinista; no equivale a verificar el proveedor remoto.
Incluye concurrencia de permisos, reintentos, un commit, claves/arrays numéricos,
escritores viejos y compatibilidad laboral/fiscal. El emulador quedó detenido.
Quince carreras con edición privilegiada durante el commit rechazaron sin
parciales; la revocación ficticia previa devolvió401 sin entrar al store. La
repetición final fortaleció el caso JWT: el mismo token obtuvo PUT200 fuera del
cerco y DELETE/PUT401 dentro, sin cambiar la revisión protegida. Resuelve el
límite de atribución de la primera ejecución, que no tenía ese baseline.

Comparación independiente del matcher: 77.712 decisiones sobre 48 ventas y
1.619 pagos, cero diferencias; 800 identidades de gastos, cero diferencias.
Diferencial financiero: 1.000 registros y 1.000 anulaciones contra las funciones
publicadas, cero diferencias finales. Los conjuntos focales se solapan con la
puerta y no deben sumarse como pruebas únicas.

La medición de rendimiento usa fixtures idénticos y versiones congeladas. Cuenta
bytes JSON, consultas, commits y tiempo local; no mide TLS, arranque frío Cloud
Run ni factura. El índice agrega almacenamiento, hojas y trabajo por escritura:
reducir las lecturas amplias **no garantiza una factura mensual menor**. No se
añadieron servicios, instancias mínimas ni consultas por reloj.

La comparación final tiene ocho escenarios, 24 muestras alternadas y tres
calentamientos por versión, con primera acción y siguiente acción: 768 acciones
medidas. Hashes de fuentes iguales al principio y al final, resultados económicos
idénticos, un commit por operación y ninguna lectura de raíz en los comandos
nuevos. La primera acción incluye capacidades; la siguiente sólo cachea esa
capacidad. Las consultas son llamadas lógicas instrumentadas, no solicitudes
físicas medidas en Google.

| Primera acción ficticia | JSON leído antes → después | Lecturas antes → después | p50 local antes → después |
| --- | ---: | ---: | ---: |
| Cobro, 5.000 pagos ajenos y 1 relacionado | 1.857.126 → 3.408 B | 8 → 21 | 33,79 → 1,27 ms |
| Cobro, 5.000 ajenos y 10 relacionados | 1.859.094 → 5.469 B | 8 → 30 | 37,99 → 2,04 ms |
| Cobro, 5.000 ajenos y 100 relacionados | 1.878.804 → 26.189 B | 8 → 120 | 38,69 → 4,94 ms |
| Gasto, 5.000 ajenos | 5.825.502 → 3.599 B | 8 → 14 | 172,58 → 1,76 ms |
| Cobro, 20 ajenos y 1 relacionado | 7.746 → 3.404 B | 8 → 21 | 2,44 → 3,60 ms |
| Cobro, 20 ajenos y 100 relacionados | 29.425 → 26.187 B | 8 → 120 | 1,94 → 4,50 ms |

La contrapartida del cobro es explícita: más verificaciones puntuales y mayor
PATCH (por ejemplo958→2.015B). Con poco historial y muchos pagos relacionados
aún puede tardar más, aunque el JSON final sea menor. El índice de la fixture de5.000 ocupa
2.408.672B JSON, preparación separada del tiempo de operación. El gasto pasa
de828→907B de PATCH. Estos datos no autorizan prometer mejora universal,
segundos de producción ni costo mensual; queda pendiente medir el transporte
real al preparar una activación autorizada. No se quitaron verificaciones para
mejorar artificialmente el benchmark.

La candidata previa realizaba220lecturas/60.707B en20ajenos/R100; la final
realiza120/26.187B sin aumentar el índice. La tabla compara siempre versiones
pareadas dentro de la misma ejecución final. Los tiempos absolutos de ambas
versiones cambiaron entre corridas por condiciones locales/JIT; no atribuir la
diferencia de24→4ms entre corridas exclusivamente al cambio. Las cabeceras,
tokens, TLS y latencia de120GET autorizados tampoco están incluidos en JSON;
continúa sin acreditarse un costo productivo no creciente.

La auditoría integral continúa abierta: SAC, contratos de otros listados y
operaciones individuales de las matrices requieren su propio cierre. Este
bloque no certifica todas las pantallas ni todos los dispositivos físicos.

QA de navegador aislada, escritorio y390×844: pago de cuenta100, cobro50,
anulación del50, gasto completo45,67 y gasto rápido12,34. Cinco commits,
históricos/comisión ficticios intactos y cero errores JS; tres bitácoras
adicionales ficticias por acciones explícitas. Se comprobó progreso, confirmación,
cierre por cruz, bloqueo del fondo y ancho móvil. El primer adaptador fbPush
no era thenable y falló una secundaria OT: se corrigió sólo ese fixture y su
seed, y se repitió el circuito normal. No se usaron Firebase ni datos reales.

El titular agregó el fallo de segunda hoja en blanco en Descargar/Compartir PDF
del recibo. Se reprodujo con html2pdf0.10.1 real, cargada localmente y toda red
abortada: mínimo A4, márgenes y espacio de barra/padding superaban el área útil
rasterizada. La exportación usa un clon de alto natural, sin controles ni padding
inferior, y la impresión elimina el mínimo/flex de la hoja. No se recorta
contenido ni se borran páginas a ciegas. Caso corto: viejo2hojas→nuevo1;
compartir1, impresión1. Caso largo USD con110observaciones:2hojas, última
observación y firmas comprobadas visualmente, sin última hoja blanca. Los
16casos focales incluyen fallos y restauración del botón. Descargar y compartir
entregan el mismo PDF generado; no se envió nada por WhatsApp.

La pestaña blob del usuario fue rechazada por la política de URL del navegador;
no se intentó recuperarla por otro medio. La reproducción usa una fixture
independiente creada desde la fuente. Se conserva como pendiente de otra revisión
el escaping de varios campos históricos/logo del generador, no introducido ni
resuelto en este cambio de paginado.

Evidencia privada fuera de Git en `C:/SisVentas/tmp/`: puerta
`cobros-gastos-current-gate-final.private.log`, emulador
`payment-scoped-emulator.integration.evidence.private.json`, corpus
`audit-finance-compatibility-corpus.json` y diferenciales
`audit-payment-financial-parity.json`. No incluyen aquí credenciales ni payloads
reales de clientes.
Comparación final congelada: `audit-finance-comparison-r100.json`, sobre
app14b6224a…f1989b83/snapshot628c6be3…f6d76b. La anterior está conservada en
`audit-finance-comparison-before-r100.json`. La QA de navegador utiliza una demora
artificial de1.200ms para ver el progreso; no forma parte de ese benchmark.
PDFs ficticios y renders: `tmp/pdfs/receipt-layout-20261022/`;
regresión `test/payment-receipt-pdf-layout.test.cjs`.
