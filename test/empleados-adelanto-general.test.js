const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const permisos = fs.readFileSync('js/modules/action-permissions.js', 'utf8');

assert.match(html, /onclick="abrirModalHaberesMes\(\)"[^>]*>[\s\S]*?Haberes<\/button>/, 'el acceso principal debe llamarse Haberes');
assert.match(html, /onclick="abrirModalAdelantoGeneral\(\)"[^>]*>[\s\S]*?Cargar adelanto<\/button>/, 'debe existir un acceso general para cargar adelantos');
assert.equal((html.match(/data-permiso="empleados\.gestionarAdelantos" onclick="abrirModalAdelantoGeneral\(\)"/g) || []).length, 2, 'Empleados y Gastos deben compartir el acceso autorizado');
assert.match(permisos, /'empleados\.gestionarAdelantos': \{modulo:'ctaemp',label:'Registrar adelantos de empleados',roles:\['admin','administrativo'\]\}/, 'Roles debe permitir delegar adelantos al perfil administrativo');
assert.match(permisos, /\['abrirModalAdelantoGeneral','empleados\.gestionarAdelantos'\]/, 'la apertura debe estar protegida por el permiso');
assert.match(permisos, /\['continuarAdelantoGeneral','empleados\.gestionarAdelantos'\]/, 'la continuación debe estar protegida por el permiso');
assert.doesNotMatch(html, /onclick="abrirModalBonificacionEmpleado\(\)"/, 'no debe mantenerse el acceso redundante de bonificación');
assert.match(app, /function abrirModalAdelantoGeneral\(\)/, 'debe existir el selector general de empleado');
assert.match(app, /function continuarAdelantoGeneral\(\)/, 'el selector debe continuar al formulario del adelanto');

const renderEmpleados = app.slice(app.indexOf('function renderTablaEmpleados()'), app.indexOf('function fbCargarCategorias()'));
assert.doesNotMatch(renderEmpleados, /abrirAdelantoEmpleadoDesdeEmpleados/, 'cada fila no debe repetir el acceso de adelanto');
assert.doesNotMatch(renderEmpleados, /onclick="editarEmpleado/, 'editar debe quedar dentro del legajo');
assert.doesNotMatch(renderEmpleados, /title="Ver legajo"/, 'la fila completa ya abre el legajo');
assert.match(renderEmpleados, /abrirCuentaEmpleadoDesdeEmpleados/, 'la cuenta del empleado debe conservarse en la fila');

console.log('empleados-adelanto-general.test.js OK');
