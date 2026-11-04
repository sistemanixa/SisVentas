# Augment de headers UID en el mismo commit

2026-11-04. Base `848064e4204cf2a2d693dbc8876cfb11a4b6d4bc`, checkout `C:/SisVentas/.local/dashboard-uid-header-augment`, rama `codex/dashboard-uid-header-augment`. Propuesta sin montar; no cambia Index.plan, el helper de política, runtime, reglas, identidades ni precios.

## Contrato y orden de composición

`dashboard-budget-read-view-augment-proposal.augment({enabled, planned, raw, get, beforeCommit})` recibe el resultado íntegro de Index.plan y los mismos puertos del guard. `raw` obtiene el snapshot previo protegido; `get` incluye el patch original staged; `beforeCommit` registra comprobaciones en el guard existente. No adquiere otro lease, no persiste ni llama a un servidor por su cuenta.

Secuencia obligatoria dentro del mismo guard:

1. Stage del patch original y llamada a Index.plan (con allowPolicyRenewal sólo si la integración la habilita).
2. Pasar el resultado a este augment, que superpone localmente su patch derivado a las lecturas puntuales de coverage/policy/stats/proofs.
3. Stage de **todo** el patch devuelto por el augment. Ejecutar comprobaciones frescas y confirmar originales, derivados, headers UID, recibo y liberación del guard en un único commit.

`enabled` es **false por defecto**. Si hay coverage derivada o `requiresReadViewRefresh:true`, la opción deshabilitada rechaza; no devuelve un patch operativo incompleto. También rechaza una señal sin coverage o un plan con headers precalculados por el caller. Sólo devuelve `requiresReadViewRefresh:false` y `readViewRefreshComplete:true` después de proyectar todos los UID habilitados y las eliminaciones necesarias. Conserva `proposal:true`, `activationAuthorized:false`, `normalWriterIntegrated:false`, `originalWrites:0`. Si el planner no cambia coverage y no solicita refresh (por ejemplo sólo telemetría), deja el plan intacto sin leer directorios ni inventarios.

## DTO reutilizado y compatibilidad de integración

La base 848064 no trae el archivo DTO. Se tomó exactamente como referencia `cotizador/dashboard-budget-sdk-dto-proposal.js` de `7fb553f8`; blob Git de referencia `f1e61a60013aab049aae96ccfdfaa17d0b9abf71`. En esta rama ese archivo se incorpora refactorizado: `validateCoverage`, `eligible` y `projectReadView` concentran las mismas validaciones/proyección para que tanto el bootstrap offline `projectReadViews` como el augment puntual las reutilicen. El bootstrap conserva su inventario completo y su comprobación exacta de propietarios; el punto usa scopes instalados, stats/proofs y el contrato `scopeAbsenceIsZero`. No se fabrican fuentes para satisfacer el oráculo offline.

**Al integrar sobre el DTO ya existente, fusionar selectivamente estas funciones y exports; no sobrescribir cambios ajenos.** El header sigue teniendo los mismos 23 campos, schema 1 y el contrato de orden estable vigente. No se duplica el compilador de permisos: se sigue usando PermissionIndex. Se conserva la presencia bruta de bloqueados y directCompatible. Las validaciones puntuales exigen contadores/revisiones válidos, proof del objeto completo y cobertura canónica sin reconciliación pendiente.

Los campos extra de stats, incluidos noticeEligible y futuras extensiones, se mantienen intactos y entran en el proof completo. No se impone una lista exhaustiva de claves de stats ni se agregan campos al DTO. La salida de Index.plan de avisos puede fusionarse independientemente: este commit no modifica ese archivo.

## Snapshots, retiro y límites de confianza

El augment lee las tres autoridades protegidas y las revalida antes del commit usando el hash compartido que excluye sólo ultimoAcceso/ultimoAccesoEn. Para cada scope elegible lee stats y proof **puntuales**, y captura coverage/policy previos. Lee únicamente el inventario anterior `/read` de headers UID para retirar también los huérfanos; no lee el árbol ROOT, `/sources`, originales de Presupuestos ni datos financieros.

Todos los headers habilitados reciben generation/revision/policyHash de la coverage resultante, incluso los de roles no editados, porque el hash es global. Los UID que pierden acceso se eliminan en ese patch. Ante retiro de coverage por cambio de ownership se eliminan todos los headers anteriores, sin reasignar históricos ni modificar fuentes. Un scope previamente poblado cuyo stats/proof desaparezca no se vuelve cero silenciosamente. Los scopes nuevos vacíos usan el contrato certificado de ausencia igual a cero; esto presupone preparación correcta y exclusividad de escritores de metadata, no prueba por sí solo un árbol dañado arbitrariamente por un administrador externo.

Antes del commit se releen autoridades, coverage, policy, inventario UID y cada stats/proof capturado; cualquier diferencia relevante aborta la operación. El inventario y trabajo crecen con los UID/scopes, no con el histórico de Presupuestos. No se incorporan consumidores, centro de avisos, transporte SDK, nuevas rutas ni reglas/fences de escritores reales: el montaje continúa pendiente.

## Evidencia

Matriz final: **120 PASS, cero FAIL/SKIP**: 28 casos propios del augment más 92 regresiones de renovación/telemetría, modelo, planner, actividad y continuidad. Altas, edición, reasignación y baja de Presupuestos; cambios de permisos, revocación/restauración de módulos, rol coherente, retiro por activo, UID huérfano; conflictos frescos en autoridades, coverage/policy, stats/proofs e inventario de headers; pruebas corruptas y contadores incoherentes; default deshabilitado y señal de refresh no eludible.

El store del fixture comprueba dentro de su único commit que no existe una combinación de coverage nueva con headers viejos. Los headers finales se cotejan con la proyección offline fuera de la operación. Sentinels de ventas, pagos, productos/costos, stock, comisiones y cuenta del empleado se conservan. Para renovación de un permiso, con 1 y 1.001 originales: 12 lecturas del augment y ocho paths de commit totales. Son conteos de fixture, no una medición de red productiva. Sintaxis de tres archivos JS/CJS y diff-check: PASS.

Logs privados: `C:/SisVentas/tmp/stage1-integral-plan/dashboard-uid-headers-first.private.log` (20 verdes) y `dashboard-uid-headers-final.private.log` (120 verdes). Sin gate general nuevo, navegador/emulador ni aceptación integral; tampoco push, publicación o datos reales. Falta integrar selectivamente el DTO y conectar el augment al guard y a todos los escritores reales antes de montar lectores.
