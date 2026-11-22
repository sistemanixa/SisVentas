# B · OrderWriter cerrado y metadata de orden · 22/11/2026

Preparación OFF en archivos nuevos. No se editan SharedGuard, store, núcleo Stock, mantenedor C, API ni CONTEXTO_ACTUAL. Requiere C d01a75c7fdda856d248ce26feb4b60049feb3de6 y modelo e966f2994b2b84c3215c93d66c5eecd7c8e10763; importados para composición en B. El principal integra hook/store y valida consumidores reales. No hay activación, escritura remota, bandera cliente ni nueva autoridad comercial.

## Política sin IO

`cotizador/office-stock-order-policy.js` inspecciona únicamente el marcador WeakMap real de C; clones, JSON y pruebas inventadas se rechazan. Vincula actor uid/claims/rol/revisión/digest (mediante inspect de C), lease propio/op/digest/fence/expiry y contexto de modo/acción/operación. Comprueba hashes de fuentes y derivados inspeccionados, ausencia de superposiciones, receipt genérico propio y cierre del guard. Guarda capacidad privada WeakMap y hash del parche FINAL completo. validate y token no hacen GET ni consultas; las relecturas/CAS siguen en C antes del PATCH y los permisos/cohorte/revisión se comprueban en Rules.

API sin callback: `issue(actor,lease,{proof,patch,now?})` sincrónica admite exclusivamente fuentes inventario de C, resúmenes verificados, único fence, receipt propio y guard=null. Rechaza money, OT adicional, metadata ajena y extras. `validate(actor,lease,patch,now?)`, `token(actor,lease,now?)`, `reservedClaims()` (version0) y `sanitizeClaims()` (quita TODO prefijo svStockOrder). Sin capacidad no se aceptan ni metadata ni rank/hash sueltos. Una operación ajena sin esos derivados queda intacta.

API de integración: `create({authorizeSourcePatch})` configura un validador SERVIDOR por factory. Su `issue` es async y recibe las mismas entradas; llama al validador con `{actor,lease,patch:basePatch,projection}`. El contrato del validador es void/throw: debe verificar las políticas tipadas originales; no puede devolver booleanos de autorización. Se admite promesa para componer validadores existentes, pero esta política no incorpora IO. Un callback en options/body/actor no se usa. El hash del parche completo se coteja después del await y queda ligado hasta validate. Las políticas originales continúan autorizando toda escritura comercial; OrderWriter no las reemplaza.

`strip({actor,lease,proof,patch,now?})` antes de issue, y `sourcePatch(actor,lease,patch,now?)` con capacidad ya emitida, devuelven copia para las políticas originales: retiran SÓLO el único Order.FENCE y Order.RANK/Order.HASH de cada resumen padre previamente verificado por C. Nunca retiran costos, originales, otros campos, receipts ni escrituras ajenas. No superponen hijos al padre y no mutan el parche original.

## Reglas de metadata, sin concesiones de fuentes

`scripts/lib/stock-order-metadata-rules.cjs` clona la candidata recibida y agrega sólo `sv_office_stock_order_config` y `sv_office_stock_order_fence`. Config tiene write=false; lectura únicamente servicio privado. Fence exige servicio bajo coordinación actual, user/command actual, identidad/rol/revisión, reset/version, configuración ready/writersClosed, generación compartida de activación, pins de Activation.predicate, siguiente revisión exacta y deltas de conteo de la capacidad. Forma exacta del fence, enteros seguros y cero inválidos. No crea write grants para inventario, resúmenes, rank/hash ni dinero.

Rechaza ancestros raíz con grant, metadata existente sin revisión y comodines no interpretables. Excluye ambas metadata de concesiones comodín raíz existentes preservando otros dominios; manifiesto enumera sólo esas exclusiones y las dos raíces. El activador/pins son los mismos de Stock/Compras/OT, sin bandera alternativa. RTDB no verifica Ed25519: C debe usar el verificador privado real de cohorte del servidor; la fixture es explícitamente un doble de servidor.

## Evidencia y límites

55/55 focales PASS (incluye19 C y36 B), 0IO adicional para 1/6/12 inventarios. Cubren copia/forja/vencimiento, UID/fence/contexto, cambios posteriores del original/derivado/fence/receipt/extras, mixedmoney, callback en body, booleano, rechazo y mutación concurrente durante validación; strip con restauración exacta e inexistencia de mutación; CAS de C por revocación. Sintaxis/diff revisados.

22/22 emulador aislado PASS: positivo metadata con proof C real y actor user, actor command de servicio, forjas de versión/generación/revisión/delta/permiso/lease; revocación tardía de rol, actividad, reset, permisos, cohorte, ready, fence y expiry; extras/config/money/source denegados. En esta fixture los grants comerciales están CERRADOS. El PATCH positivo aísla fence+receipt+guard: no es una integración completa de Stock/Compras/OT ni demuestra autorización de sus fuentes. La prueba de política sí verifica el parche C completo y original sin IO.

Emulador propio limpiado y detenido. Logs privados stock-order-policy-final-20261122.private.log y stock-order-metadata-bound-final-20261122.private.log. No se ejecutó puerta global. Pendientes de Root: wire hook tras Operational y sus fresh checks, callback de políticas originales, reserved/sanitize en store, validate/token al final, empaquetado y matriz real de consumidores/replay/ACK sobre candidata compuesta y reglas actuales. No declarar readiness ni publicar a partir de estas pruebas.
