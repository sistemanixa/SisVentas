# Cierre de escritores del borrado por venta

Propuesta offline sobre el baseline exacto revisado. No aplica reglas, no modifica originales y no activa capacidades. El nuevo índice vive únicamente en `sv_sale_delete_relations`; no instala History ni `sv_sale_financial_dependencies` y conserva el contrato nativo de OT.

El constructor `sale-delete-targeted-current-rules.cjs` conserva las etapas del candidato LIVE y agrega el cierre de escritores. Cada autorización existente de las 16 fuentes permanece como operando independiente de AND, incluidas las autorizaciones en el padre de una colección y los comodines de `sisventas`. Una autoridad desconocida en la raíz requiere revisión; no se sustituye para hacer pasar pruebas.

Sin índice antes ni después del commit, continúa la autorización previa. Con cualquier estado del padre instalado, incluso parcial o no listo, un escritor debe mantener el índice o fallar: no existe excepción de SDK por estar el lease libre. Se exige el claim reservado `svSaleDeleteRelationsWriterVersion:1`, derivado por Guard del mantenimiento real, el fence de usuario/servidor con recibo y liberación, configuración y cobertura schema2 listas, la misma generación y revisión exactamente anterior+1. La configuración no puede apagarse ni retirarse mediante una escritura ordinaria.

La instalación inicial es una operación administrativa separada: action interna literal `ventas.eliminar.preparar`, Guard de usuario, administrador activo y revisión de permisos vigente, módulos Venta/Configuración, Mantenimiento migrar no revocado, reset vigente y el claim derivado. Configuración y cobertura se crean juntas. El cierre PRE/POST impide instalar el índice y modificar una fuente original en ese mismo commit. El comando de preparación debe suministrar por su cuenta la prueba completa de fuentes leídas; las reglas no calculan hashes de JSON arbitrario.

## Inventario de integración pendiente

Las fuentes son Ventas, Pagos, OT canónicas, Presupuestos, Reclamos, Agenda, Órdenes, Listas de materiales, Remitos, Equipos, Tickets, OT legacy (`ordenesTrabajo`), Gastos, cuentas de empleados, generación de comisiones comercial y `sv_commission_generation`.

`labor-db` deriva el enrutamiento del `Guard.affects`; el proyector del índice debe agregar sus originales cerrados a ese conjunto. El mantenimiento debe estar dentro del mismo patch, después de obtener las imágenes original/futura y antes de emitir el claim de commit. Sólo se ejecuta para operaciones que afectan sus fuentes; una escritura ajena no debe añadir consultas ni mover la revisión.

En el cliente, LaborWrites ya intercepta Ventas/Pagos/Gastos/Ctaemp/Comisiones y, con Cuentas coordinadas, Presupuestos/OT. Faltan Reclamos, Agenda, Remitos, Equipos, Tickets, OT legacy y las escrituras de Órdenes/Listas que atraviesan OperationalWrites. Deben dirigirse al Guard cuando el backend anuncie la versión real del escritor. Las reglas impiden que un cliente viejo desactualice el índice tras su instalación.

La función fiscal tiene su propio bundle: `cloud-functions/emitir-factura/labor-bridge.cjs` utiliza Guard pero su `runtime()` debe montar también el proyector, el claim y los módulos nuevos en el vendor. Actualizar sólo cotizador no actualiza esa función. Los triggers Push de OT/Reclamos examinados escriben notificaciones, no modifican esas fuentes; el cron de Agenda examinado es lector. Este inventario de repositorio no certifica escritores Admin/IAM externos ni artefactos desplegados.

## Evidencia y límites

20 pruebas offline pasaron: fuentes/ancestros/comodines, SDK sin mantenimiento, versiones falsas/ausentes, metadatos parciales, cambios de generación/revisión, lease/recibo/actor, preparación y conservación de raíces existentes.

En la composición nativa apareció un veto legítimo que el fixture LIVE anterior no ejercitaba: con RecordList realmente preparado, borrar una OT también retira su resumen. Se agregó únicamente la hoja `sisventas/listados_resumen/ordenes_trabajo/$record/.write`, preservando su texto anterior completo como operando OR. La rama nueva exige el mismo recibo/venta/FK de la cascada autorizada, OT y resumen originales existentes y ambos eliminados, administrador/permisos Venta+OT/reset/revisión vigentes, y mantenimiento real de Graph con revisión avanzada. No activa OTDelete independiente ni agrega permisos en padres. El manifiesto declara esta extensión.

Sobre el freeze funcional `d5087b2b01bfa1ad426001d791730bc38f8fb85e`, la matriz local RTDB ejecutó 14 casos y pasó completa: HTTP de borrado genuino→captura del PATCH y claims completos→merge nativo autenticado; cascada+CC/Pages/recibo y replay, preparación administrativa metadata-only, actualización ordinaria con índice en el mismo commit, cuatro revocaciones tardías, SDK phantom/idle, cinco fuentes financieras, apariciones PRE/POST de H/Fin y doce variaciones adversariales OT/resumen. El positivo de preparación usa Guard y el plan privado genuinos; no construye claims positivos a mano. La preparación puede partir de revisión2, no presume revisión1. La comparación de originales tras RTDB usa el normalizador canónico que retira contenedores vacíos; la comparación en memoria conserva RAW exacto.

El arnés separa las lecturas HTTP en memoria del commit auténtico de Rules por WebSocket en un emulador propio loopback. No acredita una lectura integral HTTP contra RTDB en esa misma ejecución ni un despliegue productivo. El emulador se limpió y detuvo. No se realizaron consultas ni cambios de datos reales.

El test fiscal adicional usa el puente fuente exacto, Guard/Store/proyector reales del mismo freeze y transporte ficticio. Comprueba actualización de factura y sourceHash/revisión del índice en un único commit, claim derivado1/H0/Fin0, originales ajenos intactos y veto ante índice parcial. El staging original incluyó el cierre transitivo real de los cuatro módulos Graph y el leaf fiscal exacto, sin añadir npm. Tres pruebas pasaron. Para producción falta empaquetar y activar la función con `SALE_DELETE_RELATIONS_ENABLED=true`; la prueba local no acredita su artefacto remoto.

## Ajuste puntual de la preparación

La preparación exige además `acciones.ventas.eliminar !== false` en Rules. Se mantienen los controles de módulos Venta/Configuración y se agregan los dos módulos a la comprobación de los 64 índices de `bloqueados`, igual que la representación numérica que ya examina la cascada OT nativa. La interfaz de Roles escribe un array; esto no se presenta como un equivalente de `Object.values` para mapas históricos con claves arbitrarias. Los índices de módulos y el permiso completo siguen releyéndose en servidor.

Dos pruebas unitarias nuevas verifican la revocación de Eliminar sin mover `indiceRevision` y el bloqueo de Venta/Configuración en los extremos 0 y 63 de esa representación. El archivo completo pasó 22 casos. En emulador se ejecutaron únicamente el positivo de preparación genuina y la revocación tardía de Eliminar con el mismo JWT y PATCH completos: 2 PASS. Los otros casos nativos quedaron excluidos por filtro; no se declara una repetición de toda la matriz. El emulador propio quedó limpio y detenido.
