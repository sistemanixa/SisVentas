const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('las ventas anuladas quedan bloqueadas en permiso, apertura y confirmación', () => {
  assert.match(app, /function ventaEstaAnulada\(venta\)/);
  assert.match(app, /!ventaTienePagoTotal\(v\) && !ventaEstaAnulada\(v\)/);
  assert.match(app, /function abrirEditorVenta[\s\S]*?if \(ventaEstaAnulada\(v\)\)/);
  assert.match(app, /ventaOriginalEditar && ventaEstaAnulada\(ventaOriginalEditar\)/);
});

test('guardar y eliminar muestran progreso visible y lo cierran aun ante errores', () => {
  assert.match(app, /function _ventaMostrarProcesoPantalla\(textoInicial\)/);
  assert.match(app, /procesoPantallaVenta = _ventaMostrarProcesoPantalla\('Guardando cambios de la venta…'\)/);
  assert.match(app, /if \(procesoPantallaVenta\) procesoPantallaVenta\.finalizar\(\)/);
  assert.match(app, /var procesoEliminacion = _ventaMostrarProcesoPantalla/);
  assert.match(app, /finally \{[\s\S]*?procesoEliminacion\.finalizar\(\);[\s\S]*?delete window\._ventasEliminacionEnCurso\[fbKey\]/);
});

