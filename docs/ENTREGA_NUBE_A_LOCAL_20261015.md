# Entrega al chat «Revisar gastos duplicados históricos»

Fecha: 15/10/2026. Origen: chat cloud «Recuperar rama de traslado». Destino: chat local «Revisar gastos duplicados históricos», checkout habitual `C:\SisVentas`. Leer también `AGENTS.md`, `docs/CONTEXTO_ACTUAL.md` y `docs/TRASLADO_NUBE_SEGURIDAD.md`.

## Estado Git y publicación

- Rama de continuidad: `origin/codex/traslado-nube-seguridad-20261015`.
- Se recuperó y verificó exactamente el traslado `f5ec87774422cd8b232a5c41badeebd057630896`, padre `b1d94bc91ba288aa410f3aecd016cdb8b3b5797c`. Manifest: 21/21 artefactos coincidentes.
- Implementación nueva: `b2b06810b0b8b64d4e235a6fa892b3ed3a3176aa`, v3.11.2. Continuidad previa a este documento: `4add23f3282bb26641b944504692494f060ce9bb`. Este documento se agrega después: recuperar el HEAD remoto actual, sin retroceder la rama a esos commits.
- No se mezcló en main ni se publicó código en el sitio oficial. No se actualizó el nodo de versión de Firebase ni se desplegaron reglas, Cloud Run o funciones. La publicación oficial de referencia sigue siendo v3.11.1.
- Al comenzar la recuperación cloud no había cambios versionados; un `node_modules` sin seguimiento se conservó fuera del checkout. Esto no describe ni autoriza descartar el trabajo local de la PC.

## Qué se cambió

El usuario reportó que la página quedaba en «Cargando datos…» dentro de Gastos, también observado con otros usuarios y móviles en Dashboard. No era el bloqueo inicial «Verificando sesión…».

1. Dashboard exigía cuatro colecciones incluso cuando el rol no debía suscribir ventas/cobros. El indicador ahora usa las dependencias autorizadas por la política compartida, sin ampliar accesos.
2. El directorio reducido de empleados se recibía desde el servicio, pero no completaba el estado de carga de Gastos. Se agregó seguimiento de esa fuente y de proveedores reducidos, con error/cancelación y descarte de respuestas de otra sesión.
3. Las consultas propias combinadas de una colección esperan todas sus primeras respuestas. El éxito de una consulta no borra el error de otra ni presenta una respuesta parcial como colección completa.
4. Una espera sin respuesta pasa a error recuperable a los 15 segundos, incluido el retorno desde una pestaña suspendida. Se informa qué fuente falta y se evita presentar datos todavía no recibidos como una colección vacía.

Archivos: aplicación inmutable nueva `js/app.v3.11.2.js`, `js/core/data-readiness.js`, `index.html`, `js/core/version.js`, `js/core/version.v3.11.2.js`, `sw.js`, Novedades en la aplicación y pruebas nuevas. v3.11.1 se conservó intacta.

## Qué se probó y qué NO

- Suite general previa del traslado: 1.494 aprobadas. Suite tras la corrección: **1.504 aprobadas, cero fallos**.
- **Diez comprobaciones Chromium con fixtures**, comparando código anterior/corregido en escritorio 1366×900 y móvil 390×844: se reproduce el bloqueo anterior de Dashboard restringido y directorio reducido; la corrección permite mostrar la vista. Se comprobaron timeout, botón de reintento y recuperación con respuesta tardía.
- Nuevas regresiones de código en `test/loading-by-role.test.cjs`. Prueba DOM/navegador reproducible en `test/browser/loading-by-role.cjs`; admite `SV_PLAYWRIGHT_MODULE` si Playwright no está en la resolución estándar. No asumir las rutas Linux de herramientas/caché en Windows.
- Sintaxis, coherencia de versión y `git diff --check` correctos. No se reejecutaron reglas tras cambiar solo frontend.
- **No se controló la ventana autenticada del usuario**, no se inspeccionaron sus cookies/consola y no se verificaron todos los formularios con cuentas reales. La URL ambiental del navegador no acredita acceso a su DOM. Las pruebas móviles fueron fixtures de Chromium, no teléfonos físicos.
- **No se auditó ni depuró el caso de gastos duplicados históricos** en este bloque. No se borraron gastos, movimientos, comisiones ni registros relacionados. No inferir que el fallo de carga explica o corrige duplicados de datos.
- No se aplicaron migraciones ni se guardaron operaciones ficticias en producción como prueba.

## Google Cloud/Firebase y borradores

Se instaló gcloud 589.0.0 y el titular autorizó un inicio de sesión oficial en el entorno cloud. Pasaron `node scripts/check-cloud-access.cjs` y `--firebase`: proyecto `nixa-sisventas` ACTIVE y lectura de reglas RTDB confirmada. Los secretos de gcloud están fuera del checkout y no viajan por Git. No copiar ese perfil a la PC ni suponer que otro entorno hereda la sesión. En Node 24 del entorno cloud se necesitó `NODE_USE_ENV_PROXY=1`; esto no implica que Windows necesite ese ajuste.

El emulador de las candidatas recuperadas reprodujo **20/24**: dos fallos de domain-reads, uno de gastos y uno de divergencia de regex en known-role-read. Siguen documentados en CONTEXTO_ACTUAL; no se cambiaron candidatas ni expectativas para ocultarlos. El informe privado de auditoría y los respaldos no se trasladaron a Git. El acceso de lectura logrado no cierra la auditoría.

## Vista Sites y su limitación

Tras la autorización explícita del usuario se creó una copia privada en `https://sisventas-revision-20261015.loyalpike3.chatgpt.site`, accesible solo para su cuenta. No reemplaza el hosting oficial. **Su Firebase sigue siendo real**, no una base ficticia.

La versión realmente desplegada en Sites sigue siendo **v3.11.1**. Las fuentes v3.11.2 se sincronizaron en el repositorio separado de Sites (`2d23bc08991089e789a86509e5782caaa6ef254d`), pero no se guardaron/desplegaron después de que el usuario planteara volver a local. No usar la ventana todavía abierta de Sites como evidencia visual de la corrección v3.11.2.

Se verificó con OPTIONS que el servicio del cotizador devuelve `Access-Control-Allow-Origin` para el dominio oficial, pero no para el dominio privado de Sites en `/laboral/directorio`. Ciertos roles no pueden cargar ese directorio en Sites. Es una limitación adicional del origen de preview; no demuestra que el dominio oficial tenga ese mismo CORS. No se amplió el CORS ni se desplegó el servicio.

Las aperturas automáticas de ventanas devolvieron `queued` o desconexión: no se deben describir como aperturas/recargas verificadas. El servidor loopback cloud tampoco acreditó estar sirviendo a la ventana local de la PC.

## Continuación local solicitada

1. Conservar cambios locales desconocidos; revisar rama, SHA y status antes del fetch/cambio de rama. Recuperar el HEAD remoto de la rama de continuidad sin reset/clean ni sobrescribir trabajo de la PC.
2. Leer esta entrega y CONTEXTO_ACTUAL. Confirmar qué directorio sirve el servidor de la PC: el espejo `.local/release-v3619` no se actualiza por cambiar de rama. Sincronizar solo activos del alcance o servir el checkout correcto por loopback.
3. Verificar por HTTP y en la ventana real que índice, aplicación y marcadores cargan v3.11.2. Conservar el módulo/solapa del usuario al recargar.
4. Repetir Gastos y Dashboard con roles distintos, permisos personalizados, sesión recién iniciada/restaurada y retorno de suspensión/reconexión. Diferenciar errores de permisos/red de un vacío confirmado. No probar pagos, borrados ni duplicaciones reales.
5. Mantener aparte los duplicados históricos y la auditoría de reglas. Informar cualquier diferencia entre fixtures y sesión real. No mezclar en main ni publicar hasta completar la revisión y recibir la autorización correspondiente.

La herramienta de envío directo entre chats no estaba habilitada en el chat cloud; este documento y su push son una entrega por Git, no constancia de que el chat destinatario ya haya recibido un mensaje.
