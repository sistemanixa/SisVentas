# Costo adicional del mantenimiento de vínculos

Medición offline del paquete nativo vigente (imagen bucket7f69) frente al paquete derivado por `sale-delete-targeted-runtime-overlay`, fuente d508. No utiliza datos, red, SDK Auth, credenciales ni escrituras de producción. Los comandos, Auth wrapper, Gateway, Guard, Store y proyectores son genuinos; las fronteras de Firebase Auth/Admin/REST se sustituyen por transporte ficticio con RTT de 80 ms. No se comparte ni cachea autorización entre solicitudes. El índice de la candidata se prepara antes del tramo medido, con sus modelos reales.

Se ejecutó una escritura por caso y variante; no son percentiles ni latencia de producción. Reloj y temporizadores de Windows, CPU inicial y proyección local forman parte de los tiempos.

| Operación | Antes ms | Candidata ms | Store GET antes→después | GET nuevos del índice | Grupos de inicio antes→después |
|---|---:|---:|---:|---:|---:|
| Editar un escalar de venta | 2395 | 3263 | 27→36 | 9 | 24→33 |
| Crear entrada de Agenda | 749 | 1119 | 3→7 | 4 | 8→12 |
| Crear gasto operativo | 1884 | 2357 | 10→15 | 5 | 20→25 |
| Registrar cobro tipado | 3814 | 4814 | 44→54 | 10 | 39→49 |

Los grupos cuentan arranques de IO separados por al menos la mitad del RTT configurado. Las trazas conservan el inicio/final de cada IO para inspección; no se presentan como una prueba formal de camino crítico ni como rondas HTTP reales.

Todas las operaciones conservan exactamente una verificación Auth fresca. Lecturas Admin por caso: 2/2, 2/2, 8/8 y 4/4 antes/después. Confirman un solo patch de negocio por operación y cero IO nuevo tras quedar en reposo. El nuevo claim es 1 únicamente en la candidata mantenida; antes es 0. No se cambian importes, reglas, payloads de negocio ni controles para medir.

La candidata actual añade latencia al mantenimiento ordinario: el preparado inicial evita escaneos durante borrar, pero el mantenimiento incremental no es gratuito. No afirmar que este cambio acelera todas las operaciones. La nueva cadena de GET técnicos es mayormente secuencial: configuración, cobertura, metadatos inversos, cobertura financiera y buckets de referencias. Se pueden estudiar prelecturas acotadas de esos puntos independientes y agrupar los buckets de alias, sin adelantar Auth ni omitir controles. Este bloque no implementa tal optimización ni modifica esas fuentes.

`scripts/measure-sale-delete-writer-cost.cjs --run` requiere las mismas variables del derivador: `SV_SALE_DELETE_CURRENT_NATIVE_ROOT`, `SV_SALE_DELETE_CURRENT_DELTA_PATH`, opcional `SV_SALE_DELETE_TARGETED_OVERLAY_SOURCE_ROOT` y `SV_WRITER_MEASURE_RTT_MS` (0..200, por defecto80). No descarga paquetes ni descubre destinos. El único destino aceptado por el transporte ficticio es loopback y jamás se hace una petición real a ese destino. El reporte es de datos ficticios, con contadores, bytes JSON/modelo parcial y traza de rutas sin tokens ni contenido de los originales. Bytes de petición excluyen TLS/cabeceras/claims de autorización.

Prueba focal del reproductor: 1 PASS, 0 FAIL, confirma los cuatro comandos en ambas variantes, misma cantidad de Auth/Admin lecturas, un commit y cero sondeos en reposo. Sintaxis y diff correctos. No se ejecutó otra puerta general, navegador ni emulador. Reporte local completo de esta ejecución: `tmp/sale-delete-target-writer-cost-80.private.json`, fuera de Git.
