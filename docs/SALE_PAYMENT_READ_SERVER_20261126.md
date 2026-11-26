# Servidor mínimo de lectura de pagos — 2026-11-26

Fuente aislada desde abb16d86. No altera app20, servidor principal, Rules, IAM, flags ni datos. No desplegado.

## API

`require('./sale-payment-read-server').createServer({auth,store,allowOrigin,observe?})` devuelve http.Server, sin listen implícito. Composición única por servidor: BusinessAuth, adaptador REST readonly, Ownership scoped y lector genuinos. Proyecta sólo read/readQuery/query/readAsUser del Store; no entrega commits ni SDK database a los controladores. auth sólo necesita verifyIdToken, invocado siempre con true.

`createFromEnv({env=process.env,admin?,fetchImpl?})` compone el Store genuino con ADC y Auth; DATABASE URL obligatoria en FIREBASE_DATABASE_URL, proyecto opcional GOOGLE_CLOUD_PROJECT, origen literal ALLOW_ORIGIN (default vigente https://ventas.sistemanixa.com). Importar el módulo no inicia ADC ni firebase-admin. El ejecutable `node cotizador/sale-payment-read-server.js` compone una única instancia privada por proceso y escucha PORT (default8080). No inicializa admin.database, labor-runtime, índices de escritura, listeners ni navegador. No agrega caché de datos/contexto entre solicitudes.

Única operación GET `/comerciales/ventas/registro/:key?para=pagos`. Sin otras query keys, duplicados, verComo ni otros propósitos. OPTIONS sólo esa ruta con Access-Control-Request-Method GET. Otros métodos501; otras rutas/query404, antes de Auth/base. Clave inválida400. Origen ajeno403, sin reflection. GET sin Origin sigue requiriendo sesión. Cache-Control private,no-store y Vary Authorization,Origin en todas las respuestas. Configuración de origen HTTPS o HTTP loopback solamente.

DTO nativo exacto `{ok:true,record:{...detail.record,fbKey},paymentHistory}`. Errores `{ok:false,mensaje}`, sin excepciones internas. Se conservan usuario/rol/permiso/reset, propiedad, lectura fuente como usuario, índice/colisiones, source checks, finalAuth, finalOwnership y cobertura final. Concurrencia16, maxCandidates1000 y timeout REST vigente sin cambios. No fallback de servicio ante denegación.

## Evidencia y límites

65 focales: nuevo HTTP15 + lectores previos50. Servidor real en puerto loopback efímero, Store/Ownership/Authwrapper reales y transporte/Auth ficticios. Incluye 501/401/403/404/409/503, CORS/preflight, métodos/query ajenos0reads, revocación/reset/permisos/owner, colisión numérica sin fallback, cobertura/source race, DTO sin binario,0escrituras y ausencia de arranque runtime/browser/SDK. El sandbox inicial bloqueó connect loopback; ejecutado después con permiso de red local. No emulador, datos reales, navegador ni suite global. nodecheck/diffcheck correctos.

Root decide empaquetado y despliegue únicamente si su probe regional acredita ganancia. Este checkout no mide RTT regional ni configura servicio remoto. Infraestructura/capacidad, credenciales, DNS, frontend y corte permanecen a cargo de Root. No se anuncian mejoras de latencia de producción por estas pruebas locales.
