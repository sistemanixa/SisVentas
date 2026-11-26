# Derivación Live con lector ETag por operación

Artefacto puro, sin IO ni despliegue. Reemplaza la descripción anterior de este
mismo documento. No modifica Root, imágenes, Rules, flags ni datos reales.

Base nativa20: imagen cotizador sha256
00e36728c5d9a895ce5e17cc5e4cede770843831fe0203eabe6f32c2088647e0.
Freeze de las fuentes: 08bba18c66c971fe9beaf03132b613c0d50bfeea.
Los cuatro hashes RAW de base y catorce hashes de fuente LF están fijados en el
builder. También se exige el mapa RAW de las fuentes suministradas: recalcularlo
no permite introducir una fuente distinta del freeze.

## API y preservación

`scripts/lib/sale-delete-live-runtime-overlay.cjs` exporta
`derive({baselines,sources,expectedBaseHashes,expectedSourceHashes,baseImage})`.
Mapas exactos: NAMES contiene cuatro cores; SOURCES esos cuatro y diez hojas.
Devuelve `{files,hunks,manifest}` sin IO, activación, caché ni attestation.
Las referencias Git completas de los cores nunca se copian al paquete.

| Core | Hunks | Preservación |
| --- | ---: | --- |
| index.js | 4 | RAW idéntico al stage publicado 61b |
| labor-runtime.js | 3 | RAW idéntico al stage publicado 61b |
| labor-guard.js | 8 | Guard61b más un argumento readonly assertActive:live |
| labor-rtdb-store.js | 1 | Inserción de fábrica readonly sobre RAW |

Retirar el literal de la fábrica recupera Store con Buffer.equals(baseStore),
incluidos finales CRLF originales. EmployeeResourcesCommitVersion1, claims,
contratos OT y todos los hooks de escritura quedan intactos. Retirar únicamente
el argumento readonly de finalChecks recupera el hash RAW de Guard61b.
Cada anchor es único y cada archivo completo tiene verificación de reversa.

Diez hojas: cinco sale-delete (command/fence/relations/activity/HTTP),
live-financial-evidence, source-reader y Financial model/delta/provider.
El resultado sobre 150 JS nativos contiene 160 JS. Las dependencias nativas se
conservan; no se instala History, protocolo financiero ni proyecciones H/Fin.
Gastos admite 16 MiB; las otras cuatro fuentes conservan 8 MiB y el proveedor
conserva el límite global de 64 MiB. Sin routing H3 adicional a CC.

Defaults: Activity false, modo indexed, H0/Fin0. Se mantiene el enum servidor
indexed/live-originals. Live exige ausencia genuina de History/config/Financial.
El nuevo checker readonly permite validar lease durante committing sin habilitar
el scope de trabajo ni escrituras durante esa fase. Los dos GET finales de
permisos se mantienen después de finalChecks sólo para ventas.eliminar;
stock.ajustar conserva el orden anterior.

## Evidencia focal

Configurar SV_SALE_DELETE_NATIVE20_ROOT con el paquete nativo privado. Si las
fuentes aún no se integraron en el checkout del test, configurar además
SV_SALE_DELETE_OVERLAY_SOURCE_ROOT con un checkout del freeze C.

    node --test test/sale-delete-live-runtime-overlay.test.cjs

18 PASS, cero fallos/exclusiones. Incluye los catorce casos previos actualizados,
reversa RAW Store, hashes index/runtime61b y Guard61b más el puerto readonly,
rechazo de fuentes refirmadas y mapas extra, LF/CRLF, H0/Fin0, provider genuino,
ausencia parcial, permisos y revocación tardía.

Adapter, BusinessAuth, gateway, Guard, Store y lector reales sobre transporte
Auth/RTDB ficticio: un delete/commit/recibo, cinco GET iniciales200 y cinco
condicionales304, uno por raíz y fase. Un ETag modificado en el segundo plan
produce 200 fresco y rechazo409 con cero commit, conservando la venta. Dos
fábricas tienen cachés aisladas; dispose impide lecturas posteriores; sólo se
admiten las cinco raíces. El checker readonly funciona durante committing y el
scope de trabajo sigue rechazando escrituras en esa fase.

Límites: sin Rules, emulador, suite global, navegador ni cambios productivos.
No acredita CAS/concurrencia RTDB, ACK perdido, regresión OT V2 ni HTTP del index
completo. No se repiten ni se atribuyen aquí los 70 casos de C. La composición,
pruebas de esos límites y publicación pertenecen al coordinador.
