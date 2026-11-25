# Contratos de integración de Compras · 25/11/2026

Base pública conservada: 37e1cbab, v3.21.15. Trabajo aislado codex/purchases-complete-20261125. No se habilitan rutas ni se publica en este frente. El borrado revisado vigente se conserva; no se reemplaza por la implementación antigua.

## Enum compartido con E

purchase-route-contract.js exporta specs y byOperation, contenedores, entradas y arrays fields profundamente congelados. Contiene trece acciones. Coincide con los wrappers recuperados de 33a93d32: incluye listReserve y exchangeRate opcional en orderReconcile; no renombra cancelar-preparacion. El nombre público de capacidad listPreparationCancel debe mapearse explícitamente a la acción interna listCancelPreparation. No aceptar miembros heredados del prototipo ni acciones elegidas por el cliente.

El wire de cada acción contiene sólo los fields presentes del enum; el kind semántico es interno y no se agrega al digest de transporte. Alta manual y generación conservan sus ramas estrictas específicas. Recepción/edición usan el body literal de inventario. La recuperación es POST /laboral/operacion; toda escritura devuelve ok, committed y operationId iguales al id original.

## Numeración y lecturas paginadas

La asignación consume sólo sv_purchase_numbering/state con ocho campos exactos: schema:1, generation, revision, lastNumber, bootstrapOrderCount, bootstrapHash, cohortDigest, lastOperation. Contador y órdenes se escriben en el mismo PATCH. Se conserva bootstrap/cohort/generation; revision/lastNumber aumentan por cantidad de órdenes. Ausencia exige bootstrap de B, no se supone cero.

Para bootstrap, únicamente sisventas/ordenes y sisventas/ordenes_compra; orderBy:'$key', limitToFirst entero de 2 a 129, startAt opcional de hasta 769 unidades (clave 768 más sentinel). Sin orderByChild, rutas hijas, filtros arbitrarios ni lectura ilimitada. El consumidor purchase-numbering no ejecuta el scan ni escribe el bootstrap. El máximo histórico debe incluir sufijos de numero y legacyNum sin perder ceros significativos de la identidad; B es dueño del protocolo verificable.

## Dependencias y hooks del principal

La referencia publicada todavía no tiene office-stock-explicit-reference, stock-link-activation-contract, office-stock-reference-io, office-stock-reference, office-stock-reference-port, office-stock-order e initial-inventory-reference. E/B deben entregar su cierre transitivo y autoridad genuina. No sustituirlos por callbacks confiados, flags o inventario cero inventado.

Guard: permiso ordenes.editar sólo con Policy.isBound; begin sobre PATCH base antes de validar costos; pasar lease a validateChangedCosts; sealDerived después de las proyecciones reales; validate final sobre fuentes frescas. Store: emitir exclusivamente claims de purchase-source-cost-protocol desde autoridad privada sellada; conservar Financial/History activados y queryPageFresh en precommit. El puente sale-cost-correction para receive/prepare/reconcile se entrega al dueño compartido, no se edita desde este frente.

Runners: purchase-manual-create-command.create({authorize,store,guard,assertAdmission,creationReferencePort,numbering,...}), purchase-list-generation-command.create({authorize,store,guard,assertAdmission,listReferencePort,numbering,...}), purchase-inventory-command.create({authorize,store,guard,resolveReference,editReferencePort,assertAdmission,queryPage,linkedEnabled,...}) y purchase-actions.create({action,authorize,store,guard,assertAdmission,numbering,referencePort,queryPage,...}); todos con enabled:false por defecto y execute(req,body). Revisar nombres exactos de parámetros de las fábricas al componer, no inyectar aliases.

HTTP: crear e inventario 64KiB, preparar 3MiB, guardar 512KiB, resto 16KiB; documento nuevo máximo 1/op y 2MiB decodificados con SHA/magic/base64 validados. Mantener el endpoint eliminar existente y sus límites revisados propios.

## Trabajo y validación

486 pruebas de modelos recuperados pasaron en la copia nueva (log privado purchases-resumed-pure-20261125.log). No acreditan todavía wrappers/guard/store/emulador, nuevas rutas ni publicación. Continúan edición stockextra explícita, composición conjunta receive→reconcile→cancel con SourceCost V2, disponibilidad de preparación y aplicación UI a la fuente actual.

El árbol ajeno purchase-backend-completion-20261122 conserva 11 archivos modificados y 2 nuevos; sólo se lee para revisar cambios, nunca se sobrescribe ni se integra como una rama completa.

## FX de edición cerrado

Dentro de declaration: exchangeRate opcional, number finito mayor que cero y hasta 1e9, exclusivamente currency USD. Obligatorio para SKU nuevo o unitCost nuevo; sin default ni FX histórico inferido. publicPrice siempre ARS. El modelo conserva base USD y captura ARS separada con actor/fecha de servidor. Wrapper rechaza presentes undefined/null/boolean/string/NaN/infinito/0/negativo y quote en ARS antes de consultar fuentes. E debe ampliar su whitelist estricta de declaración; Policy liga el campo al digest literal del cuerpo. No activar UI/backend con wire desactualizado.
