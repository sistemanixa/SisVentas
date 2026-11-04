# Renovación de política sin reconstruir propietarios

2026-11-04. Propuesta aislada desde `8c84aed27617a8346a2bb1ef3ab029b73ad21cd4`, rama `codex/dashboard-policy-renewal`, checkout `C:/SisVentas/.local/dashboard-policy-renewal`. Extiende el helper compartido de telemetría; no modifica el runtime ni el checkout de integración.

## Contrato de opt-in y montaje pendiente

`Index.plan` acepta `allowPolicyRenewal: true`. El valor predeterminado es **false**, conservando el retiro anterior de cobertura ante cambios de autoridad hasta que la integración implemente el siguiente augment. No es un flag remoto ni una activación de servicio.

Con el opt-in, un cambio de autoridad lee `sv_usuarios`, `sv_chat_roles` y `sv_permisos` antes y después mediante el overlay del **mismo guard**. Exige que `Policy.hash(before)` coincida con la cobertura publicada. Compara `Policy.ownershipProjection`, derivada de `Own.profiles`: UID elegibles con sus conjuntos de alias normalizados, ordenados. No agrega roles o permisos a esa clave de ownership; los roles sí siguen interviniendo en la elegibilidad y consistencia que ya verifica `Own.profiles`. No redefine ni reimplementa el algoritmo de propietarios.

Si la proyección efectiva se conserva y la generación está lista, el patch renueva `policy.hash`, `coverage.policyHash` y `coverage.revision`. No modifica conteos, pruebas, filas, originales, acumuladores ni importes. Si también hay una mutación de Presupuesto, el planner mantiene su ruta incremental existente en ese mismo commit. La cobertura ya retirada nunca se rehabilita así. Los cambios efectivos de UID, alias, pertenencia activa, identidad o ambigüedad conservan el retiro y la reconciliación explícita; no se reasignan históricos por nombre.

Una renovación devuelve **`policyRenewed: true`, `requiresReadViewRefresh: true`, `policyHash: <nuevo hash>`**. El siguiente augment de la integración **debe refrescar todos los headers UID de readViews afectados dentro del mismo commit del guard**, usando la nueva política y las autorizaciones actuales. No se debe montar el opt-in ignorando esa señal ni refrescando headers después en otro commit. Esta entrega no implementa ni acredita ese augment: readViews/DTOHist aún no están montados aquí. El retorno conserva `activationAuthorized: false` y `originalWrites: 0`.

Antes del commit se vuelven a leer las tres autoridades y se verifica el hash compartido completo de política, que excluye sólo los dos campos conocidos de acceso por perfil. Cambios concurrentes de usuarios, identidades o permisos abortan; una carrera de telemetría sin semántica de autoridad no altera ese hash. La comparación fresca puntual de un PUT de perfil de la entrega anterior sigue vigente. La exclusividad frente a escritores externos sigue dependiendo del protocolo del guard; no se ampliaron reglas.

## Autorización y límites de la comparación

Los lectores existentes vuelven a comprobar Auth, rol, módulos, acciones y revisión/digest de permisos durante cada lectura. Conservar cifras globales no conserva un permiso del actor: perder Dashboard deniega la lectura aunque `coverage.ready` permanezca true. Un rol actualizado coherentemente en perfil e identidad puede renovar política sólo si mantiene la resolución efectiva de propietarios. Los alias equivalentes tras la normalización existente no implican una nueva asignación. La comparación certifica equivalencia de `Own.profiles`, no que todo cambio bruto de un perfil oculto/inactivo sea una reasignación.

Una autoridad previa que ya no coincida con el hash publicado se rechaza como drift sin certificar una mezcla. No repara una generación ajena ni convierte cobertura retirada en lista. La autorización de guardar permisos sigue siendo responsabilidad del comando real que invoca el guard; el planner sólo prepara derivados.

## Evidencia local

Rojo inicial sobre la base sin extensión: 13 casos, siete PASS y seis FAIL. La primera corrección dio 13/13. Matriz final: **92 PASS, cero FAIL/SKIP**, con 21 casos nuevos y 71 regresiones anteriores (telemetría, modelo, planner, actividad y continuidad). Incluye revisiones/acciones/módulos legítimos, denegación por pérdida de Dashboard, rol coordinado, cambios de UID/nombre/activo, identidad inconsistente, UID duplicado y alias ambiguos; carreras frescas en las tres autoridades; drift previo; ausencia de rehabilitación; telemetría concurrente excluida.

Con 1 y 1.001 originales más un histórico sin UID, la renovación lee cinco paths del planner: coverage, policy y las tres autoridades. Emite cinco paths de commit en el fixture: permiso, policy, coverage, recibo y liberación del guard. No lee originales de Presupuestos ni financieros; conserva sentinels de ventas, pagos, productos/costos, stock, comisiones y cuenta del empleado. Son conteos de fixture, no ahorro de bytes/latencia ni una prueba de Firebase productivo. Sintaxis de los tres archivos JS/CJS afectados y diff-check: PASS. No se ejecuta puerta general nueva.

Logs privados en `C:/SisVentas/tmp/stage1-integral-plan/`: `dashboard-policy-renewal-before.private.log` (rojo), `dashboard-policy-renewal-after.private.log` (13 verdes), `dashboard-policy-renewal-extended.private.log` (18 PASS y un acceso equivocado del arnés a response.context.role, corregido a response.role), `dashboard-policy-renewal-final.private.log` (92 verdes). No se versionan datos ni logs. Sin push, despliegue, migración, operaciones reales ni cambios SDK.
