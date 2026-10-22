# Pruebas de SisVentas

La puerta de publicación de la versión activa se ejecuta con:

```powershell
.\scripts\test-current.ps1
```

Los archivos `incremental-*`, `release-*` y `v3-architecture.test.js` son
instantáneas históricas. Conservan verificaciones útiles sobre sus artefactos,
pero varias contienen aserciones de publicación (por ejemplo, que
`index.html` todavía apunte a v2.0.x). Por esa razón no forman parte de la
puerta de la versión actual: una publicación nueva no debe modificar ni hacer
pasar artificialmente esas expectativas antiguas.

Las pruebas funcionales vigentes deben leer la aplicación declarada por
`index.html` mediante `test/helpers/active-app.js`, nunca el espejo legado
`js/app.js` ni un nombre de versión fijado a mano.

Atajos de guardado: `node --test test/keyboard-actions.test.js test/keyboard-budget-primary.test.cjs test/keyboard-sale-primary.test.cjs`.
F5 usa la acción principal explícita de Venta o Presupuesto en el ámbito
visible, respeta modales y estado ocupado; F8 conserva su comportamiento.
La prueba de doble tecla verifica la fase ocupada del botón, sin ejecutar
un guardado real ni alterar la validación financiera de confirmarVenta.

Paquete Cotizador: `node --test test/cotizador-container-dependencies.test.cjs`.
Comprueba que los archivos JS del Dockerfile actual incluyan sus `require`
relativos literales. Detecta la omisión del lector comercial en la imagen;
no ejecuta Firebase ni reemplaza construir y comprobar el arranque de la
revisión exacta antes de mover tráfico. Cambios de etapas, destinos o sintaxis
COPY requieren revisar también el alcance de esta prueba.

Cobros y altas de Gastos acotadas:
`node --test test/payment-commands.test.cjs test/payment-membership-index.test.cjs test/payment-index-preparation.test.cjs test/payment-guard-integration.test.cjs test/admin-expense-create.test.cjs test/admin-expense-client.test.cjs test/financial-commands.test.cjs test/payment-entry-idempotency.test.cjs test/payment-related-frontend-contract.test.cjs test/relationship-normalization-atomic.test.cjs test/relationship-normalization-gateway.test.cjs`.
Usan datos ficticios, preservan los criterios contables publicados y verifican
permisos, concurrencia, referencias legacy, reintento y errores posteriores al
acuse. Recuperación complementaria: `test/labor-write-recovery.test.cjs`.
Recibo PDF: `node --test test/payment-receipt-pdf-layout.test.cjs`; comprueba
clon de exportación, contenido largo, mismo blob para descargar/compartir,
impresión y recuperación ante errores. La prueba raster real y sus PDFs/PNG
son evidencia privada complementaria, no se descargan librerías en la puerta.
Plan de cancelación: `node --test test/private-finance-plan-rate-source.test.cjs`;
13 casos de procedencia de TEM manual/resumen, vacío/cero, escenarios y cambio
de tarjeta sin modificar los resúmenes ficticios.

Baja administrativa de Gastos: `node --test test/paid-expense-admin-removal.test.cjs test/expense-removal-policy.test.cjs test/expense-removal-guard.test.cjs test/expense-removal-rules.test.cjs test/labor-expense-edit-delete-compensation.test.cjs`.
Comprueba permiso real de administrador, pagos/compensaciones conservados,
tabla operativa, acuse, reintentos y protección del gateway genérico.
`test/expense-removal-emulator.integration.cjs` es opt-in: requiere
`FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9037` y `SV_RULES_TEST_FILE` con
la base coordinada revisada (hash verificado). Sólo usa datos ficticios en
`demo-expense-removal-proof`; deriva y prueba la candidata sin aplicarla en
producción. Diez casos con permiso eliminar sin administrar y revocación al commit.

La publicación independiente de Gastos usa `scripts/prepare-expense-removal-rules.cjs`,
sin activar los cambios de Pagos/índices del builder combinado. Su prueba
`test/expense-removal-standalone-rules.test.cjs` verifica el alcance de cinco
reglas y el recibo condicionado; `test/expense-removal-standalone-emulator.integration.cjs`
es opt-in con las mismas variables de loopback/base, namespace exclusivo
`demo-expense-removal-only-proof`. Incluye revocación final con administrar habilitado
y otra acción financiera intacta. El caso de compatibilidad del vendor fiscal anterior
requiere además `SV_FISCAL_LABOR_VENDOR` apuntando al paquete privado local indicado
en la prueba; su ausencia produce skip, no aprobación de compatibilidad.

Eje mensual del simulador: `node --test test/private-finance-plan-chart.test.cjs`.
Comprueba Inicio/meses 1–12, los trece puntos y la tabla/resultados sin fechas inventadas
ni cambios de saldos. La legibilidad en anchos móviles se verifica visualmente aparte.

Conceptos reutilizables: `node --test test/bonus-concepts.test.cjs test/bonificacion-concepto-integration.test.cjs test/bonus-history-index.test.cjs`.
Prueba catálogo separado, CAS, acuse ambiguo, baja sin resurrección, permisos,
lectura puntual al Usar, historial desconocido y metadatos de CTA/Gasto conservados
al pagar. El módulo no genera comisiones ni modifica Haberes al editar un concepto.
Los opt-in `bonus-config-emulator.integration.cjs` y
`bonus-concept-financial-emulator.integration.cjs` requieren loopback9037 y
`SV_BONUS_RULES_TEST_FILE` con la base revisada dc05032c…; sus namespaces demo
son exclusivos. Prueban reglas existentes de configuración y el nuevo índice,
sin publicar ni ejecutar operaciones productivas. Un skip no prueba integración.

Privacidad Dashboard: `node --test test/dashboard-privacy.test.cjs`.
Verifica los controles individuales y maestro, estado mixto, preferencias por
cuenta, roles, repintados y ocultación accesible del resumen completo. No consulta
datos ni cambia cálculos; la distribución y los glifos se revisan en navegador.

Opt-in RTDB: `test/payment-scoped-emulator.integration.cjs` requiere
`FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9037`, `SV_RULES_TEST_FILE` con la
base local coordinada revisada y `SV_EMULATOR_DEPENDENCIES` con una ruta local
de resolución de `@firebase/rules-unit-testing`; Firebase Admin se resuelve desde
las dependencias existentes de Cotizador. El archivo valida el hash de la base y deriva reglas
candidatas restringidas. Sólo usa el namespace `demo-payment-scoped-proof` y
loopback explícito; no ADC ni datos productivos. No ejecutar contra una base
real ni interpretar un skip como una integración aprobada. Detalle y estado en
[Auditoría financiera](../docs/AUDITORIA_COBROS_GASTOS_20261022.md).

Cuenta corriente y cobros: `node --test test/cuenta-corriente-payment-actions.test.cjs`.
Cubre identidad del cobro, agrupación/adjuntos, retorno con período y scroll,
permiso de Cobranzas, visor solo lectura y saldos con el historial completo.
Recorrido aislado en `dev-module-audit.cjs`, botón Cuenta corriente de prueba.

Alcance de consultas y sesión: `node --test test/commercial-single-record-read.test.cjs test/supplier-directory.test.cjs test/commission-observer-startup.test.cjs test/cotizador-auth-default.test.cjs test/version-http-single-flight.test.cjs test/ot-data-sync-context.test.cjs test/catalog-promotions-context.test.cjs test/dolar-history-session.test.cjs test/audit-confirmed-operations.test.cjs`.
Comprueba autorización del registro exacto y de proveedores, arranque explícito del
observador, consultas simultáneas compartidas y respuestas de otra vista/sesión.
Abrir una OT no persiste una reparación histórica; las ediciones siguen siendo
explícitas. Los wrappers de bitácora retirados estaban inactivos con el orden
publicado: la prueba de carga tardía es preventiva, no evidencia de tráfico real.
Inventario y límites: [AUDITORIA_COTIZADOR.md](../docs/AUDITORIA_COTIZADOR.md).

Pantalla bloqueada y preparación de acceso: `node --test test/auth-foreground.test.cjs test/background-foreground.test.cjs test/foreground-session.test.cjs test/firebase-write-foreground.test.cjs`.
La regresión integrada usa perfil, almacenamiento protegido y plazo real con reloj
ficticio: esperar oculto no consume el plazo ni deja un GET huérfano al volver.
Demostración aislada: `node scripts/dev-foreground-audit.cjs`, loopback8882,
`/?hidden=1`. Sólo GET locales y Auth/SDK ficticios; no abre SisVentas real.
Validar aislamiento aparte con `node --test test/foreground-audit-isolation.integration.cjs`.
Confirmación del cobro y comisión: `node --test test/commission-payment-confirmation.test.cjs test/commission-generation-response.test.cjs`;
prueba orden, respuesta retenida, doble clic y cambio de sesión sin guardar datos reales.

Viewport del pago de cuenta: `node --test test/cuenta-payment-viewport.test.cjs`.
Cubre espacio visible con teclado, cierre/limpieza y fallback sin visualViewport;
la revisión visual usa Cuenta corriente de prueba y abre el pago sin confirmarlo.

Carga persistente y caché: `node --test test/sw-fallback.test.cjs test/update-recovery.test.cjs test/realtime-transport-policy.test.cjs`.
Reproducción anónima de transporte y límites en
[DIAGNOSTICO_CARGA_PERSISTENTE.md](../docs/DIAGNOSTICO_CARGA_PERSISTENTE.md).

Corte/retorno y cierre de sesión: `node --test test/reconnection-cycle.test.cjs`.
Fixture con lecturas reales y servidor ficticio: `node scripts/dev-reconnection-audit.cjs`;
su aislamiento se valida aparte con `node --test test/reconnection-audit-isolation.integration.cjs`
(requiere loopback). Evidencia y límites en [AUDITORIA_RECONEXION.md](../docs/AUDITORIA_RECONEXION.md).

Interacciones compartidas: `node --test test/system-dialog-interactions.test.cjs test/surface-scroll-stack.test.cjs`.
Demostración de navegador sin Firebase ni datos de negocio: `node scripts/dev-interaction-audit.cjs`,
solo loopback en8784. Casos, evidencia y límites en [AUDITORIA_INTERACCIONES.md](../docs/AUDITORIA_INTERACCIONES.md).

Recorridos con la aplicación completa y datos ficticios: `node scripts/dev-module-audit.cjs`,
loopback8786. Incluye controles para42 rutas,27 ventanas y9 vistas de edición;
no carga Firebase y bloquea servicios externos/escrituras HTTP. No usarlo para
medir producción ni para validar permisos reales. Integración de aislamiento:
`node --test test/module-audit-isolation.integration.cjs` (requiere loopback;
se ejecuta aparte de la puerta sin red). Las fixtures de Proyectos, finanzas y
Distribuidora completan las vistas con sus servicios ficticios en memoria.

Generación automática de comisiones candidata: `node --test
test/commission-generation.test.cjs` (24 pruebas funcionales sin credenciales).
El emulador de responsabilidad comercial también cubre generación, observador y
recuperación: `node scripts/test-commercial-ownership-emulator.cjs`, con las
dependencias/Java de AGENTS y solo el proyecto demo. Ver
`docs/COMISIONES_GENERACION_SERVIDOR.md`; no genera comisiones reales.

Gestión de acceso (solo cuentas ficticias): `node scripts/test-user-access.cjs`
ejecuta Auth, RTDB y Storage en emuladores demo. La interfaz se comprueba con
`test/browser/user-access.cjs`. Configuración y límites en
[GESTION_ACCESO_USUARIOS.md](../docs/GESTION_ACCESO_USUARIOS.md).

Proyectos: `node --test test/projects.test.cjs`; integración demo con
`node scripts/test-projects.cjs`; navegador aislado con
`test/browser/projects.cjs` y `test/browser/projects-bridge.cjs`.
Configuración, permisos y límites de validación en [PROYECTOS.md](../docs/PROYECTOS.md).

Selector de Proyectos: `node --test test/projects-selector-etag.test.cjs`.
Lector real con transporte ficticio: DTO completo, pertenencia/perfiles actuales,
errores sin datos obsoletos, fuente modificada y 304 tardío frente a respuesta nueva.
Sólo reduce cuerpos repetidos de una fuente sin cambios; la primera consulta sigue
leyendo el historial completo. No mide red productiva ni factura.

SAC sin suscripción huérfana: `node --test test/payroll-orphan-listener.test.cjs`.
Carga los cuatro módulos de Haberes en orden real sobre funciones activas: roles,
render/KPI/filtros, baja de escuchas y alta SAC con gateway/guard en memoria.
Conserva el cálculo, duplicados, CAS y pagos anteriores. Todo dato es ficticio;
el alta sigue usando sus validaciones históricas completas por acción explícita.

Transporte comercial: `node --test test/commercial-transport.integration.cjs test/commercial-ownership-session.test.cjs`.
HTTP real en loopback con datos ficticios, sin credenciales. La integración no
forma parte del glob general `.test.*`: ejecutar explícitamente. Alcance y límites
en [RENDIMIENTO_COMERCIAL.md](../docs/RENDIMIENTO_COMERCIAL.md).
## Auditoría de distribución de formularios

Ver [AUDITORIA_FORMULARIOS.md](../docs/AUDITORIA_FORMULARIOS.md). La herramienta aislada `node scripts/dev-module-audit.cjs` registra medidas de las cuadrículas en los recorridos de módulos, ventanas y editores; incluye Recorrer configuración. Esperar a que termine cada recorrido antes de iniciar otro. No ejecutarlos sobre producción ni sobre8766, que usa datos reales.

Conexión y recuperación: `node --test test/connection-transport-cycle.test.cjs` abre un servidor HTTP efímero sólo en127.0.0.1 y lo cierra/reabre dos veces. Forma parte de la suite vigente; necesita que el entorno permita conexiones loopback. Usa exclusivamente registros y token ficticios: no consulta Firebase ni Internet. Comprueba datos conservados, pausa durante el corte, recuperación automática de Ventas/Presupuestos,304 sin reconstrucción y recepción de cambios. No sustituye una prueba física de Wi-Fi en el navegador.

Control de consumo: `test/user-triggered-reads.test.cjs`, `test/commission-job-events.test.cjs` y `test/cost-guard.test.cjs` forman parte de la puerta vigente y usan datos ficticios. La integración opcional `node --test test/cost-guard-framework.integration.cjs` requiere instalar las dependencias fijadas de `cloud-functions/cost-guard/` y permitir HTTP en loopback; usa el framework real con credenciales bloqueadas y un aviso de octubre que debe ignorarse. Nunca enviar un aviso falso elegible de noviembre al controlador de producción. Ver [CONTROL_COSTOS.md](../docs/CONTROL_COSTOS.md).

Eventos de comisiones candidatos: pruebas de receptor/HTTP/reenviador forman parte de la puerta. `node --test test/commission-event-oidc.integration.cjs` requiere las dependencias fijadas de cotizador y usa firmas RSA efímeras con el verificador oficial, sin Internet. `node --test test/commission-forwarder-framework.integration.cjs` requiere las dependencias de cloud-functions/commission-events y HTTP de loopback; un contexto ficticio vencido no debe pedir credenciales. El runner comercial demo también comprueba reservas y permisos del receptor. Ver [COMISIONES_EVENTOS.md](../docs/COMISIONES_EVENTOS.md); ninguna de estas pruebas escribe en Firebase real.
