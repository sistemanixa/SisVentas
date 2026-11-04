# Reader SDK: sesión fijada y cancelación local entre consumidores

Propuesta aislada en `codex/dashboard-sdk-session-cancellation`, desde
`8cdda057c4fa5260f8694a62682cf8889e3d26bf`. No se modifica el checkout de Hist,
la integración, reglas, DTO, política legacy, modelo, aplicación ni contrato
de caché/frescura. No se consulta red o datos reales ni se monta el consumidor.

## Snapshot de origen y delta

Se copió exclusivamente `js/core/dashboard-budget-sdk-proposal.js` del checkout
`C:/SisVentas/.local/dashboard-activity-sdk-v2`, cuyo HEAD observado era
`0aad5533decf86004ab2b33001b459a731283c4d`. SHA256 de los bytes copiados:

`efbb410daa4854cc189989509e20d90f3ef184f401fe7b63831a941050acf962`

El snapshot sin modificaciones se registró en
`6d0f076a91044909094cb04f4c899cfe6b1bd2e6`. El commit posterior es un delta
revisable contra ese archivo, no una copia silenciosa de otros WIP de Hist.

## Contrato de sesión

Cada invocación fija tanto la referencia `capture().auth.currentUser` como
`capture().sessionEpoch`. Este último es obligatorio: entero seguro no negativo,
monótono durante el ciclo de sesión del host. El host debe incrementarlo al
retirar/recrear la sesión, también si vuelve el mismo UID. Por ejemplo, el binding
futuro puede capturar `_svOperacionesSesionEpoch`; no se lo reemplaza por
`connectionEpoch`, que representa otro ciclo de vida.

La respuesta se retira antes de decodificar si cambia User, epoch, UID, Auth,
DB, rol, permisos, grants o los demás contextos que ya fijaba el reader.
`sessionEpoch` ausente/inválido falla antes de pedir datos. No hay un valor por
defecto que aparente una sesión válida. `valid(ctx)` continúa siendo obligatorio.

Los llamadores y fixtures de Hist todavía deben incorporar este campo al
coordinar la integración. No se actualizaron desde esta rama ni se presume que
sus pruebas actuales ya satisfacen el nuevo contrato. No se cambia el DTO público.

## Cancelación estrictamente local

Eventos y badge continúan iniciándose como consumidores concurrentes de una
sola lectura. El primer fallo fija una razón local a esa invocación y retira su
resultado. `Promise.all` devuelve el error sin esperar a una petición hermana
pendiente. Los consumidores mantienen handlers para sus rechazos tardíos.

El gate común `live()` impide decodificar un snapshot tardío y emitir páginas
nuevas después del fallo. Esto también cubre un badge cuyo as-of todavía estaba
pendiente cuando fallaron eventos. La razón inicial se conserva en ambos sentidos
(eventos falla/badge tardío; badge falla/eventos tardío).

**No cancela una petición SDK ya enviada**, no promete ahorrar su respuesta y
no garantiza que esa petición termine. Cuando termine, su resultado se ignora.
El estado de cancelación es por invocación: no cancela otra lectura válida ni
introduce un lock global, transporte alternativo, reintento o fallback HTTP.

## Regresiones y alcance real

Prueba propia `test/dashboard-budget-sdk-session-cancellation.test.cjs`, con
promesas controladas, snapshots y SDK ficticios, Core v2 real y sin transporte
externo. La primera reproducción, contra el snapshot intacto, dio **6 FAIL y
1 PASS**. Los fallos cubren mismo UID/User distinto, mismo User con epoch nuevo,
epoch ausente/inválido, badge en vuelo, as-of pendiente y actividad tardía tras
fallo del badge. Esa evidencia inicial se conserva fuera de Git.

La octava prueba verifica devolución temprana del error, manejo del rechazo SDK
tardío y una lectura independiente mientras aquel transporte aún está pendiente.
El positivo conserva cinco GET acotados en el caso de 50 futuros: dos headers,
cinco eventos y dos páginas badge de 50 con anchor inclusivo. No se agregan
lecturas de originales/raíces.

Resultado final con Node 22.23.4: **14 PASS, 0 FAIL, 0 SKIP** (ocho propias y seis
del modelo de actividad v2). `node --check` y `git diff --check`: PASS. Evidencia
privada: `tmp/dashboard-sdk-session-cancellation-before.private.log` y
`tmp/dashboard-sdk-session-cancellation-after.private.log`.

No es prueba de SDK real/emulador, revocación Firebase, caché o revalidación de
servidor. `connected=true` sigue sin demostrar frescura. No decide entre SDK y
servidor, no cambia permisos legacy y no certifica mantenimiento de cobertura
por todos los escritores. No se ejecutó la suite global ni se importó a root/app.


## Integración root posterior

En la integración local el lector conserva readFresh, incorpora User/sessionEpoch y cancelación P2 y valida las nueve columnas de actividad v3. El DTO comparte AuthorityPolicy.hash y Activity.SCHEMA. Los resultados nativos anteriores corresponden al freeze descrito arriba, no demuestran por sí solos el bloque reunido. El código continúa sin montaje en la aplicación.
