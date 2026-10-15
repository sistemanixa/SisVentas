# Validación del corte progresivo de permisos

Estado al 15/10/2026: **plan de validación; ninguna candidata aplicada**. Producción sigue con cliente v3.11.7. Ver [CONTEXTO_ACTUAL.md](CONTEXTO_ACTUAL.md) antes de ejecutar cualquier corte.

## Etapas y condiciones

| Etapa | Artefacto | Resultado y límite |
| --- | --- | --- |
| Base remota | `database.domain-write.candidate.json` | Coincide estructuralmente con la última lectura de producción. Mantiene lectura padre para internos activos, incluso roles desconocidos distintos de los dos portales. |
| A: roles conocidos | `database.known-role-read.candidate.json` | Cambia únicamente la lectura padre. Conserva los accesos de roles internos conocidos; **todavía permite leer cuentas ajenas por herencia**. No equivale a aislamiento por empleado. |
| Intermedio de generación | `database.domain-read.candidate.json` | **No desplegar de forma independiente**: rechaza consultas propias de Gastos y Vacaciones que utiliza el técnico. Es entrada para la siguiente etapa. |
| B: dominios y cuentas propias juntos | `database.employee-account-read.candidate.json` | Incluye las excepciones de consultas propias y sus índices. Las dos identidades ficticias leen su cuenta, sus consultas por `empleadoId`/`empleadoFbKey` y sus vacaciones; se rechazan las ajenas y colecciones completas. Requiere vínculos protegidos correctos. |
| C: escrituras finales | `database.audit-final.candidate.json` | Conserva las consultas propias. Prueba de dos transacciones técnicas concurrentes de stock sin perder unidades; precios protegidos. No acredita todavía todas las operaciones de OT, ventas, cobros o personal. |

La etapa B debe ser una actualización atómica de reglas que incluya dominios y excepciones propias, sin dejar en producción el snapshot intermedio. Esto **no autoriza reemplazar datos de la base**. El permiso padre no puede usarse como arreglo para una denegación de un hijo.

## Huellas de reglas comprobadas

SHA-256 sobre `JSON.stringify(JSON.parse(archivo))`, UTF-8:

| Artefacto | SHA-256 |
| --- | --- |
| Base/remotas | `469548d26df33d734ab426bbee17f696bf2eafa3ab8e8a4f955473aee596b427` |
| Roles conocidos | `1e92494249911fa6a0cc7d20ecf388ef029a496c23ec5f48a1120238d2371938` |
| Dominios intermedios | `436b2db821ed839364ce02f8e00afc30a5074a86af1cbb06f08e522550cf2ba5` |
| Dominios + cuenta propia | `06941199aea375f5acba957e4c07466e44637e3a7a5525b82c871014baeb1819` |
| Final | `4fabf4a04a9d2a195ad368bc5e62a83936bc57ec77add3de1c50815afb83b470` |

Si cambia una huella, detener ese corte, revisar diferencias y repetir las pruebas afectadas. No tratar las huellas de este documento como una autorización para desplegar.

## Evidencia reproducible

- `node scripts/verify-handoff-manifest.cjs`: integridad del paquete de trabajo; no prueba permisos.
- `node scripts/test-security-drafts.cjs --emulator`: cinco suites, **30 casos aprobados** con datos ficticios en `demo-sisventas-security`, RTDB en `127.0.0.1:9005`; no cambiar ese destino por producción. Necesita Java 21 y las dependencias indicadas en [TRASLADO_NUBE_SEGURIDAD.md](TRASLADO_NUBE_SEGURIDAD.md).
- `test/cut-progression.integration.cjs` comprueba explícitamente el límite inseguro del snapshot intermedio y las consultas propias en las dos candidatas combinadas. La transacción de stock es una prueba de concurrencia de ese campo; no sustituye el flujo completo de rendición de materiales.
- Las pruebas con una sesión propia real y las de emulador acreditan cosas distintas: la primera verifica el cliente contra reglas vigentes, y la segunda comprueba las candidatas con identidades ficticias. «Ver como» no reemplaza ninguna de las dos.

## Validaciones que deben preceder al corte

1. Volver a leer las reglas remotas y guardar copia/huella por canal privado, sin tokens. Comprobar que siguen siendo la base revisada y preparar su reversión exacta. No usar un respaldo de datos como archivo de reglas.
2. Revisar identidades activas por rol y vínculos protegidos, conservando la privacidad. No inferir identidad por nombre/correo ni ampliar permisos para compensar un vínculo ausente. Verificar compatibilidad de los permisos guardados y sus overrides con la política del cliente.
3. Completar sesiones propias de Mauro y Osmar, con recarga directa de Mi cuenta, Dashboard, menú, OT, cambio de cuenta y retorno, en escritorio/ancho móvil. Probar teléfono físico, suspensión y reconexión por separado. No guardar operaciones ficticias en Firebase real.
4. Distribuir y comprobar las correcciones necesarias del cliente antes de restringir lecturas. En la validación de Mauro se encontró una carrera de llegada de perfiles/directorio: v3.11.8 la corrige **solo local**, todavía sin publicar.
5. Revisar los registros antiguos que puedan contradecir validaciones nuevas, sin modificarlos. Probar las operaciones de escritura afectadas y los caminos de rechazo/concurrencia con fixtures; no basta que cargue Dashboard.
6. Revisar por separado la gestión de contraseñas: hay código heredado que guarda una copia en la ficha y un botón que llama a una función ausente. No confundir esa copia con la contraseña vigente de Auth. No leer, exportar ni trasladar claves para facilitar las pruebas.
7. Presentar la etapa exacta, huella, condiciones, evidencia y reversión antes de un corte de producción autorizado. Mantener los otros cambios separados. Tras cualquier corte, comprobar lecturas/errores y revertir las reglas exactas si falla una operación necesaria; nunca conceder lectura padre como atajo.
