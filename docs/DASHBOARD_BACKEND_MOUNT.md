# Montaje backend y empaque de Dashboard

2026-11-04. Implementación local aislada desde `5bde629d`, rama `codex/dashboard-backend-mount`, checkout `C:/SisVentas/.local/dashboard-backend-mount`. No activa flags de corte, despliega, crea servicios ni modifica SDK/UI, fuentes comerciales, reglas o contratos de ownership.

## Flags y requisitos de arranque

Todos los flags nuevos son false por defecto; variables de entorno sólo reconocen el literal `true`. createLaborRuntime también permite booleanos explícitos y rechaza otros tipos.

| Variable | Efecto | Prerrequisitos |
|---|---|---|
| DASHBOARD_BUDGETS_ENABLED | Inyecta el writer de Presupuestos en el guard existente | LABOR_SCOPED_ENABLED y COMMERCIAL_PAGES_ENABLED |
| DASHBOARD_COMMERCIAL_ACTIVITY_ENABLED | Inyecta el proyector de actividad de Ventas/Pagos/OT | Mismos requisitos |
| DASHBOARD_BUDGET_POLICY_RENEWAL_ENABLED | Habilita la renovación preparada de política con ownership equivalente | Writer de Presupuestos habilitado |
| DASHBOARD_READS_ENABLED | Habilita las cinco rutas GET preparadas | Guard, Pages y ambos writers habilitados |

Una combinación incoherente aborta el arranque antes de consultas/credenciales. No comprueba ni prepara automáticamente metadata remota: al leer o guardar se conservan las validaciones existentes de coverage/generation/proof. Con writers habilitados, prepare/assign de Presupuestos usa el fence comercial del actor aunque Accounts esté apagado; sin ese flag se conserva el comportamiento anterior. No se agrega otro bloqueo, recibo ni autorización.

El payload público existente de capabilities permanece sin campos nuevos; los flags son configuración interna de arranque.

## Rutas y lectura

- GET `/commercial/dashboard/presupuestos/actividad-v2`: lector preparado de KPI, actividad y badge.
- GET `/commercial/dashboard/presupuestos/avisos`: lector preparado de candidatos de avisos.
- GET `/commercial/dashboard/ventas/actividad-v2`.
- GET `/commercial/dashboard/pagos/actividad-v2`.
- GET `/commercial/dashboard/ordenes_trabajo/actividad-v2`.

Se devuelve directamente el resultado de los lectores existentes, sin alterar schema/DTO. Se reutilizan Auth real, verificaciones de revocación/reset, identidad, permisos actuales y validación de solicitud existente. No admiten POST, cuerpo, query ni view-as; responden sin caché. OPTIONS conserva el preflight global previo.

Los controladores reciben el puerto Admin de **lectura** nativo para mantener consultas indexadas fuera del overlay de escrituras (éste protege también sv_usuarios y bloquea formas de consulta durante coordinación). Eso no cambia su autorización: los mismos lectores verifican el actor fresco y sólo consultan metadata/prefijos, sin conversiones, prepare ni guardados incidentales. Las pruebas hacen fallar cualquier transporte de guard al leer y cualquier lectura de originales.

Contexto explícito del backend: IANA `America/Argentina/Buenos_Aires`, locale `es-AR`. Los codecs conservan la canonicalización existente a `America/Buenos_Aires`. El día de evaluación del badge se calcula dentro de la solicitud con esa zona; no hay timer, observador, consulta periódica ni mutación de TZ global. Se exige preparación compatible; no se reconvierte el histórico para adaptarlo.

## Contenedor y sincronización de helpers

Dockerfile copia explícitamente los doce módulos backend de Dashboard y conserva el patrón existente de commercial-models. Se copiaron byte a byte desde js/core: dashboard-activity-instant.v1.js, dashboard-activity-model.v2.js, dashboard-budget-notice-model-proposal.js y permission-index.js. Los require del backend apuntan únicamente a esas copias; no cambia código canónico del frontend ni hay fallback a ../js/core. El modelo de actividad conserva su require hermano del helper de instante.

El delta Legacy de Hist no existe en la base 5bde629d y **no se importó ni se adivinó**. Al fusionarlo, root debe copiar también `js/core/dashboard-budget-notice-legacy-proposal.js` a commercial-models y sincronizar NoticeModel/adapter/Index según el delta revisado; conservar el require hermano correspondiente. Repetir hashes y la prueba de dependencias antes del empaquetado final. DTO de 23 campos y Source.row de 17 no se amplían aquí.

## Verificación local y límites

**128 PASS, cero FAIL/SKIP**, focales de arranque/empaque/rutas y regresiones relacionadas; no puerta general. Incluyen nueve casos nuevos del montaje, dependencia Docker vigente, política runtime, writer/headers/renovación, lectores, actividad/races, commit mixto y pausa de admisión. Configuraciones false/true pasan por el index real con Auth/DB/HTTP y listen ficticios. Las cinco rutas devuelven DTOs preparados; identidades inactivas, módulos revocados y coverage corrupta se rechazan sin entrar al guard.

La prueba reconstruye en una carpeta temporal **sólo el payload de COPY**, sin ../js, y vuelve a arrancar el index con flags false/true. También contrasta hashes exactos de los cuatro helpers canónicos y comprueba dependencias transitivas. No hubo construcción/ejecución de una imagen Docker real (CLI no disponible); no se presenta la simulación del payload como tal. No se abrió un puerto ni un navegador. La frontera de contexto del harness VM se clona al host para evitar prototipos de otro realm en los validadores reales; no se reemplazan algoritmos, DTOs ni resultados de los lectores.

Se conservan logs privados de iteraciones iniciales del montaje/harness; incluyeron el uso incorrecto del overlay para leer, una expectativa de mensaje y el objeto de contexto VM. El resultado final está en `C:/SisVentas/tmp/stage1-integral-plan/dashboard-backend-mount-final.private.log`, SHA256 `a7ba04734e4eb74ad3935cef1b49c6089213f066dc2f5e4af4266cf5da85fa34`. Sintaxis de JS/CJS afectados y diff-check: PASS. Dependencias existentes vía NODE_PATH; sin instalar paquetes. No se repiten aquí los opt-in nativos de la fuente anterior ni se acredita producción, paridad Legacy aún en revisión o aceptación global.

Pendiente de la integración: fusionar el delta Legacy y sus copias; coordinar consumidores/avisos y fences de todos los escritores; validación final conjunta y preparación/corte explícitos. Este commit técnico deja los nuevos callbacks deshabilitados por defecto.

Integración raíz posterior: se incorpora Legacy y el NoticeModel actual como copias byte exactas; un chequeo detectó y se corrigió la diferencia LF/CRLF de permission-index, sin cambiar la expectativa. Los flags permanecen apagados y el montaje de frontend/corte remoto sigue pendiente.
