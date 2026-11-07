# Overlay conjunto CC y vínculo OT

Hereda por digest la candidata CC verificada sin tráfico. El único cambio nuevo
es una rama estricta de `validLink` en el modelo OT desplegado, cuyo hash debe
coincidir exactamente. No cambia runtime, permisos de usuario, importes,
comisiones, inventario o recursos. El script rechaza bases desconocidas y
aplicaciones repetidas. Las reglas emparejadas se generan sin IO mediante
`scripts/lib/ot-lifecycle-missing-primary-rules.cjs` y se prueban en emulador.
No ejecutar un cierre real como smoke test. La publicación exige el conjunto
verificado, no sólo la imagen ni sólo las reglas.
