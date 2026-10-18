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

Cuenta corriente y cobros: `node --test test/cuenta-corriente-payment-actions.test.cjs`.
Cubre identidad del cobro, agrupación/adjuntos, retorno con período y scroll,
permiso de Cobranzas, visor solo lectura y saldos con el historial completo.
Recorrido aislado en `dev-module-audit.cjs`, botón Cuenta corriente de prueba.

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

Transporte comercial: `node --test test/commercial-transport.integration.cjs test/commercial-ownership-session.test.cjs`.
HTTP real en loopback con datos ficticios, sin credenciales. La integración no
forma parte del glob general `.test.*`: ejecutar explícitamente. Alcance y límites
en [RENDIMIENTO_COMERCIAL.md](../docs/RENDIMIENTO_COMERCIAL.md).
## Auditoría de distribución de formularios

Ver [AUDITORIA_FORMULARIOS.md](../docs/AUDITORIA_FORMULARIOS.md). La herramienta aislada `node scripts/dev-module-audit.cjs` registra medidas de las cuadrículas en los recorridos de módulos, ventanas y editores; incluye Recorrer configuración. Esperar a que termine cada recorrido antes de iniciar otro. No ejecutarlos sobre producción ni sobre8766, que usa datos reales.
