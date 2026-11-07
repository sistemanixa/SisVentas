# Cuenta Corriente: apertura y lecturas vinculadas

## Diagnóstico del 7 de noviembre de 2026

Incidente específico, independiente de Eliminaciones y Tecnoprices. Base web
verificada en la sesión existente: v3.19.16, administrador. Sólo navegación y
lecturas; ningún pago o cambio comercial usado como prueba.

La reapertura observada, desde el menú visible hasta el estado capturado, tomó
unos 3,9 segundos. Es una medida del recorrido automatizado, no un tiempo de CPU.
El arranque por recarga todavía mostraba la pantalla de inicio a los 6,4 segundos;
la observación posterior acreditó el módulo listo, pero no permite fijar el
instante exacto de finalización. No presentar ese intervalo como latencia exacta.

Metadatos de cinco lecturas comerciales recientes: respuestas 200 de unos
2.192.312 bytes y respuestas 304 de 427 bytes; latencias de servidor entre
2,46 y 4,96 segundos. Incluyen las navegaciones observadas, no una atribución
exclusiva de todas las solicitudes a esta prueba. El visor no expone Resource
Timing; no se obtuvo un waterfall de navegador real. Los logs privados sólo
conservan fecha, revisión, ruta, estado, latencia y tamaño, nunca tokens o cuerpos.

El módulo legacy requiere todas las ventas y cobros para no perder deuda
histórica. Renderiza 225 cuentas, con 13 visibles bajo el filtro observado.
El ensayo sintético de 1.100 ventas y 225 clientes muestra unos 20–24 ms de
conciliación y 10–11 ms de tabla: no explica por sí solo la espera del servidor.
La medición inicial de retorno que vio filas antiguas en 15 ms tenía readiness
incompleto; se conserva como intento no válido, no como apertura lista.

## Corrección local

Las referencias de presupuesto se resuelven mediante una cola de seis lectores.
Se agrega una opción estricta, de 1 a 16, sólo para listados completos; el
servidor usa 16. El predeterminado y las verificaciones de guardado siguen en
seis. Con 96 orígenes únicos y 288 ventas ficticias, la prueba pasó de unos
251 ms a 105 ms: mismos 96 GET puntuales, mismos registros completos y autores.
No se descargan presupuestos sin relación, no se recorta historia ni se alteran
importes, fórmulas, asignaciones o permisos. Es optimización de latencia, no una
reducción demostrada del número de lecturas RTDB ni una solución global de caché.

Tres casos nuevos reprodujeron el límite anterior antes del cambio; después
pasaron, junto a los 47 controles de propiedad y sesión. La prueba de overlay
inicial detectó un ancla ambigua; se acotó a la única construcción del servicio.
Después se corrigió la extracción de una función en el arnés que incluía código
vecino. Los intentos rojos se conservan; no se relajaron permisos ni se cambió
el comportamiento de escritura para obtener un positivo.

## Publicación y límites

El parche de servidor se aplica sobre los dos archivos exactos de la imagen
publicada. No copia las otras diferencias de la rama, no actualiza el servidor
completo ni activa capacidades pendientes. Se conserva la revisión anterior,
recursos, configuración e identidad. Estimación informada: menos de USD 1 por
compilar y actualizar, sin servicios ni tareas nuevas.

La candidata web v3.19.17 sólo incorpora versión y Novedades; no cambia el flujo
ni las cifras de Cuenta Corriente. La activación, verificación web y evidencia
posterior se registrarán al completarse: los resultados sintéticos no prueban
por sí solos una mejora en producción. No se permiten operaciones financieras
reales de prueba, cambios de reglas, índices, main ni inclusión de los otros
bloques locales.
