# Hook post-Operational y prueba privada para política B — 22/11/2026

Módulo nuevo `cotizador/office-stock-order-projections.js`, sin editar SharedGuard, Operational, store, rutas, Docker, índice ni aplicación. `create({enabled=false,verifyCohort}).augment({patch,raw,get,actor,lease,operationId,beforeCommit})`. OFF devuelve maintained=false con cero lecturas y sin tocar patch; operaciones ajenas al inventario tampoco consultan metadata. El flag y verifyCohort son dependencias de servidor, jamás campos del cliente.

## Entrada y mantenimiento

El hook se ubica DESPUÉS de Operational.augment. Sólo admite hasta 128 inventarios individuales con original padre revisionado y resumen padre emitidos en patch. Recalcula Model.plan(before, after, operationId) y compara ambos padres antes de proyectar: rechaza revisión/op falsa, resumen del cliente, hijos superpuestos y escrituras de colección completa sin consultarla. before proviene de raw y after exclusivamente de patch[source], no de get sin revisionar. Un intento de inyectar config/fence en el patch original también se rechaza.

ON lee una vez por fase operational config, order config y fence; exige versiones/generación/ready/writersClosed y ausencia de cantidades inválidas. verifyCohort debe leer evidencia PRIVADA acotada mediante el puerto read y devolver `{schema:1,verified:true,writerVersion:1,generation}`. No se acepta un booleano sin lecturas. El puerto read sólo permite rutas sv_* acotadas, excluye las tres configuraciones ya comprobadas y no puede descargar originales. Su evidencia y resultado quedan vinculados a la prueba. La implementación real del cierre de todos los escritores aún corresponde al coordinador.

Cada resumen se toma del plan operativo comprobado: se agregan rank/hash numéricos para positivos, se retiran para cero; una baja conserva el resumen padre null. No se agregan hijos junto a un padre. El original ya propuesto no cambia un byte: no se reescriben general, unidad, costo, reservas, asignaciones ni historia. Se acumulan todos los deltas y se escribe UN fence con revisión+1, cualquiera sea el tamaño del lote.

beforeCommit registra relectura fresca de fuentes, configuraciones, fence y evidencia de cohorte, reejecuta verifyCohort y rechaza cualquier diferencia o revocación. Hay deduplicación sólo dentro de una fase; ninguna lectura inicial sustituye una lectura de confirmación. Se comprueba también que nadie haya cambiado originales o derivados en patch después del hook. Fixture con tres lecturas privadas: N+6 lecturas iniciales y N+6 frescas para 1/6/12 inventarios, sin consultas globales.

## Contrato para B

augment modifica los padres de resumen/fence en el mismo patch y retorna `{maintained:true,proof,paths,inventoryCount}`. No devuelve ni persiste copias de ledger en proof. `proof` es un marcador congelado, registrado en WeakMap privado del módulo; serializarlo, clonarlo o inventarlo pierde la capacidad.

B puede llamar `inspect(proof,{actor,lease,operationId})` usando las identidades reales que llegan al store. Se valida la vinculación con uid, rol/revisiones/permisos/claims, operación, UID del lease, fence y digest del lease. No requiere identidad del objeto actor porque SharedGuard pasa una copia al store; sí exige sus valores vinculados. Una prueba ajena o copiada se rechaza.

inspect devuelve únicamente:

- schema, operationId, uid, fence, generation y revisionBefore/revisionAfter;
- countsDelta inventory/positive/invalid;
- sources `{path,beforeHash,afterHash,summaryPath}`;
- writes `{path,hash}` para cada resumen padre y el único fence;
- reads `{path,hash}` y cohortHash de evidencia privada.

Política B pendiente: aceptar derivados/fence sólo con prueba propia inspeccionable, comprobar hashes del patch final y fuentes, negar claims/campos forjados y cualquier ampliación de paths; emitir token mínimo según el protocolo privado del store. Debe mantener la validación de las escrituras originales del dominio. Este módulo no concede una capacidad de escritura de inventario ni reemplaza su autorización. Root deberá conectar hook, política y store juntos, registrar la relectura bajo el mismo guard y resolver el empaquetado antes de cualquier activación. Hasta entonces sigue OFF, sin barrera productiva declarada.

## Evidencia inicial y alcance

19 pruebas sintéticas PASS / 0 FAIL / 0 SKIP: OFF/cero lecturas; 1/6/12 originales realmente emitidos por Operational.augment; un solo fence; baja/string cero/alta; padre completo sin superposición; rechazo de resumen/revisión/fence inyectados; conflictos de fuente/config/fence/cohorte/rol/permisos; evidencia privada obligatoria; cambios posteriores del patch; prueba copiada u otra coordinación. `C:/SisVentas/tmp/audit-20261122-C/stock-order-projections.log`, fuera de Git. Sintaxis correcta. La primera entrega aún no afirma replay o respuesta perdida integrada con SharedGuard; la prueba siguiente lo compondrá sin modificar ese módulo y se documentará aparte. Sin red, datos reales, permisos remotos, corte SDK ni publicación.

## Segunda entrega: SharedGuard real y límite de política final

Se agrega office-stock-order-projections-guard.test.cjs: instancia createLaborGuard REAL con almacén ficticio, llama Operational.augment real y luego el hook dentro de una operación aislada; no modifica ni conecta SharedGuard de producto. Pérdida de respuesta DESPUÉS del commit ficticio, seguida de replay de recibo propio con el mismo digest: un commit, una ejecución del hook y fence 10→11 una única vez para doce inventarios. Cambiar el digest manteniendo ID se rechaza. Reservas, unidad, costos y asignaciones del original se conservan.

La primera prueba de revocación registrada después del final-check del hook mostró que, SIN política de store, ese cambio tardío no es rechazado por el check ya ejecutado. No se cambiaron sus expectativas: se completó el almacén FICTICIO del test con el contrato de validación propuesto a B (relectura de proof.reads y cotejo de sources/writes al confirmar), y entonces la misma revocación impide el commit. Esto NO demuestra que la política real esté implementada: B/store/reglas deben validar la prueba y evidencia actual en la fase final, incluyendo lease vigente y pertenencia/paths/digest, sin permitir una sustitución posterior. Tampoco basta un callback inicial que declare verified=true.

Tanda final: 22 PASS / 0 FAIL / 0 SKIP (19 del hook + 3 de composición). `C:/SisVentas/tmp/audit-20261122-C/stock-order-projections-guard-final.log`, fuera de Git. Sin red ni escrituras reales; no se repite puerta global. La integración productiva, emisión de claims, cierre SDK, cohorte autoritativa y revisión conjunta de B quedan pendientes; el mantenedor permanece OFF.
