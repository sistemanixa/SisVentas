# B · Candidata combinada de inventario · 22/11/2026

OFF, sin reglas remotas, credenciales, UI ni datos reales. Base de código confirmada f927f74a505fcc1712e254cf99cb05aec5e2c5f7 en checkout aislado B. El helper SDK cut A8c fue importado separado como ff17fb8b; central ya lo integró por otra vía y no debe duplicarlo. No se modifica CONTEXTO_ACTUAL ni Store/guard/core/mantenedores.

## Constructor y manifiesto

scripts/lib/inventory-combined-rules.prepare(raw,{activationPins}) compone, en este orden: Link (incluye Catalog e índices), corte SDK de Compras, metadata Order, SourceCost, restauración de scope Link1 y dos validadores de resumen de Order. Todos reciben el mismo conjunto de pins. No lee archivos ni aplica reglas. Retorna rules y manifiesto con SHA de cada etapa, tamaño, diff de atributos con hashes y presencia (sin valores/expresiones privadas), y submanifiestos.

Se verifican concesiones raíz sin alteración. El padre ventas se conserva respecto de la etapa anterior a SourceCost: su concesión histórica ya fue estrechada por la restricción global Link1. No confundir estrechamiento con una nueva autoridad. SourceCost sigue sin grant padre.

Hallazgo de composición: grants nuevos agregados DESPUÉS de Link podían omitir su exclusión CAP-only. El paso final agrega outsideLink1 AND únicamente a Order.FENCE/.write y al .write de la hoja SourceCost. No restringe Link0/ausente ni modifica otros tipos de capacidad.

## Validadores de resumen necesarios

Primera candidata compiló pero dio13/14: positivo dual SourceCost1/Order1 rechazado. Causa: EA compras_resumen/inventario_operativo/$record/$other/.validate=false y no había validadores nombrados de _svStockRank/_svStockSourceHash. Las verificaciones previas aisladas no cubrían ese resumen comercial.

Nuevo stock-order-summary-rules agrega SÓLO esas dos hojas .validate y el índice de consulta rank (conservando todos los índices previos). No agrega .write y conserva $other=false y las políticas originales del resumen/fuente. Los validadores heredan la condición completa de Order fence con contexto reubicado a raíz/fence; literal de claves/pins entre comillas se conserva. Exigen fuente, general/revisión espejados, tipo rank numérico negativo y hash64hex. Para general numérico también comprueban rank===0-general. Para general string no se afirma conversión Number(str) por RTDB: el cálculo exacto y SHA siguen en la prueba C y validación del parche final del servidor.

El constructor revierte en memoria exactamente las dos hojas y el índice añadido y verifica recuperación SHA idéntica a la candidata previa. Esto se ejecuta también sobre la base privada EA, no sólo fixture mínima. Hash previo/restaurado:702e89914ed99a72f92e787755ef6769e5cd7697e1ac171a864fa561826b14c2.

## Evidencia hasta este checkpoint

Base privada RAW:ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db, conservada sin modificar ni exportar. Candidata con pins ficticios: d12f2163dc136949f75f14b9c3df637c0e4fb0668742f2addf86670bd5f5cd6c,3848237 bytes,diff228 atributos. No es el digest de una cohorte final autorizada.

16/16 emulador completo EA PASS. Positivo: Linked.build/Policy.begin/sealDerived/validate de A, Operational y proyección C reales, checks frescos y capacidad Order privada, dos familias de claims1 simultáneas y patch conjunto exacto. Segundo positivo: cancelación A tipada que conserva general='10' con capacidad C, no se excluyen cantidades históricas en texto. Negativos: ausencia de cada capacidad, revisión Order, venta/orden ajena, permiso/fence/cohorte, actor inactivo, readiness/acción revocadas, mezcla Link1, dinero extra, metadata desconocida y rank numérico falso. Emulador propio limpiado y detenido.

Cuatro focales de pipeline, pruebas conjuntas y reversión exacta PASS. Log privado inventory-combined-plan-final-20261122.private.log. Los hashes/manifest no incluyen reglas privadas. No se ejecutó la puerta global.

## Límites y continuación

Estas pruebas anteriores emiten claims desde los sellos reales pero todavía no ejecutan el receptor completo Command+Guard+Financial TRUE+Store real contra RTDB. El helper Root554f608d será incorporado como dependencia confirmada y se conectará al emulador con UID/body intactos. No declarar receptor completo por los planes/sellos. La firma de cohorte es verificada por runtime; RTDB verifica semántica, no Ed25519/SHA/WeakMap. Las políticas originales siguen autorizando las fuentes comerciales. Todo permanece OFF.
