# Auditoría general de optimización — v3.10.2

Fecha: 10/10/2026. Versión revisada: 775cd14. Auditoría de código, recursos de entrada y pruebas automatizadas; verificación visual local del ranking y navegación. No es una medición de latencia en producción ni una prueba con todos los roles simultáneamente.

## Conclusión

Las optimizaciones anteriores siguen presentes y las 1273 pruebas pasan. Se puede publicar lo funcional. No conviene declarar terminada la optimización: el mayor margen está en la carga inicial y los históricos completos, no en seguir ajustando pequeños textos o botones. No se encontraron motivos de rendimiento para bloquear esta publicación. Esto no equivale a certificar ausencia de errores en todos los circuitos.

## Medición reproducible de archivos

Se sumaron los scripts locales referenciados por index.html, excluyendo recursos remotos e importaciones transitivas. Gzip es una estimación local por archivo, no tráfico medido.

| Indicador | v3.9.25, auditoría previa | v3.10.2 |
|---|---:|---:|
| Scripts locales de entrada | 110 | 106 |
| JavaScript sin comprimir | 4.597.075 bytes | 4.269.195 bytes |
| Suma gzip estimada | 1.177.552 bytes | 1.073.336 bytes |
| Archivo principal sin comprimir | 3.131.638 bytes | 3.205.734 bytes |
| Archivo principal gzip | 754.034 bytes | 758.286 bytes |
| HTML inicial | 461.523 bytes | 468.329 bytes |

La entrada JavaScript bajó aproximadamente 7,1% en tamaño bruto y 8,9% en gzip estimado, pero el archivo principal creció y representa alrededor del 75% del JS inicial. Diferencias de tamaño no implican iguales porcentajes de mejora de tiempo.

## Hallazgos priorizados

1. **Alta — Separar el archivo principal y cargar por módulo/rol.** index.html sigue referenciando 106 scripts locales y un archivo principal de 3,21 MB. session-assets.js ya descarga Excel y métricas a demanda, pero forRole todavía inicia portales y Compras por sesión. Próximo paso: medir arranque frío/caliente y extraer un dominio por vez conservando dependencias. No añadir async indiscriminadamente.
2. **Alta — Históricos completos.** fbCargarPresupuestos mantiene una suscripción al nodo completo, convierte y ordena toda la colección. chatCargarCanal escucha el canal completo y ordena todos los mensajes al recibir cambios. exterior-user-lists.js escucha todos los productos y crea listeners por usuario visible. Revisar consultas por rango, paginación y resúmenes separados de los contadores. No limitar datos sin conservar deudas, búsquedas, no leídos y exportaciones completas.
3. **Media — Precarga PWA.** sw.js usa cache.addAll(SHELL) con una lista amplia. Cada versión crea otra caché y precarga módulos aunque no se abran. Medir instalación y actualización con red lenta; separar recursos imprescindibles de los cargados bajo demanda, manteniendo el comportamiento offline. No se modificó la estrategia en esta publicación.
4. **Media — Detalles plegados de proveedores.** renderResumenPreciosProveedores evita trabajo cuando la página está oculta y usa índices por proveedor. Sin embargo, arma las tarjetas de todos los productos dentro de details, aunque estén plegados. Con catálogos grandes conviene dibujar esas tarjetas al desplegar y paginarlas. El top 5 nuevo reutiliza grupos ya calculados y agrega como máximo cinco tarjetas; no incorpora consultas ni recorridos adicionales de productos.
5. **Medición pendiente — Tareas largas y red real.** Falta una serie comparable con caché fría/caliente, admin y roles restringidos, tiempos hasta interacción, bytes transferidos y duración de tareas. Sin esos datos no corresponde afirmar que el sistema ya está optimizado al máximo.

## Protecciones comprobadas

- Proveedores oculto: cero recorridos de productos. Visible con 1000 productos sintéticos: un recorrido por producto; conserva conteos, empates, exclusiones y detalle anterior.
- Ranking: orden por cantidad de productos al menor costo registrado, máximo cinco proveedores, sin referencias manuales como participantes. No pretende representar todo el mercado ni certificar vigencia.
- Navegación: retorno interno antes del historial; sin recursión al delegar desde botones locales; módulos sin permiso se omiten.
- Actualizador: pruebas de URL vigente, respuestas antiguas y transacciones para no sobrescribir cambios concurrentes.
- Mano de obra: confirmación masiva solo de vigencia, sin modificar importes; prueba de fallo parcial y reintento.
- Suite completa de esta versión: 1273 aprobadas, cero fallos. No se repitió una sesión simultánea real entre dos usuarios ni emulador de reglas.

## Recomendación

Cerrar esta publicación funcional. La siguiente etapa debe empezar por una medición controlada del arranque y de históricos grandes; después abordar carga por módulo y detalles de proveedores bajo demanda. Evitar una reestructuración grande sin esas mediciones. No se alteraron datos comerciales durante esta auditoría.

## Adenda v3.10.3 — Separación por origen

Tras la auditoría se separaron las métricas en Locales y Exterior. Cada top 5 se calcula contra alternativas de su mismo origen. Se conserva un único recorrido de productos y se reutiliza la clasificación de origen existente. La prueba de 1000 productos verifica que un proveedor local y uno exterior, sin otra alternativa de su origen, quedan como única opción y no como ganadores. Suite final: 1274 aprobadas. Las cifras de tamaño anteriores corresponden a v3.10.2; la conclusión de arquitectura no cambia.
