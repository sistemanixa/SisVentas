# Verificación de los 42 opt-ins de navegador — 22/11/2026

Resultado: **42 PASS / 0 FAIL / 0 SKIP / 0 canceladas**, proceso salida 0, 87,67 segundos. Los 42 nombres emitidos por TAP se compararon como conjunto con los 42 del inventario de omisiones: coincidencia exacta, sin agregar ni sustituir casos.

Fuente fija probada: f927f74a505fcc1712e254cf99cb05aec5e2c5f7, copia detached C:/SisVentas/.local/qa-browser-optins-f927-20261122. Se creó desde el commit central limpio, no copiando archivos de un árbol mutable. HEAD y diff de archivos seguidos comprobados al finalizar: mismo SHA, sin cambios. No se modificó central ni se controlaron ventanas del usuario.

Referencia del inventario: puerta 7fe2c12063470e17d8146082fba20919554649f7, 91 omisiones originales clasificadas por coordinación en 42 browser, 29 emulador y 20 artefactos. Esta tanda ejecuta exclusivamente los 42 browser sobre fuente posterior fija; no reescribe el log global ni presenta las otras 49 omisiones como resueltas. No se repitieron los 14 casos Count/confirmed-refresh ya comprobados por root: sus archivos no participan de esta selección.

## Entorno y selección

Node portable v22.23.4; Chrome existente 158.0.8127.36; NODE_PATH=C:/SisVentas/cotizador/node_modules, sin instalaciones ni builds. Navegadores headless secuenciales con --test-concurrency=1. SV_TEST_CHROME y SV_CHROME_PATH apuntan al ejecutable existente C:/Program Files/Google/Chrome/Application/chrome.exe; además SV_GARANTIA_MANUAL_RUN=1, SV_GARANTIA_MANUAL_CHROME al mismo ejecutable, SV_RUN_COMMERCIAL_METRICS=1 y SV_DASHBOARD_NOTICE_INDEPENDENT_NATIVE=1. Se seleccionaron por nombre sólo las pruebas omitidas de los siete archivos siguientes, sin ejecutar las demás pruebas Node de esos archivos ni una puerta global.

Todas las operaciones usan fixtures ficticias, puertos/servidores loopback y conexiones externas bloqueadas o rutas de imagen interceptadas con bytes de prueba. No se usó una sesión real, datos comerciales reales ni credenciales. El caso de arranque completo recorre 60 y 1.095 ventas ficticias más 20 históricas, readiness real, Dashboard/ventas/cobranzas/retorno, totales completos y originales conservados; no demuestra que todos los dominios hayan abandonado sus lecturas raíz heredadas, que el test inventaría por separado.

## Inventario exacto ejecutado

| Archivo en test/ | Casos PASS |
| --- | ---: |
| budget-share-preview-browser.test.cjs | 2 |
| client-account-legacy-ready-browser.test.cjs | 4 |
| commercial-full-app-metrics.test.cjs | 1 |
| dashboard-notice-rest-independent.test.cjs | 1 |
| page-demand-readiness.test.cjs | 6 |
| project-presentation-generic-browser.test.cjs | 18 |
| project-presentation-trial-browser.test.cjs | 10 |

### budget-share-preview-browser.test.cjs

1. budget preview remains usable around pending/cancelled sharing 390 — PASS
2. budget preview remains usable around pending/cancelled sharing 1280 — PASS

### client-account-legacy-ready-browser.test.cjs

3. legacy CC completes without touching filters 390 ventas-pagos-clientes — PASS
4. legacy CC completes without touching filters 390 clientes-pagos-ventas — PASS
5. legacy CC completes without touching filters 1280 ventas-pagos-clientes — PASS
6. legacy CC completes without touching filters 1280 clientes-pagos-ventas — PASS

### commercial-full-app-metrics.test.cjs

7. opt-in complete HTML fictional boot and historical debt metrics — PASS

### dashboard-notice-rest-independent.test.cjs

8. Chrome: retiring dataEpoch after point editor opens removes the stale form — PASS

### page-demand-readiness.test.cjs

9. Nueva garantía fría resuelve cliente y original fuera de memoria 390 — PASS
10. Nueva garantía fría resuelve cliente y original fuera de memoria 1280 — PASS
11. Nueva garantía fría descarta denied — PASS
12. Nueva garantía fría descarta client-changed — PASS
13. Nueva garantía fría descarta modal-closed — PASS
14. Nueva garantía fría descarta session-ended — PASS

### project-presentation-generic-browser.test.cjs

15. generic saved budget uses actual items/photos and exact documentary totals 390 3 — PASS
16. generic saved budget uses actual items/photos and exact documentary totals 390 35 — PASS
17. generic saved budget uses actual items/photos and exact documentary totals 768 3 — PASS
18. generic saved budget uses actual items/photos and exact documentary totals 768 35 — PASS
19. generic saved budget uses actual items/photos and exact documentary totals 1280 3 — PASS
20. generic saved budget uses actual items/photos and exact documentary totals 1280 35 — PASS
21. generic photos require exact snapshot or unique ready catalog identity, never first fuzzy match — PASS
22. generic multiline descriptions paginate without losing text or repeating quantities — PASS
23. generic incomplete documents show review and never fabricate financial zeros — PASS
24. generic keys, late session responses and PDF fresh-read guards stay read-only — PASS
25. generic PDF rechecks the same canonical document and preserves actual photos and money — PASS
26. generic deleted snapshot is denied initially and after opening before PDF export — PASS
27. valid saved Firebase keys retain backend length and Unicode contract without arbitrary paths — PASS
28. actual HTTPS snapshot photo is shown without legacy scene assets and export uses CORS-safe image loading — PASS
29. unavailable actual photo never blocks opening or PDF and cloned failed photos are removed — PASS
30. saved legacy product identity resolves a unique normalized code and public photo uses existing read-only image route — PASS
31. cover shows the real product photo and keeps title and image apart — PASS
32. cover prioritizes an equipment photo over a company logo on a legacy service row — PASS

### project-presentation-trial-browser.test.cjs

33. project presentation is explicit, read-only and closes on session revocation 390 — PASS
34. project presentation is explicit, read-only and closes on session revocation 1280 — PASS
35. project presentation reopens from fresh items and rate, never fixed pages — PASS
36. late presentation response is discarded after leaving the session — PASS
37. native presentation owns Escape and Enter on Volver never starts a background action — PASS
38. prepared PDF has a persistent download link inside the active dialog and is retired with the session — PASS
39. real grid enhancement and application CSS cannot clip static presentation tables 390 — PASS
40. real grid enhancement and application CSS cannot clip static presentation tables 1280 — PASS
41. real CSS presentation scroll and footer follow the current page 390 — PASS
42. real CSS presentation scroll and footer follow the current page 1280 — PASS

## Evidencias y límites

Directorio privado fuera de Git: C:/SisVentas/tmp/audit-20261122-C.

- browser42-f927.log: log TAP completo, SHA256 9f9e053e62a9b77b59c517a92ba811a1958ed957b9bb2aca7dd1f744f5b79bd2.
- browser42-manifest.json: nombres originales agrupados por archivo, SHA256 583ed6676319d43720b875f7d29fa5c7f6bb7b883c0209d3d3b4cf4b4d0db2e6.
- browser42-results.json: cada nombre/archivo/PASS y cotejo exacto del conjunto, sin datos comerciales.
- Artefacto ficticio de métricas: C:/SisVentas/.local/qa-browser-optins-f927-20261122/tmp/stage1-integral-plan/commercial-full-app-metrics.private.json; no se agrega a Git.

La cobertura de presentación/PDF de estos opt-ins incluye transporte html2pdf simulado o enlaces blob preparados; no certifica una exportación documental con el bundle real, un PDF de producción ni la publicación de presentaciones. Las pruebas de garantía abren/leen y descartan respuestas o cierres con escrituras bloqueadas; no guardan garantías reales. Las rutas HTTPS de fotos se sirven por interceptación local de prueba, no prueban disponibilidad externa.

No se cambiaron producto, expectativas, fixtures, permisos, runtime, índice, versión ni Service Worker. No se ejecutaron emuladores, artefactos privados requeridos por otras pruebas, builds, despliegues, push ni otra suite general. Informe entregado al chat general para que root consolide la evidencia por fuente sin sumar estas 42 a las pruebas globales o a tandas previas solapadas.
