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
