# Continuidad guard → headers UID → lector fresco

2026-11-04. Fuente congelada: **1e4078d259a01f2a3908019cf89d6d1ee62f3b20**, checkout aislado `C:/SisVentas/.local/dashboard-cross-read-1e4078`, rama `codex/dashboard-cross-read-1e4078`. Sólo se agregan esta nota y `test/dashboard-budget-guard-fresh-cross.integration.cjs`. No se modifican runtime, reglas ni expectativas existentes. La coordinación autorizó después de revisar el resultado un commit local exclusivamente de estos dos archivos, sin push.

## Prueba cruzada real del contrato preparado

Se usa `createLaborGuard({dashboardBudgets: Writer.create({enabled:true, allowPolicyRenewal:true})})` de la fuente congelada. La operación de negocio sólo ejecuta `scope.update(patch)`; el **plugin real** llama al planner y al augment de headers. No hay llamada manual a Index.plan ni staging manual de derivados desde el test. Bootstrap/DTO se usan una sola vez al preparar cada fixture, nunca para reparar o reconstruir después de una mutación.

El store de prueba conserva el lease en RTDB con ETag y confirma el patch completo mediante un único PATCH nativo del emulador. Antes de enviarlo comprueba que la coverage y todos los headers anteriores estén representados en ese mismo patch; cada header resultante conserva sus 23 campos y coincide en generation, revision y policyHash. Se utilizan datos ficticios y credencial owner **sólo del emulador** para preparar/confirmar el fixture. Esto no acredita los fences ni la autorización de escritura de reglas productivas.

El lector probado es Direct + Fresh sin reemplazar algoritmos, con fetch HTTP real a `127.0.0.1:9059`, no-store y JWT ficticio del emulador. Las reglas standalone son las del SHA congelado. Los lectores cliente y servidor registran y rechazan cualquier lectura normal de `sisventas/*`. El oracle fuera del recorrido del lector puede inspeccionar los originales ficticios para comprobar el top cinco por instante y clave, y los conteos esperados; esas inspecciones no se presentan como lecturas del cliente.

## Resultado y alcance

**10 PASS, cero FAIL/SKIP, exit 0.** Incluye:

- Alta, edición de estado/instante, reasignación y baja de Presupuesto mediante el plugin: lectura inmediata coherente de KPI, prefijo de cinco y centro de avisos, para usuario propio y administrador, sin rebuild.
- Guardado de permisos con revision/acción: cobertura global lista, contexto anterior rechazado y contexto fresco con revisión nueva aprobado.
- Revocación del módulo Dashboard: headers UID retirados y métricas/avisos rechazados; administrador conserva acceso.
- Desactivación coordinada de perfil/identidad: cobertura y headers retirados en el mismo commit, sin reutilizar resultados previos.
- Permiso revocado mientras una lectura fresca está en curso: no devuelve un DTO exitoso parcial. No se afirma que todo cuerpo HTTP se cancele antes del parseo.
- Reglas reales del emulador deniegan UID ajeno, scope ajeno/global y originales, incluso con claims ficticios admin/svLaborService falsificados. Son intentos negativos explícitos, separados de la afirmación de cero lecturas normales de originales.
- Inyección de derivados por el caller y cambio concurrente de autoridad: rechazo sin commit de negocio.

Se mantienen sentinels de ventas, pagos, productos/costos, stock, comisiones y cuenta del empleado. Los avisos superan una página: consultas acotadas a 50, con verificación de contador noticeEligible y contenido completo; el prefijo usa límite cinco. En las comprobaciones positivas observadas, el conjunto read + notices + metrics realizó 12 GET del cliente y los dos oracles servidor 57 GET, sin originales; no es una medición de latencia ni una afirmación de ahorro productivo.

Los namespaces ficticios se eliminan al finalizar, con comprobación de raíz null. El proceso Java propio de 9059 se detiene desde el mismo bloque que lo creó. No se usa ni se detiene QA 9046/9058. No se inició una puerta general ni se instaló ningún paquete. No se montó la aplicación ni se ejecutaron operaciones reales.

## Reproducción y procedencia

Con un emulador propio libre en 9059 y dependencias locales existentes:

```powershell
$env:SV_BUDGET_CROSS_NATIVE='1'
$env:FIREBASE_DATABASE_EMULATOR_HOST='127.0.0.1:9059'
$env:SV_BUDGET_FIREBASE_MODULES='<node_modules existente con @firebase/util>'
node --test --test-concurrency=1 test/dashboard-budget-guard-fresh-cross.integration.cjs
```

Sin el opt-in, los diez casos se omiten explícitamente. `SV_BUDGET_CROSS_SOURCE_ROOT` permite repetir sobre otra fuente congelada sin copiar ni modificar runtime; por defecto se usa este checkout.

Manifiesto privado de las once fuentes principales antes/después: `C:/SisVentas/tmp/stage1-integral-plan/dashboard-cross-read-1e4078-source.private.json`. Log final: `dashboard-cross-read-1e4078-final.private.log`, SHA256 `f342bf881e4f4911c6cc1ea39c15672e787ed859ef7cac085dde40c607ec1b2b`. El log previo `dashboard-cross-read-1e4078.private.log` ya dio diez verdes; la repetición final agregó claims falsificados en los negativos y eliminó una ruta Windows del fallback de dependencias.

Se conservan intentos anteriores separados: errores de entorno EACCES/ECONNREFUSED y la primera captura WIP con dos PASS/ocho FAIL porque faltaba `sv_labor_config.ready` en el setup; no se presentan como fallos del producto ni como aceptación de esos negativos. Se corrigió sólo el fixture y se pasó al SHA inmutable indicado antes de validar el bloque final. Sin push/deploy; pendiente importación de estos dos archivos por la integración. Los logs y manifiestos privados no se versionan.
