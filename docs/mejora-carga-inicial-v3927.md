# Carga inicial: segundo bloque de rendimiento

Versión preparada: v3.9.27. Fecha: 09/10/2026.
Rama de trabajo local: `codex/login-performance-v3926`.
Sin publicación, push ni cambios de datos/reglas en Firebase.

## Resultado estructural

| JavaScript referenciado por la entrada | Auditoría v3.9.25 | Preparación v3.9.27 |
| --- | ---: | ---: |
| Archivos | 110 | 107 |
| Bytes sin comprimir | 4.597.075 | 4.201.966 |
| Suma de gzip local por archivo | 1.177.552 | 1.073.515 |

La entrada carga aproximadamente 395 KB menos sin comprimir, una reducción del 8,6 %. No representa el tráfico total de una sesión ni una medición de velocidad: se desplaza parte del código a la fase posterior a la verificación de acceso. La comparación incluye los cambios del primer bloque de login y el cargador nuevo de 2.705 bytes. No incluye imports transitivos de Firebase, imágenes, fuentes ni otras descargas dinámicas.

## Qué cambió

- `session-assets.js` carga los portales de Distribuidora/Paraguay y, para roles internos, Órdenes de compra. El resolutor espera sus exports antes de conceder el rol local y ejecutar `_completarLogin`, por lo que los listeners de sesión y las funciones que reemplazan a las anteriores están disponibles a tiempo.
- Las descargas del grupo comienzan juntas. Los scripts dinámicos con `async=false` conservan el orden de ejecución: Distribuidora, portal Paraguay y Compras.
- El cargador comparte solicitudes en curso, comprueba la inicialización, informa error/timeout y permite reintentos. Reutiliza módulos ya cargados durante el mismo documento, pero no reemplaza las verificaciones de autorización del login.
- Compras Paraguay y Distribuidora no descargan Órdenes de compra durante su preparación de sesión.
- El planificador Paraguay dejó de cargarse desde el HTML. Sólo se descarga para compras históricas que requieren ese planificador. Compras nuevas siguen usando la preparación actual; el cargador también comparte sus solicitudes y las de importación PDF.
- La precarga de `sw.js` excluye los módulos separados y la preparación exterior. De otro modo, el primer registro de la PWA los descargaría de todos modos durante la pantalla de acceso. El cargador liviano sí pertenece a la precarga.
- Antes y después de esperar los recursos del simulador se comprueba que siga abierta la misma lista, con permiso y modalidad compatibles. Una lista cerrada/cambiada durante la espera no abre una edición obsoleta.
- Se conservaron los archivos de aplicación y marcadores anteriores. Índice, Novedades, aplicación, marcadores y caché son coherentes en v3.9.27.

## Comprobaciones

La batería vigente aprobó sus 358 archivos, siguiendo los filtros de `scripts/test-current.ps1` sin navegador. Las pruebas nuevas cubren ausencia de descargas al inicializar el cargador, grupos por rol, espera de todos los exports, concurrencia, error de red, error de inicialización, timeout, reintento y cancelación de sesión. Las pruebas de integración del resolutor comprueban que no concede acceso antes de completar la preparación ni después de salir.

Se probaron además los caminos del simulador actual e histórico y el cambio/cierre de lista mientras se descargan recursos. La prueba de comprobantes/conciliación de OC ahora resuelve la referencia de Compras a través del cargador activo; conserva sus verificaciones financieras y de impresión.

Sintaxis de JavaScript, consistencia de versión y revisión de whitespace verificadas. No se ejecutó el script PowerShell de publicación ni se creó un commit de release. Tampoco se realizó una medición en navegador o celular real.

## Límites y siguiente bloque

El monolito todavía se descarga al abrir la página: sigue siendo la mayor parte de la entrada. Esta modificación reduce la carga previa al acceso; no garantiza que el tiempo total desde pulsar Ingresar hasta ver el dashboard baje. Hay que medir ese tiempo con la nueva fase de descarga y con red lenta antes de publicar.

Los módulos opcionales se guardan mediante el caché de ejecución habitual de la PWA una vez solicitados. Si no se descargaron antes, no puede garantizarse su primer uso offline. Se debe comprobar actualización, recarga y sesiones frías/calientes sin red en navegador real.

El siguiente bloque recomendado es extraer del monolito funcionalidades independientes con una entrada mínima de autenticación, e instrumentar tiempos de verificación, descarga, procesamiento y primera vista. Gastos, Catálogo y los renders de vistas ocultas conservan los hallazgos de la auditoría y todavía requieren mejoras.
