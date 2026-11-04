# Actividad v2: instante heredado, prefijo de Presupuestos y transporte pendiente

Propuesta inactiva sobre los commits congelados `69b915d44435d1b3d81a3c829f6394c7093b6994` (lector) y `12046d62977e1a44d19c44914d3aa46841045e2e` (clave documental acotada). Manifiesto privado previo a esta etapa: `tmp/dashboard-budget-activity-v2-freeze.private.json`, con hashes de blobs de ambos commits. No se modifican aplicación, OT, commercial-pages, guard, reglas o configuración real. No se monta handler ni se consulta producción.

## Semántica comprobada, sin decisión nueva de producto

`js/modules/activity-history.js` concatena Venta, Cobro, OT y Presupuesto; aplica `fechaMs321`, descarta ms falsy y hace sort estable `b.ms-a.ms`, top cinco. Los empates conservan dominio y orden de la fuente. OT usa fechaCierre || fecha; Cobro excluye anulado truthy. Un ts truthy usa Number(ts) || 0 incluso si hay fecha válida; ts numérico cero permite fallback, string "0" no. El fallback conserva regex, año remapeado, zona local y rollover de Date. Fecha comercial diaria y SHA de clave **no** sustituyen ese contrato.

`js/core/dashboard-activity-model.v2.js` implementa ese merge en archivo nuevo, sin tocar Core v1. Valida contexto Auth/db/UID/rol/revisión/grants/zona/locale y generation/revision de cada prefijo, orden/ordinal, alcance y límite. El binding `budgetPrefix` enlaza sólo un DTO del índice con un contexto vivo capturado antes/después; no carga originales en cliente. Las fuentes faltantes de Venta/Cobro/OT continúan incompletas: no se adaptaron sus proveedores ni se afirma actividad mixta cerrada.

La corrección elimina el recorte arbitrario de 60 y la dependencia de una página histórica, conservando **la fórmula de instante y los empates de la fuente completa autorizada**. El caso de 62 propios contiene un PP antiguo con ts más nuevo que todos: el recorte lo omite; el prefijo correcto lo recupera aunque su fecha de documento sea del año 2000.

## Una raíz, un índice de últimos cinco

`dashboard-budget-activity-bootstrap-proposal.js` parte del modelo completo autorizado y del bootstrap existente. Conserva sources, propietarios/huellas, conteos, policy, acumulador, meses, avisos y recibos del protocolo existente; sustituye en memoria **sólo** el contenido de `document/{scope}` por eventos, antes de emitir el patch. No persiste primero un índice documental ni mantiene ambos. En el checkout estos módulos no tienen importación activa desde index.html, sw.js o cotizador/index.js; el índice es inactivo y puede cambiar de contrato antes de instalarse.

`coverage.documentOrder = legacy-ms-desc/source-ordinal-v2`, `activitySchema=2`, `activityReady`, zona y colación distinguen el nuevo contrato. El lector documental anterior rechaza esa marca. El Core v2 rechaza prefijos diarios/hash y Core v1 sigue intacto. Una instalación anterior requiere reconstrucción offline explícita, snapshot estable, precondiciones del destino y generación nueva: emitir un patch no es aplicar ni certificar ese corte.

El codec calcula ms desde el original, sin depender del ts escalar reducido del preview. Un ms cero o NaN se excluye exactamente como el renderer y se contabiliza como eventExcluded; esto puede producir actividad vacía con KPI no vacío, nunca un KPI cero fabricado. Un ms truthy no finito exige reconciliación: no se serializa como null ni se certifica silenciosamente.

La clave física de evento usa el orden IEEE754 descendente de ms (16 hex) y ordinal certificado de fuente (14 hex): **31 bytes ASCII**, con clave original sin truncar dentro del valor y huella del original intacta. Admite negativos, fracciones y todo Number finito no cero. El ordinal por ámbito se obtiene del orden real del loader completo, antes del sort global por ms; no es SHA ni orden alfabético inventado.

El preparador debe usar un snapshot observado. En la prueba RTDB se persisten primero originales ficticios y se leen una vez con Admin SDK **durante la preparación offline** para capturar su enumeración nativa; el lector de la petición no hace esa lectura. Zona de preparación debe coincidir con la del navegador certificado; el locale se declara explícitamente y el comparador lo usa. El lector y los updates sin cambios de orden pueden correr en UTC: reutilizan instantes/ordinales ya certificados sin volver a interpretar fechas. El binding del host deberá comparar sus zona/locale vivos con la cobertura.

El comparador heredado mezcla PP, parseInt(ts) y localeCompare(fecha). Con numeraciones válidas homogéneas, o todas no canónicas, sus claves definen el orden. En mezcla puede haber ciclos. El preparador certifica un preorden consistente por pares, limitado a 100.000 comparaciones offline; si hay ciclo o se supera el presupuesto falla explícitamente. No interpreta que una ordenación arbitraria de datos inconsistentes sea un empate verificable. Esto es un límite técnico abierto para imágenes mixtas grandes, no una normalización de históricos ni una pregunta al titular.

## Escrituras: exactitud primero, sin mantenimiento global oculto

El planner propio existente reconoce el nuevo contrato. Cambios de presentación/estado conservan ms y ordinales y actualizan filas, huellas, KPI y avisos en el mismo commit/recibo. Se comprueba la evidencia de campos de orden del original anterior. No se agrega lock, timer, servicio o recibo.

Alta, baja, reasignación o cambios de id/numero/fecha/ts pueden alterar ordinales de otros registros. En vez de recorrerlos durante un guardado, el mismo commit deja **activityReady=false, requiresActivityReconciliation=true**. Los KPI/avisos continúan mantenidos bajo coverage.ready; los metadatos de actividad quedan explícitamente no certificados. El lector de actividad devuelve error hasta reconciliación offline con generación nueva; ninguna escritura posterior reactiva el flag. Esto todavía **no** es mantenimiento continuo de actividad para todos los escritores. Resolverlo mediante un protocolo acotado o una reconciliación coordinada sigue pendiente; no se esconde detrás de un top cinco parcial.

## Transporte: SDK directo como candidato preferido, servidor sólo oráculo

`dashboard-budget-activity-reader-proposal.js` reutiliza la misma `createBudgetAuthority` extraída del lector servidor propio. Esa extracción conserva createBusinessAuth, createCommercialOwnership.authorize, perfil único consultado por UID con límite dos, rol activo y revisión/digest de permisos. No crea autoridad alternativa. La ruta propuesta no se importa ni monta. Sirve para contrastar resultados y diseñar un fallback si se justifica; no implica que el cliente deba pasar por Cotizador.

| Parte | SDK RTDB directo acotado | Evidencia o condición pendiente |
| --- | --- | --- |
| KPI | Stats del ámbito, sin originales ni backend agregador | El guard ya mantiene los cuatro agregados; el tamaño no depende del histórico. |
| Últimos cinco | orderByKey + limitToFirst(5) en document/{scope} | Contrato v2 y codec reutilizables. No usar páginas de listas ni adaptador de día/hash. |
| Badge | totalDueEligible menos futuros; páginas desde hoy, máximo 50 | Reutiliza el contrato raw lex. Presupuesto agotado da error. No necesita un reloj o servicio agregador. |
| Autoridad | Reglas por auth.uid/rol activo/permisos actuales, reset/version y ámbito; contexto cliente fijado antes/después | Faltan reglas de este índice y pruebas SDK no privilegiado; no se deduce autorización de un rol enviado por cliente. |
| Cobertura | Header mínimo público por ámbito y revision/generation antes/después | El coverage privado actual incluye records y unresolvedOwners globales. Abrir su padre a un UID propio filtraría metadata ajena; las reglas no filtran campos de un GET padre. |
| Identidad y política | Binding de perfil único y policy vigente, derivado del directorio canónico o índice existente comprobado | El servidor actual comprueba duplicados por consulta UID. No se comprobó que un simple sv_chat_roles reproduzca esa condición; debe certificarse al preparar y forzarse invalidación con todos los escritores de autoridad. |
| Revocación | Mantener el gate existente de reset/accessVersion y la política de sesión acordada | El servidor llama verifyIdToken(...,true). No se comprobó equivalencia de revocación real sólo con reglas; falta revisar el protocolo efectivo, no inventar un permiso nuevo. |

Por costo/latencia, la siguiente prueba debería implementar **un solo camino SDK directo**, con reglas candidatas y namespace ficticio. Header mínimo puede vivir dentro de la raíz derivada existente, actualizado en el mismo commit; no hace falta servicio o índice de eventos adicional. Alternativamente, lecturas de hojas públicas de coverage evitando el GET padre preservan privacidad pero agregan peticiones. Debe compararse costo real antes de elegir ese detalle. No se implementó ese header ni se declararon seguros datos privados por conveniencia.

Las reglas deberán negar raíz completa, fuentes privadas, scope ajeno, consultas sin límite y escrituras cliente; conceder sólo DTO y metadata mínima por scope; y comprobar coverage/actividad ready, generation y revisión vigente de permisos, junto con los gates compartidos. Debe verificarse que no exista una concesión en un padre que anule el alcance. Los archivos security/database.* del checkout son antecedentes locales, no evidencia de reglas remotas actuales. Los generadores prepare-password-access/prepare-payment-index-rules muestran gates de reset/version reutilizables, pero no son un despliegue de este índice.

La elección del camino directo no cambia el requisito pendiente de cubrir **todos** los escritores y autoridades: una revisión estable no prueba cobertura si un escritor viejo puede eludirla. No deben quedar SDK y Cotizador activos en paralelo para el mismo consumidor. Si el ensayo directo no preserva un aspecto de autorización, documentar la diferencia concreta y usar sólo entonces el fallback diseñado.

## Verificación y límites reales

Pruebas nuevas: `test/dashboard-activity-model-v2.test.cjs`, `test/dashboard-budget-activity-proposal.test.cjs` y `test/dashboard-budget-activity-emulator.integration.cjs`, más fixture propio. Comparan con activity-history.js y el loader activo extraído, no sólo con otra implementación del codec.

El opt-in nativo usa `SV_BUDGET_ACTIVITY_EMULATOR=1`, `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9057` y la instalación existente indicada por `SV_BUDGET_ADMIN_MODULE`. Namespaces propios demo-budget-activity-PID, credencial owner sólo local, sin ADC y limpieza verificada. Consultas/persistencia/guard/store son reales; el verificador de token es ficticio y las reglas del namespace son permisivas. **No** prueba permisos del SDK cliente ni Auth real.

Caso nativo de 5.051 presupuestos: una query de cinco eventos, dos queries badge, cero originales leídos por el lector y DTO de 1.807 bytes JSON. Ese tamaño no es facturación, tráfico físico ni benchmark de latencia. El lector servidor realiza 37 GET lógicos observados (incluidos queries) y cuatro verificaciones frescas de actor; sigue siendo un oráculo costoso frente a la posibilidad directa, no una justificación para añadir ese salto por defecto. El camino SDK directo aún no se implementó ni midió; no se presenta una estimación de peticiones como ahorro probado.

Los casos cubren rollover, ts truthy/falsy, negativos/fracciones, UTF-8 largo, empates, 62/5.051 registros, propios/admin, permisos cambiados, metadata ausente y guard con invalidación atómica sin efectos financieros ajenos. No prueban formularios ni operaciones de producción.

Pendientes: continuidad de actividad para cambios de orden, imágenes mixtas grandes/inconsistentes, preparador/fence/gate de todos los escritores, DTO/header mínimo y reglas directas, prueba SDK no privilegiado y Auth real, proveedores v2 de Venta/Cobro/OT y centro de notificaciones. Ninguno se da por aplicado con este código inactivo.
