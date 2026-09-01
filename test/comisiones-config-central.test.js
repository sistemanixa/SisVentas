const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.v3.2.3.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const finance = fs.readFileSync('js/modules/finance-details.js', 'utf8');

assert.match(html, /id="cfg-comisiones-empleados-tbody"/,
  'Configuración debe permitir administrar excepciones por empleado');
assert.match(html, /app\.v3\.2\.3\.js(?:\?preview=2)?/,
  'La vista local debe invalidar el controlador anterior de comisiones');
assert.doesNotMatch(app, /% Comisión propio \(solo vendedor a comisión\)/,
  'La ficha de empleado no debe editar la comisión');
assert.match(app, /sisventas\/config\/comisionesEmpleados/,
  'Las excepciones deben persistirse en la configuración central');
assert.match(app, /migrarComisionesEmpleadosDesdeFichas/,
  'Los porcentajes actuales deben migrarse sin perder valores');
assert.match(app, /function obtenerDetalleComisionEmpleado/,
  'Debe existir una única resolución de cargo y excepción individual');
assert.match(app, /var detalle = obtenerDetalleComisionEmpleado\(emp\);[\s\S]{0,100}return parseFloat\(detalle\.pctSolicitado\)/,
  'La generación debe dejar de priorizar la ficha personal');
assert.match(app, /var pctCadaUno = maxComisionPct \/ vendedores\.length/,
  'Si la suma excede el máximo, el tope debe dividirse en partes iguales');
assert.match(finance, /obtenerDetalleComisionEmpleado\(emp\)\.pct/,
  'La cuenta personal debe leer la configuración central');

console.log('comisiones-config-central.test.js OK');
