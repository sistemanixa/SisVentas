const fs = require('fs');
const assert = require('assert');

const modulo = fs.readFileSync('js/modules/commissions.js', 'utf8');
const app = fs.readFileSync('js/app.v3.7.5.js', 'utf8');

assert.match(modulo, /est === 'pendiente_aprobacion' \|\| est === 'pendiente_pago'/,
  'La gestión debe permitir rechazar una comisión aprobada que todavía está pendiente de pago');
assert.match(app, /estadoActual === 'pagado' \|\| estadoActual === 'pagado_parcial'/,
  'Las comisiones con pagos registrados deben quedar protegidas');
assert.match(app, /aprobacionRevertida:estadoActual === 'pendiente_pago'/,
  'La reversión de una aprobación debe quedar auditada');
assert.match(app, /aprobadoPor:null, fechaAprobacion:null, aprobadoTs:null/,
  'Al rechazar se deben limpiar los marcadores de aprobación en ambos registros vinculados');

console.log('OK comisiones-revertir-aprobacion-v375');
