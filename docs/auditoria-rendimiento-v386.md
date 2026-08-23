# Auditoría de rendimiento v2.0.386

Fecha: 23/08/2026

## Medidas estructurales

- Aplicación principal: 43.427 líneas y 2.479.249 bytes sin minificar.
- JavaScript activo referenciado por `index.html`: 3.200.589 bytes en 68 archivos.
- Funciones declaradas en la aplicación principal: aproximadamente 1.730.
- Pruebas disponibles: 738; pasan 648 y fallan 90. La mayoría de los fallos corresponden a pruebas históricas que todavía exigen que su versión antigua sea la aplicación activa.

## Problemas corregidos

1. El inicio conectaba más de veinte colecciones completas de Firebase en el mismo instante.
2. `cargarCargos` y `cargarConfigComisiones` se programaban dos veces durante cada inicio de sesión.
3. Cargos y presencia no impedían listeners repetidos.
4. Órdenes de compra abría sus colecciones inmediatamente aunque el módulo no se utilizara.
5. Aguinaldos se conectaba globalmente aunque nunca se abriera Gastos.
6. El histórico del dólar podía inicializarse por tres eventos diferentes.
7. Notificaciones recalculaba cada 30 segundos incluso con la pestaña oculta y podía repetirse por foco más visibilidad.
8. La versión web se consultaba cada minuto además del listener Firebase; el Service Worker consultaba cada dos minutos.

## Solución aplicada

- Identidad, clientes, productos, ventas y las dependencias de la ruta visible se cargan primero.
- El resto se distribuye en lotes con demoras mínimas reales de 0,7, 1,8 y 3,8 segundos y espera adicional de hilo ocioso.
- Las rutas directas de Gastos, Facturas, Actualizador, Garantías, Órdenes y otros módulos cargan sus dependencias sin esperar el lote general.
- Se agregaron guards para listeners de cargos y presencia y una única promesa compartida para comisiones.
- Órdenes de compra se difiere, pero se activa inmediatamente al abrir su pantalla.
- Aguinaldos se conecta junto con Gastos.
- Histórico del dólar se inicia una sola vez después de resolver la sesión.
- Notificaciones y chequeos de versión se suspenden con la pestaña oculta y se agrupan.

## Código sin referencias detectado

El análisis estático encontró 41 candidatos. Los más grandes son:

- `renderModuloActualizadorPreciosAhora` (~16,7 KB): renderizador anterior sin referencias directas.
- `_registrarCobroAtomico` (~6,9 KB): flujo anterior sin referencias directas.
- `repararVentasArsDuplicadasPorDolar` (~4,8 KB): herramienta manual sin acceso visible.
- `pptoAlertarVencimientosProximos`, `flujoPostPago`, `renderTareasPendientes`, `cotizarProveedoresAsistente` y `verEmpleado` (~2–3 KB cada uno).

No se eliminaron automáticamente porque las funciones globales pueden ser herramientas administrativas usadas manualmente. Deben trasladarse primero a un módulo de mantenimiento cargado bajo demanda y probarse contra datos reales.

## Próxima mejora estructural recomendada

Separar `app.js` por dominio y cargar los módulos al entrar en cada pantalla. El escalonamiento reduce la competencia de red y renderizado, pero el navegador todavía descarga y analiza el monolito completo. También se debe reemplazar la batería incremental que compara la aplicación activa con versiones históricas por pruebas que inspeccionen cada archivo inmutable correspondiente.
