# Compatibilidad Graph y verificador OT existente

`sale-delete-target-commit.prepareOTPatch({patch,actor,lease,readFresh,existsFresh,now?})` valida la proyección Graph completa y devuelve una copia del PATCH sin `sv_sale_delete_relations/*`. No modifica el PATCH real ni emite claims.

Montaje reservado a Root: invocar inmediatamente antes de `otDeleteOperationalReadiness.commitClaims`, pasando a ese verificador únicamente la copia devuelta. Conservar actor/proof originales y el PATCH completo para el commit real. No cambiar módulos OT ni pins. `readFresh` y `existsFresh` son puertos del Store servidor, nunca callbacks de la solicitud.

La rama Graph exige actor OT/UID/op/modo/claim derivado, lease actual no vencida y digest del input. Recalcula con `sale-delete-target-projections.augment` desde los originales y TODO el PATCH final no Graph; compara igualdad exacta de todas las rutas y valores Graph, configuración y cobertura válidas. Relee cada dependencia observada y la lease. Sólo excluye ese namespace: recibo, guard, fuentes físicas, financieras y demás proyecciones siguen en la comparación nativa OT original. Sin Graph ni claim de writer conserva el camino anterior sin IO adicional.

Validación local: cuatro pruebas pasan contra módulos reales de Root; Accounts y Graph se preparan con sus modelos reales. El verificador OT schema2 recibe firmas Ed25519 FICTICIAS efímeras generadas exclusivamente en memoria. Rechaza el PATCH completo antes de adaptar y acepta la copia validada; rechaza proof clonado y campo físico ajeno. Negativas de Graph incompleto/extra/adulterado, fuente/config/cobertura/lease concurrentes, actor incompatible y vencimiento. El PATCH original permanece intacto.

Límites: prueba directa del contrato nativo y helper, no ejecución HTTP/Guard/REST de OT ni firma productiva. No emulador nuevo, datos reales, Rules ni despliegue. La relectura no certifica cierre de Admin externo; el montaje necesita conservar los fences y validaciones existentes.
