# Auditoría de permisos internos — 5 de septiembre de 2026

Se revisaron 76 scripts cargados por index.html. Se encontraron 19 referencias directas a roles. Son candidatos de revisión, no todos representan un permiso: también hay etiquetas, valores por defecto y personalización. No se inspeccionaron versiones históricas no cargadas.

## Cambios de este parche

- Roles ordenados por nombre, buscador que conserva todas las casillas, nombres desde el menú.
- Corrección y entrega de materiales de OT, y resolución de reclamos, registradas en el catálogo de acciones.
- Eliminado el veto adicional fijo del técnico en el resolutor de rutas.
- Casillas de margen de ventas y presupuestos configurables.
- Configuración destacada en rojo.

## Estado de la migración

- El catálogo central decide acciones antes limitadas por comparaciones de roles en ventas, presupuestos, fiscal, personal, precios, soporte, OT, mantenimiento y chat.
- Los widgets consultan Roles y reutilizan la configuración histórica cuando todavía no hay una casilla explícita. Se eliminó su editor duplicado.
- Admin también admite casillas de acciones explícitas; dashboard sigue siendo la página de entrada común.
- Se agregaron 447 valores de acciones a la configuración guardada mediante transacción, conservando todas las autorizaciones y bloqueos previamente guardados. Respaldo local previo a la migración.
- Roles incluye búsqueda de 44 px, expansión y contracción global, orden alfabético y Configuración resaltada en rojo dentro de la tabla.
- Verificación: 46 pruebas seleccionadas aprobadas; búsqueda y plegado comprobados en navegador sin alterar casillas.

## Límite pendiente del servidor

Las reglas reales de Firebase consultadas en esta sesión permiten lectura y escritura a usuarios autenticados sin aplicar el catálogo de acciones. Esta migración centraliza la aplicación cliente; NO equivale a autorización aplicada por el servidor. Ese punto requiere un diseño por rutas y operaciones y pruebas de permisos contra las reglas antes de desplegarlo. No se modificaron ni desplegaron reglas del servidor.

Las reglas contables, de cobros, entrega y rendición son validaciones del registro, no permisos por rol. Deben permanecer aunque se centralice quién puede ejecutar cada acción.

## Inventario completo de referencias candidatas

| Archivo y línea | Función | Expresión |
|---|---|---|
| js/modules/action-permissions.js:12 | isAdmin | `function isAdmin(){ return normRol() === 'admin'; }` |
| js/modules/action-permissions.js:13 | isAdm | `function isAdm(){ return normRol() === 'administrativo'; }` |
| js/modules/action-permissions.js:194 | overrideAccion | `if(regla.admin)return role==='admin';` |
| js/app.v3.3.16.js:2493 | iaAbrir | `var bienvenidaRol = currentRole === 'tecnico'` |
| js/app.v3.3.16.js:2495 | iaAbrir | `: currentRole === 'administrativo' \|\| currentRole === 'vendedor'` |
| js/app.v3.3.16.js:5231 | renderTablaUsuarios | `var rolBadge = u.rol === 'admin' \|\| u.rol === 'Administrador'` |
| js/app.v3.3.16.js:5233 | renderTablaUsuarios | `: u.rol === 'tecnico' \|\| u.rol === 'Técnico'` |
| js/app.v3.3.16.js:9481 | esAdmin | `function esAdmin() { return rolActualNormalizado() === 'admin'; }` |
| js/app.v3.3.16.js:9482 | esAdministrativo | `function esAdministrativo() { return rolActualNormalizado() === 'administrativo'; }` |
| js/app.v3.3.16.js:9483 | esTecnico | `function esTecnico() { return rolActualNormalizado() === 'tecnico'; }` |
| js/app.v3.3.16.js:9751 | showPage | `var _titulo = id === 'ctaemp' && (currentRole === 'admin' \|\| currentRole === 'administrativo')` |
| js/app.v3.3.16.js:13153 | aplicarRolYNombre | `currentRole = (r==='admin'\|\|r==='administrador') ? 'admin'` |
| js/app.v3.3.16.js:14644 | inicializarFilasVenta | `} else if (currentRole === 'admin' && currentUser) {` |
| js/app.v3.3.16.js:43041 | pptoAccion | `const usuario = currentUser \|\| (currentRole === 'admin' ? 'Admin' : 'Vendedor');` |
| js/app.v3.3.16.js:43560 | guardarPresupuesto | `audit: [{ fecha: new Date().toLocaleDateString('es-AR') + ' ' + new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}), usuario: currentUser \|\| (currentRole === 'admin' ? 'Admin' : 'Vendedor'), accion: aprobacionDirectaAdmin ? 'Creado y aprobado directamente por administrador' : (estadoFinal === 'revision' ? 'Creado y enviado a revisión automáticamente por regla de aprobación' : (estadoFinal === 'aprobado_int' ? 'Creado dentro del límite configurado, sin requerir aprobación' : 'Presupuesto creado como borrador')) }]` |
| js/app.v3.3.16.js:46552 | toggleChecklistFase | `usuario: currentUser \|\| (currentRole === 'admin' ? 'Admin' : ot.tecnico),` |
| js/app.v3.3.16.js:46592 | toggleCheckOT | `ot.audit.push({ fecha: ahora, usuario: currentUser \|\| (currentRole === 'admin' ? 'Admin' : ot.tecnico), accion: (ot.checks[fase][idx] ? '✓ ' : '✗ ') + CHECKLISTS[fase][idx] });` |
| js/app.v3.3.16.js:46681 | completarOT | `auditCierre.push({ fecha: ahora, usuario: currentUser \|\| (currentRole === 'admin' ? 'Admin' : ot.tecnico), accion: custodiaCierre.conObservaciones ? 'OT cerrada con materiales pendientes clasificados. Conformidad: ' + conf : 'OT marcada como completada. Conformidad: ' + conf });` |
| js/app.v3.3.16.js:49821 | ventaCreadorBadge | `(clave === String(currentUser \|\| '').trim().toLowerCase() && String(currentRole \|\| '').toLowerCase() === 'admin'));` |
