# Avisos opcionales: SDK/Fresh y reglas nativas

04/11/2026. Fuente aceptada: `d6280f50402b2092b324a8fe7e96a08ec50d996e`. Prueba propia `test/dashboard-budget-notices-fresh-native.integration.cjs`; no modifica fuentes, fixtures comunes, reglas propuestas ni aplicación.

## Procedencia y aislamiento

La primera ejecución dio 18 PASS pero tomó tres WIP posteriores ya presentes en el checkout (índice, DTO y política). Se conserva `C:/SisVentas/tmp/dashboard-budget-notices-fresh-native.private.log` y no se atribuye ese resultado al freeze d628.

Para la aceptación se extrajo desde Git únicamente la fuente d628 necesaria a `C:/SisVentas/tmp/notice-source-d628-frozen/`, sin checkout/reset ni sobrescribir WIP. `SV_NOTICE_CONTRACT_ROOT` permite ejecutar el test propio contra esa copia. La repetición final usa exclusivamente esos imports. Los once hashes de los archivos vigilados coinciden antes/después; sus blobs normalizados por Git coinciden con d628. Se conservan por separado SHA256 de bytes del snapshot (con conversión de finales de línea del checkout/archivo) y blobs Git; no se confunde EOL con cambios funcionales.

Firebase SDK **10.12.0** instalado, conexión nativa real `.info/connected`, Fresh con HTTP GET `no-store` y reglas standalone compiladas reales del emulador. Emulador propio en **127.0.0.1:9060**, namespace aleatorio `demo-notice-native-5082a38b2f6ab6`. El proceso 9046 ajeno no se utiliza. Se detuvieron exclusivamente las dos instancias propias al terminar, verificando PID, ejecutable, argumentos y puerto: 10388 (primera corrida) y 27636 (snapshot). No se instalaron dependencias.

## Resultado final

**18 PASS, 0 FAIL, 0 SKIP**: 17 escenarios más contenedor.

- Propios: 121 candidatos; administrador: 124. Tres páginas inclusivas de 50 en ambos alcances, sin duplicados, con count real autorizado. Incluye claves `2` y `10` para comprobar el índice UTF-16 sin ordenación numérica accidental de RTDB.
- El histórico propio conserva fecha ambigua e importe `null`; no se filtra fuera ni se inventa precio. Convertidos/anulados quedan excluidos. No viajan `sourceHash` ni payload privado. Ventas/costos, pagos, productos, stock y comisiones testigo no cambian por leer.
- La lectura por defecto no solicita candidatos ni count de avisos.
- Reglas deniegan header, candidatos y count ajenos; scope `all` forjado por vendedor; lectura de stats completa; candidatos sin límite o con límite 51; anónimo; escritura por administrador de aplicación en count, candidatos y header.
- El grant local forjado no amplía el scope capturado. Revocación del gate RTDB, ausencia del schema de candidatos y revisión DTO distinta de cobertura deniegan mediante Fresh contra reglas reales.
- Count ausente con records positivos o índice ausente con count positivo no producen éxito vacío.

Reglas standalone SHA256 `2447b4482874308e45543048c7c475382e54ad8d3e0068a45b7bc71836f30f59`. No se compusieron con reglas productivas.

## Evidencia y defectos anteriores

Log final privado: `C:/SisVentas/tmp/dashboard-budget-notices-fresh-native-frozen-d628.private.log`, SHA256 `fa585746dc07cc80db50caac10066412953c09f7b74dca93c128af1ba1e07318`. Test SHA256 `e2217deb014888029852252f2b6379117ad3c1c1dc5b066432e7b92697a1f2f6`.

Manifiesto/resultados y hashes antes/después/Git: `C:/SisVentas/tmp/dashboard-budget-notices-native-20261104/frozen-d628/notices-native-results.json` y `before-after-and-git-hashes.private.json`. Los tokens ficticios se mantienen en memoria y no se incluyen en logs/documentación.

Se conservan sin ocultar los rojos de `DASHBOARD_AVISOS_REVISION_INDEPENDIENTE.md`: primero vacío global falso (3 PASS / 2 FAIL), luego revisiones no canónicas (10 PASS / 4 FAIL). Root informó 26 PASS tras corregirlos, con tests propios originales sin editar. Esta corrida nativa final no sustituye ni reescribe aquellos logs.

Límites: es SDK Node real con identidades/token mock de emulador y controles owner de fixture; la revocación probada es reset/version RTDB, no `revokeRefreshTokens` del proveedor real. No es recorrido visual, prueba de todos los escritores/renovación de DTO, montaje de SDK, UI, composición remota, puerta general ni publicación. La propuesta sigue sin montar.
