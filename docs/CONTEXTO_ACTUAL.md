# Continuidad de SisVentas

Actualizado: 15/10/2026. Documento de entrega entre la PC original, otra PC y Codex en la nube. Leer junto con [AGENTS.md](../AGENTS.md). No contiene credenciales.


## Publicación oficial v3.11.7 completada (15/10/2026)

- El usuario autorizó publicar escucha de versión y carga del Dashboard. Se preparó `.local/publicacion-v3117`, rama `codex/publicar-v3117`, desde main `c15e5663d928840f9823ddb3ee9c34b85d62d3e4`; se incorporaron explícitamente **13 archivos de cliente/pruebas**. Código publicado: **`4f7762a4c9bdcace6bc6a1b01509a1f08cbad67b`**. No se integró la rama completa de auditoría ni se publicaron candidatas, scripts de migración o material privado.
- Alcance: escucha de versión después del acceso, reconexión y carga inicial/Dashboard según dependencias de tarjetas habilitadas; controles de lectura de categorías y Agenda. Se conservan datos compartidos de OT/cuenta y errores de cargas auténticas. Sin recalcular comisiones ni modificar datos comerciales como prueba.
- Paquete exacto: **1.536 pruebas aprobadas, cero fallos**, más **36 comprobaciones Chromium** (12 escucha, 14 tarjetas, 10 cargas/directorios/recuperación), datos ficticios. Las tres pruebas adicionales de entrega de borradores quedan en la rama de auditoría. La suite vigente usó rutas relativas por el límite Windows de argumentos del checkout largo. Los nuevos scripts de navegador usan el ancestro común `c15e5663` como baseline, disponible desde main. Evidencia privada: `.local/publicacion-v3117/tmp/publicacion-v3117-*.log`.
- GitHub Pages confirmó **completed/success**, ejecución **`38748993050`**, para el commit publicado. Los seis activos web coinciden por SHA-256 normalizado UTF-8/LF: índice, SW, app v3.11.7, ambos marcadores y data-readiness. Después, `scripts/actualizar-nodo-version.ps1 -Version v3.11.7` comprobó web y lectura posterior: **v3.11.7-firebase**. Única escritura Firebase: `sisventas/config/version`. Sin cambios de reglas, IAM ni servicios.
- La revisión local previa de Administrativo real cubrió restauración del acceso, Dashboard y Gastos en escritorio/ancho móvil. Siguen pendientes **teléfono físico y sesiones propias de Osmar/Mauro**, suspensión/reconexión y recuperación del borrador del teléfono por el titular. No borrar datos del sitio para actualizar. La auditoría continúa aislada en `codex/traslado-nube-seguridad-20261015`; esta publicación no la cierra. Los estados «solo local» anteriores son antecedentes históricos.


## Entrega del cliente v3.11.5 para publicación (15/10/2026)

- El usuario autorizó publicar los cambios revisados para recuperar el borrador de Relevamientos desde el celular. Código de publicación: **`f412bcf23ab7cde1f491ae3d73fb83e701271fa4`**, preparado en `codex/publicar-v3115` desde `b1d94bc91ba288aa410f3aecd016cdb8b3b5797c`, con avance normal de `origin/main`. El material de origen sigue conservado en `codex/traslado-nube-seguridad-20261015` (`0680ceb54b9dee321743b46e120db7cf4e5d2208` antes de documentar el despliegue).
- Se integraron únicamente el frontend activo y sus pruebas: recuperación de cargas por rol (v3.11.2), franja de «Ver como» que no cubre la cabecera (v3.11.3), selección explícita del empleado y descarte de respuestas tardías (v3.11.4), guardado compatible de Relevamientos (v3.11.5). Los siete activos de producción coinciden con los validados en local. No se añadieron candidatas de reglas, scripts/fixtures de la auditoría ni `drafts/continuidad` a main; tampoco el archivo local previo `js/app.v3.10.33.js`. El servidor local sigue sirviendo su espejo y la copia de trabajo original se conserva.
- Relevamientos conserva las claves planas de su borrador IndexedDB y las convierte a objetos anidados al guardar en RTDB; lee ambos formatos. Conserva valores, notas y fotos. La reproducción con datos ficticios comprobó el error anterior, la recuperación del mismo borrador tras recarga/fallo simulado y el reintento exitoso. No se guardó ni eliminó el relevamiento real del usuario como prueba.
- Pruebas del paquete exacto desde main: **1.515 aprobadas, cero fallos**, frente a 1.518 de la rama de traslado (las tres pruebas de sus borradores de hosting/reglas se excluyen junto con ese material). Se usó la selección vigente con rutas relativas porque el checkout largo de Windows excedía el límite de argumentos del script con rutas absolutas; no se cambiaron aserciones ni selección de casos. Chromium: **10 comprobaciones de cargas por rol y 8 de guardado**, escritorio 1366×900 y móvil 390×844, datos ficticios. En estos scripts se usa como baseline el ancestro común `b1d94bc9`, con las mismas fuentes anteriores, para poder repetirlos desde una copia de main sin la historia privada de traslado. Sintaxis, coherencia local y diff correctos.
- **Publicado y verificado**: GitHub Pages terminó correctamente la ejecución `38736988641` para el commit de código `f412bcf23ab7cde1f491ae3d73fb83e701271fa4` (API: completed/success, Pages built). Los siete activos de `https://ventas.sistemanixa.com` coinciden por SHA-256 con el paquete validado, normalizando UTF-8/LF. `scripts/actualizar-nodo-version.ps1 -Version v3.11.5` confirmó web, marcador liviano, SW y lectura posterior del nodo Firebase en `v3.11.5-firebase`. Esa escritura se limitó a `sisventas/config/version`; no se desplegaron reglas, Cloud Run, Functions ni el candidato de hosting. La nota de continuidad se incorpora después del código y no cambia los activos del cliente.
- Recuperación del borrador: el dato permanece en el IndexedDB del mismo navegador/origen/usuario del celular. La nueva versión debe cargarse allí mediante recarga normal; **no borrar datos del sitio ni cambiar de origen** para actualizar. Esta PC no accedió al borrador de ese teléfono ni confirmó su guardado real. Pendiente comprobarlo con el titular.
- La auditoría de seguridad sigue abierta en la rama de traslado: cuatro fallos de candidatas, lectura de `config/version` para Administrativo, sesiones propias de los técnicos y teléfono físico/reconexión. «Ver como» conserva Auth del administrador; sus pruebas no acreditan permisos efectivos de los técnicos. Se mantienen los duplicados históricos y demás datos comerciales sin cambios de prueba. Los apartados siguientes describen la entrega anterior v3.11.1 y conservan su evidencia histórica.

## Punto de partida y objetivo actual

- Repositorio: `https://github.com/sistemanixa/SisVentas.git`.
- Rama vigente: `main`; al comenzar esta entrega coincidía con `origin/main` en `867358cf6080283c0228d194695789af4ff77eae` (v3.11.0, conservar foco del teclado móvil en Cargos).
- Trabajo que se entrega: v3.11.1, cabeceras opacas, aislamiento de scroll de ventanas y presentación USD sin decimales en Distribuidora/catálogo, más documentación de continuidad. El usuario autorizó publicarlo antes de pasar el control a la nube y agregó la revisión monetaria durante la preparación.
- Commit del código de esta entrega: `505c0757956400b999989ecfbcaef43c83c4b7f4` (`Publicar v3.11.1: cabeceras, scroll y formato USD de Distribuidora`), subido a `origin/main`. Sustituye a `867358cf` como referencia de código.
- Estado del despliegue: **publicado y verificado**. GitHub Pages completó correctamente el despliegue del commit de código (ejecución `38680094498`). `scripts/actualizar-nodo-version.ps1 -Version v3.11.1` confirmó web, marcadores, Service Worker y Firebase sincronizados en `v3.11.1-firebase`. También se comparó el contenido HTTP con el local para el formateador, cargador de módulos, portal, selector público de moneda, catálogo HTML y CSS de scroll. No se desplegaron servicios ni reglas de seguridad en este bloque.
- La auditoría de seguridad general sigue abierta. La auditoría reciente de presentación/scroll es otro bloque y no la cierra.

## Terminado y evidencia disponible

### Último bloque: presentación y scroll (v3.11.1)

- El actualizador de precios abierto bloquea el scroll del fondo; minimizar libera la página y restaurar vuelve a bloquearla. Se preserva el proceso de actualización: no se ejecutó una actualización real de proveedores para verificar el scroll.
- Contención de scroll para ventanas/diálogos, incluido planificador; fondos opacos en cabeceras y ajuste de anclaje en la OT para tapar la franja que dejaba leer el contenido anterior.
- Archivos del bloque: `css/surface-scroll.css`, `js/app.v3.11.1.js`, `js/core/version.v3.11.1.js`, `js/core/version.js`, `index.html`, `sw.js`, `test/surface-scroll-stack.test.cjs`.
- Verificación local: 36 pantallas de consulta recorridas en escritorio y viewport móvil 390×844, aperturas adicionales de Distribuidora, Asistente y Nueva venta en escritorio; estilos de 23 ventanas declaradas. OT y actualizador comprobados visualmente. No se abrieron todas las variantes de formularios ni se guardaron operaciones comerciales. El planificador se revisó por código; falta comprobar todas sus variantes visuales con contexto real.
- Suite vigente: **1.487 pruebas aprobadas, cero fallos**; `node --check` y `git diff --check` correctos. Las instantáneas de versiones históricas no son la suite vigente y varias fallan si se ejecutan contra el índice actual; no retocarlas para forzar su aprobación.
- Evidencia local no transferida por Git: `tmp/auditoria-interfaz-scroll-2026-10-15.json`, `tmp/auditoria-scroll-pruebas-vigentes.txt`, `tmp/ot-cabecera-opaca.png`, `tmp/actualizador-scroll-aislado.png`. Estos archivos son evidencia auxiliar, no dependencias para ejecutar la aplicación.

### Revisión monetaria incorporada antes de la entrega

- Encontrados formateadores que imponían dos decimales. Corregidos precios, ganancias, referencias, totales, solicitudes, listas agrupadas, balances, PDF y catálogo/carrito público para presentar USD enteros. ARS mantiene centavos. Los porcentajes pueden tener decimales: no son importes USD.
- Nuevo `js/core/distribuidora-money.js`: formato separado de valores y cálculo desde el precio canónico. Si la fuente canónica es USD se conserva ese USD y se calcula ARS desde él; si la fuente es ARS sigue haciendo falta convertir para mostrar USD. No se inventó un precio USD original para registros que solo tienen ARS.
- El guardado de una lista conserva el valor interno de los campos USD mostrados redondeados si el usuario no los editó. Los precios originales y cálculos mantienen precisión; no se hizo una migración/redondeo masivo de la base. CSV conserva datos crudos. El redondeo de envío guardado a enteros es la regla anterior específica de envíos.
- Verificación local: los 62 precios del catálogo interno quedaron sin decimales y coincidieron exactamente tras alternar USD→ARS→USD. Lista existente comprobada sin guardarla. Suite posterior: **1.491 pruebas aprobadas**, incluidas regresiones de precio nativo USD ante cambio de cotización y conservación del original al guardar.
- Evidencia auxiliar local: `tmp/distribuidora-usd-enteros.png`, `tmp/entrega-nube-pruebas.txt`. El catálogo público conserva su proyección persistida; no se reescribió masivamente para esta revisión. Para fuentes históricas o balances que parten de ARS, comprobar la procedencia antes de proponer una migración.

### Bloques anteriores

Verificados en Git: v3.11.0 (`867358cf`, foco móvil en Cargos), catálogo/retorno a Ofertas (`99cf0c12`), ayuda de Roles (`7e84fb4b`), validación de Roles (`d1910ca3`) y Responder primero en menú del chat (`bf15603f`, v3.10.34).

Según esta conversación y documentación previa, se trabajó también en:

- Correo de solicitudes confirmadas/declinadas con estética SisVentas. Remitente y secreto descritos en [correo-solicitudes.md](correo-solicitudes.md); hay constancia de SMTP aceptado. No equivale a garantía de lectura ni entrega en bandeja de entrada. No repetir envíos a clientes para comprobar continuidad.
- Listas de compras: precios fijados al agregar, carga inicial autorizada de listas antiguas, compra personal, envío editable en USD, resumen de ganancia/ahorro, colapso, buscador y acceso al producto con retorno. La identificación de seis referencias actuales era una excepción histórica, no el número total de productos. Se solicitó fijar esos precios, no seguir leyéndolos dinámicamente.
- Comunicados: participantes, edición, vista previa, Privado al seleccionar manualmente y conteo coherente. Chat con acciones y seis reacciones principales, edición propia tras lectura.
- Historial de clientes con selección de domicilios y solapas (timeline, ventas, pagos, presupuestos, tickets, equipos, credenciales). La conversación registra correcciones de pagos y conservación de solapa/domicilio. Registros antiguos sin vínculo inequívoco no deben asignarse arbitrariamente.
- Recuperación de borradores sin pisar la venta actual, comisiones, resumen de mano de obra, participantes de comisión y OT de reclamo sin inventar entregas con garantía.

Estos antecedentes no se revalidaron íntegramente durante esta entrega. Para modificar un recorrido, localizar su implementación activa y sus pruebas; no asumir que cada afirmación histórica describe el estado remoto de hoy.

## Decisiones importantes

- Git conserva código; Firebase y Google Cloud conservan datos/configuración/servicios. Las sesiones locales no viajan con Git. Verificar cada capa por separado.
- Servir local puede conectar al Firebase de producción. Priorizar pruebas con emulador y datos ficticios; una revisión visual no autoriza cambios financieros reales.
- Mantener la versión inmutable referenciada por el índice y coherencia con caché, marcadores y Novedades. Actualizar el aviso Firebase solo cuando la web ya entregue todos los activos.
- Evitar conversiones monetarias de ida y vuelta. Envío USD queda como base USD; ARS se presenta desde esa base. El redondeo pedido a enteros corresponde a envíos de listas, no a todos los importes.
- Distinguir ahorro (precio proveedor fijado menos pagado, por cantidad) de ganancia (venta menos costos según reglas del sistema). No inventar datos ni esconder ítems pendientes de cálculo.
- Dashboard es inicio sin Volver. Los retornos deben tener destino real. Recargar la ventana al comunicar cambios locales y comprobar que conserva el contexto.
- No tocar comisiones existentes por estas correcciones. No sustituir la base completa para migrar permisos.

## Auditoría de seguridad: pendiente de confirmar y cerrar

Hay código versionado de separación de lecturas (`js/core/domain-read-policy.js`), control de acceso y migraciones, además de scripts de preparación/aplicación. La conversación registra autorización para permisos de clientes, ventas, cobros y configuración, bloqueo del reemplazo completo y migraciones de cobros, horas extra, aguinaldos y redistribución de comisiones. **Esta entrega no volvió a consultar todas las reglas y revisiones remotas**: no declarar que el corte completo quedó aplicado.

La documentación de `security/README.md` y `security/CONTROL-ACCESO.md` registra fases anteriores de identidades activas y Usuarios/Roles protegidos. Contiene estados históricos; contrastar con reglas actuales. El pendiente conocido del último trabajo de seguridad es terminar separación de lecturas por módulo/dominio, accesos de cuentas de empleados y revisión final de roles, evitando permisos amplios heredados de la raíz. Probar concurrencia y compatibilidad antes del corte.

Cabeceras HTTP/hosting: el usuario indicó dominio de Google y abrió un panel de administración. No quedó confirmado aquí el proveedor DNS efectivo ni una migración de hosting. Existe un script local candidato de hosting; no ejecutarlo para retomar. Hace falta verificar DNS, alojamiento, cabeceras HTTP y plan de reversión sin interrumpir el sitio.

## Archivos locales que no viajan en esta entrega

Inventario inicial del 15/10/2026; los siete archivos de v3.11.1 listados arriba pasan a Git en esta publicación. Permanecen fuera del commit:

| Archivo/grupo | Estado y tratamiento |
| --- | --- |
| `js/app.v3.10.33.js` | Git lo marca modificado, pero el diff no muestra cambios semánticos (posible normalización de fin de línea). Histórico, no restaurar ni incluir por accidente. |
| `scripts/deploy-secure-hosting.cjs` | Sin seguimiento. Candidato de despliegue; revisar portabilidad, alcance público y configuración antes de conservarlo. |
| `security/auditoria-2026-10-12.txt` | Informe privado, sin seguimiento. **No subir ni publicar**. La nube no lo tendrá; reconstruir una lista saneada de hallazgos o usar un canal privado autorizado si resulta necesario. |
| `security/database.audit-final.candidate.json` | Sin seguimiento; propuesta final, no prueba de reglas publicadas. |
| `security/database.domain-read.candidate.json` | Sin seguimiento; propuesta de lecturas por dominio. |
| `security/database.employee-account-read.candidate.json` | Sin seguimiento; propuesta de cuentas de empleados. |
| `security/database.known-role-read.candidate.json` | Sin seguimiento; propuesta de restricción de roles. |
| `test/audit-final-permissions.integration.cjs`, `test/domain-reads.integration.cjs`, `test/employee-account-reads.integration.cjs`, `test/known-role-read.integration.cjs` | Sin seguimiento; no están incluidas en las 1.487 pruebas vigentes ni en esta entrega. Revisar y transferir de forma saneada en un bloque de seguridad aparte, o regenerarlas desde los generadores versionados. |
| `.local/` | No tiene archivos seguidos por Git en esta copia. Incluye servidor, espejo, herramientas y material privado/antiguo; no copiar ni subir toda la carpeta. |
| `tmp/` | Ignorado: respaldos, evidencia y dependencias de pruebas. No es transferible automáticamente. No subir respaldos ni sesiones. |

La publicación solicitada no incluye estas reglas candidatas ni aplica cambios de permisos. La nube debe saber que no cuenta con esos borradores. No borrar los originales en la PC.

## Configuración de otra PC / nube

- Herramientas: Git y Node.js; esta PC usó Node `v24.17.0`, Git `2.55.0.windows.3`. PowerShell facilita scripts existentes. No hay npm install en raíz. `cotizador/` declara Node >=20; funciones de correo Node 22. Instalar dependencias con sus lockfiles en cada servicio solo cuando se trabaje en él; Playwright/emuladores requieren dependencias adicionales.
- Inicio estático y pruebas: ver AGENTS.md. La PC original sirve el espejo `.local/release-v3619` mediante `.local/serve-preview.cjs 8766`. Una copia nueva debe servir el checkout directamente; ese servidor/espejo no está en Git. Python no quedó disponible en el PATH de esta PC: los comandos Python de inicio requieren instalarlo o usar un servidor estático equivalente.
- En Linux, `pwsh -NoProfile -File scripts/test-current.ps1`, o selección equivalente de pruebas en Node según AGENTS.md. Los scripts de operaciones Cloud pueden invocar `powershell.exe` y rutas absolutas Windows: no son portables automáticamente. Adaptar llamadas a gcloud del entorno sin cambiar su lógica ni divulgar tokens.
- Proyecto Google Cloud/Firebase: `nixa-sisventas`; Realtime Database: `nixa-sisventas-default-rtdb`; dominio web: `ventas.sistemanixa.com`. Configurar sesión GitHub para fetch/push y sesión Google Cloud con permisos mínimos cuando sea necesario. No copiar perfiles de autenticación entre equipos ni incorporar credenciales al código.
- La configuración Firebase cliente se carga desde el frontend; verificar dominios autorizados de autenticación para el nuevo origen de preview. No desactivar reglas para permitir una URL nueva. Las APIs/Cloud Run deben reconocer el origen y validar el token según su configuración.
- Cotizador: variables documentadas en `cotizador/README.md` (incluye `FIREBASE_DATABASE_URL`, `ALLOW_ORIGIN`, `REQUIRE_FIREBASE_AUTH`, integración ML y secretos). Su existencia no confirma los valores vigentes en producción. Consultarlos por acceso autorizado; no imprimir secretos.
- Correo: `NIXA_GMAIL_APP_PASSWORD` en Secret Manager, remitente `nixa@sistemanixa.com`; acceso del servicio al secreto, sin guardar la contraseña en Git. Ver `docs/correo-solicitudes.md` y script de despliegue. No crear otra credencial para retomar.
- Emulador de seguridad: seguir `security/README.md`, proyecto demo y host loopback comprobado. No ejecutar pruebas de integración contra producción por defecto.
- `CNAME` declara el dominio, pero la configuración de despliegue GitHub y el DNS no quedan completamente descritos por ese archivo. No migrar hosting ni DNS al preparar el entorno.

## Pendientes por prioridad y próximo paso

1. En la nube: clonar/fetch, leer AGENTS y este documento, comparar rama/commit y ejecutar la suite vigente antes de editar. Levantar preview aislado y verificar que los activos v3.11.1 provengan del checkout correcto. La PC original deja de editar el mismo bloque durante el traspaso. Publicación de código ya terminada según la evidencia anterior.
2. Reanudar auditoría de seguridad: inventariar reglas remotas, revisiones de servicios y pendientes reales; recuperar/regenerar borradores saneados. Completar lecturas por módulo/cuentas de empleados/roles con emulador y verificaciones de regresión. No activar candidatos a ciegas.
3. Confirmar DNS y cabeceras HTTP; GitHub Pages sí quedó identificado y verificado como hosting actual en esta entrega. Preparar un corte reversible si sigue siendo necesaria la migración. No equiparar la corrección CSS de cabeceras a cabeceras de seguridad HTTP.
4. Completar comprobaciones visuales dinámicas del planificador/editor y variantes de modales que no se abrieron, con datos de prueba. Revalidar teclado móvil y navegación cuando se modifiquen esas superficies.

**Próximo paso concreto de quien retoma:** comprobar el SHA remoto de entrega y correr `scripts/test-current.ps1`; después elaborar el inventario de permisos remotos frente a `js/core/domain-read-policy.js` y los generadores de `scripts/`, antes de proponer el próximo cambio de seguridad.

El commit de documentación se crea después del commit de código citado. Para identificar la entrega completa, usar `git log -1 --oneline origin/main` y el SHA informado en el mensaje de entrega de este chat; no es posible escribir dentro de un commit su propio SHA final.

Mensaje de arranque (completar el SHA de documentación con el informado al entregar):

> Continuá SisVentas desde origin/main en el commit de entrega indicado. Leé AGENTS.md y docs/CONTEXTO_ACTUAL.md antes de editar. La versión publicada es v3.11.1; el código está en 505c0757956400b999989ecfbcaef43c83c4b7f4. Verificá Git, ejecutá la suite vigente (1.491 pruebas al entregar) y levantá un preview aislado del checkout. Después retomá el inventario de permisos remotos y los pendientes de seguridad documentados, sin aplicar candidatos automáticamente ni modificar datos comerciales para probar. Conservá los importes de origen; USD se presenta sin decimales. Informá cualquier archivo o acceso que falte en la nube.

## Protocolo entre equipos

Una sola copia trabaja cada bloque. Comenzar con `git fetch origin`, revisar `git status --short` y `git log -1 --oneline`; con árbol limpio y rama main, `git pull --ff-only origin main`. En rama de trabajo integrar explícitamente main sin pisar cambios. Al entregar informar SHA y push confirmado. No usar el navegador local de una PC como evidencia de lo que está sirviendo otra o la nube.

El procedimiento antiguo [sincronizacion-dos-pc-y-publicacion.md](sincronizacion-dos-pc-y-publicacion.md) sigue siendo útil sobre marcadores/despliegue, pero sus comandos a `codex/v3-integracion-v236` y versiones de ejemplo son históricos; usar la rama y versión de esta entrega.
