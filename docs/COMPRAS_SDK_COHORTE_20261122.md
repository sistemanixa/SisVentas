# Cierre SDK de Compras: cohorte única y composición local

Incremento separado de `27d56399`. Todo OFF, sin activación, ruta nueva,
despliegue ni cambios de producción. No hay flag purchaseInventorySdkClosed.
El prototipo booleano previo fue descartado; sus logs privados no son aceptación.

## Regla candidata y contrato firmado

`purchase-inventory-sdk-cut-rules.prepare(input,{activationPins})` reutiliza
`stock-link-activation-rules.predicate` de B. Sin pins devuelve la entrada intacta.
Con pins cierra únicamente órdenes, listas y sus resúmenes; catálogo e inventario
siguen bajo el builder de B. Cada concesión original sigue siendo necesaria.
No agrega read/write grants, configuración ni autoridades. Es idempotente.

Con la misma cohorte activa exige el fence nativo para escritores existentes;
fuera de cohorte conserva Link0. Para el NUEVO escritor ordenes.editar exige
además la cohorte activa en la propia regla del registro: si se revoca después
del último check de aplicación, el PATCH completo se rechaza atómicamente.
No afecta ordenes.eliminar ni convierte ese permiso en edición/preparación.

Sobre el builder confirmado de B sólo modifica seis `.write`: el comodín de
sisventas, record de orden/lista y record de sus tres resúmenes. No cambia
validadores, lectores, índices ni archivos fuente de reglas. Los índices provienen
de B `fb96de1a476cf9337ea0761a15f733fa290f6991`, no de un espejo inventado.

## Escritor de conteo legado

`inventory-count.js` envuelve su transacción existente sin cambiar permisos
admin+ordenes, diseño, cantidades o lógica de conteo. Si está instalada la
admisión interna, exige prueba derivada verificada de la cohorte común, ligada
a sesión y digest de cohorte esperado. Corte activo, firma/cohorte no verificada,
error de red o sesión obsoleta bloquean antes del SDK, sin fallback.
Una modificación posterior al envío se informa incierta y no inicia otra escritura.

La UI NO lee configuración privada mediante SDK. loadVerifiedAdmission es un
puerto interno futuro autenticado, no un booleano del formulario. No está instalado
desde index ni se crea un endpoint en este incremento. Sin instancia, OFF conserva
el recorrido anterior; aun una UI vieja sin este módulo queda bloqueada por las
reglas de B cuando se active correctamente la cohorte. Ninguna protección de
servidor depende de que el navegador cargue este helper.

## Composición realmente ejecutada

Copia aislada desde central `eee3ff6d`, con originales confirmados de E
`5ee57ee0da180afa9d75d3cc1e909b91be946aa5`, guard root `7f1c700c` y sus
queryPageFresh, builder/índices B `fb96de1a`, comando propio `27d56399` y esta
extensión. No se modifican worktrees de E/B ni el central.

Emulador exclusivo 127.0.0.1:9059, namespace demo-purchase-sdk-cut-20261122.
Copia completa privada con SHA256
`ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db`.
La prueba genera firma Ed25519 efímera y usa exactamente los mismos pins/digest
en runtime y reglas. Sin datos reales ni credenciales reutilizadas.

7 PASS, 0 FAIL, 0 SKIP del archivo explícito de emulador, incluyendo:

- SDK conservado con cohorte ausente; retirado también DESPUÉS del lease.
- Usuario SDK no puede quitar el marcador privado.
- Cohorte/firma/código Compras incorrectos no admiten nuevo escritor.
- Guard/store existentes legítimos conservados con fence.
- register→receive→replay con guard, store REST y queryPage REAL, resolver E
  dirigido, sin fake config/index; una recepción, costo preciso, autor/precio intactos.
- Catálogo SDK no puede cambiar durante el comando; phantoms de catálogo,
  inventario y mapping insertados por owner ficticio se detectan en consultas frescas.
- Revocación de cohorte JUSTO antes del PATCH, después de checks de aplicación:
  orden/inventario/recibo permanecen sin modificación parcial.
- Quitar el índice de catálogo produce rechazo real de store.queryPage, no un vacío.

La recepción del ensayo es manual, no vinculada y con ledger OT vacío. No se
presenta ese positivo como validación de recibos antiguos no demostrados ni de
órdenes enlazadas. Estas últimas continúan rechazadas por el comando hasta su
incremento completo; no se habilita parcialmente Compras.

SHA256 de JSON.stringify(candidata) para los pins FICTICIOS de este test:
`275b253c14277ce882f0db920bd3bf9a230dd6ba4a331fe6dcd5a559a0ffd3da`.
No es un hash de una candidata de producción ni autorización para usar esos pins.

El test requiere SV_CATALOG_RULES_FILE y SV_STOCK_REFERENCE_ROOT apuntando a la
composición confirmada; el segundo aporta núcleo E real, nunca WIP. No copia
reglas completas, llaves, documentos firmados ni artefactos privados a Git.
Log privado final: tmp/purchase-sdk-cut-20261122/directed-real-rest.private.log.
Pruebas unitarias separadas cubren builder y wrapper real de conteo; suite general
la ejecuta el coordinador. La activación sigue bloqueada hasta cierre de TODOS
los consumidores, reglas/cohorte revisadas y plan de corte expresamente autorizado.
