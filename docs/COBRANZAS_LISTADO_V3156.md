# Historial de Cobranzas más ágil

El listado reutiliza un índice temporal de pagos por venta durante cada render.
Filtrar y cambiar de página siguen calculando saldos sobre el historial completo,
incluidos los pagos anteriores que no estén visibles. El índice se descarta al
repintar; no agrega consultas, cachés persistentes, tareas por reloj ni escrituras.

Se respeta la prioridad de claves técnicas y del resolvedor canónico, los alias
históricos, anulaciones y saldos guardados. Cada sufijo suma desde cero en el
orden original, sin invertir operaciones, redondear centavos o reagrupar montos.
Los registros malformados conservan el recorrido anterior como fallback.

## Verificación

- Doce regresiones nuevas y puerta vigente:6.052aprobadas,27opt-in,0fallos.
- Los tres cuerpos y el helper coinciden exactamente con el candidato medido
  anteriormente;18utilidades canónicas permanecen idénticas.
- QA de controles/DOM:52comparaciones exactas en320/390/768/1280, datos ficticios,
  sin red ni escrituras. Capturas de móvil/escritorio revisadas.
- Sintaxis, diff y coherencia local de versión correctos. El resultado externo
  de publicación se registra en CONTEXTO_ACTUAL, no se deduce de estas pruebas.

La medición histórica en Chromium con5.000pagos mostró40/40pares favorables en
dos ejecuciones, con reducciones medianas pareadas82,05% y83,33% en alias
compartidos. Una sola fila tenía sobrecosto~0,007–0,017ms; saldos persistidos no
mostraron mejora concluyente. No se repitió esa medición ni se presenta como
latencia total, ahorro de transferencia o factura Google.

No cambia pagos, comisiones, servidor, reglas, permisos, los PDF de pedidos ni
los arreglos publicados de Dashboard/Agenda. La prueba aislada no acredita una
sesión autenticada productiva ni todos los formularios financieros.
