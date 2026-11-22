# Incremento 1: resolver y plan puro de vínculo

Base:60cf871c, rama propia codex/audit-20261122-stock. Este incremento no edita consumidores ni habilita endpoint/UI. No modifica guard, claims, recibos genéricos, reglas, permisos, índices o datos reales.

## Implementado

- `cotizador/office-stock-reference.js`: devuelve productKey e inventoryKey separados, mappingRevision/status, sin mutar ninguna entrada. Conserva clave física y recibos históricos. Valida asociaciones bidireccionales, alias compartidos, inventarios duplicados (incluidas referencias históricas y propietarios), inexistencia, servicio/eliminación y cobertura incompleta. Un inactivo exacto sigue identificado como inactivo; no habilita reparación ni reactivación.
- `cotizador/office-stock-link-plan.js`: valida comando y permisos derivados por servidor, compara hash completo y revisión/digest de acceso; propone únicamente asociación/inversa/recibo propio. Misma operación y payload devuelve recibo sin patch; reutilización divergente se rechaza. Plan nunca escribe inventario, catálogo, OT, compras o reservas.

Rutas propuestas (NO aplicadas ni habilitadas): sisventas/stock_vinculos/porProducto/{productKey}, porInventario/{inventoryKey}, operaciones/{operationId}. Cada asociación lleva ambas claves, revisión, operación, UID, observación e instante. Las dos direcciones son idénticas. El recibo es exclusivo del dominio de asociación; no sustituye ni cambia los recibos genéricos de coordinación.

## Entradas confiables y límites

snapshot es producido sólo por un loader autoritativo futuro: producto puntual, inventarios candidatos completos, ambas direcciones de asociación relevantes, propietarios por inventario, propietarios de alias, cobertura catalog/inventory/links/owners y contexto UID/rol/revisión/digest de permisos. Las marcas coverage NO son una prueba de autorización ni pueden recibirse del cliente. El cliente sólo envía id/productKey/inventoryKey/reason/expectedHash. Los permisos actor.active/allowed/productAccess/stockAdjust también deben proceder de las verificaciones existentes del servidor, nunca del body.

El hash compara catálogo, asociaciones, cobertura, propietarios, permisos y TODOS los campos de los candidatos de inventario, incluso costos/historial que jamás salen a la UI. El recibo pasado a plan procede de almacenamiento confiable tras autorización actual; no es un argumento que pueda suministrar el cliente. Las pruebas de replay son de plan, no garantizan persistencia ni exclusión entre procesos.

## Coordinación requerida antes del comando ejecutable

El guard existente ofrece scope.get, scope.query, scope.beforeCommit y scope.update; se debe usar su lease/exclusión y su relectura final. El store existente invoca office-stock-policy.validate y esa política sólo emite capacidad de conteo con rutas de inventario y resumen. No reutilizar esa capacidad para el nuevo patch. Tampoco agregar una operación sin validar sólo porque no activa la rama de la política anterior.

Hace falta acordar con coordinación una política/capacidad específica de asociación y su punto de integración en labor-rtdb-store/validadores, manteniendo guard/claims/recibos genéricos intactos. Hasta ese acuerdo no hay comando conectado a guard ni endpoint. Las reglas/índices nuevos se prepararán como propuestas con emulador, sin aplicar remotos; Java existente puede usarse. Esos cambios deben revisarse antes de habilitar escrituras, aun cuando los consumidores utilicen el resolver.

El loader compartido debe asegurar cobertura acotada por índices y mantener los campos productKey/inventoryKey distintos. Todos los escritores deben leer mapping bajo la misma coordinación antes de calcular un delta y verificar mappingRevision antes del commit. No basta comparar sólo un mapping ni sólo probar este módulo puro. Sigue vigente el contrato de60cf871c y sus cuatro pruebas de divergencia.

## Evidencia

27 casos nuevos de resolver/plan y4 regresiones de escritores:31PASS,0FAIL,0SKIP. Conservación profunda de inventario y originales, patch limitado a3rutas nuevas, admin/administrativo, actor revocado/Ver como/rol inválido, cambio de cada rama del inventario, catálogo/propietarios/permisos concurrentes, replay/respuesta perdida, duplicados, metadata histórica, claves peligrosas, asociación/inversa divergente, huérfano elegido explícitamente y producto inactivo exacto. Sintaxis de ambos módulos y git diff --check correctos.

Primer intento27PASS/1FAIL detectó que un cambio concurrente de alias lanzaba error semántico antes de clasificar CAS. Se corrigió el orden: el plan compara hash/contexto primero y luego resuelve el snapshot validado. Se añadió detección de segundos inventarios ya asociados por metadata. No se relajaron expectativas ni se omitieron pruebas. Sin navegador, servicios, red o datos reales.

Comando: node --test test/office-stock-link-plan.test.cjs test/office-stock-link-writer-contract.test.cjs. No suite general (reservada al coordinador), emulador aún no ejecutado. Siguiente incremento pendiente de revisión: loader/consumidores y protocolo de commit; UI después de todas las carreras.
