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

Gestión de acceso (solo cuentas ficticias): `node scripts/test-user-access.cjs`
ejecuta Auth, RTDB y Storage en emuladores demo. La interfaz se comprueba con
`test/browser/user-access.cjs`. Configuración y límites en
[GESTION_ACCESO_USUARIOS.md](../docs/GESTION_ACCESO_USUARIOS.md).

Permisos por dominio con el guard de acceso publicado: ejecutar
`node scripts/test-security-drafts.cjs --emulator --with-access-guard`.
Reutiliza los 30 escenarios de permisos y añade 8 de bloqueo temporal,
revocación por versión, nodos privados, consultas propias y portal externo.
Usa exclusivamente RTDB demo en loopback; no aplica reglas remotas ni
requiere cuentas reales. Las seis regresiones de generación offline forman
parte de la suite general. Estado y límites en
[PLAN_CORTE_PERMISOS.md](../docs/PLAN_CORTE_PERMISOS.md).
