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

## Cierre del transporte completo con Root554f608d

Se incorporó únicamente la fixture confirmada Root554f608d4a22cd2450c46880768dd73749adb755 (dependencia local60f3780d); no se editó el helper ni Store/Guard. Nueva prueba inventory-linked-full-rules.integration compone Command, SharedGuard, Financial TRUE, Order ON y Store reales. El adaptador conserva body, método y UID de auth_variable_override; sólo convierte ese contexto a JWT ficticio para el emulador propio. Usa Date.now para que el lease sea real respecto del reloj del emulador. Cohorte firmada de laboratorio es única para admisión del comando y mantenedor C, con rulesDigest de la candidata exacta.

Primero fallaron3/3 antes del PATCH por CAS esperado de objeto en memoria: RTDB serializa referencias numéricas como arrays. Se obtiene expectedHash/expectedRevision de la orden REST real, como haría el lector del usuario; no se relaja digest ni se recalculan precios/catálogo. Con ese ajuste las dos revocaciones alcanzaron el PATCH, pero el positivo seguía401.

Diagnóstico ficticio restaurando el mismo estado y guard entre ensayos (sin cambiar reglas) aisló mínimo8rutas204, páginas y cuentas204; Historial y dependencias financieras401. Causa exacta: EA no contiene sv_client_history ni sv_sale_financial_dependencies. No eran flags incorrectos ni permiso que debiera ensancharse. Se conservan logs del rechazo original. Los subconjuntos sólo fueron diagnóstico: no se usan como evidencia positiva ni se recortó el PATCH final.

El principal autorizó exclusivamente laboratorio con los dos constructores de opt-ins existentes: client-history-write-rules y sale-financial-write-rules, ANTES de Link. Se añade opción offline preparedFinancial:false por defecto; true compone esos constructores ya revisados, no capacidades nuevas. La nueva alternativa SourceCost conserva además los cierres condicionales de ambos protocolos cuando están instalados, para no saltarlos mediante su OR. Nuevas raíces privadas siguen sin lectura de cliente. No representa el estado actual de producción ni activa una migración SDK.

Candidata PREPARED con pins ficticios:582ff287cd9b11ba19ee266267eb35cd3cbb67d0f38611923efb3c136a64556e,3957636bytes,diff234atributos. Default sin esos dos opt-ins conserva d12f2163dc136949f75f14b9c3df637c0e4fb0668742f2addf86670bd5f5cd6c. Cada manifiesto identifica preparedFinancial, etapas y hashes; no incluye expresiones de reglas.

Validación final:3/3 receptor completo PASS: recepción exacta y replay sin segundo PATCH; revocación tardía de revisión de permisos y generación de cohorte rechazadas en el PATCH real. SourceCost1+Order1+Financial1+History1 se verifican desde override del Store real. Se exige presencia de TODAS las proyecciones de Historial/dependencias en el parche, no se omiten las rutas bloqueadas. Pagos, gastos/comisiones, cuentas y trabajos históricos quedan idénticos; costo22 y precio público100 según fixture. El resolver de referencia de compra sigue inyectado como dato de servidor de la fixture: esto no valida todo el universo de mappings E ni la aplicación/UI.

Control separado default sin opt-ins:16/16 PASS. Focales finales:14/14 PASS (incluyen los10 Root de composición/reintentos y cuatro B). Logs privados inventory-linked-full-confirmed-20261122.private.log e inventory-combined-default-confirmed-20261122.private.log. Ambos emuladores limpiados y detenidos; EA intacta. Diagnóstico temporal no queda en el test entregado.

Se cierra este bloque de laboratorio. Permanecen OFF y pendientes operativos de Root: cohorte/pins finales, inventario exhaustivo y cierre de todos los escritores, empaquetado y límites de validación reales, reglas y flags remotos. No se aplicó SDK cut ni se declara activación/readiness productiva. No se amplían modelos/capacidades en este cierre.
