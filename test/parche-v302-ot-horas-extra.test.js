const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v3.0.5.js'), 'utf8');
const custody = fs.readFileSync(path.join(root, 'js', 'modules', 'ot-material-custody.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, 'js', 'modules', 'ot-workflow.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('la versión activa queda enlazada en aplicación y documento', () => {
  assert.match(index, /app\.v3\.0\.5\.js/);
  assert.match(app, /VERSION: 'v3\.0\.5-firebase'/);
});

test('guardar custodia conserva la posición visible de Materiales', () => {
  assert.match(custody, /materialCard\.getBoundingClientRect\(\)\.top/);
  assert.match(custody, /scrollTop \+ correction/);
  assert.match(custody, /requestAnimationFrame/);
  assert.match(workflow, /var sameOT=/);
  assert.match(workflow, /if\(!sameOT\) window\._otWizardStep='cliente'/);
  assert.match(workflow, /show\(targetStep,\{scroll:!sameOT\}\)/);
});

test('el origen de la OT abre venta o reclamo y es accesible por teclado', () => {
  assert.match(app, /function otAbrirDocumentoOrigen\(\)/);
  assert.match(app, /origen === 'reclamo'.*otVerReclamo\(\)/s);
  assert.match(app, /origen === 'venta'.*verDetalleVenta/s);
  assert.match(app, /origenBadge\.onkeydown/);
});

test('horas extra bloquea a técnicos con OT abiertas de más de diez días', () => {
  assert.match(app, /function _hsexOTPendientesVencidas\(empleado\)/);
  assert.match(app, /limite\.setDate\(limite\.getDate\(\) - 10\)/);
  assert.match(app, /var esRolTecnico = currentRole === 'tecnico' \|\| currentRole === 'tecnico_vendedor'/);
  assert.match(app, /async function enviarSolicitudHsExtra[\s\S]*_hsexOTPendientesVencidas\(empleadoActual\)/);
  assert.match(app, /Ver OT pendientes/);
});
