# Carga detenida después de una interrupción

18/10/2026. Reparación publicada en v3.12.11 desde el commit
`410b07e6f9d8c8a284980744e85ed21ad9fc242a`. Publicación y comprobación
web registradas en [CONTEXTO_ACTUAL.md](CONTEXTO_ACTUAL.md).

## Causa reproducida

La cabecera de Hosting permite la conexión WebSocket de RTDB mediante
`connect-src`, pero no su transporte alternativo, que carga scripts JSONP
en `https://<host>.firebaseio.com/.lp`. El SDK10.12.0 guarda
`firebase:previous_websocket_failure` después de un intento WebSocket;
si queda marcado, el siguiente arranque empieza con long polling. Borrar
datos de navegación elimina esa marca y puede ocultar temporalmente la falla.

No se debe borrar esa marca en los dispositivos como reparación: se necesita
que ambos transportes funcionen. La propuesta agrega únicamente
`https://*.firebaseio.com/.lp` a `script-src`: los shards de Firebase pueden
cambiar de host. No permite otros paths de esos hosts, HTTP, JavaScript de
cualquier origen, ni modifica reglas, usuarios, tokens o permisos de datos.

Se contrastó la cabecera pública vigente:200, sin ese endpoint autorizado.
DNS de ventas resuelve a199.36.158.100, el Hosting esperado; no fue necesario
cambiar DNS. Esto identifica una causa concreta, no demuestra que toda
incidencia de todos los dispositivos tenga el mismo origen.

## Evidencia

- En la web real se reprodujo Dashboard en Reconectando, esperando clientes,
  productos, ventas y cobros, y luego el aviso de carga incompleta. Local8766
  cargaba correctamente. No se borraron sesiones ni borradores.
- Prueba anónima aislada con el mismo SDK y marca previa de fallo: política
  anterior, transporte inicial long-poll y sin conexión después de20segundos;
  política corregida, mismo almacenamiento y transporte inicial long-poll,
  conexión establecida y posterior mejora a WebSocket. Solo se escucha el
  estado de conexión y un path inexistente `__sisventas_transport_probe__`
  sin Auth, sin leer colecciones ni guardar datos.
- Capturas privadas en `C:/SisVentas/tmp/carga-transporte-*.private.png`.
  No van a Git ni a Hosting.

## Segunda falla corregida en el Service Worker

Fallos de Cache Storage al abrir, leer o guardar el SDK podían rechazar una
respuesta online correcta; cuota agotada también podía impedir instalar la
reparación. Las pruebas nuevas fallaron antes de corregir. Ahora la caché es
opcional cuando el almacenamiento está bloqueado/lleno; la red válida se
conserva. Una descarga incompleta por falta de red sigue rechazando instalar
una shell incompleta. Los errores de mantenimiento no bloquean activar el
worker. PDFs temporales y cachés ajenas se conservan.

El respaldo de JS/CSS respeta ahora la consulta de versión exacta; no entrega
otro módulo con un `?v=` distinto. Navegaciones conservan su respaldo HTML.
Peticiones autenticadas y finanzas privadas siguen fuera de la caché. No hay
borrado de localStorage, IndexedDB, Firebase Auth ni borradores.

## Repetir

```powershell
node --test test/sw-fallback.test.cjs test/update-recovery.test.cjs test/realtime-transport-policy.test.cjs
node scripts/dev-realtime-transport.cjs
```

El segundo comando sirve únicamente la fixture en loopback8794 y usa los
SDK públicos de gstatic. Comparar `/?baseline=1` y `/` en ese origen aislado;
no ejecutarlo dentro del origen de trabajo del usuario. Si la descarga del
SDK debe aislarse, configurar `SV_TRANSPORT_SDK_DIR` con copias públicas de
`firebase-app-diagnostic.js` y `firebase-sdk-diagnostic.js` correspondientes
a10.12.0. No necesitan credenciales; no copiar perfiles. `SV_TRANSPORT_PORT`
permite elegir otro puerto. En esta PC se usó8795.

## Publicación y seguimiento

1. Publicar desde el commit limpio revisado con el script de Hosting: la
   corrección principal está en la cabecera, por lo que copiar JS o hacer
   push no resuelve por sí solo el bloqueo de la web.
2. Verificar la cabecera real y los activos; luego activar el aviso de versión.
3. Recargar normalmente un dispositivo afectado, sin borrar sus datos, y
   comprobar Dashboard, Ventas, Presupuestos y Cuenta corriente. Verificar
   también una interrupción/retorno de red. No guardar operaciones de prueba.

Publicación, cabecera y recarga web con sesión conservada ya comprobadas.
Queda el seguimiento en los otros dispositivos afectados: no afirmar que
todos fueron probados ni pedir borrar su navegación como reparación.
