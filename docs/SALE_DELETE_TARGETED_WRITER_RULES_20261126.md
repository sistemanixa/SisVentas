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

19 pruebas offline iniciales pasaron: fuentes/ancestros/comodines, SDK sin mantenimiento, versiones falsas/ausentes, metadatos parciales, cambios de generación/revisión, lease/recibo/actor, preparación y conservación de raíces existentes. Son evaluaciones de predicados y composición, no una certificación de RTDB ni de la autoridad del emisor real. Falta el comando/emisor congelado para probar JWT genuino + PATCH completo en emulador; no se inventan tokens positivos ni se afirman cierres productivos.
