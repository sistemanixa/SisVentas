# Revisión del pin nativo de Stock publicado en v3.21.12

La prueba conservaba SHA256 ec94803f75ea15249acbe75ff9144fb90526c1e70e028a15023a74ff36cc1429 de office-stock.js, correspondiente a b624bf4cd4063a0c19fae5ee22df47eb3b137d61. El cambio ya publicado v3.21.12 es cffdc959c36fc6ce5343f72b2c3707d755fb5370, con padre exactamente b624; SHA256 del archivo publicado: 1752ec80411b82c91c8d5c63d1093c49bc852ea7d47ef901a51c53895d9bb20a. No es un cambio de esta candidata15.

La revisión identifica sólo dos bloques:

- list: resumen vivo completo, orden numérico descendente antes de paginar100, cursor estable por cantidad/clave, incluye reservas positivas aun con general0, mantiene revisión para referencias inválidas, opción compact sin consultas a productos. El resto conserva resolución de producto. Un producto inactivo con vínculo directo puede presentarse para conteo a cero.
- save: veta productos eliminados; un producto inactivo sólo admite conteo0 si el vínculo de inventario es directo y existe registro. Conserva lectura por usuario/rol, guard coordinado, expectedHash/CAS, Model.plan, comprobación fresca del producto y referencias, Policy.issue y único scope.update.

No se sustituye el pin nativo por el nuevo hash. La fixture reviewed-stock-v32112-blocks.json contiene los dos pares before/after exactos y procedencia Git completa. La prueba exige cada after exactamente una vez, reconstruye el source nativo anterior y exige su hash original ec948. Una diferencia dentro del bloque revisado, fuera de él o en otra función sigue fallando. Los restantes pins de Stock/OT y la reversión Accounts-v2 no se modificaron.

Evidencia: 22/22 pruebas de preservación nativa/ajustes,0skip, y2/2 focales compactlist/adapter; tres adversariales nuevos rechazan pageSize101, agregado externo e historia renombrada. Los ajustes conservan reservas, recibos, costos, precisión, auditoría desconocida, replay y rechazo de conflictos. No se ejecutó un navegador nuevo. Un primer intento amplio no resolvió Playwright; no se cuenta como verificación UI. No se editó código de producto ni reglas/despliegue/datos reales.
