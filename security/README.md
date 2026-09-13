# Restricción de identidades Firebase — primera fase

13 de septiembre de 2026. **Aplicada y verificada en producción**, después de recibir autorización específica del usuario. La revisión automática había exigido esa autorización por su alcance global.

Resultado: nueve comprobaciones de lectura reales correctas (siete identidades activas y rechazo de sesión anónima y no registrada), coincidencia exacta de las reglas publicadas con la candidata y ningún registro comercial modificado. Respaldo previo: `tmp/backups/reglas-identidad-1789304541772.json`.

## Cambio concreto

`database.identity.rules.json` conserva las reglas existentes excepto las dos condiciones generales de `sisventas`: exige autenticación y `activo === true` en `sv_chat_roles/{auth.uid}`. Ese registro solo es editable por administradores activos en las reglas existentes. No confía en el rol enviado por el navegador ni en la ficha editable de usuarios.

Esta fase bloquea sesiones no registradas y desactivadas. **No limita todavía las operaciones entre usuarios activos por módulo**: sigue pendiente sustituir los permisos amplios dentro de `sisventas`. No presentar este cambio como cierre de la auditoría.

## Compatibilidad comprobada

- 7 usuarios reales: todos activos, vinculados al registro protegido, roles y estados coherentes; incluye un administrador activo. Verificación de lectura sin imprimir datos personales.
- 19 pruebas aprobadas en RTDB Emulator: acceso de los cinco roles, rechazo anónimo/no registrado/inactivo, imposibilidad de autopromoción en identidad protegida, escritura multipath atómica, borradores privados y restricciones existentes del chat.
- Función real `_registrarCobroAtomico` del archivo activo: dos cobros simultáneos sobre el mismo saldo, exactamente uno confirmado, preservando centavos.
- La prueba descubrió un defecto preexistente: con caché inicial nula, la función abortaba antes de leer el servidor. Se reprodujo con las reglas anteriores y candidatas. El ajuste local devuelve null en esa primera invocación para permitir la comparación de versión y reintento de Firebase; no altera el cálculo ni separa el pago del resumen de la venta.
- Activar/desactivar usuario actualiza ficha, identidad y directorio con una única actualización atómica. Ese ajuste de interfaz sigue local y requiere publicación posterior para alcanzar la web.

## Ejecutar las pruebas

Las dependencias del emulador están aisladas de la aplicación:

```powershell
npm install --prefix tmp/firebase-security-tools --no-audit --no-fund --ignore-scripts firebase-tools@15.30.0 firebase@10.12.0 @firebase/rules-unit-testing@3.0.4
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-firebase-identidad.ps1
```

El proyecto empieza por `demo-`; las pruebas abortan si el host no es `127.0.0.1:9005`. Solo se usan datos ficticios. La suite carga explícitamente las reglas candidatas.

## Aplicación controlada

`scripts/aplicar-reglas-identidad.cjs` sin argumentos solo verifica. La variante `--apply` se ejecutó con autorización específica. Antes de escribir vuelve a comprobar las identidades y exige que las reglas remotas coincidan exactamente con la base auditada y la candidata probada. Guarda un respaldo de reglas en `tmp/backups`, publica únicamente reglas y verifica su lectura y accesos. No escribe registros comerciales. Después de aplicado, su comprobación de base impide ejecutarlo de nuevo accidentalmente.

Una respuesta incierta debe resolverse leyendo las reglas remotas antes de cualquier reintento. Si difieren de la candidata o falla un acceso, investigar y usar el respaldo exacto solo como reversión controlada; no generar permisos más amplios como solución improvisada.

## Siguiente fase y restricción técnica

Inventariadas transacciones raíz: aprobación de horas extra, aguinaldos, crédito histórico y cobros. Quitar la autorización raíz sin adaptar esos recorridos bloquearía sus escrituras. La autorización por módulo requiere migrar esas operaciones a un servicio con permisos explícitos o reorganizar su dominio transaccional, manteniendo validación y concurrencia. Añadir un veto en un nodo hijo no revoca un permiso concedido por su padre ([documentación oficial](https://firebase.google.com/docs/database/security/core-syntax)).

La siguiente fase debe proteger también fichas de usuarios, configuración de Roles y datos sensibles. No confiar en comparaciones de objetos mediante `RuleDataSnapshot.val()`: no devuelve objetos con sus hijos ([referencia oficial](https://firebase.google.com/docs/reference/security/database)).
