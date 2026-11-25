# Compras: vínculos descriptivos v2 · 25/11/2026

Entrega local sin commit: cinco modelos y sus cinco tests en `C:/SisVentas/.local/purchases-complete-20261125`.

Modelos: purchase-list-reserve-model.js, purchase-joint-reserve-model.js, purchase-list-generation-model.js, purchase-joint-generation-model.js, purchase-inventory-linked-plan.js (todos en cotizador/). Tests del mismo nombre en test/, extensión .test.cjs.

Nueva vinculación llama planExistingReservation con listKey y allocationKey=saleKey. Guarda planesCompra[listKey] v2 y recibo, conserva general/reservado/consumido. Lista.vinculosInventario es ARRAY; entries exactas {schema:2,productKey,inventoryKey,receiptIdentityKey,listKey,saleKey,cantidad,operationId,ts}. No propaga metadata de referencia. Marca stockExistenteVinculado; no crea stockExistenteReservado ni reservasInventario. Conjunta reúne entries de las listas hijas, conservando identidad completa. CAS originales y referencias de recibo respaldan cada vínculo.

Replay verifica entry+planesCompra+recibo sin depender de stock actual. Generación exige disponibilidad actual. JointReserve al crear vínculos y JointGeneration validan SUMA de cantidades por inventoryKey de TODAS las fuentes de esta operación contra general una vez. No descuentan saldos, no suman planes de operaciones ajenas y no convierten esa comprobación en reserva física. Replay puramente histórico en JointReserve no invalida traza por entrega posterior.

Legacy: registro vinculado preserva reserva física verificada sin duplicarla. Sin evidencia suficiente, REVIEW. Los modelos de vinculación/generación nuevos no migran reservas legacy automáticamente. Recepción actualizada en su test: general11/reservado3 y traza recepcionesCompra; no nueva reserva.

Verificación final: 148 PASS, 0 FAIL, 0 SKIP ejecutando juntos los cinco tests anteriores; incluye 6+6>general10 rechazado y 5+5=general10 aceptado en ambos modelos conjuntos, invariancia de saldos/CAS, planes ajenos, metadata extra, corrupción de proof y replay tras entrega. Sintaxis de cinco modelos y git diff --check correctos. Datos ficticios; sin backend remoto ni publicación.

Límite externo observado en prueba adicional de purchase-list-generation-command.test.cjs: 18 PASS/4 FAIL, Acción financiera no autorizada en labor-guard; main posee integración/Guard/Policy. No se modificó ese archivo ni se atribuye integración completa a los 148 casos puros.

Repetición main contra Root 77e5b176: 15/15 casos de comandos reserva/generación PASS, con Guard/Store genuinos, Financial/History/SourceCost preparados y datos ficticios. Vínculo simple y conjunto comprueban general intacto; el simple también reservado/consumido/enCompra intactos, array schema2 y replay de un solo commit. No emulador ni publicación. Log privado tmp/purchase-vinculos-v2-root-20261125.log.
