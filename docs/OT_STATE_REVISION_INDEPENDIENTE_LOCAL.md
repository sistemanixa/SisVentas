# State importado: repetición independiente acotada

04/11/2026. Checkout aislado `integracion-v3190-verificada`, HEAD `ffd59fda` más importación local de `729f6a40e08cd59d55700e08cd0fc1187f3c5228`. Se conservaron los modelos de stock exactos, atestación V2 y auditoría `antes: null` del checkout receptor. No se editó servidor, cliente, fixtures compartidos ni expectativas anteriores durante esta repetición.

El coordinador integró después esas mismas fuentes en `2a154bd8` y el test/documento propios en `ccf5dc3d`; las 14 huellas volvieron a coincidir después de esos commits y de la prueba de namespace siguiente. Aclaración de alcance/autoría: `ccf5dc3d` no es un commit exclusivamente de QA; por cruce del índice compartido incluye además `docs/CONTEXTO_ACTUAL.md`, `index.html` y `sw.js` del coordinador. No se reescribió historia ni se retiraron archivos.

**Resultado: 9 PASS, 0 FAIL, 0 SKIP**, únicamente los casos solicitados:

- Prueba propia nueva: entregadas 2 / instaladas 3 con recibo mínimo rechaza con `SV_OT_MATERIAL_REVIEW` antes de todo PATCH; cero commits/proofs y base comercial idéntica.
- Segunda reproducción original: entregadas 2 / instaladas 2 con recibo mínimo y consumo cero también rechaza antes de PATCH; cero commits/proofs y base comercial idéntica.
- Control positivo: recibo generado por `Stock.plan` real y ledger coherente permite instalar 2 sobre 2 entregadas. Un PATCH/commit, finanzas e inventario posterior al movimiento intactos. Reenviar el mismo comando no duplica consumo ni commit.
- Caso exacto anterior `instalación individual original y adicional histórico consume cada uno una vez`, seleccionado por nombre en `ot-closed-correction.test.cjs`: PASS.
- Tres cadenas existentes de recibir2/3→entregar2→instalar2→corregir1→recibir1: normal, móvil con ACK perdido y venta con estado inicial ausente: PASS.
- Dos cadenas `f265129e` sin instalación, móvil/escritorio: consumo cero, reserva propia 2→1, general +1, reserva ajena 5 y remito intactos: PASS.

Los 14 archivos fuente/fixtures registrados en `C:/SisVentas/tmp/ot-state-independent-import-before.private.json` coinciden con `ot-state-independent-import-after.private.json`: sin drift durante la validación. Huellas clave:

| Fuente | SHA256 |
| --- | --- |
| State | `305588de8df834d4bbd0689b8bc04517a1b59e6ecff5381cd57ae3b2b9edc1a7` |
| Ciclo servidor | `087b443e78bb583c8472c18b0b7758f6f980f568abcf19c4a705eecf6e09f0cd` |
| Modelo de ciclo con `antes: null` | `cf9893ccbc6681ce35e49e33e804df2d3dd4c9f954976181bade09e92efef7e3` |
| Stock servidor conservado | `6351a9c512a9fa4f62c8350c7b397946b6aafd7795aacd32a8ecb882fff43397` |
| Stock navegador conservado | `7988f7cce514d17d3a3a293b40eb4f89bf0d3e76081bbe44746799ac786d7373` |
| Custodia conservada | `833d8ad74a107e544c0c3e693671d78ed7bdb39ed9d3e3f7eac3b45fd2413305` |
| Prueba independiente nueva | `8b1ffebf833941ff8ee6abb479bc0ef5bc9977297de50515e76c3dd3e39f713a` |

Logs privados (fuera de Git):

| Ruta en `C:/SisVentas/tmp/` | SHA256 |
| --- | --- |
| `ot-state-independent-negatives-positive.private.log` (3 PASS) | `0576d7b3fb2f3f50dcac47ce7dfe296d82f15877f2b63922bf7c3bc212cdd211` |
| `ot-state-independent-original-first.private.log` (1 PASS) | `83e75a8218669a0b52e69286640c398e2e611659e60a818cb19faf057c1846ce` |
| `ot-state-imported-five-native-chains.private.log` (5 PASS) | `39f30edbcb7ac202fd16d23fe4ff04d2765685791f375eee6fbee7eb6bff20b4` |

Capturas/trazas ficticias: `C:/SisVentas/tmp/ot-state-imported-native-20261104/installed/` y `uninstalled/`. Sintaxis de la prueba propia y diff correctos.

Aceptación limitada: las dos reproducciones bloqueantes originales quedan rechazadas y los positivos solicitados no presentan regresión en estos bytes. Los comandos usan servicios, guard y store REST reales con persistencia HTTP, identidad y prueba de fence ficticias; las cadenas usan el navegador aislado y las mismas fronteras previamente documentadas. No se repitió la matriz histórica de 26 ni se la atribuye a esta versión. No hubo operaciones reales ni publicación. La prueba y este documento son propios; la importación State pertenece al coordinador.

## Namespace con la composición nueva

Repetición independiente posterior de `ot-attestation-private-namespace.integration.cjs`: **85 PASS, 0 FAIL, 0 SKIP** (84 denegaciones más caso contenedor), namespace nuevo `demo-otatt-0e044487737f356f` en el emulador existente 127.0.0.1:9046. Base histórica privada local + commercial-write-cut + fence importado + reglas del marcador privado. Candidata SHA256 `8d98aab9ec9694d3e8b8b851c4dfbd6ce5d1373045c2cc5e398f5ebf1717cecd`; builders y dependencias congelados antes/después, sin drift.

Builders: commercial-write-cut `b4d20a61d4e6b509b99528121b50408064ec6790a53b1c93da237319a75945fa`; fence nuevo `837626a23199b89519d1f5c245ea1d0f2a1280c77ca0d37c65538d38bb435c6e`; marcador `97ca6db84ad1dbabc97d55ad1c82dc805b955c8896c8b7fa04259a37f1889260`.

Log privado `C:/SisVentas/tmp/ot-attestation-namespace-state-imported.private.log`, SHA256 `bccaff7d458b08126145572d5659bf908faccef7ccac45579711aa375457ee78`. Matriz y manifiesto: `C:/SisVentas/tmp/ot-attestation-private-namespace-20261104/state-imported/attestation-namespace-matrix.json`. Valida únicamente el aislamiento de marcador/padre/descendientes/raíz ante sesiones de aplicación y claims falsos; no valida la aceptación de todos los commits OT bajo reglas nuevas, TTL/V2, exclusividad de escritores, suite general o despliegue. No sustituye la matriz operativa de permisos del coordinador/Costos.

## Matriz nueva de commits sobre las reglas exactas

Después de la puerta 22 informada por el coordinador, se agregó `test/ot-state-composed-rules-current.integration.cjs`: **15 PASS, 0 FAIL, 0 SKIP** (14 escenarios más contenedor). No reutiliza ni renombra la matriz histórica de 26. Compone los mismos tres builders exactos y la base privada local: candidata `8d98aab9ec9694d3e8b8b851c4dfbd6ce5d1373045c2cc5e398f5ebf1717cecd`, namespace nuevo `demo-otatt-879e3bf30472030f` en el proceso existente 127.0.0.1:9046. No inicia/reinicia/detiene procesos.

Los patches y capacidades válidos se preparan con el ciclo/guard/store reales del fixture en RAM. Después se ejecuta de nuevo el commit con **store real, protocolo State real, verificador V2 real y HTTP REST al emulador con sus reglas**, sin sustituir el resultado de autorización. La firma usa una clave Ed25519 efímera ficticia, no escrita en disco ni Git; el marcador corresponde al hash exacto de la candidata. No es un corte/publisher productivo.

Escenarios:

- Entrega 2/3 con V2 firmado tres días antes: permitida, sin expiración diaria artificial.
- Marcador revocado, firma incorrecta y generación diferente: rechazo del servidor antes de PATCH; base intacta.
- Fence, OT o revisión de permisos incorrectos, ausencia de kind o recibo: rechazo bajo las reglas actuales; sin persistir datos comerciales ni recibo confirmado.
- Original instalado antes de persistir el adicional histórico intacto: commit permitido.
- Recuperación histórica de fuente sin clave canónica, catálogo que tiene solo `cod` y ledger producido por `Stock.plan`: permitida. Se verifican tanto `.indexOn` `codigo/cod/ventaFbKey` como la **consulta REST real con `orderBy=cod`**, y el material completo persistido.
- Recibo mínimo sin consumo respaldado y clasificación instalada superior a entrega: rechazo State antes de PATCH aun con capacidad legítima y reglas reales; base intacta.
- Administrador de aplicación no puede reemplazar OT activada, padre canónico ni padre de resúmenes: tres denegaciones efectivas.

Huellas antes/después idénticas para runtime/custodia/Stock/V2 y builders/dependencias. Detalle privado: `C:/SisVentas/tmp/ot-state-current-composed-20261104/final/before-after-hashes.private.json`; resultados y manifiesto: `current-state-composed-matrix.json` en el mismo directorio. Ningún runtime/builders fue editado durante esta matriz.

Test nuevo SHA256 `95458276d69ef8534c30182b1b4960bab2fbe3d71fe9642c120a9ca5dfc10980`. Log privado `C:/SisVentas/tmp/ot-state-current-composed-final.private.log`, SHA256 `8f8b39f8f6c65b5582103feece8baffe97ffe1812bbe295224d36bb0e9e152da`. Sintaxis y diff correctos.

Aceptación limitada: pasan esos commits/negativos concretos con reglas exactas y V2 ficticio válido. No acredita todas las operaciones financieras, publicación/revocación operativa real, exclusividad de escritores externos privilegiados, autenticación productiva ni despliegue. Los 85 casos de privacidad del namespace son evidencia distinta, no se cuentan como operaciones de negocio ni se atribuyen a la vieja matriz de 26. Sin publicación, datos reales o cambios de runtime.

## Revisión independiente del delta de alcance de claves

Sobre `62d7a5019b2a041c96ebd20450b2ac31cfddbd42` (delta recibido `70474689`), se confirmó que el protocolo OT solo rechaza segmentos reservados dentro de su dominio y deja `gastos/__proto__` a su escritor financiero. Protocolo SHA256 `375224186053cb9c5d740daf96525fd950a2486bc6dca060aec0674bda411605`; su blob coincide exactamente con el commit importado. No se modificó fuente ni las ocho pruebas originales del delta.

Foco: **9 PASS, 0 FAIL/SKIP** (ocho regresiones del delta y una propia nueva). `ot-protocol-expense-key-independent.test.cjs` usa guard/store/protocolo reales con HTTP/RAM ficticios. Verifica `__proto__` como propiedad propia en consulta staged, registro persistido, consulta REST y round trip JSON; prototipo estándar y descriptores globales intactos; ningún campo filtrado hacia objetos vacíos. No hay lecturas ni patches OT. El gasto previo de 5 se conserva, se agrega exactamente 1 (total 6), con un commit/PATCH y ventas, pagos, comisiones, cuenta de empleados, empleados y configuración idénticos. Los tres negativos de segmentos reservados OT siguen rechazando atómicamente antes de leer OT.

El primer ensayo de la prueba propia esperaba incorrectamente prototipo `null` para el resultado staged, aunque `scope.query` retorna `Object.fromEntries` con `Object.prototype`. Se corrigió esa expectativa nueva para exigir el prototipo estándar intacto, manteniendo todas las comprobaciones de propiedad propia/contaminación. Log previo 8 PASS / 1 FAIL preservado en `C:/SisVentas/tmp/ot-expense-protocol-delta-independent.private.log`; no fue un fallo del delta ni se cambió una expectativa anterior.

Se repitió sin modificarla la matriz nueva de commits sobre las reglas exactas: **15/15 PASS**, namespace `demo-otatt-2df7209cd0646b60` en 9046. Candidata de reglas sin cambios `8d98aab9ec9694d3e8b8b851c4dfbd6ce5d1373045c2cc5e398f5ebf1717cecd`, V2/State e índices actuales. Runtime/builders antes y después coinciden: `C:/SisVentas/tmp/ot-state-current-composed-20261104/protocol-62d7/before-after-hashes.private.json`; matriz en `current-state-composed-matrix.json` del mismo directorio. Esta es una repetición real posterior al delta, no atribución de los 15 anteriores.

| Artefacto | SHA256 |
| --- | --- |
| Prueba propia nueva | `2e42c34a86d370d411d3f3976ebc8d6df7dd73d7e1222cc580bd9e98803f99a3` |
| `tmp/ot-expense-protocol-delta-independent-final.private.log` (9 PASS) | `4319ec6458acff5eae76447723fabf8b5ade158089ee5a39f3fca210baeec560` |
| `tmp/ot-state-current-composed-protocol-62d7.private.log` (15 PASS) | `20893d83ceaa44baa1acfb1b35a20622c269b4d771cf0914ba9113de19399fcc` |

Aceptación acotada del delta en esos casos: sin bloqueo nuevo detectado. No se repitieron aquí los 27 opt-in financieros del coordinador ni la suite general; su informe 35/35 es evidencia separada. El gasto de la prueba independiente usa transporte ficticio; los commits OT de la matriz sí cruzan reglas reales de emulador. Sin producción, publicación ni cambios de runtime/builders.
