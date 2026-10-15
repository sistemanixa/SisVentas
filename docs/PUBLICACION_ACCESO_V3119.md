# Publicación coordinada de acceso v3.11.9

Preparada el 15/10/2026 desde `origin/main` `9fdaeb8f8513aeaf07b85997257487ddc3875b5f`, con el bloque local `da7d0cc7ba92e42a873f7ccb114bc5a81e60ccf0` y verificadores adicionales de los endpoints fiscales, asistente y audio. La rama de publicación es `codex/publicar-acceso-v3119`; no integra la rama completa de auditoría ni su corte pendiente de permisos por dominio.

## Alcance

Cliente v3.11.9: gestionar acceso desde Usuarios con confirmación del administrador, clave temporal de 24 horas mostrada una sola vez, cambio obligatorio y correo estándar de restablecimiento al email de Auth validado por UID. La comprobación automática del servicio es de solo lectura; no requiere generar una temporal ni enviar un correo. Se incluye la corrección de llegada tardía del vínculo de cuenta propia de v3.11.8 de la que depende este cliente.

Servidor: bloqueo de sesiones temporales o anteriores al restablecimiento en Cotizador, facturación, prueba fiscal, Asistente y transcripción. Los verificadores fiscales/asistente conservan los permisos y las operaciones anteriores; no cambian facturas ni comisiones. Las URLs de revisiones de prueba deben apuntar también a los verificadores nuevos para evitar caminos alternativos.

## Evidencia previa al corte

- Rama de auditoría: **1.567 pruebas generales**, **94 del servicio Cotizador** y **20 comprobaciones Chromium** en 1366×900 y 390×844, sin fallos. Paquete de publicación aislado desde main: **1.561 pruebas generales aprobadas**. La diferencia corresponde a comprobaciones de borradores conservadas solo en auditoría; no se excluyó una prueba fallida para publicar.
- Integración con Auth, RTDB y Storage en el proyecto demo: emisión temporal, bloqueo, clave personal, tokens antiguos, adjuntos y correo/enlace emulados. No cambió ninguna contraseña real ni se enviaron correos reales.
- Las revisiones nuevas en 0% conservan variables/secretos, cuenta de servicio y recursos de la configuración previa. Se probaron rutas protegidas sin identidad y con token inválido: rechazan con 401 antes de procesar datos o llamar a proveedores.
- Proveedor email/password, dominios autorizados y plantilla de recuperación ya configurados. Se configuraron `USER_ACCESS_ENABLED` y `FIREBASE_WEB_API_KEY` del proyecto; esta última es configuración pública, no una credencial privada. Sin cambios de IAM.

## Reglas aplicadas para este bloque

- RTDB antes: `469548d26df33d734ab426bbee17f696bf2eafa3ab8e8a4f955473aee596b427`.
- RTDB con guard de acceso: **`2fab3dfbda44e88c165729f4ab41bdcd8c3b36318f8dd280d81286675a20b56c`**, hash del JSON normalizado. Conserva la política previa y añade la condición a cada concesión; los nodos de marca, auditoría y límites son privados. No aplica las candidatas de lecturas por módulo/dominio. Se comprobó que no existía estado de recuperación antes del corte y se compararon nuevamente las reglas antes de escribir. El endpoint de reglas no devolvió ETag: la comprobación previa no equivale a una escritura condicional atómica.
- Storage: se conservó la fuente remota exacta, coincidente con `storage.rules`, y se añadió únicamente el rechazo del claim de cambio pendiente. Fuente SHA-256 **`a5f8774fb509b2262a1827dcd1fbb9eeb0ce641955fa6039d4c24a6e59e6147e`**; ruleset nuevo **`a2b7337a-c540-4192-9ff8-3e6d567e3ce9`**, anterior `619ae59c-6104-4a9c-bec9-b857df73db37`. Release: `firebase.storage/nixa-sisventas.firebasestorage.app`. Compilación y lectura posterior correctas.
- No se modificaron datos comerciales, perfiles, roles, contraseñas o comisiones como prueba. No se eliminan copias históricas de contraseñas en este bloque.

## Revisiones y secuencia

| Servicio | Previo | Nuevo preparado |
| --- | --- | --- |
| Cotizador | `cotizador-00096-vin` | `cotizador-00100-boc` |
| Asistente | `asistente-00020-qat` | `asistente-00022-wod` |
| emitirFactura | `emitirfactura-00026-rew` | `emitirfactura-00027-yed` |
| testTFApp | `testtfapp-00008-yuw` | `testtfapp-00009-rux` |

Las dos funciones fiscales ya finalizaron su actualización. Cotizador y Asistente se construyeron primero sin tráfico; queda registrada por separado la activación exacta y la confirmación final. La revisión automática de aprobación requirió una confirmación específica para el 100% de tráfico y sus 11 etiquetas de prueba; no se sustituyó ese paso por una vía indirecta.

Después del corte: verificar tráfico/etiquetas, publicar solo el paquete revisado en main, esperar los activos de GitHub Pages, comprobar diagnóstico real del administrador sin acciones de recuperación, y recién entonces sincronizar `sisventas/config/version`. Un commit o una revisión sin tráfico no confirman la publicación.

Respaldos de configuración/reglas y evidencia privada: `tmp/publicacion-acceso-v3119/` en la PC original, excluidos de Git. Los secretos permanecen en sus servicios/Secret Manager. La reversión de reglas y tráfico a la versión previa es adecuada **antes de usar temporales reales**; si ya hay marcas de cambio pendiente, no retirar su protección ni volver a servidores que la omiten. En ese caso detener nuevas emisiones y recuperar conservando el guard.

## Límites y pendientes ajenos a esta publicación

Storage no consulta la marca RTDB: un token anterior sin claim temporal puede conservar acceso a sus adjuntos hasta vencer, y las URLs de descarga tienen su propio ciclo. Las pruebas no acreditan revocación instantánea de todos los enlaces. Las copias históricas de claves en fichas requieren inventario y limpieza privados aparte. Sesión real de Osmar y teléfono/reconexión siguen pendientes; no se cambió su contraseña para probar.
