# Política de Dashboard y telemetría de acceso

2026-11-04. Implementación aislada desde `249040dc6b967949d71fff60a0ebe632ef7f11be`, rama `codex/dashboard-policy-telemetry`, checkout `C:/SisVentas/.local/dashboard-policy-telemetry`. No está montada ni publicada.

## Defecto y corrección acotada

El acceso normal de app.v3.19.3 actualiza `sv_usuarios/<fbKey>/ultimoAcceso` y `ultimoAccesoEn`. Antes, el hash incluía ambos valores y cualquier escritura del directorio retiraba la cobertura de Presupuestos. Reproducción inicial: 10 casos, cinco FAIL y cinco PASS; las cinco expectativas de conservación/frescura fallaban sin modificar el código base.

`cotizador/dashboard-authority-policy-proposal.js` exporta `profile(value)`, `profileHash(value)`, `projection({users,identities,permissions})` y `hash(authority)`. Sólo omite los dos campos propios del nivel superior de cada perfil de `users`. No filtra por lista de campos permitidos: conserva uid, rol, activo, nombre, todos los desconocidos, objetos anidados, identidades y permisos. Devuelve copias sin mutar originales. Un snapshot sin esos campos mantiene exactamente su hash anterior.

El modelo de dominio usa el hash compartido al construir y verificar la proyección. El bootstrap documental y el de actividad reciben ese mismo `model.policyHash`; el driver `Index.plan` usa `profileHash` para la comparación puntual. No descarga el directorio ni reconstruye históricos durante una mutación.

Un PUT individual de perfil y los cambios exactos de los dos campos conocidos leen el perfil antes/después mediante `raw` y el overlay `get` del guard. Si la proyección cambia, se retira `ready` y se exige reconciliación como antes. Si sólo cambia telemetría, no se toca cobertura/hash/derivados; una modificación simultánea de un Presupuesto mantiene sus índices en el mismo commit. El perfil original se comprueba completo mediante `readFresh` antes del commit, incluso cuando el planner devuelve un patch vacío. Una carrera de rol/nombre/activo aborta sin sobrescribirla. Esta comprobación también aborta conservadoramente una carrera de telemetría.

Crear un perfil ausente aunque contenga sólo telemetría, eliminar un perfil, cambiar uid/rol/activo/nombre/otro campo, escribir identidades/permisos, reemplazar el directorio entero o tocar un campo anidado de nombre parecido sigue retirando cobertura. La telemetría nunca rehabilita una cobertura retirada. No se amplían reglas ni se cambia ownership legacy.

## Adaptación pendiente del DTO histórico por integración

El consumidor/DTOHist que compare un hash de autoridad debe importar **este mismo** `hash` y pasar `{users, identities, permissions}` con los perfiles originales, sin duplicar un filtro ni eliminar telemetría del snapshot persistido. Su hash debe cotejarse con el publicado en policy/coverage. Esta exclusión no reemplaza la autorización fresca, el pin de actor, la revisión de permisos ni la verificación del perfil durante el guard. Si allí se comparan perfiles individuales para política, se dispone de `profileHash`; no usarlo para ocultar diferencias de la evidencia cruda o el conflicto de escritura. El archivo DTOHist de la integración no se modifica en esta entrega.

Los artefactos ya preparados cuyo hash incluya telemetría no se reinterpretan ni reparan automáticamente: requieren preparación/reconciliación explícita bajo el contrato nuevo. No se migran datos ni se activa un corte.

## Evidencia y límites

Final: 71 PASS, cero FAIL/SKIP: 16 casos nuevos más 55 existentes en proyección, planner, actividad, claves estables y continuidad de actividad con guard/store reales sobre datos ficticios. Los diez casos iniciales pasan sin cambiar sus expectativas. Se agregó una lectura puntual esperada a la prueba existente de PUT de perfil nuevo; las expectativas de invalidación y ausencia de escaneo se conservan.

Con 1 y 1.001 originales, un PUT sólo de telemetría realiza una lectura del planner y tres lecturas del perfil en el store del fixture (antes, overlay y comprobación fresca), con tres paths de commit (perfil, recibo y liberación del guard). No son mediciones de red productiva. Se conservan sentinels de ventas, pagos, costos, productos, stock, comisiones y cuenta del empleado. Sintaxis de los cinco archivos JS/CJS afectados y `git diff --check`: PASS. No se ejecutó una nueva puerta general, emulador ni operación real.

Logs privados en `C:/SisVentas/tmp/stage1-integral-plan/`: `dashboard-policy-telemetry-before.private.log` (rojo inicial), `dashboard-policy-telemetry-after.private.log` (diez verdes), `dashboard-policy-telemetry-focal.private.log` (70 PASS y una expectativa de lectura antigua), `dashboard-policy-telemetry-final.private.log` (71 verdes). No se versionan logs ni snapshots.
