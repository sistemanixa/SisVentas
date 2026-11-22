# Auditoría C: 20 referencias de artefactos · 22/11/2026

Fuente de pruebas fija: f927f74a505fcc1712e254cf99cb05aec5e2c5f7. Node v22.23.4. Sólo lectura de fuentes, hashes y transformaciones en memoria con dobles ficticios; no Chrome, red, builds, despliegues ni datos reales. No se repitieron los 42 browser ni los 14 de conteo.

Resultado: 12 casos ejecutados, 11 PASS y 1 FAIL, sin omisiones dentro de la selección. Otros 7 requieren escritura/servidor y 1 no tiene referencia antigua de reglas confirmada. No equivalen a ocho pruebas aprobadas.

El fallo de composición Accounts/Clothing es SV_ACCOUNTS_OVERLAY_INVALID: Source adapter shape changed en scripts/lib/client-account-runtime-overlay.cjs:24, llamado desde la derivación de labor-rtdb-store.js:29. Las cuatro bases coinciden con sus hashes fijados. El contrato rechaza la forma del adaptador actual; no se modificaron fuentes, anclas, hashes ni expectativas para hacerlo pasar.

## Tabla de los 20 casos

| Archivo | Nombre exacto | Resultado |
|---|---|---|
| test/cc-opening-overlay.test.cjs | exact deployed baseline retains write/auth functions while changing only the list read pool | PASS |
| test/combined-accounts-clothing-overlay.test.cjs | reviewed four-file derivation preserves every other inherited runtime file | FAIL: Source adapter shape changed |
| test/employee-resources-combined-overlay.test.cjs | real reviewed Accounts assembly preserves readQuery, writer claims and all unrelated native bytes | PASS |
| test/ot-lifecycle-missing-primary-rules.test.cjs | exact reviewed rule baseline changes only two lifecycle grants | NO EJECUTADO: referencia antigua de reglas no identificada; actual rechazada |
| test/ot-lifecycle-missing-primary-rules.test.cjs | pinned deployed model retains every byte outside one verified-link branch | PASS |
| test/stage-combined-runtime.test.cjs | real native inventory stages 26 Git copies and four derived outputs with LF parity | NO EJECUTADO: escribe archivos/repositorio o abre servidor; fuera de sólo lectura |
| test/stage-combined-runtime.test.cjs | baseline manifest, immutable image, payload hash and path escape fail before output | NO EJECUTADO: escribe archivos/repositorio o abre servidor; fuera de sólo lectura |
| test/stage-combined-runtime.test.cjs | reference parity and baseline symlinks are rejected | NO EJECUTADO: escribe archivos/repositorio o abre servidor; fuera de sólo lectura |
| test/tecnoprices-container-contract.test.cjs | retained image sources form the exact reversible combined filesystem; not a container run | NO EJECUTADO: escribe archivos/repositorio o abre servidor; fuera de sólo lectura |
| test/tecnoprices-current-overlay.test.cjs | exact current overlay preserves all non-reader bytes including OT auth and Stock | PASS |
| test/tecnoprices-current-overlay.test.cjs | packaging includes helper in COPY and startup check without changing runtime configuration | NO EJECUTADO: escribe archivos/repositorio o abre servidor; fuera de sólo lectura |
| test/tecnoprices-overlay-http-loopback.test.cjs | exact composed scraper and preserved Presentation handler over own HTTP loopback; provider API is fictitious | NO EJECUTADO: escribe archivos/repositorio o abre servidor; fuera de sólo lectura |
| test/tecnoprices-presentation-overlay.test.cjs | CLI apply/verify/revert are exact and refused writes leave their input intact | NO EJECUTADO: escribe archivos/repositorio o abre servidor; fuera de sólo lectura |
| test/tecnoprices-presentation-overlay.test.cjs | private reference is exactly deterministic Presentation overlay of the pinned old entrypoint | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | apply and reversal preserve every byte outside the login scraper, including Presentation/auth/deletion behavior | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | Presentation model authorization still requires genuine active admin context; no data IO | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | patched exact scraper with real helper and synthetic API: authenticated | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | patched exact scraper with real helper and synthetic API: HTTP401 | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | patched exact scraper with real helper and synthetic API: login-with-price | PASS |
| test/tecnoprices-production-overlay.test.cjs | production package pins the serving base, changes only Tecnoprices context, and declares all three files | PASS |

## Referencias exactas existentes

Los hashes siguientes son SHA256 de bytes crudos; no se normalizaron saltos de línea. Un esperado “registrado” identifica evidencia reproducible, sin afirmar que el test lo fije.

| Archivo existente | Esperado | Actual |
|---|---|---|
| C:/SisVentas/tmp/return910199-server/cotizador/commercial-ownership.js | f5df3428c59bf7ee1ecf68f732ceaf31b2c3d46909e040f1f241f61bea956923 | f5df3428c59bf7ee1ecf68f732ceaf31b2c3d46909e040f1f241f61bea956923 |
| C:/SisVentas/tmp/presentation-release-v3198/patched-index.private.js | c20743a481d1c51fed8e1631aec015ca12f4cf7ed10dc914015d57e3b652c9eb | c20743a481d1c51fed8e1631aec015ca12f4cf7ed10dc914015d57e3b652c9eb |
| C:/SisVentas/tmp/return910199-server/cotizador/ot-lifecycle-model.js | 7936cb65d857ab514186ae9ed33270a065d5494e17850b26bf528ba5f0537e53 | 7936cb65d857ab514186ae9ed33270a065d5494e17850b26bf528ba5f0537e53 |
| C:/SisVentas/tmp/ot188-server-build-auth-overlay-20261109/server/index.js | 65bcf210546539b6c70ccc1018df009ceaec867e458172b411525c41fcf02fd4 | 65bcf210546539b6c70ccc1018df009ceaec867e458172b411525c41fcf02fd4 |
| C:/SisVentas/tmp/presentation-release-v3198/published-index.private.js | 50e9a049d412515ad4062af0acb793b9a268d3919da97376e4f4dbd66c7bee85 | 50e9a049d412515ad4062af0acb793b9a268d3919da97376e4f4dbd66c7bee85 |
| C:\SisVentas\tmp\cuenta-corriente-20261113\base0b-reconstructed-v2\index.js | 8063e1588cc9e45927ec70b4b1eff304a467be147eb8f23411f52b094f3b9ba3 | 8063e1588cc9e45927ec70b4b1eff304a467be147eb8f23411f52b094f3b9ba3 |
| C:\SisVentas\tmp\cuenta-corriente-20261113\base0b-reconstructed-v2\labor-runtime.js | 3e11e7062cf94d5abf9d79e4b9b8393bc5a30d583af3973124734d2c22ef1710 | 3e11e7062cf94d5abf9d79e4b9b8393bc5a30d583af3973124734d2c22ef1710 |
| C:\SisVentas\tmp\cuenta-corriente-20261113\base0b-reconstructed-v2\labor-guard.js | 94ee689c24e4066031e68fe0218b4314ad677584595da93892b6ff30ce3d110c | 94ee689c24e4066031e68fe0218b4314ad677584595da93892b6ff30ce3d110c |
| C:\SisVentas\tmp\cuenta-corriente-20261113\base0b-reconstructed-v2\labor-rtdb-store.js | e634c4971c856a304241137aee8c051e0ddafb6010ee8e0c88896fac1d69c47c | e634c4971c856a304241137aee8c051e0ddafb6010ee8e0c88896fac1d69c47c |
| C:\SisVentas\tmp\cuenta-corriente-20261113\cotizador-accounts-assembled\index.js | b50fdfac03be0633f09e2d6c9108594e287d8aac691b5517efe6cdfd5e04d919 | b50fdfac03be0633f09e2d6c9108594e287d8aac691b5517efe6cdfd5e04d919 |
| C:\SisVentas\tmp\cuenta-corriente-20261113\cotizador-accounts-assembled\labor-rtdb-store.js | d68082c60a4abf1d6144d3602321cc5d83a4486d3d5e109d277a1179e9a4eb23 | d68082c60a4abf1d6144d3602321cc5d83a4486d3d5e109d277a1179e9a4eb23 |
| C:\SisVentas\.local\presentation-admin-v3198\cotizador\presentation-overlay\attach.cjs | registrado, sin pin propio | 08bcb6829d2e053412cb5a04df3dc3d0fb9df34a86d7e08f8cc512b55bb76ee4 |
| C:\SisVentas\.local\presentation-admin-v3198\cotizador\budget-presentation-trial.js | 6559e9588a4c484afd45e9de5b36881a1d5271dff03b362f49104b2e6a4a29eb | 6559e9588a4c484afd45e9de5b36881a1d5271dff03b362f49104b2e6a4a29eb |
| C:\SisVentas\.local\presentation-admin-v3198\cotizador\budget-presentation-trial-model.js | 2c817da2d3b1fd5909eff3b60de92adbff978bddce9536eac7a7394681b8dd5e | 2c817da2d3b1fd5909eff3b60de92adbff978bddce9536eac7a7394681b8dd5e |

## Manifiestos y límites

- C:/SisVentas/tmp/cuenta-corriente-20261113/base0b-manifest.private.json — SHA256 47ea6e24a30f7eebe7757273c9d53f3833c71a54d14785a9f1b59dc2033dca15; 125 entradas.
- C:/SisVentas/tmp/cuenta-corriente-20261113/cotizador-accounts-proposal/manifest.proposal.private.json — SHA256 177e3ac8d526b61b8df37f6214dec829da1b720a3bb56f0c1c8011448cc69bdb; 25 entradas.

Inventario nativo completo: 125 archivos comparados con el manifiesto, 0 diferencias. Accounts ensamblado: index.js y labor-rtdb-store.js coinciden con payloadSha256 del manifiesto Accounts. Retained Presentation: ambos módulos coinciden con test/helpers/tecnoprices-container-contract.cjs. Las pruebas de staging no se ejecutaron: sus hooks crean temporales y su fixture crea repositorios, aunque el nombre seleccionado sea negativo. Tener las referencias no acredita todavía staging ni contenedor.

SV_OT_LINK_RULES: el archivo local rules-current.private.json fue rechazado en memoria con “Unknown or already patched OT lifecycle grant”. No se sustituyó por reglas parecidas; no se encontró referencia antigua confirmada en las referencias revisadas. SV_OT_LINK_MODEL sí coincide exactamente y su caso pasó.

## Evidencia privada local

Directorio C:/SisVentas/tmp/audit-20261122-C, fuera de Git:

- pinrefs-readonly.log — SHA256 5076436111a68fa693f221563283320ccf78fbd27659080c73ff893f0f2fa1a5
- pinrefs-readonly.json — SHA256 93bdba45335ab1e2e44ffa8203c4bdb433e3575baa05da6c2c7ca8871e6241c5
- pinrefs-inventory.json — SHA256 7131c83ef7cdc565234bd3377756da39aedc1ec7ee0da5b3f85b68e8587a33ec

El JSON de ejecución conserva nombres exactos, selección y hashes antes/después: todos los inputs utilizados permanecieron iguales. El inventario conserva los 125 resultados de comparación. No se copiaron respaldos, credenciales, sesiones ni datos comerciales.

Siguiente paso: revisar el contrato de derivación frente al adaptador actual en un bloque separado; la ejecución de los siete casos que escriben/abren servidor queda fuera de esta instrucción de sólo lectura. No hubo push por la restricción explícita de no usar red.
