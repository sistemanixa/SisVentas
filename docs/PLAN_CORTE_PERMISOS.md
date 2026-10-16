# Validación del corte progresivo de permisos

Estado al 16/10/2026: **corte compacto aplicado con autorización expresa**. Producción: **v3.11.11**, Cotizador `cotizador-00104-zuh` al 100%, reglas `e5dbd9b0ca5e7e63f7966184a39350184d55fa9d7c4111c23e82ef0beb4dbc10`. Índice de Roles sin cambios en casillas y 532 comprobaciones GET correctas de ocho identidades. No repetir `--apply`: la base anterior ya no es la efectiva. Ver [CONTEXTO_ACTUAL.md](CONTEXTO_ACTUAL.md) y [AUDITORIA_CIERRE_20261016.md](AUDITORIA_CIERRE_20261016.md) para estado HTTPS y pendientes humanos.

## Fuente del corte vigente y preparación previa

La final compacta tiene huella normalizada **`e5dbd9b0ca5e7e63f7966184a39350184d55fa9d7c4111c23e82ef0beb4dbc10`** y compila en remoto con `dryRun=true`. Conserva el guard, consultas propias, índices y validaciones; añade directorio privado, chat por mensaje y dominios omitidos por las instantáneas históricas, incluido Relevamientos. Los índices de Roles se derivan sin cambiar casillas. Se verificaron 54 casos RTDB demo. `scripts/apply-audit-cutover.cjs` muestra un plan por defecto; `--check` solo lee/compila; aplicar exige huellas, cliente publicado, API y copia privada.

El inventario encontró configuración heredada sensible y comprobó que la candidata antigua habría bloqueado Relevamientos técnicos. Por eso las candidatas `8c318727…` y previas no son el corte vigente. Las secciones siguientes conservan la historia y condiciones, **no una autorización para aplicar un archivo histórico**. Los pendientes antiguos de directorio/inventario/tamaño ya tienen implementación y evidencia en el documento de cierre; activación, limpieza autorizada y comprobaciones humanas aún siguen pendientes.

## Composición vigente sobre v3.11.9

La lectura remota de reglas del 16/10/2026 confirmó **`2fab3dfbda44e88c165729f4ab41bdcd8c3b36318f8dd280d81286675a20b56c`** (hash de JSON normalizado). No se leyeron datos comerciales, fichas ni contraseñas. Las candidatas de la tabla histórica no incluyen ese guard: una publicación directa podría reabrir el acceso temporal y dejar indisponible la emisión de temporales porque el servidor comprueba las reglas efectivas.

`scripts/prepare-access-permission-stages.cjs` compone offline cada etapa revisada con el guard. Exige que la base suministrada coincida estructuralmente con la base revisada más su protección, y falla si aparecen diferencias no revisadas; no obtiene credenciales, llama a Firebase ni aplica reglas. Los dos generadores antiguos rechazan ahora una base que ya contenga marcas de acceso para impedir una regeneración que pierda su condición.

Comando reproducible, **solo genera archivos**:

```sh
node scripts/prepare-access-permission-stages.cjs security/database.password-access.candidate.json tmp/permisos-protegidos-v3119
```

| Etapa compuesta | SHA-256 de JSON normalizado | Estado |
| --- | --- | --- |
| Roles conocidos + guard | `44e2b9754557c7ca1d36c726cf42ea8fc357827ae159e139c413d67e219500f0` | Solo propuesta, todavía conserva lectura interna padre. |
| Dominios intermedios + guard | `499f18658028c9c13775ed7675b513a6075d6d88012a5c598b48f1bcbbafba05` | No desplegar solo: pierde las consultas propias. |
| Dominios + cuentas propias + guard | `c857853413b1d2ff1e6a32af8365ffb6610695eb6e25e78dad37b3f32ffb6c30` | Etapa B compuesta; faltan las condiciones de corte. |
| Escrituras finales + guard | `6f35824e124aea31b37e8bc4164a95412b28ede794a92affce31ea1f6ea8605a` | Etapa C compuesta; validación funcional de escrituras aún parcial. |

Los archivos generados y manifest quedan en tmp, fuera de Git; son reproducibles desde el generador y las fuentes versionadas. Se mantienen todos los índices y validaciones y no se modifican datos. Las reglas llegan a unos 2,1–3,1 MB en las etapas mayores: las pruebas locales no prueban aceptación ni rendimiento del compilador de producción. No trasladar límites de Firestore a RTDB por analogía; confirmar este aspecto con un mecanismo documentado antes del corte, sin usar un despliegue como prueba.

**Evidencia**: 1.578 pruebas generales y 38 de integración aprobadas; seis regresiones estructurales incluidas en la suite general. Se comprobaron tokens temporales, marca requerida y fallida, versión antigua después del cambio, sesión nueva válida, privacidad de los dos nodos de control, consultas propias/ajenas, rechazo de autoasignación de rol/vínculo, Distribuidora y catálogo público, módulos/acciones, transacciones de cobros y stock concurrente. Son escenarios ficticios, no todas las operaciones de negocio. Evidencia privada: tmp/permisos-protegidos-v3119.

## Pendientes prioritarios antes de dar por cerrado este bloque

1. **Directorio de usuarios**: la lectura padre de `sv_usuarios` sigue permitiendo fichas completas a internos activos, incluso roles no reconocidos distintos de los portales. Las etapas de dominios comerciales no la corrigen. El cliente activo pide esa colección en `fbCargarUsuarios` y en el acceso interno; una prohibición abrupta rompería esas rutas. No se inspeccionaron los valores reales ni se confirmó presencia/cantidad de campos heredados sensibles. Próximo cambio concreto: autenticación y escucha del perfil propio por UID exacto, directorio con campos mínimos para participantes/comunicados y lista completa solo para administración autorizada; probar carga tardía, recarga, cambio de usuario y revocación antes de modificar reglas. No intentar ocultar campos con un veto hijo debajo de una lectura padre: [las reglas RTDB conceden acceso de forma descendente](https://firebase.google.com/docs/database/security).
2. **Sesión real de Osmar**, teléfono físico, suspensión y reconexión. Mauro tuvo una sesión real revisada y su carrera de carga está corregida/publicada; no reemplaza probar la identidad de Osmar. No restablecer una contraseña para obtener acceso de prueba ni presentar «Ver como» como esa validación.
3. Inventario privado por campos permitidos de identidades/vínculos y de configuración de permisos; no leer ni exportar claves, correos, salarios o historiales completos para hacerlo. Revisar también los registros antiguos que podrían incumplir validaciones nuevas sin modificarlos.
4. Completar recorridos/fixtures de los formularios afectados de OT, presupuestos, ventas, cobros y personal; no basta una prueba de lectura del Dashboard. Confirmar tamaño/compilación y reversión exacta antes de proponer producción.

## Etapas y condiciones

| Etapa | Artefacto | Resultado y límite |
| --- | --- | --- |
| Base previa al guard | `database.domain-write.candidate.json` | Antecedente sin guard; ya no equivale por sí solo a las reglas remotas. Mantiene lectura padre para internos activos, incluso roles desconocidos distintos de los dos portales. |
| A: roles conocidos | `database.known-role-read.candidate.json` | Cambia únicamente la lectura padre. Conserva los accesos de roles internos conocidos; **todavía permite leer cuentas ajenas por herencia**. No equivale a aislamiento por empleado. |
| Intermedio de generación | `database.domain-read.candidate.json` | **No desplegar de forma independiente**: rechaza consultas propias de Gastos y Vacaciones que utiliza el técnico. Es entrada para la siguiente etapa. |
| B: dominios y cuentas propias juntos | `database.employee-account-read.candidate.json` | Incluye las excepciones de consultas propias y sus índices. Las dos identidades ficticias leen su cuenta, sus consultas por `empleadoId`/`empleadoFbKey` y sus vacaciones; se rechazan las ajenas y colecciones completas. Requiere vínculos protegidos correctos. |
| C: escrituras finales | `database.audit-final.candidate.json` | Conserva las consultas propias. Prueba de dos transacciones técnicas concurrentes de stock sin perder unidades; precios protegidos. No acredita todavía todas las operaciones de OT, ventas, cobros o personal. |

La etapa B debe ser una actualización atómica de reglas que incluya dominios y excepciones propias, sin dejar en producción el snapshot intermedio. Esto **no autoriza reemplazar datos de la base**. El permiso padre no puede usarse como arreglo para una denegación de un hijo.

## Huellas históricas sin el guard (no desplegar directamente)

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
- `node scripts/test-security-drafts.cjs --emulator`: conserva las cinco suites históricas de 30 casos sin guard. Para la validación vigente usar **`node scripts/test-security-drafts.cjs --emulator --with-access-guard`**: seis suites y **38 casos aprobados** con datos ficticios en `demo-sisventas-security`, RTDB en `127.0.0.1:9005`. Los 30 escenarios existentes se ejecutan sobre las etapas compuestas, y se añaden 8 de recuperación/aislamiento. No cambiar ese destino por producción. Necesita Java 21 y las dependencias de [TRASLADO_NUBE_SEGURIDAD.md](TRASLADO_NUBE_SEGURIDAD.md).
- `test/cut-progression.integration.cjs` comprueba explícitamente el límite inseguro del snapshot intermedio y las consultas propias en las dos candidatas combinadas. La transacción de stock es una prueba de concurrencia de ese campo; no sustituye el flujo completo de rendición de materiales.
- Las pruebas con una sesión propia real y las de emulador acreditan cosas distintas: la primera verifica el cliente contra reglas vigentes, y la segunda comprueba las candidatas con identidades ficticias. «Ver como» no reemplaza ninguna de las dos.

## Validaciones que deben preceder al corte

1. Volver a leer las reglas remotas y guardar copia/huella por canal privado, sin tokens. Comprobar que siguen siendo la base revisada y preparar su reversión exacta. No usar un respaldo de datos como archivo de reglas.
2. Revisar identidades activas por rol y vínculos protegidos, conservando la privacidad. No inferir identidad por nombre/correo ni ampliar permisos para compensar un vínculo ausente. Verificar compatibilidad de los permisos guardados y sus overrides con la política del cliente.
3. Completar sesiones propias de Mauro y Osmar, con recarga directa de Mi cuenta, Dashboard, menú, OT, cambio de cuenta y retorno, en escritorio/ancho móvil. Probar teléfono físico, suspensión y reconexión por separado. No guardar operaciones ficticias en Firebase real.
4. Distribuir y comprobar las correcciones necesarias del cliente antes de restringir lecturas. En la validación de Mauro se encontró una carrera de llegada de perfiles/directorio: la corrección está incluida en la v3.11.9 publicada. No confundir la etapa local homónima v3.11.8 con la v3.11.8 del catálogo de main.
5. Revisar los registros antiguos que puedan contradecir validaciones nuevas, sin modificarlos. Probar las operaciones de escritura afectadas y los caminos de rechazo/concurrencia con fixtures; no basta que cargue Dashboard.
6. Gestión de contraseñas: v3.11.9, servicios y guard ya publicados; los escenarios de generación/cambio/correo se probaron solo con identidades ficticias. Ver [GESTION_ACCESO_USUARIOS.md](GESTION_ACCESO_USUARIOS.md). Toda etapa futura debe conservar el guard y sus nodos privados. No publicar solo el cliente ni confundir las copias heredadas (todavía pendientes de inventario privado) con la contraseña vigente de Auth. No leer, exportar ni trasladar claves para facilitar pruebas. La sesión real de Osmar sigue pendiente porque no se conoce su contraseña.
7. Presentar la etapa exacta, huella, condiciones, evidencia y reversión antes de un corte de producción autorizado. Mantener los otros cambios separados. Tras cualquier corte, comprobar lecturas/errores y revertir las reglas exactas si falla una operación necesaria; nunca conceder lectura padre como atajo.
