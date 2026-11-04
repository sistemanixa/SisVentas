# Procedencia y contraste de Cotizador · 04/11/2026

Comparación de sólo lectura entre la fuente del Cotizador principal y `cotizador/` de `fc4225700964349b4d73b7f845bb474a9be930e7`. Checkout de trabajo al cierre: `9b5c95b3`, sin diferencias de `cotizador/` contra fc422. Se conservaron los cambios ajenos de aplicación y prueba. No se modificó CONTEXTO_ACTUAL.

## Cadena comprobada

- Servicio `cotizador`, proyecto `nixa-sisventas`, región `southamerica-east1`: consulta fresca de metadatos confirma 100% del tráfico general en `cotizador-return910199-bbf61e86`. Hay etiquetas que siguen apuntando a `cotizador-expenses3186a-bfe0052f`; esta comparación no cubre esa otra fuente.
- Digest de la revisión: `sha256:09a9d7f6bfffb4a13ec2aa00235dbc52c442bc4f86737d49f3d82a161888353f`.
- Build `6763d3e6-7507-4ac4-9406-758b8b05e744`, estado SUCCESS. Consulta fresca de `results.images` devuelve exactamente ese digest. Imagen nombrada `cotizador:return910199-bbf61e86` en `cloud-run-source-deploy`.
- Fuente resuelta del build: `gs://nixa-sisventas_cloudbuild/source/1793766044.693147-ebbae6a0775344508a4a0787518af9a1.tgz#1793766049875230`.
- Objeto de **255.912 bytes**, generación `1793766049875230`; SHA-256 descargado `9cbe33aa73eff11a0e261dbd611c181ab67b8d82e6a701b8e7805df71cd7349b`, coincidente con la huella SHA-256 del build (`nL4zqnPv8RoOJh29YRwYGrZ7jYLmpwG454Bd9xzXNJs=`).
- El archivo original es **TGZ**, no ZIP. Se conservó sin convertir en `C:/SisVentas/tmp/cotizador-provenance-fc422/source.private.tgz`, fuera de Git; extracción privada en el mismo directorio. No se descargó la imagen del contenedor. Antes de extraer se comprobaron rutas y ausencia de enlaces peligrosos.

La cadena es revisión → digest de imagen → resultado del build → objeto de fuente fijado por generación → hash local. Las anotaciones de revisión consultadas no aportaron un SHA Git verificable. El sufijo `bbf61e86` y el nombre de imagen no demuestran por sí solos un commit de origen.

## Diferencias reales

Se compararon los 100 archivos del archivo remoto con el contenido Git de fc422, normalizando CRLF/LF; 85 iguales, 14 distintos y uno exclusivo remoto. Las diferencias de finales de línea no se contabilizaron como cambios funcionales. No se interpretan las pruebas locales ausentes del paquete remoto como regresiones del servidor.

| Archivos distintos | Cambio local respecto del remoto |
| --- | --- |
| `index.js`, `Dockerfile` | Integración y empaquetado de Accounts, H7, eliminaciones coordinadas, dependencias financieras y Cobranzas nativas; capacidades y rutas correspondientes. Retiro del observador de comisiones. |
| `commercial-ownership.js` | Coordinación y validación comercial también para presupuestos; extracción/exportación de resolución de responsable para reutilizarla. |
| `commercial-pages-model.js`, `commercial-pages-projections.js` | Fuente del cobro global/embebido/legado; resúmenes, grupos y búsqueda de Cobranzas nativas, con validación de esquema/cobertura. Se conserva la aritmética previa de deuda en los cambios revisados. |
| `labor-db.js` | Dominios observados derivados del guard; transacciones de cuenta laboral por movimiento, conservando imagen anterior y evitando reemplazar el padre. |
| `labor-runtime.js`, `labor-guard.js`, `labor-rtdb-store.js`, `labor-write-gateway.js` | Accounts/H7 y dependencias financieras dentro de coordinación; claims reservados, capacidades, validaciones económicas y protección de nodos derivados. Coordinación comercial de presupuestos cuando Accounts está habilitado. |
| `sale-cost-correction.js` | Una denegación explícita también bloquea al administrador; exportación de utilidades de costos para validación económica. |
| `sale-return-to-budget.js` | Validación compartida de transición económica y capacidad condicionada por coordinación y digest de reglas; conserva comprobaciones de actividad, cobros y permisos concurrentes. |
| `commercial-models/budget-read-model.js` | Distingue precio explícito cero válido de precio ausente/inválido; inferencia desde subtotal sólo cuando falta el precio explícito. |
| `commission-generation.js` | Retira observador y recuperación de raíz; `retryPending` requiere una clave concreta. Generación explícita y `systemGenerate` se conservan. |

Los módulos locales nuevos corresponden a Accounts, H7, Cobranzas nativas, eliminación de venta/compra/OT, economía y dependencias financieras, además de modelos auxiliares y pruebas. El remoto carece de estas capacidades: no puede mantener sus índices nuevos sólo por activar flags o reglas.

## Única capacidad remota retirada: observador de comisiones

`commission-job-events.js` existe únicamente en remoto y está incluido en su Dockerfile. No es código sin referencias: `commission-generation.start()` instala su escucha de trabajos para reintentos, además de consultas de ventas pagadas, señales de conexión y un temporizador de salud/reintentos. El arranque remoto llama a `start()` sólo con `COMMISSION_OBSERVER_ENABLED=true`.

Lectura fresca de **sólo la salida filtrada de estos indicadores no secretos** de la revisión exacta:

- `COMMISSION_OBSERVER_ENABLED=false`.
- `COMMISSION_GENERATION_ENABLED=true`.
- `COMMISSION_EVENT_ENABLED=true`.

Por tanto, el observador y su watcher no están arrancados por el proceso principal activo. La copia local no elimina una función habilitada de esta revisión; conserva `commission-event.js` idéntico y su llamada a `systemGenerate`, junto con autenticación y coordinación de eventos. El índice local rechaza expresamente arrancar con el observador habilitado. **No reutilizar una configuración antigua con ese flag en true**: impediría el arranque. Tampoco presentar `retryPending()` sin identificador como API compatible; ese contrato se retiró deliberadamente.

No se encontró otra mejora funcional exclusiva del remoto que quedara ausente en la copia local entre los archivos contrastados. No corresponde restaurar automáticamente el watcher retirado ni copiar archivos remotos sobre el trabajo local.

## Límites y siguiente paso

Esto acredita procedencia y contraste estático, no autoriza un despliegue ni prueba equivalencia operacional completa. No se invocaron endpoints comerciales, leyeron registros de negocio, consultaron logs, accedieron valores de secretos, cambiaron IAM, habilitaron APIs, ejecutaron builds ni desplegaron servicios. Sólo se descargó el objeto de fuente pequeño identificado por el build.

No se repitió la suite ni se hicieron operaciones financieras: no hubo cambios de código. Las Functions fiscales y los forwarders tienen comparación propia y no quedan certificados por este documento. Tampoco se comprobó aquí entrega de eventos, configuración completa, comportamiento de etiquetas antiguas ni estado de índices/reglas remotos.

Para una futura candidata autorizada, preservar el receptor de eventos, conservar los tres indicadores comprobados y coordinar todos los escritores que aún carecen de Accounts/H7/dependencias financieras. Revisar el paquete y la configuración exactos antes de publicar; este contraste no constituye aprobación de corte.
