# Preservación nativa de Stock: derivación revisada

Base aislada `3510ef2f`. La prueba de preservación conservaba hashes anteriores
al arreglo autorizado `d052768a`; no se sustituyen esos hashes.

Se reconstruye la fuente anterior revirtiendo únicamente dos bloques exactos:

- `office-stock.js`: dos guardas `p.eliminado===true` en lecturas puntuales y
  una en el guardado. Se exige su presencia y multiplicidad exactas.
- `office-stock-model.js`: retirada de la excepción por conteo igual al anterior.
  Se repone exclusivamente esa excepción para comparar el hash original.

El segundo cambio pertenece al mismo commit autorizado: permite registrar una
confirmación explícita sin alterar saldos. La regresión vigente verifica evento
único, conservación integral e idempotencia en modelos cliente y servidor.
No es una modificación funcional adicional de esta revisión.

Las pruebas adversariales rechazan quitar, debilitar o duplicar las guardas,
cambiar operación, agregar contenido ajeno o alterar el cálculo del modelo.
Los demás archivos nativos mantienen comparación exacta y la derivación Accounts-v2
preexistente no se modifica.

Resultado: 27 PASS, 0 FAIL, 0 SKIP en preservación nativa, rechazo de producto
eliminado por detail/history/save y ajuste de Stock. El primer intento obtuvo
25 PASS/1 FAIL porque dejó visible el segundo hash del modelo; no se ocultó.
Sin navegador, producción, reglas, claims ni cambios de producto. La puerta
general corresponde al coordinador. Logs privados en tmp, fuera de Git.

## Extensión revisada de lectura ordenada, 22/11/2026

El listado opt-in del commit02ba0c58 modifica explícitamente el lector de office-stock.js; por eso la prueba de preservación del bloque anterior rechazó su hash. No se sustituyó el hash nativo ni se retiró la prueba. La fixture pública reviewed-stock-order-source.json contiene únicamente los hunks exactos de ese cambio revisado y hashes anterior/posterior. El helper los revierte en orden inverso, exige coincidencia literal y, para la fuente exacta, acredita el hash del predecesor. Después se reconstruyen los tres guardas de producto eliminado como antes y se compara el hash nativo original.

Alterar el lector dentro de un hunk se rechaza; cambios ajenos, debilitamiento/duplicación de guardas y modificaciones de la operación de ajuste siguen fallando.11casos de preservación PASS sobre la integración local, incluidos los adversariales existentes y uno nuevo del lector. Esta derivación admite sólo ese parche autorizado de lectura; no certifica código futuro, activar orden global ni nuevos consumidores sin revisión.

## Consumo físico explícito revisado

La integración 5aacb179 y 64b175f3 añade el consumidor físico opt-in de E y su identificación en el listado de C. La nueva fixture reviewed-stock-mapped-source.json invierte únicamente esos hunks contra d59f66a6, antes de invertir el lector ordenado anterior. Conserva hashes nativos originales y falla ante alteraciones en el resolver, validación fresca, cantidades o cualquier código no revisado. Esta derivación demuestra preservación del resto; no sustituye pruebas funcionales del consumidor ni certifica activación de la cohorte.
