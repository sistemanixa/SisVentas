# Lectura fresca, legacy y revocación: bloque aislado, sin montar

Base congelada: `0aad5533decf86004ab2b33001b459a731283c4d`, rama `codex/dashboard-activity-sdk-v2`. El bloque limitado anterior queda como evidencia histórica, no como lector listo. No modifica integración, app activa, originales, SDK instalado, fechas ni permisos efectivos. No publica ni retira la descarga completa.

## Hallazgo reproducido y frontera corregida

En SDK 10.12.0 se activó onValue del header y del prefijo, y se demoró la entrega de mensajes sólo en la conexión WebSocket del test. El servidor avanzó revisión/cambió una fila derivada y cerró el gate de acceso. El lector congelado aprobó metadata vieja con **cero frames get enviados al servidor**. El SDK devolvió también el prefijo viejo de una query activa. Misma identidad y conexión seguían aparentando estar vigentes. No se parcheó el SDK; se instrumentó el transporte del test. No se afirma que todo get esté siempre obsoleto: se demostró que no es un certificado de respuesta de servidor.

El lector ahora exige readFresh; no tiene default a sdk.get. `dashboard-budget-fresh-rtdb-proposal.js` realiza **todas** las lecturas —header, filas y rangos— mediante GET HTTP directo a RTDB, sin pasar por Cotizador. Construye únicamente paths/query tipados, fija expectedOrigin y dominio Firebase, rechaza redirects/credenciales/orígenes arbitrarios y sólo permite loopback bajo opt-in explícito de prueba. Usa ID token en memoria y cache:no-store. No parsea privados del SDK, no crea otra conexión Firebase ni usa una respuesta de caché como prueba. La misma función sirve para el header inicial y final.

La prueba confirma que header nuevo y filas nuevas llegan por esta frontera aunque el SDK mantenga el prefijo viejo, y que el gate cerrado se deniega aunque el aviso de revocación WebSocket siga pendiente. Se cubren falla HTTP, User cambiado durante la petición, origen/path inválido y respuesta de índice malformada. Errores son sanitizados; no incluyen URL, token o respuesta privada. El query auth es credencial de petición: el host no debe registrar URLs completas ni instrumentarlas sin redacción. Hay deadline por petición, sin sondeo o reintentos automáticos.

## Permisos legacy: misma política, un transporte elegido antes

Recompilar PermissionIndex al preparar el DTO no alcanza para autorizar lecturas futuras. Se conserva el compilador vigente y su revisión, pero las reglas directas **no** confían en que un bloque raw siga igual: si existe bloqueados, deniegan ese camino. Se reprodujo la inserción de `bloqueados.arbitraryLegacyKey='presupuesto'` sin cambiar indiceRevision, indiceModulos ni header: tanto la lectura directa como el lector autorizado actual la deniegan. No se ampliaron grants para admitir legacy.

`dashboard-budget-transport-plan-proposal.js` usa el índice actual y la misma decisión de módulo que Own.moduleAllowed/eligible. Un bloqueo efectivo de dashboard o presupuesto elige denied. Un rol legítimo con bloqueados legacy elige **authorized-server desde el comienzo**, porque RTDB no puede sustituir Object.values sobre mapas arbitrarios con el índice de una foto pasada sin cerrar todos sus escritores. Configuración canónica compatible elige direct-rtdb. No hay fallback después de error, ni dos caminos activos por consumidor.

Se contrastan arrays, mapas dispersos, claves arbitrarias y booleanos legacy contra Own y contra el lector autorizado real sobre la misma raíz derivada. Los roles legítimos reciben el mismo KPI/prefijo por el camino planificado; Presupuestos bloqueado se deniega. El host deberá fijar la configuración de permisos protegida que originó el plan y retirarlo si cambia; el servidor siempre vuelve a autorizar por su fuente actual. Un plan local no concede permisos.

## Revocación con proveedor local real

La prueba de Auth usa Auth Emulator en 127.0.0.1:9098 y RTDB en 127.0.0.1:9058, cuentas/namespace propios y passwords aleatorios sólo en memoria. Emite JWT por login real del emulador y ejecuta **createUserAccess.temporary y complete existentes**, incluida revokeRefreshTokens. verifyIdToken(checkRevoked=true) del Admin SDK rechaza el JWT anterior. El acceso directo rechaza el anterior y el temporal, incluso cuando el gate reabre; sólo acepta el nuevo login con accessVersion vigente y cambio obligatorio terminado. No hay verificador simulado en ese caso, no se envían emails ni se toca Auth de producción.

Esto prueba el circuito real de revocación/reset/version existente en emulador. No certifica acciones manuales externas que revoquen Auth sin actualizar su gate RTDB: ese inventario/fence continúa siendo una precondición del corte. No se cambió la política de sesión para hacer pasar pruebas.

## Estado de integración y límites

- Cinco GET HTTP directos frente a 37 GET lógicos del oráculo en 5.051 propios; resultado de 1.788 bytes JSON. Conteos y paridad en loopback, no latencia, facturación ni ahorro real.
- Las reglas siguen siendo standalone de namespace ficticio, no un merger ni un despliegue. La proyección pública aún no está en todos los escritores: revisiones privadas que avancen sin actualizarla se deniegan. No se promete continuidad de un DTO vencido.
- La captura User/sessionEpoch y el freno de páginas tras fallo hermano tienen deltas separados a fusionar por root. Esta frontera no reemplaza esos controles; no se monta hasta unificar.
- V2 conserva el límite conocido de ordinales y TZ del preparador. Las pruebas congeladas muestran invalidación de activityReady en alta/cambios de orden y rechazo del preparador bajo TZ distinto. No se los da por resueltos con el DTO.
- Propuesta de integración para ese límite: conservar ms principal y fecha observada, desempatar por clave original con codificación acotada y estable y mantener sólo claves/ámbitos afectados; el fallback de fecha debe usar zona IANA explícita sin cambiar TZ del proceso UTC. Core/Costos implementan esas piezas aisladas; no se tocaron aquí ni se mezclaron contratos.
- Faltan escritores/autoridades completos, preparación/reconciliación, montaje único de transporte y consumidores, otros proveedores y centro. La descarga completa no se considera retirada.

Pruebas nuevas/relevantes: `dashboard-budget-fresh-rtdb-proposal.test.cjs`, `dashboard-budget-sdk-emulator.integration.cjs`, `dashboard-budget-sdk-cache-emulator.integration.cjs`, `dashboard-budget-auth-revocation-emulator.integration.cjs`. Los logs anteriores, incluido el hallazgo de caché y la corrida con el índice UID faltante del oráculo, quedan en tmp privado. El manifiesto de entrega registra comandos, hashes, casos y limpieza; nada de ello incluye credenciales.

## Freeze para unificación

Verificación final del bloque: 82 pruebas locales y 9 nativas PASS, sin omisiones; sintaxis y diff correctos. El contrato vigente de estos archivos aún es el v2 congelado (ordinal). Root recibió aparte f0bf209c98cae070d44a1d7a88046acbf2eff7a4: stable-key-utf16-v3, Activity.SCHEMA=3, envelope/recent.schema=2, nueve campos sin sourceOrdinal y eventSort(ms,key). Este freeze no acepta silenciosamente esa fuente: root deberá adaptar order/schema/validador DTO/reglas al unificar, junto con User/sessionEpoch y fail-fast. No se editaron los archivos asignados a Core/Costos.

## Presencia raw frente a defaults de la UI

El plan acepta rawBlockedExists, capturado del snapshot protegido antes de normalizarlo (por ejemplo child(bloqueados).exists en el snapshot de permisos ya disponible, sin otra llamada). [] / {} / null y contenedores sólo de valores que RTDB poda pueden usar direct-rtdb si esa metadata certifica ausencia raw. Sin esa evidencia, un campo normalizado vacío conserva authorized-server por precaución. Un campo canónico raw ausente también puede usar directo. false, 0 y strings son valores persistidos, nunca vacíos: aun con defaults [] capturados, rawBlockedExists=true conserva la ruta autorizada. No se amplían reglas ni se agrega un fallback.

La prueba real serializa [] / {} / null en RTDB, confirma ausencia y lee directo con la captura normalizada; compara también false / 0 / string vacío, que permanecen presentes y eligen servidor. La implementación no edita la configuración fuente. Costos adapta aparte el hash canónico para excluir sólo ultimoAcceso/ultimoAccesoEn; el digest del DTO de este freeze se deja intacto para esa unificación, sin ignorar campos de autoridad.

Addendum de presencia raw: 83 pruebas locales y 10 nativas PASS sin omisiones, incluyendo el circuito Auth y la regresión de caché. Las reglas no cambian respecto del freeze de lectura fresca; sólo plan, pruebas y este documento.


## Integración root posterior

En la integración local el lector conserva readFresh, incorpora User/sessionEpoch y cancelación P2 y valida las nueve columnas de actividad v3. El DTO comparte AuthorityPolicy.hash y Activity.SCHEMA. Los resultados nativos anteriores corresponden al freeze descrito arriba, no demuestran por sí solos el bloque reunido. El código continúa sin montaje en la aplicación.
