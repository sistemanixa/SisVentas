# SDK directo: DTO mínimo y reglas comprobadas, sin montar

**Registro histórico del commit 0aad5533, no apto para montaje:** la caracterización posterior confirmó que sdk.get puede aprobar caché activa. El bloque vigente exige RTDB HTTP fresco para todas las lecturas y un plan explícito para legacy; ver DASHBOARD_RTDB_FRESCO_COMPATIBILIDAD_PROPUESTA.md.

Bloque aislado desde `8cdda057c4fa5260f8694a62682cf8889e3d26bf`, checkout `dashboard-activity-sdk-v2`. Sólo archivos nuevos propios. No cambia la integración congelada, aplicación, semántica fechaMs321, originales, guard o reglas reales. No elimina la descarga completa actual.

## Qué se prueba

El SDK oficial 10.12.0, con usuario sin privilegios Admin, lee KPI, cinco eventos legacy y badge directamente de RTDB. Usa Core v2 y las mismas membresías document/noticeBadge, sin Cotizador ni fallback automático. El servidor congelado es sólo oráculo de paridad en la prueba. No hay dos caminos montados.

`projectReadViews` construye offline `sv_dashboard_budget_proposal/v1/read/{uid}` dentro de la raíz propuesta existente. El DTO reúne sólo contadores del ámbito, generación/revisión, flags de cobertura, orden/zona/locale y vínculo canónico propio. No copia inventario de fuentes, acumulador, conteos globales de otros ámbitos, fotos, ítems o costos. policyHash es una huella opaca, no un directorio. Se deriva de Own.profiles/moduleAllowed/eligible y exige política completa coincidente, inventario completo y pruebas de stats. No crea un resolver de autoridad alternativo.

Un ámbito propio vacío sólo se emite si la ausencia equivale a cero bajo cobertura completa y no hay fuentes de ese UID. Un DTO ausente, inconsistente o vencido da error; no se infiere cero. El DTO admin contiene los totales all a los que su rol tiene acceso.

El lector nuevo `js/core/dashboard-budget-sdk-proposal.js` toma el UID de un contexto Auth/db vivo, exige conexión confirmada y connectionEpoch estable, fija rol/permisos/grants/zona/locale antes/después y valida el DTO dos veces. Recibe getAsOfDay del host; no redefine fechas de actividad. Usa una query de cinco eventos y páginas badge de hasta 50, con cursor inclusivo y ancla validada. Una página llena necesita otra; presupuesto agotado da error. No crea listeners, temporizadores, caché entre solicitudes o peticiones HTTP al backend.

`metrics()` es independiente de actividad: tras invalidación explícita puede seguir mostrando KPI certificados. `read()` combinado rechaza actividad no certificada, sin devolver un prefijo vacío engañoso. El binding de Core v2 conserva ms y ordinales; no acepta el contrato diario/hash como instante.

## Reglas candidatas y evidencia

`security/dashboard-budget-sdk-rules.proposal.cjs` genera **sólo una base standalone para namespace ficticio**, no un merger de reglas de producción. Niega por defecto todas las lecturas/escrituras. Concede únicamente DTO del auth.uid y queries acotadas del ámbito certificado, con rol activo, perfil canónico propio, revisión de permisos, módulos, gates reset/accessVersion y generación/revisión coincidente con coverage. Reutiliza GUARD de password-policy. El índice UID agregado sólo sirve al oráculo Admin; no concede lectura de directorio.

No hay permiso en un padre que anule estos controles. Se niegan raíces, fuentes privadas, metadata global, originales, otro UID, otro scope, cursores de documentos, queries sin límite y escrituras create/update/delete, incluido un patch combinado de rol y autoconcesión. Claims ficticios admin/svLaborService no dan privilegios. La autoridad proviene de RTDB protegida y del certificado derivado, no del rol enviado por el cliente.

Pruebas: `node --test test/dashboard-budget-sdk-proposal.test.cjs` (6). Opt-in nativo: `test/dashboard-budget-sdk-emulator.integration.cjs`, con `SV_BUDGET_SDK_EMULATOR=1`, `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9058`, `SV_BUDGET_ADMIN_MODULE` y `SV_BUDGET_SDK_DIR` apuntando a instalaciones existentes. Se fijan hashes de los módulos oficiales y se usan mock user tokens del emulador; **no** prueba login/Auth real. Datos sólo ficticios, namespace demo-budget-sdk-PID y limpieza verificada. No se despliegan reglas.

Caso de 5.051 propios más uno ajeno: resultado idéntico al oráculo en KPI, prefijo y badge, con **5 GET lógicos SDK frente a 37 del oráculo**, sin originales leídos por el cliente. DTO de resultado observado: 1.788 bytes JSON. Son conteos de operaciones y serialización en loopback; no prueban latencia de producción, tráfico físico, facturación o ahorro monetario.

Se prueban revocación por reset, accessVersion, rol inactivo, módulo retirado, cambio tardío de indiceRevision, certificado de perfil duplicado, desconexión antes de reutilizar snapshot, metadata vencida/ausente y vacío explícitamente certificado. Las denegaciones se ejecutan con el SDK real y reglas compiladas, no sólo con stubs de permisos. La primera corrida falló al consultar el oráculo por faltar el índice UID; se conservó y se corrigió sin conceder lecturas.

## Continuidad y límites que siguen abiertos

- El candidato **todavía no soporta** cualquier `bloqueados` legacy presente. Falla cerrado, incluso si sólo contiene un módulo ajeno. El oráculo puede permitirlo; esa diferencia se reproduce y documenta. No se amplían permisos ni se activa un fallback por excepción. Falta inventariar/normalizar el índice de permisos o justificar un único camino compatible para esos roles.
- La unicidad del perfil se certifica con el snapshot canónico completo. Cambios de autoridad deben invalidar cobertura en el mismo protocolo. El namespace de prueba niega todas las escrituras cliente de autoridad; no demuestra que todos los escritores reales ya estén cerrados.
- El protocolo existente aún **no mantiene estos DTO públicos**. Una revisión privada avanzada deja el DTO viejo denegado. La prueba refresca sólo la proyección derivada en el namespace ficticio para comprobar continuidad: KPI funciona con activityReady=false y actividad sigue rechazada. No modifica presupuestos originales ni demuestra mantenimiento continuo de escritores reales.
- La cobertura de ordinales sigue invalidándose en cambios de orden según v2. No se resolvió aquí la reconciliación ni los otros proveedores de actividad. Metadata antigua nunca se considera cero ni lista completa.
- Se probó el gate RTDB reset/version, no la equivalencia total con verifyIdToken(checkRevoked=true) contra el proveedor real. Ese requisito de sesión sigue pendiente antes de seleccionar el camino activo.
- Faltan composición contra reglas remotas revisadas, fence de todos los escritores, proyección atómica en cada commit, preparación/reconciliación, integración de captura conexión/epoch del host, consumidores y despliegue. Las reglas standalone no deben copiarse sobre la base comercial.

El siguiente corte deberá escoger un solo transporte activo. Esta prueba hace viable evaluar primero SDK directo; no autoriza montar ninguno ni retirar el listado completo.
