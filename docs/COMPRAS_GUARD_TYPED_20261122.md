# Compras: hook local de autoridad existente y capacidad typed

Dependencias: capa pura `c8294731`, política OFF `23189e00`. Hook separado del
guard sobre base `8fae41a3`; integrar por función con la entrada stock.ajustar de E,
sin reemplazar su tabla ni su validación. No hay handler, ruta ni frontend nuevo.

## Autoridad aprobada

Se agrega únicamente `ordenes.editar` al mapeo existente de validateFinancialContext:
módulo ordenes, grupo ordenes, acción editar, defaults admin/administrativo.
Conserva overrides, módulos bloqueados, revisión y digest. Para esta entrada exige
además una capacidad WeakMap interna y uno de cuatro nombres cerrados:
purchase-inventory-register/edit/cancel/receive, coherente con input.kind.

No acepta acción elegida libremente, acción Stock ni tipo delete. Eliminar conserva
ordenes.eliminar y su política actual. Los cuatro tipos son edición de una orden;
no habilitan reservar para ventas, conteo, devolución OT ni cambios genéricos.

La política deriva preparación de la orden original del servidor: register con
listaMaterialesId requiere ADICIONALMENTE balancecompra Y ordenes y ausencia de
bloqueo de ambos módulos. Un booleano del body no puede quitar esa condición.
confirmPlannedPurchase/closePurchase completos todavía no están conectados y
deberán conservar esa conjunción en sus comandos específicos. No se autoriza
asumir que permisos de venta o un actor automático equivalen a Compras.

## Plan exacto y exclusión

La capacidad liga actor/claims completos/rol/revisión/digest, tipo, input completo,
operationId, transportDigest y lease/fence. Sólo acepta orden original completa
con hash esperado, patch servidor de esa orden e inventarios identificados y los
originales exactos correspondientes. No hay función HTTP que acepte ese patch.
La API issue es interna para un plan calculado por modelos; no es un validador de
patches enviados por clientes ni deriva por sí sola una recepción comercial.

Al terminar todas las comprobaciones finales del guard, se repiten sesión/reset,
perfil/permisos y originales, y se compara el commit completo con el plan sellado.
Las únicas diferencias técnicas admitidas son las proyecciones exactas calculadas
por operational-read-model.plan cuando ese mecanismo está habilitado y preparado,
más el recibo/fin del guard. Todo destino o valor ajeno se rechaza. Sin claims ni
hook nuevo en store; no se modifica la política Stock ni la de eliminación.

El modelo/política todavía no admiten una recepción vinculada que deba guardar
costos de venta en el mismo commit: antes de conectar ese caso hace falta su plan
comercial completo y proyecciones, con autoridad/CAS propios. No guardar primero
inventario y después venta. Tampoco se declara resuelto register planificado por
comprobar una orden ficticia enlazada a lista sin toda la generación comercial.

## Evidencia y límites

Antes de agregar el hook: 19 casos del guard real, 8 PASS/11 FAIL, entre ellos los
positivos rechazados por acción financiera inexistente. Después: 19 PASS, luego
24 PASS con negativos de autoridad ampliados. Store ficticio en memoria; guard,
modelos y proyección operacional reales. No se ejecutó el store REST ni emulador
para esta entrada de autoridad: ninguna regla ni admisión remota está activada.

La matriz incluye cuatro tipos con resúmenes ON/OFF, autoría/precio público y
ledger OT conservados, ACK perdido con un solo commit y un solo work, cambios
tardíos de revisión/digest/rol/acción/reset/orden/inventario, capacidad ausente,
destino ajeno, preparación sin Balance, técnico sin override, edición denegada,
módulo denegado, acción ausente/Stock, default administrativo y tipo arbitrario.
Los planes de orden del fixture de composición son mínimos: no acreditan todos
los cálculos de costos, proveedores, índices o formularios de una recepción real.

Última tanda, repetida tras exigir correspondencia exacta patch/originales:
91 PASS, 0 FAIL, 0 SKIP: 24 guard, 5 policy, 52 modelos/puertos/eliminación y
10 preservación nativa.
No sumar tandas repetidas como casos distintos. Sintaxis/diff verificados.

Pendiente: composición con SHA confirmado del hook de Stock de E, adapter de
callback común estable, comando fuente+inventario completo OFF, validación con
reglas completas y cierre SDK posterior al lease antes de cualquier activación.
La nueva dependencia purchase-inventory-policy.js también requiere incorporarse
al empaquetado de una futura imagen antes de desplegar un guard que la use.

Logs privados C:/SisVentas/tmp/purchase-inventory-*.log. Sin datos reales, reglas
remotas, producción, publicación ni suite general desde este frente.
