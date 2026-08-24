const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert.match(html, /id="movi-modal-titulo"/, 'El modal debe tener un título identificable');
assert.match(app, /function abrirAdelantoEmpleadoDesdeEmpleados\(empFbKey\)/, 'Debe existir el acceso directo al adelanto');
assert.match(app, /abrirNuevoMovEmp\('adelanto'\)/, 'Debe reutilizar el movimiento de tipo adelanto');
assert.match(app, /estado\.value = 'pagado';[\s\S]*?onMoviEstadoChange\(\)/, 'El adelanto entregado debe solicitar el medio de pago');
assert.match(app, /title="Cargar adelanto"/, 'La grilla de empleados debe ofrecer la acción directa');
assert.match(app, /> Cargar adelanto<\/button>/, 'El legajo debe ofrecer una acción explícita');
assert.doesNotMatch(app, /293[.\s]?100/, 'El monto informado por el usuario no debe quedar fijo en el código');
assert.doesNotMatch(app, /osmar tello/i, 'El empleado informado por el usuario no debe quedar fijo en el código');
assert.match(html, /id="nav-label-ctaemp">Cuentas de empleados</, 'La cuenta del personal debe figurar como módulo separado');
assert.match(html, /id="ctaemp-page-heading"[^>]*>Cuentas de empleados</, 'El módulo debe tener un encabezado propio');
assert.match(app, /gestionaCuentasEmpleados \? 'Cuentas de empleados' : 'Mi cuenta'/, 'Los empleados deben conservar su acceso personal');
assert.match(app, /navCtaEmp\.style\.display = \(isAdmin \|\| permisoConfiguradoParaRol\('ctaemp', currentRole\)\) \? '' : 'none'/, 'El módulo debe permanecer visible para el administrador');

console.log('OK empleados: carga directa de adelantos');
