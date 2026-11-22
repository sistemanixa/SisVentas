# Frente B: claims y paquete Cotizador · 22/11/2026

Trabajo exclusivamente local autorizado por coordinación. Worktree `C:/SisVentas/.local/audit-20261122-claims-package`, rama `codex/audit-20261122-claims-package`, base `060c77f8`. AGENTS y CONTEXTO_ACTUAL leídos de esa base; checkout fuente compartido limpio al inspeccionarlo. Producción v3.21.2 / código público `5e4bb83d` es evidencia comunicada por coordinación: este frente no consultó producción. Raíz atrasada no utilizada como fuente funcional.

## Reproducción y corrección

Los tres archivos originales de pruebas, sin modificar, reprodujeron 15 casos: 12 PASS y 3 FAIL.

1. `store overwrites incoming reserved protocol claims instead of elevating the user`: faltaba el marcador canónico del escritor cuando ninguna capacidad de mantenimiento estaba activada. El store eliminaba el marcador entrante, pero sólo emitía `svLaborWriterSchema:2` si había una capacidad específica. Es una propiedad del protocolo implementado por el servidor, separada de esas capacidades. La corrección siempre emite 2 desde el store; los indicadores financiero, Accounts e History siguen normalizados a 0 salvo capacidad interna explícita. No se habilitan por claims de Auth. Se conservan UID, marcas de cambio obligatorio de contraseña y versión de acceso; lecturas ordinarias no reciben identidad de servicio.
2. `la imagen del Cotizador incluye las dependencias locales de cada módulo copiado`: faltaban dependencias literales del índice y de dos módulos ya incluidos. Los cinco archivos existentes que faltaban eran `tecnoprices-login.js`, `budget-presentation-trial.js`, su modelo `budget-presentation-trial-model.js`, `ot-custody-held-authority.js` y `client-account-operational-state.js`.
3. `Docker COPY payload alone boots actual index false/true without ../js dependencies`: el payload no podía cargar `./budget-presentation-trial`. Una línea COPY explícita agrega los cinco archivos, sin copiar todo el checkout, dependencias locales instaladas, perfiles o documentación privada.

Commits de corrección separados:

- `cd9ad6eeb5a20ceb4caf2d378d9b83e4c812c603`: una línea de claims en `cotizador/labor-rtdb-store.js` y cuatro regresiones nuevas en `test/store-protocol-claims.test.cjs`.
- `f665c2c1b535a4e2514337ba9e71cdf54672642d`: una línea en `cotizador/Dockerfile`.

El coordinador autorizó expresamente editar sólo la función de claims del store en este worktree y recogerá ese commit por separado del frente A. No se tocaron recibos, recuperación, idempotencia ni el otro checkout.

## Verificación local

Tanda final de siete archivos, concurrencia 1: **35 PASS / 0 FAIL / 0 SKIP**. Node v22.23.4 existente y preload `transversal-deny-network-independent.cjs` que bloquea HTTP/HTTPS/net/TLS/fetch, incluso loopback. Transportes, Auth y datos son dobles. No se usaron navegador ni llamadas comerciales.

Archivos: `store-protocol-claims`, `commercial-writer-protocol-rules`, `client-account-writer-protocol`, `labor-rtdb-store`, `sale-financial-writer-protocol`, `cotizador-container-dependencies`, `dashboard-backend-mount`, todos `.test.cjs`.

Las regresiones nuevas comprueban acquire/commit/abort, neutralización de claims entrantes, capacidades internas independientes, identidad y marcas de revocación conservadas, lecturas sin elevación, y rechazo antes de PATCH con identidad inactiva, permisos cambiados o contraseña pendiente. La prueba original de recibo histórico con autorización fresca se ejecutó sin editarla: no modifica el alcance del frente A. Empaquetado verifica cierre de dependencias locales y arranque del índice real desde los COPY, con flags false/true y rutas protegidas en memoria.

`node --check` del store y nuevo test, y `git diff --check`, sin errores. Un intento de staging detectó CRLF como cambio total; se normalizaron sólo los tres archivos propios a LF antes de los commits. El diff final del store es una línea, sin reescritura masiva.

Logs privados, no incluidos en Git:

- `C:/SisVentas/tmp/audit-b-20261122-red.private.log`: SHA256 `aee6f4e7ee47e4c6d51b06b9c368149ebdf5c6b92d61a4b18b7fdf4f5be7ef8a`.
- `C:/SisVentas/tmp/audit-b-20261122-final.private.log`: SHA256 `5567c5f07868efaa660a21e09543b28637bb01a9de66b2169c173454e024e264`.

Tandas intermedias de 20 y 25 PASS se solapan con la final: no sumarlas. No se ejecutó la suite general, reservada al coordinador después de integrar.

## Compatibilidad, procedencia y límites

Se contrastó `origin/main` `4639a87b`, ya obtenido por fetch del coordinador. Esa limpieza histórica elimina `labor-rtdb-store.js` y los tres tests originales, además de reducir el Dockerfile. No contiene una solución aplicable al backend de la base publicada; importar sus eliminaciones ocultaría las reproducciones. No se integró ni se retiró ninguna prueba. Los cinco módulos agregados al COPY son código ya versionado de la base, no nuevas funciones implementadas aquí ni restos locales sin seguimiento. Los módulos llamados `*-proposal` ya presentes no prueban activación de sus flags en producción.

Separación de estados:

| Clase | Resultado |
|---|---|
| Código local | Marcador del protocolo y cinco dependencias del payload corregidos y probados. |
| Artefacto | Se simuló el payload real de COPY y se cargó el índice; no se construyó una imagen Docker. No se encontró Docker/Podman en PATH. |
| Configuración externa | Imagen/digest backend desplegado, reglas activas, configuración `writerSchema`, flags, secretos y compatibilidad de infraestructura no consultados ni modificados. |
| Sólo test | Auth, HTTP, módulos de terceros de arranque, almacenamiento y datos comerciales ficticios; no certifican SDK remoto ni operación real. |

Riesgos concretos pendientes: validar npm/base de Playwright/arranque de imagen en un entorno autorizado; contrastar el artefacto backend real antes de cualquier publicación; revisar el corte de protocolo con sus reglas/flags reales. El marcador 2 no reemplaza autorización, fence, revisión de permisos ni las capacidades que permanecen en 0. Los nuevos archivos de COPY ya incluyen sus validaciones de acceso existentes, que este cambio no relaja.

Entrega local sin push/publicación por alcance explícito. Sin builds remotos o locales, despliegue, reglas, permisos, datos reales, instalaciones, cambio de versión/index/SW o CONTEXTO_ACTUAL compartido. Integración y suite general quedan a cargo del coordinador.
