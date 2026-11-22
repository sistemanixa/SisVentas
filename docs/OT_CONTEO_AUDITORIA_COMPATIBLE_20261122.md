# Auditoría del conteo mapeado compatible con la siguiente confirmación

El conteo mapeado de `74337bcf` producía un recibo verificable por el resolver, pero su entrada nueva en `regularizacionesOT` carecía de `signature` y `regularization`, requeridos por el validador del siguiente movimiento físico. La nueva regresión falló con «Auditoría de confirmación inválida» antes de corregirlo.

Se completan sólo esas auditorías nuevas del conteo mapeado con firma SHA-256 del comando, cantidad regularizada y contexto de autor, fecha y tipo. No se cambian recibos, identidades, cantidades, auditorías históricas ni el formato OFF. La prueba ejecuta el modelo real de confirmación física sobre el inventario contado y conserva consumo y general.

Validación focal: 28 PASS, cero fallos y omisiones, combinando comando de conteo y composición explícita con núcleo Stock `01347ba1`. Logs privados `tmp/audit-front-d/count-audit-next-physical-red.log` y `count-audit-next-physical-green.log`. Sin operaciones reales ni activación. El perfil de latencia en curso es otro bloque y no queda certificado por estas pruebas funcionales.
