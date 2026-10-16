# Proyectos: primera versión local (v3.11.10)

Estado al 16/10/2026: diseño revisado y publicación autorizada por el usuario. Implementación en `codex/proyectos-v31110`, preparada desde main `2a0d01e747204e42c278fc2ddf0f4ae3f1aad893`. Servidor `cotizador-00102-red` activo; cliente v3.11.10 en publicación. Estado exacto y constancia de cierre en [PUBLICACION_PROYECTOS_V31110.md](PUBLICACION_PROYECTOS_V31110.md).

## Flujo

1. Crear una ficha con nombre, cliente/domicilio, objetivo, fecha objetivo e integrantes. El creador es responsable y conserva acceso.
2. Organizar necesidades por sector: equipo, material, mano de obra o tarea. Cantidad opcional; estados A definir, Por verificar o Definido. No se inventan cantidades ni importes.
3. Preparar un borrador de alcance seleccionando necesidades, o vincular un presupuesto existente del mismo cliente.
4. Un borrador puede abrir el formulario comercial existente cuando todas sus cantidades están definidas. Allí se revisan productos, precios y condiciones. El módulo no agrega otro motor de precios ni guarda ventas/stock.
5. Al guardar correctamente el presupuesto comercial, se vincula su clave persistida al proyecto mediante un contexto único de ese formulario. Un evento ajeno o repetido no crea otro vínculo. Si falla la asociación, el presupuesto comercial permanece guardado y se indica vincularlo manualmente.

Estados de ficha: Relevamiento, Planificación, Presupuestando, Presentado, Aprobado y Descartado. Los importes de propuestas alternativas no se suman como si fueran una sola compra. Quitar un vínculo conserva el presupuesto comercial.

## Acceso y almacenamiento

- Nueva raíz privada **`sv_proyectos`**, fuera de `sisventas`: las lecturas amplias heredadas del padre no exponen la colección. Los clientes no leen/escriben esa raíz directamente. En emulador se verificó el rechazo incluso con token admin.
- Se accede por el servicio Cotizador, usando Firebase Admin SDK y el verificador de sesión comercial existente (revocación, clave temporal y versión de acceso).
- Requiere rol interno activo y módulo habilitado. Distribuidora queda excluida.
- Administrador puede ver los proyectos; otros usuarios solo los que integran. Responsable/admin gestionan integrantes. Un integrante puede ser lector o editor. Los bloqueos de módulo/acción también se aplican en servidor.
- Acciones en Roles: `proyectos.crear`, `proyectos.editar`, `proyectos.presupuestar`. Crear/cotizar por defecto para roles comerciales; editar depende además de membresía. Un técnico no recibe presupuestos comerciales por el mero hecho de integrar un proyecto.
- Vincular **no convierte en privado al presupuesto comercial heredado**: conserva los permisos existentes del módulo Presupuestos. La ficha y los borradores de alcance sí dependen de la membresía. Si se requiere privacidad propia de cada presupuesto comercial, falta migrar también ese dominio.
- El directorio devuelve UID/nombre/rol; no perfiles completos, emails o credenciales. Las referencias comerciales omiten costos internos. Datos de cotización vienen del servidor, no del importe que proponga el navegador.
- Cada operación usa transacción por proyecto y revisión exacta. Conflictos devuelven 409 sin reemplazar cambios. Una suscripción temporal mantiene la caché inicial válida; no se recuperan registros ausentes con una copia anterior. Se normalizan arrays vacíos y cantidades null omitidos por RTDB.
- Límites: 40 integrantes seleccionados más responsable, 150 necesidades, 30 borradores/vínculos y 60 eventos recientes; documento de hasta 220 KB. No hay eliminación de proyecto: se puede descartar mediante estado.

## Servicio y configuración pendiente

Rutas autenticadas: `GET /proyectos`, `GET /proyectos/opciones?proyecto=ID`, `POST /proyectos/guardar`. Comandos explícitos, sin reemplazo completo de la base.

**`PROJECTS_ENABLED=true`** habilita el servicio; por defecto está apagado. No es una credencial. Se reutilizan las credenciales/IAM del servicio existente y su acceso a RTDB; no se agregan secretos. El cliente real muestra el error si falta el servicio: nunca cae silenciosamente a datos locales de ejemplo. «Ver como» no se admite como comprobación de permisos reales de Proyectos.

Publicación autorizada: se comprobaron reglas remotas exactas y rechazo directo, se evaluó el alcance heredado de Presupuestos y se activó el servidor con la bandera. No fue necesario cambiar reglas ni IAM. Para otro despliegue volver a revisar el estado remoto y seguir la secuencia de cliente/marcador de AGENTS.

## Vista previa y pruebas locales

En localhost, con administrador y `?proyectos_preview=1#/proyectos`, se habilita **Vista previa · datos de ejemplo**. Tres proyectos ficticios permiten revisar tarjetas, necesidades, integrantes, borradores y vínculos. Se guardan exclusivamente en `localStorage` bajo `sv-projects-preview-v1`. No se ofrecen desde ese modo acciones que lleven presupuestos ficticios al formulario real; no se consulta el servicio de Proyectos. Fuera de localhost/admin esa opción no habilita la vista previa.

La PC original sirve `.local/release-v3619`; sincronizar explícitamente los activos de esta rama allí o servir este checkout en otro puerto. No borrar los datos del sitio para actualizar. La sesión local de admin sigue conectada a los demás módulos reales: la vista previa aísla solo Proyectos.

Pruebas repetibles desde la raíz de esta rama:

```powershell
node --test test/projects.test.cjs
node scripts/sync-projects-model.cjs
# Ejecutar también la suite vigente de AGENTS.md.

# Dependencias/browsers ya instalados en esta PC; adaptar rutas en otra máquina.
$env:SV_PLAYWRIGHT_MODULE='C:/SisVentas/cotizador/node_modules/playwright'
$env:PLAYWRIGHT_BROWSERS_PATH='C:/SisVentas/tmp/playwright-browsers'
node test/browser/projects.cjs
node test/browser/projects-bridge.cjs

$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
$env:PATH=$env:JAVA_HOME+'/bin;'+$env:PATH
$env:SV_SECURITY_TOOLS='C:/SisVentas/tmp/firebase-security-tools'
$env:SV_PROJECTS_ADMIN_MODULE='C:/SisVentas/cotizador/node_modules/firebase-admin'
node scripts/test-projects.cjs
```

Herramientas demo: `firebase-tools` y `@firebase/rules-unit-testing`, más Java; navegador: Playwright; servidor: dependencias de `cotizador/package.json`. Reinstalables, no trasladar node_modules. El runner elimina variables de credenciales y usa únicamente `demo-sisventas-projects`, RTDB 127.0.0.1:9005. No desplegar la candidata para ejecutar las pruebas.

La fuente canónica `js/core/projects-model.js` se copia a `cotizador/projects-model.js` porque Docker solo incorpora el contexto de Cotizador. El script sincroniza y una prueba verifica igualdad; ejecutar después de modificar el modelo.

Evidencia inicial: 1.577 pruebas generales, 94 del servidor, 6 de RTDB emulado; 24 comprobaciones de interfaz aislada (1366×900 y 390×844) y puente al formulario comercial con API ficticia. Se corrigió la lectura CRLF del extractor de una prueba de Functions, sin cambiar sus escenarios ni expectativas. Logs/capturas en `tmp/`, ignorados.

## Límites y próximos pasos

- Vista local inicial mostrada con fixtures. Comprobación real de solo lectura con administrador (listado y formulario), sin crear proyectos; no acredita operaciones de todos los usuarios ni teléfono físico.
- Servicio probado como fábrica contra RTDB emulado; puente comercial probado con API/DOM ficticios, no guardando presupuestos reales.
- Actualización manual al abrir/refrescar y conflicto de revisión; todavía sin escucha en vivo, adjuntos, tareas asignadas, notificaciones o conversión automática a venta/OT.
- Lectura de proyectos y catálogo de presupuestos completa en servidor antes de filtrar/proyectar. Agregar índices de membresía/paginación antes de escalar, manteniendo la autorización del servidor.
- El usuario aceptó el diseño y autorizó publicar. Completar y registrar la verificación del cliente; luego acompañar el primer uso real del titular sin crear registros incidentales. La auditoría general sigue en su rama aislada.
