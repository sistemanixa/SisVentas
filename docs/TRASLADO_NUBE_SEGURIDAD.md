# Traslado de borradores a la nube (15/10/2026)

## Revisión posterior de candidatas, 15/10/2026

El inventario original de abajo es histórico. Las correcciones del cliente están publicadas en **v3.11.7**, código `4f7762a4c9bdcace6bc6a1b01509a1f08cbad67b`, constancia de main `9fdaeb8f8513aeaf07b85997257487ddc3875b5f`. Las candidatas y scripts de esta entrega **siguen sin aplicarse ni incorporarse a main**. Leer primero el bloque «Candidatas de seguridad corregidas y probadas» de [CONTEXTO_ACTUAL.md](CONTEXTO_ACTUAL.md).

El emulador local reprodujo los cuatro fallos originales; se corrigieron el generador de la excepción de productos, la procedencia de la candidata intermedia y dos fixtures que esperaban accesos contrarios a los permisos declarados. Se conservan denegaciones explícitas de Administrativo, consulta propia de Gastos y consulta externa limitada de ambos portales. La validación progresiva posterior añadió cinco casos: **30/30 de integración y 1.549 generales aprobados**, sin cambios en las reglas remotas. El manifest revisado contiene **24 artefactos**, huellas anteriores y base de procedencia; los originales también están en Git antes de esta revisión. No ocultar fallos modificando expectativas de snapshots históricos. El arreglo de recarga de cuenta v3.11.8 está solo local; ver [PLAN_CORTE_PERMISOS.md](PLAN_CORTE_PERMISOS.md): el snapshot de dominios no se puede desplegar sin las excepciones de cuenta propia.

En esta PC, Java **21.0.10** está instalado con Android Studio en `C:/Program Files/Android/Android Studio/jbr`. Para ejecutar el emulador se definieron `JAVA_HOME` y PATH solo dentro del proceso. Esa ruta no es trasladable ni obligatoria en otra PC/nube: usar su instalación autorizada de Java 21 o posterior. Las dependencias Firebase siguen reinstalables, y los emuladores se cierran al terminar. Los logs/respaldos privados quedan fuera de Git según CONTEXTO_ACTUAL.

Esta entrega **solo comparte archivos por Git**. No aplica reglas, no despliega servicios, no cambia DNS/hosting, no modifica datos comerciales y no avanza main. La versión publicada sigue siendo v3.11.1.

Rama: `codex/traslado-nube-seguridad-20261015`. Base: `b1d94bc91ba288aa410f3aecd016cdb8b3b5797c` (coincidía con origin/main al iniciar). El SHA final está en el mensaje de entrega; dentro de la rama se consulta con `git log -1 --oneline`.

## Inventario que faltaba y se incorpora

| Archivos | Uso y estado |
| --- | --- |
| `security/database.known-role-read.candidate.json` | Snapshot intermedio de restricción de roles conocidos. No es una regla desplegada por esta entrega. |
| `security/database.domain-read.candidate.json` | Snapshot de lecturas por dominio. |
| `security/database.employee-account-read.candidate.json` | Snapshot de consultas propias de cuentas, gastos y vacaciones. |
| `security/database.audit-final.candidate.json` | Snapshot final propuesto de escrituras y lecturas. |
| `test/known-role-read.integration.cjs`, `test/domain-reads.integration.cjs`, `test/employee-account-reads.integration.cjs`, `test/audit-final-permissions.integration.cjs` | Pruebas con identidades/registros ficticios, exclusivamente contra emulador loopback. Antes estaban sin seguimiento. |
| `scripts/deploy-secure-hosting.cjs` | Candidato de hosting. Se retiró la ruta personal Windows y la autenticación durante importación. Por defecto solo imprime un plan sin red/autenticación. El modo `--apply` existe pero queda fuera de la autorización de traslado: **no ejecutarlo**. |
| `scripts/lib/gcloud-cli.cjs`, `scripts/check-cloud-access.cjs` | CLI portable y diagnóstico de lectura sin imprimir cuentas/tokens ni datos de negocio. No conceden permisos ni inician sesión. |
| `scripts/test-security-drafts.cjs` | Validación offline por defecto; con `--emulator` inicia el emulador demo y las cuatro suites en serie. No publica reglas. |
| `scripts/prepare-known-role-read.cjs` | Generador offline que faltaba para la propuesta intermedia, partiendo de la base versionada actual. No se ejecutó sobre el snapshot preservado: regenerar produce una propuesta diferente por la discrepancia documentada abajo. |
| `test/security-handoff.test.cjs` | Regresión del modo plan/importación sin credenciales y del generador intermedio. |
| `drafts/continuidad/` | Cuatro fuentes anteriores sin coincidencia exacta en la historia consultada y dos deltas saneados de un commit local no remoto. Archivo inactivo para comparación; ver su README. No es un nuevo frontend/servicio ni debe reemplazar código vigente. |
| `.gitignore` | Exclusión compartida de .local, dependencias, informe privado, archivos de entorno y formatos de claves. No incorpora ni borra esos archivos. |

Las reglas se conservaron byte a byte. Se revisó que el JSON solo contiene `rules` y hojas de reglas/índices, sin registros de la base. No se encontraron credenciales ni datos personales en los artefactos elegidos; las pruebas conservan campos como `password` únicamente con valores ficticios de fixture. Se revisaron patrones de claves privadas, tokens, credenciales literales, correos, rutas personales y el contenido/uso de los archivos. Un escaneo no prueba ausencia absoluta de cualquier información sensible; por eso no se suben indiscriminadamente carpetas completas.

`docs/traslado-nube-manifest.json` fija tamaños y SHA-256 de los artefactos transferidos para comprobar su integridad, normalizando UTF-8/LF para que Git en Windows y Linux pueda verificarlos. Ejecutar `node scripts/verify-handoff-manifest.cjs`. No incluye secretos ni el inventario privado detallado. Las instrucciones/documentos de entrega no se incluyen en ese hash para evitar referencias circulares.

## Estado de pruebas: no activar las candidatas

El emulador se ejecutó con Java y `demo-sisventas-security`, en `127.0.0.1:9005`, sin aplicar nada a producción. Resultado de las cuatro suites originales: **24 pruebas, 20 aprobadas y 4 fallidas**. Son borradores recuperados, no una auditoría cerrada:

1. `domain-reads`: falla una lectura que la prueba espera conservar para admin/administrativo. Hay que identificar el dominio concreto antes del corte.
2. `domain-reads`: falla la consulta de productos autorizada para Distribuidora; no se debe activar este snapshot sobre producción sin resolverlo.
3. `employee-account-reads`: falla una expectativa de acceso de gastos (caso administrativo con módulos bloqueados, línea 22 de la prueba recuperada). Resolver intención de política frente a expectativa antes de cambiar reglas.
4. `known-role-read`: el snapshot y `database.domain-write.candidate.json` difieren también en `/rules/sv_permisos/$rol/bloqueados/$indice/.validate`, no solo en `.read`. La expresión del snapshot conserva un grupo `(?:...)`, mientras la base versionada usa `(...)`. El generador nuevo toma la base actual; el snapshot se preserva para revisar su procedencia, sin ocultar esta diferencia ni cambiar la aserción para hacerla pasar.

La candidata final obtuvo sus seis pruebas aprobadas en esta ejecución. Eso no elimina los fallos de las etapas previas ni demuestra compatibilidad integral del sistema. La suite general vigente pasó **1.494/1.494** (las 1.491 previas más tres verificaciones de entrega); las 24 de integración se reportan aparte.

Evidencia detallada local: `tmp/traslado-emulador-pruebas.txt`. El primer intento dentro del aislamiento no pudo iniciar el puerto del hub; el resultado de 20/24 corresponde a la ejecución local posterior que sí arrancó y terminó apagando el emulador.

## Archivos ignorados y pendientes anteriores

Se inventariaron .local y tmp sin seguir enlaces ni copiar dependencias, cachés, respaldos o espejos de publicaciones. En el conjunto de trabajo no excluido se encontraron 292 fuentes/scripts; 9 eran idénticos a archivos vigentes y 283 se revisaron por señales de contenido sensible y finalidad. Este recuento no representa todo archivo binario o toda copia histórica de los espejos.

- `.local/cotizador-v389-publicar/` y `.local/deploy-flytec-v386/`: sus fuentes diferentes y pruebas antiguas se encontraron en la historia **alcanzable desde origin/main** (entre otros, `1d9c0794`, `932c4c97`, `2d4684b7`, `35f85f98`, `c62fc3e0`, `85d30892`). No son trabajo perdido: recuperar con Git si hiciera falta, no copiar sobre la versión vigente.
- `tmp/security-ai-new-source/index.js` y `tmp/security-fiscal-source/index.js`: también recuperables desde historia remota (`13166718`/`e2596bbb` y `11e7508d`/`3a3e4609`, respectivamente).
- `.local/purchase-orders-unificacion-en-progreso.js`, `tmp/asistente-source/index.js`, `tmp/security-assistant-source/index.js` y `audio.cjs`: no se encontró su contenido exacto en la historia local consultada; se archivan saneados en `drafts/continuidad/`. Falta confirmar si sus ideas están totalmente superadas por las implementaciones actuales.
- Rama local de respaldo `codex/respaldo-limpieza-20261009-principal`: único commit local fuera de los remotos al iniciar, `b2616cf9f4179eb003fce15559acea1cb8162feb`. Se conservan sus deltas funcionales saneados en drafts; no se empuja la rama antigua ni se incorporan sus marcadores de versión. No hacer cherry-pick directo a main sin comparación con la implementación posterior.
- `js/app.v3.10.33.js`: Git lo marca modificado pero no hay diff textual/semántico observado. Histórico; se conserva fuera del commit.
- Espejos `.local/base-*`, `.local/release-*`, `.local/publicacion-*`, `tmp/base-*`, `tmp/release-*`, `tmp/side-release-*`, `tmp/respaldo-*`, `tmp/publish-*`: copias antiguas/respaldos, no el checkout autoritativo. No se trasladan a Git. No eliminados en la PC.
- Scripts temporales de parche, reparación de registros concretos, consultas a producción, correos de prueba y pruebas históricas que afirman hallazgos: no son dependencias del sistema. No trasladarlos ni ejecutarlos en lote; pueden incorporar rutas, identificadores, datos reales o depender de una instantánea anterior. Un nombre de script de prueba no garantiza que no escriba en producción.
- `node_modules`, cachés, logs, imágenes/PDF/CSV de evidencia y exportaciones no se necesitan para reconstruir las dependencias ni ejecutar las pruebas ficticias. La evidencia que contenga datos reales se trata como privada.

El inventario completo de rutas locales y revisión está en `tmp/inventario-traslado-privado.json` y `tmp/traslado-ignorados-revision-privada.json`. No se publican porque sus rutas/evidencias pueden identificar personas o registros. No se afirma que cada script temporal histórico haya recibido una revisión funcional completa: los que no se seleccionaron quedan excluidos.

Además se clasificaron 118 archivos HTML/CSS/JSON/configuración fuera de los directorios históricos excluidos. Son muestras descargadas de proveedores, previews de correo/recibo, respuestas de auditoría, configuración auxiliar o snapshots anteriores; 17 dispararon señales de revisión sensible y no se incorporó ninguno de ese conjunto a Git. La lista privada está en `tmp/traslado-otros-textos-privados.json`. La detección de una señal no implica que todos contengan una credencial real; basta para evitar copiarlos sin una revisión individual necesaria.

## Material privado: qué conservar y cómo moverlo

| Material que queda en la PC | Para qué puede servir | Traslado |
| --- | --- | --- |
| `security/auditoria-2026-10-12.txt` | Hallazgos detallados y antecedentes de la auditoría. Sigue siendo privado; no está en esta rama. | Preferir una síntesis saneada. Si hace falta el original, usar archivo cifrado y almacenamiento privado con acceso solo al titular, autorizado para el entorno destinatario. |
| `tmp/backups/` (36 JSON al revisar), exportaciones y snapshots reales de reglas/datos | Recuperación/reversión y comparación histórica. No son fixtures. | Solo los respaldos concretos necesarios, cifrados y por canal privado. No incorporar una copia de la base a Git ni al preview. |
| Inventarios privados, salidas de auditoría, capturas, PDF/CSV y archivos de diagnóstico en tmp/.local | Explicar casos reales y reproducir incidencias específicas. | Selección mínima y revisión/redacción previa; no subir carpetas completas. La mayoría no es necesaria para continuar desde código. |
| Configuración/credenciales de usuario de Google Cloud, tokens Firebase, perfiles de navegador y sesiones | Autenticación de esa PC. | **No trasladarlas como archivos de trabajo.** Configurar una identidad nueva/autorizada en la nube mediante su mecanismo seguro. |

Canal privado recomendado: preparar un archivo cifrado con AES-256 y nombres cifrados (por ejemplo, 7-Zip), introducir la contraseña fuera del repositorio, y guardarlo en almacenamiento privado restringido al titular. Autorizar después al entorno receptor por su mecanismo de secretos/adjuntos privados. Entregar la contraseña por un canal separado/almacén seguro; nunca en commits, enlaces públicos ni el mensaje de arranque. Una alternativa con clave pública del receptor evita compartir contraseñas. No se creó ni se envió ese paquete en esta tarea.

## Preparar y verificar el entorno cloud

1. Recuperar esta rama y comprobar SHA/base antes de editar. No mezclarla automáticamente en main. La nube puede empezar sin recibir el informe privado: los siguientes pasos y fallos están saneados arriba.
2. Instalar Node compatible y Java para el emulador (la CLI actual requiere Java 21 o posterior). Dependencias reinstalables, sin copiarlas desde la PC:

   ```sh
   npm install --prefix tmp/firebase-security-tools --no-audit --no-fund --ignore-scripts firebase-tools@15.30.0 firebase@10.12.0 @firebase/rules-unit-testing@3.0.4
   node scripts/verify-handoff-manifest.cjs
   node scripts/test-security-drafts.cjs
   node scripts/test-security-drafts.cjs --emulator
   ```

   El manifest verifica integridad; test-security-drafts sin opciones solo valida sintaxis/JSON y con --emulator ejecuta permisos en emulador demo: tras la revisión superior deben aprobarse los 30 casos de cinco suites. Los cuatro fallos documentados corresponden al snapshot original del traslado. No sustituir el host demo por producción. No se necesitan credenciales Google para estas pruebas. Mantener libre el puerto 9005 y los puertos del hub/log del emulador.
3. Correr la suite vigente por `scripts/test-current.ps1` o su equivalente documentado. Las cuatro suites `.integration.cjs` son separadas y no se suman como si fueran pruebas de la suite general.
4. Instalar Google Cloud CLI en PATH. Configurar sesión autorizada/federación o impersonación aprobada usando los secretos/conexiones del entorno, con permisos mínimos para el objetivo. No copiar archivos de credenciales de esta PC ni crear una clave permanente como atajo. Si se utiliza inicio de sesión interactivo, hacerlo el titular con la herramienta oficial.
5. Diagnóstico explícito, solo de lectura:

   ```sh
   node scripts/check-cloud-access.cjs
   node scripts/check-cloud-access.cjs --firebase
   ```

   El primero verifica sesión activa y lectura de metadatos de `nixa-sisventas`; el segundo agrega GET de reglas RTDB y muestra solo su huella. Puede requerir IAM y red adicionales de lectura de reglas; una sesión válida no demuestra esos permisos. El script no agrega roles, no hace login ni lee datos comerciales.

En esta **PC** se confirmó sesión gcloud, proyecto ACTIVE y lectura de reglas RTDB. Eso no verifica el acceso del entorno **cloud**: debe repetir el diagnóstico con su propia identidad. Los comandos no muestran tokens ni cuentas personales.

Configurar en la nube, solo si se necesitan: acceso GitHub a esta rama; red saliente para registro npm/herramientas y APIs oficiales de Google/Firebase; identidad con lectura del proyecto y reglas para auditoría. Servicios productivos usan sus propias identidades. Secretos de correo/ML/IA (`NIXA_GMAIL_APP_PASSWORD`, `FRONTEND_KEY`, `ML_CLIENT_SECRET`, `ML_TOKEN_KEY`, `ANTHROPIC_KEY`, según cada servicio) se conservan en Secret Manager/configuración segura; sus nombres son referencias, **no una instrucción para copiarlos al entorno ni otorgar acceso a todos**. Ver documentación de cada servicio y consultar al administrador qué permisos concretos ya tiene la identidad.

No ejecutar `deploy-secure-hosting.cjs --apply`, los scripts de aplicación de reglas ni despliegues de funciones para verificar esta entrega. El siguiente trabajo es resolver los fallos de las candidatas, revisar políticas y contrastar estado remoto de forma controlada.
