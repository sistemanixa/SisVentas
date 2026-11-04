# State importado: repetición independiente acotada

04/11/2026. Checkout aislado `integracion-v3190-verificada`, HEAD `ffd59fda` más importación local de `729f6a40e08cd59d55700e08cd0fc1187f3c5228`. Se conservaron los modelos de stock exactos, atestación V2 y auditoría `antes: null` del checkout receptor. No se editó servidor, cliente, fixtures compartidos ni expectativas anteriores durante esta repetición.

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

Aceptación limitada: las dos reproducciones bloqueantes originales quedan rechazadas y los positivos solicitados no presentan regresión en estos bytes. Los comandos usan servicios, guard y store REST reales con persistencia HTTP, identidad y prueba de fence ficticias; las cadenas usan el navegador aislado y las mismas fronteras previamente documentadas. No se repitieron emulador ni matriz histórica de 26: esta validación no certifica reglas compuestas nuevas, TTL/V2, exclusividad de escritores, suite general o despliegue. No hubo operaciones reales ni publicación. Este commit contiene solo prueba y documento propios; la importación State pertenece al coordinador.
