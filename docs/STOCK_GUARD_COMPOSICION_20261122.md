# Hook mínimo stock.ajustar y composición real local

Autorización expresa del coordinador para este incremento. Cambios de producto limitados a validateFinancialContext de cotizador/labor-guard.js: entrada stock.ajustar con módulo stockoficina, tabla stock, acción ajustar, roles predeterminados admin/administrativo; restricción a mode=user y operaciones office-stock-adjustment/office-stock-link en esa validación. Se conservan chequeos de perfil activo, rol, overrides, bloqueos, revisión y digest. No se cambian claims, recibos, orden del commit ni formatos genéricos. Las políticas específicas mantienen su exigencia de prueba interna y revisión de productos/stock.

La integración anterior del typed command que esperaba rechazo por acción ausente se sustituye por guard REAL que confirma y recupera el recibo original una sola vez. Es cambio de contrato autorizado, no una expectativa relajada para esconder un fallo. El módulo Link sigue OFF y no registrado en index/runtime.

## Pruebas de composición

office-stock-store-composition.test.cjs usa servicio Stock real → createLaborGuard real → políticas reales → createLaborRtdbStore real con fetch ficticio. Verifica los JSON y auth_variable_override emitidos; jamás contacta Firebase. Admin/administrativo, conteo distinto e igual,1PATCH y replay único, inventario/operaciones/costos/reservas/historial previo conservados, resumen coherente y ningún mapping. La quinta prueba conecta el componente Link sólo en fixture y verifica5rutas, schema2 y capacidadLink sin reutilizar conteo.

office-stock-guard-composition.test.cjs usa guard real con almacenamiento de memoria que valida ambas políticas. Cubre conteo igual/distinto por ambos roles, respuesta perdida, producto/perfil/revisión/permiso cambiado antes del commit y falsificación de operación/capacidad/modo. También una recepción ficticia concurrente: el conteo obsoleto se rechaza, la recepción y su operación se conservan; al releer se confirma12sin diferencias, con un único recibo/auditoría al reintentar.

La fixture común de orquestación se extrajo a test/helpers/office-stock-link-command-fixture.cjs y ahora también valida la política de conteo. No se reemplaza el guard real por un doble en las pruebas que afirman composición. Siguen existiendo pruebas unitarias del orquestador con doble, identificadas por su alcance. El transporte de la composición es un doble de REST, no emulador ni reglas efectivas.

## Alcance pendiente

La barrera de catálogo candidata de A, cobertura/índices autoritativos y reglas cerradas de asociación aún deben integrarse/probarse con emulador. Compras SDK y consumidores físicos aún no migrados: no se habilita guardado de vínculo ni UI por aprobar este hook. No se publican builds, servidores ni reglas. Ningún registro real, navegador del usuario o checkout compartido fue utilizado.

Gate acotado: tests office-stock-store-composition, office-stock-guard-composition, office-stock-link-command, office-stock-link-policy y store-protocol-claims.65PASS,0FAIL,0SKIP; sintaxis y git diff --check correctos. No suite general, reservada a coordinación.
