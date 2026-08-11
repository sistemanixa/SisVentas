const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const appActivo = (html.match(/<script src="\.\/js\/(app\.v[^"?]+\.js)"/) || [])[1];
assert.ok(appActivo, 'index.html debe declarar el archivo principal activo');
const app = fs.readFileSync(path.join(raiz, 'js', appActivo), 'utf8');

test('Empleados separa haberes, bonificaciones posteriores y comisiones vinculadas', () => {
  assert.match(html, /Haberes y bonificaciones/);
  assert.match(html, /onclick="abrirModalBonificacionEmpleado\(\)"/);
  assert.match(html, /onclick="abrirModalComisionVenta\(\)"/);
  assert.match(html, /id="modal-bonificacion-empleado"/);
  assert.match(html, /id="modal-comision-venta"/);
  assert.match(html, /list="comision-manual-ventas-list"/);
});

test('la bonificación posterior crea un haber y un gasto pagable sin modificar el sueldo', () => {
  const inicio = app.indexOf('function _guardarBonificacionEmpleadoAtomica');
  const fin = app.indexOf('var _comisionManualVentasMap', inicio);
  const flujo = app.slice(inicio, fin);
  assert.match(flujo, /actualizaciones\['ctaemp\/\s*' \+ emp\.fbKey \+ '\/' \+ movKey\] = movGuardado/);
  assert.match(flujo, /actualizaciones\['gastos\/' \+ gastoKey\] = gastoGuardado/);
  assert.match(flujo, /window\.fbUpdate\(window\.fbRef\(window\.fbDB, 'sisventas'\), actualizaciones\)/);
  assert.doesNotMatch(flujo, /fbRunTransaction\(window\.fbRef\(window\.fbDB, 'sisventas'/);
  assert.match(flujo, /tipoPagable: 'bonificacion'/);
  assert.match(flujo, /gastoGuardado\.estado = 'aprobado'/);
  assert.match(flujo, /tipo: 'bonificacion'/);
  assert.doesNotMatch(flujo, /sueldoBase\s*=/);
  assert.match(app, /TIPOS_HABER = \['sueldo','aguinaldo','comision','hextra','bonificacion'/);
});

test('la comisión manual usa la misma base que la automática y conserva la venta canónica', () => {
  assert.match(app, /function _calcularBaseComisionVenta\(venta\)/);
  assert.match(app, /var calculoBaseComision = _calcularBaseComisionVenta\(venta\)/);
  assert.match(app, /await _ventaTieneComisionGenerada\(emp\.fbKey, venta\)/);
  assert.match(app, /await _generarComisionVentaAtomica\(emp, movimiento\)/);
  assert.match(app, /ventaId: venta\.id \|\| venta\.numero \|\| venta\.nro/);
  assert.match(app, /ventaFbKey: venta\.fbKey \|\| ''/);
  assert.match(app, /origenCarga: 'manual_empleados'/);
  assert.match(app, /comisionYaExistia/);
});
