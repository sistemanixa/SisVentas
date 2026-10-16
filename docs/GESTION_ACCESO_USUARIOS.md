# Gestión de acceso: clave temporal y restablecimiento

Estado al 15/10/2026: **publicado y verificado en v3.11.9**, con servidores y guard de reglas activos por autorización del titular. Código `3bf92dac6290e76e09b24b5fb0c72c843cf6c2d7` en main, integra el catálogo de la otra PC desde `fea23c0d`; la rama completa de auditoría permanece aislada. Pages completed/success, 14 activos públicos coincidentes y marcador `v3.11.9-firebase` leído después de escribir. El diagnóstico real desde administrador devuelve «Gestión de acceso disponible.», sin generar claves ni enviar correos reales. Ver [PUBLICACION_ACCESO_V3119.md](PUBLICACION_ACCESO_V3119.md) para estado externo y evidencia. Este documento no autoriza nuevas acciones sobre usuarios.

## Comportamiento

- Usuarios → **Gestionar acceso** permite generar una clave aleatoria temporal o solicitar el correo estándar de Firebase. Ambas acciones exigen administrador activo, módulo Usuarios habilitado, permiso `usuarios.gestionarClave` y confirmación reciente de la contraseña del administrador. «Ver como» no puede ejecutar estas acciones.
- La clave temporal se muestra una vez, oculta inicialmente y con botón Mostrar/Ocultar. Dura 24 horas. Al cerrarla se limpia el campo; no queda una copia consultable en la ficha, almacenamiento web o registro de actividad. Si se pierde la respuesta no se repite la solicitud automáticamente: revisar y generar otra, como mínimo un minuto después.
- Al ingresar con la temporal se exige una contraseña personal distinta, entre 12 y 128 caracteres, antes de preparar perfiles, roles o módulos. El servidor aplica el cambio y exige volver a ingresar; cerrar el diálogo cierra la sesión.
- El correo se obtiene de Firebase Auth por el UID del perfil y debe coincidir con la ficha. No se acepta un destinatario arbitrario en el cuerpo de la petición. El correo **no cambia la contraseña hasta que su destinatario completa el enlace**. No expone el enlace al administrador ni lo almacena en RTDB.
- No se admiten perfiles duplicados para un UID, cuentas inactivas, roles/fichas divergentes, cuentas deshabilitadas ajenas al proceso ni la recuperación de la propia cuenta desde este diálogo. Para la cuenta propia usar el cambio personal o el restablecimiento desde el acceso.
- Si se envía correo a una cuenta que todavía tiene cambio temporal pendiente, ese cambio obligatorio permanece: completar el correo no lo elimina. Si la temporal venció o la operación quedó incompleta, el administrador debe emitir otra. No se desbloquea una cuenta solo por pedir un email.

## Protección y fallos parciales

`cotizador/user-access.js` usa Firebase Admin SDK. La marca privada `sv_access_resets/{uid}` cierra las lecturas/escrituras de RTDB antes de modificar Auth. Se deshabilita brevemente la cuenta mientras se sustituyen contraseña y claims; se revocan sesiones anteriores. Una versión aleatoria del acceso impide que los tokens previos vuelvan a servir cuando termina el cambio. El servidor no acepta completar el proceso con un token anterior, con otra versión, otro proveedor o la misma clave temporal.

Se guarda únicamente una derivación scrypt con sal de la temporal mientras está pendiente, para impedir reutilizarla; se elimina al completar. No hay contraseña legible en RTDB. Auditoría y límites privados en `sv_access_control` guardan acción/UID/fecha/versión, nunca contraseñas, tokens o enlaces.

Las transacciones serializan cambios sobre el mismo usuario. Un fallo parcial mantiene la cuenta protegida, con fase `failed`, y permite un nuevo intento administrativo. Una caída abrupta en `preparing`/`completing` requiere revisar Auth y la marca por un operador autorizado antes de recuperar el circuito: **no borrar la marca ni abrir permisos como solución**. La UI no anuncia éxito sin respuesta confirmada y libera sus botones tras errores.

Los verificadores de Cotizador y de `authenticatedUser` en emitir-factura comprueban esta marca y la versión; no basta ocultar controles. `security/database.password-access.candidate.json` deriva de la base vigente de escrituras, conserva la política anterior y añade el bloqueo a **cada** concesión de lectura/escritura, con denegación de los nodos privados. No combina automáticamente el corte de lecturas por dominio.

La candidata de Storage conserva propietario, tipos y tamaño, y rechaza tokens marcados con cambio pendiente. **Límite conocido**: las reglas de Storage no consultan la marca RTDB; los tokens anteriores sin ese claim pueden conservar acceso a adjuntos propios hasta vencer. La revocación de Auth no equivale a invalidar inmediatamente cada URL de descarga o token de Storage. Esto no autoriza ampliar la duración ni abrir archivos; revisar ese límite antes de un corte que requiera revocación instantánea también de adjuntos.

## Secuencia de configuración y verificación

1. Desplegar y verificar los verificadores de servidor, manteniendo `USER_ACCESS_ENABLED` ausente/`false`; no integrar toda la rama de auditoría. La imagen de Cotizador incluye los tres módulos nuevos en su Dockerfile.
2. Revisar reglas remotas exactas y respaldo privado; componer el guard sobre la etapa acordada con `scripts/prepare-password-access.cjs`. Aplicar únicamente en un corte autorizado las reglas revisadas de RTDB/Storage, con regresiones y reversión del alcance exacto. No reemplazar datos ni aplicar a ciegas la candidata incluida.
3. Configurar en el servicio `FIREBASE_WEB_API_KEY` (configuración pública del proyecto correcto, no una clave privada), proveedor email/password y plantilla/dominios de restablecimiento de Firebase. La cuenta de servicio necesita gestionar usuarios de Firebase Auth y leer/escribir las rutas privadas y consultar las reglas efectivas de RTDB. Configurar IAM por los mecanismos seguros del entorno, sin exportar credenciales al checkout.
4. Después de verificar servicios, reglas, cliente y el límite de Storage, habilitar explícitamente `USER_ACCESS_ENABLED=true`. Por defecto todos los endpoints de recuperación permanecen cerrados. Aun con la bandera activada, generar una temporal verifica las reglas efectivas mediante `getRulesJSON()` y falla sin cambios si falta el guard. No exige ni amplía permisos de clientes, ventas o comisiones.
5. Publicar el cliente coherente y verificar los activos antes del marcador remoto. El servidor real ya quedó preparado y su diagnóstico de solo lectura fue comprobado por el administrador. **No usar generación de temporales o envío real como prueba incidental**; las pruebas completas de recuperación usan emuladores y adaptadores ficticios.

## Contraseñas heredadas y vista administrativa

Se eliminaron las nuevas escrituras `claveAdmin` y la precarga de claves antiguas en Editar usuario. Guardar el perfil actualiza solo campos permitidos y no reenvía copias del snapshot. No se leyeron, exportaron, borraron ni migraron copias reales existentes: su posible exposición histórica y la lectura interna del directorio completo siguen siendo un hallazgo separado de la auditoría. Una migración de limpieza requiere inventario privado y autorización específica; nunca llevarla a Git ni registrar valores.

«Ver como» ya usa una fila compacta propia del shell, sin superponerse a la cabecera, con **Volver a Admin**. Conserva Auth del administrador y muestra identidad/módulos de la ficha elegida; no se le agregan permisos administrativos a la vista del técnico. Es revisión de experiencia, no prueba de sus reglas con Auth real. La sesión real de Osmar sigue pendiente porque el titular no tiene su contraseña y **no autorizó cambiarla para probar**.

## Verificación reproducible

- `node --test test/user-access.test.cjs test/user-access-login.test.cjs`: autorización, no-admin, UID/email, sesión reciente, reglas faltantes, errores, expiración, bloqueo, tokens antiguos, cambio y ausencia de claves en los parches del perfil.
- `node scripts/test-user-access.cjs`: Auth `127.0.0.1:9098`, RTDB `127.0.0.1:9005`, Storage `127.0.0.1:9198`, proyecto **demo-sisventas-access**, sin credenciales reales. Instalar herramientas como indica TRASLADO_NUBE_SEGURIDAD y Java 21. El runner copia reglas a `tmp/`, elimina variables de credenciales de los subprocesos y apaga emuladores. No sustituir esos hosts/proyecto por producción. Prueba también el correo y su enlace dentro del emulador; no implica entrega a una casilla real.
- `test/browser/user-access.cjs`, con `SV_PLAYWRIGHT_MODULE` y `PLAYWRIGHT_BROWSERS_PATH` del entorno: **18 comprobaciones**, 1366×900 y 390×844, datos/adaptadores ficticios; foco, diálogos, contraseña oculta, errores, correo, cambio obligatorio, salida y rechazo desde «Ver como». No prueba un teclado físico.
- Suite vigente, sintaxis, coherencia `-ValidarLocal` y `git diff --check`. Evidencias y capturas `tmp/user-access-*`, solo locales; no subirlas.

No se cambió ninguna contraseña real ni se enviaron correos reales. Las candidatas son propuestas; producción, main, reglas, servicios y marcador remoto permanecen sin modificar.
