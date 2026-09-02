# Antecedentes y reglas obligatorias de grillas

## Incidente de Gastos — versión 3.3.2

La pantalla de Gastos llegó a bloquear el hilo principal del navegador al combinar una grilla dinámica con dos observadores de cambios. Uno de ellos reinicializaba la tabla de forma sincrónica dentro de su propio `MutationObserver`; esa inicialización modificaba nuevamente el DOM y podía alimentar otra ejecución.

La carga histórica de adjuntos pesados aumentaba el costo, pero no fue la causa inmediata del bloqueo. El desencadenante fue la realimentación del controlador general de columnas.

## Regla permanente

- Un `MutationObserver` nunca debe inicializar, redimensionar ni reconstruir una grilla de forma sincrónica dentro de su callback.
- Las mutaciones de filas deben agruparse y procesarse en una única pasada diferida.
- La inicialización debe ser idempotente: ejecutarla nuevamente sin cambios no puede modificar el DOM.
- No se deben agregar controladores particulares de columnas por módulo. Todas las grillas usan la misma regla general.
- Cualquier cambio futuro en columnas debe conservar la prueba que verifica que el observador no se realimenta.

La protección vigente está en `js/modules/resizable-tables.js` y su regresión está cubierta por `test/gastos-rendimiento-v330.test.js`.
