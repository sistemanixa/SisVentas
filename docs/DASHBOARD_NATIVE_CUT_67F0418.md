# Nativa intacta sobre fuente final 67f0418

Fuente: `67f0418cc2b67618b0b3d89cfed365c2acd352b9`. **14 PASS, 0 FAIL/SKIP, exit 0**, con Node portátil **22.23.4**, Firebase cliente 10.12.0 y emulador RTDB 4.11.2 propio. Trece subcasos y su contenedor; ningún caso añadido, eliminado o modificado.

Test: `test/dashboard-native-cut-ee46.integration.cjs`, SHA256 **B5B13FED6A567862301688ADBF875FA60235ED37624E2C4E75FAA52E7CAEAC14**, idéntico al rojo ee46 y al verde 2a0798. Se fijó `SV_NATIVE_SOURCE_SHA` al SHA final completo; la prueba contrasta las dependencias ejecutadas con ese Git y no sólo cambia una etiqueta.

## Diff integral desde el verde anterior

Comparación exacta `2a0798a9d25c62bc8c6640c494520c32348695d0..67f0418cc2b67618b0b3d89cfed365c2acd352b9`: doce archivos, seis de documentación, cinco de pruebas y un archivo funcional. El manifiesto conserva nombres/status y numstat completos.

| Archivo | Añadidas | Quitadas |
| --- | ---: | ---: |
| docs/CONTEXTO_ACTUAL.md | 12 | 0 |
| docs/DASHBOARD_ANCLAS_REVISION_INDEPENDIENTE.md | 25 | 0 |
| docs/DASHBOARD_BROWSER_QA_2A_FINAL.md | 35 | 0 |
| docs/DASHBOARD_NATIVE_CUT_2A0798.md | 31 | 0 |
| docs/DASHBOARD_NATIVE_CUT_2A0798_MANIFEST.json | 574 | 0 |
| docs/DASHBOARD_NOTICE_PERMISSION_FIX.md | 11 | 0 |
| js/app.v3.19.3.js | 4 | 2 |
| test/dashboard-budget-host-callpoints.test.cjs | 1 | 1 |
| test/dashboard-creator-order-anchor-interaction.test.cjs | 10 | 0 |
| test/dashboard-late-consumers.test.cjs | 2 | 1 |
| test/dashboard-late-notice-browser-independent.integration.cjs | 30 | 0 |
| test/dashboard-native-cut-ee46.integration.cjs | 66 | 0 |

Los tres hunks del app hacen que `verificarVencimientosPptos` retorne `true` en sus dos caminos que generan el centro. El callback consulta ese retorno y genera el centro si el verificador no lo hizo. No hay cambios funcionales en backend, hosts, contratos, reglas, índice o Service Worker; verificado por diff de `cotizador`, `cloud-functions`, `js/core`, `js/modules`, `security`, `index.html` y `sw.js` entre ambos SHAs.

## Alcance de la repetición

Se repitieron reglas mensuales SDK/Fresh/Month admin `all` y regular `own`, bloqueo de scope ajeno, cinco GET del index real sobre store REST fresco y rechazos de autoridad/cobertura. El helper acepta evidencia equivalente tras REST; el host personal con sólo grant Ventas conserva un GET, contador **501**, cinco filas públicas mínimas en orden, centavos exactos, privacidad y Readiness independiente. Se ejercitan deduplicación, cambio concurrente de membresía, reset real con mismo UID, recuperación explícita y revocación de grant, sin originales ni fallback.

El rojo ee46 **10 PASS/4 FAIL** y el verde 2a0798 **14 PASS/0 FAIL** permanecen intactos y con sus hashes; no se atribuyen al SHA final. El manifiesto nuevo registra los tres cortes, las 166 dependencias ejecutadas y los 263 activos adicionales del índice/SHELL rehasheados y contrastados con la fuente final. Los activos UI se hashean, no se ejecutan en navegador en esta prueba. El arreglo del centro tardío tiene su evidencia Chrome separada de root; esta nativa no pretende cubrirlo.

Namespace ficticio vaciado y verificado; el runner detuvo sólo el Java propio iniciado con puerto 9059 previamente libre. Verificador Auth ficticio ligado al namespace y owner como sustituto de la credencial de servicio; fecha de prueba fija 2026-11-04 y borde VM de contexto clonado. Son reglas standalone propuestas, no reglas remotas ni Auth real. No servicios de producción, datos reales, Docker remoto, push, publicación o recarga de la ventana del usuario.

Log privado: `C:/SisVentas/tmp/stage1-integral-plan/dashboard-native-67f0418-final/test.private.log`. Hashes de logs/manifiestos, reglas, Node, test, dependencias y diff completo en `DASHBOARD_NATIVE_CUT_67F0418_MANIFEST.json`. Esta evidencia nativa es independiente de la puerta general que root ejecuta sobre la misma fuente.
