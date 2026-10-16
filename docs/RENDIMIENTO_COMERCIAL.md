# Transporte comercial · candidata v3.11.17

GET de las listas `/comerciales/ventas` y `/comerciales/presupuestos` autentica,
autoriza y filtra antes de calcular un ETag débil SHA-256 de la respuesta.
Un `If-None-Match` coincidente recibe 304 sin cuerpo. Las respuestas nuevas de
al menos 1 KiB usan gzip si se admite y reduce tamaño; descomprimir conserva
exactamente los bytes e importes originales. No cambia fórmulas ni comisiones.

Se mantiene `private, no-store` y `Vary: Authorization, Origin, Accept-Encoding`.
CORS permite `If-None-Match` y expone `ETag`, con la política de orígenes existente.
El cliente conserva el validador solo en memoria por suscripción; lo descarta al
cerrar sesión, cambiar contexto, cancelar/reemplazar la suscripción o recibir
401/403. No almacena datos comerciales en disco. Un 304 requiere representación
local previa y no relee JSON ni repinta; sí recupera readiness tras error transitorio.
Las respuestas tardías no reactivan una sesión cerrada. Servidor antiguo sin ETag
y cliente antiguo sin validadores mantienen su funcionamiento anterior.

## Validación y límites

`node --test test/commercial-transport.integration.cjs test/commercial-ownership-session.test.cjs`:
18 casos aprobados. HTTP real en loopback con servicio de autorización y datos
ficticios; sin Firebase real. Cubre 200/304/cambio, gzip sin alterar valores,
cuentas separadas, revocación y cancelación/recuperación de carga.
Suite vigente: 1.707 casos; servidor: 94. Sintaxis, diff y versión local correctos.

Fixture visual desde la aplicación activa: `node scripts/dev-commercial-ownership.cjs`.
Se puede asignar `SV_COMMERCIAL_FIXTURE_PORT` para usar otro puerto (8764 por defecto).
Verificados administrador, vendedor y administrativo en escritorio. La solicitud
de viewport móvil no cambió el tamaño efectivo de esa pestaña: no contabilizar
prueba móvil. Tampoco se probó teléfono físico ni proxy desplegado.

Reduce bytes y trabajo del navegador. **No reduce aún lecturas RTDB ni evita
serializar y calcular la huella en el servidor**. La carga inicial aún requiere
el historial autorizado. No extrapolar ratios de una descripción ficticia repetida.

## Antes de activar

Revisar el alcance autorizado y el paquete. Dockerfile incluye commercial-response.js.
Conservar secretos, límites, instancia/CPU y el corte COMMISSION_GENERATION_FROM:
no es una nueva activación del generador ni autoriza backfill. No tocar reglas,
comisiones existentes ni datos reales para probarlo.
Verificar CORS, 200/304 y compresión con proxy, y arranque autenticado de Dashboard,
Ventas, Presupuestos y Cuenta corriente. Un 304 no demuestra procesamiento de UI.
Seguir el procedimiento de Hosting y aviso; el push de una candidata no publica.
Reversión compatible: cliente v3.11.16 y revisión anterior del servidor, sin restaurar
la base ni recalcular comisiones.
