const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.v3.7.3.js'), 'utf8');
const permissions = fs.readFileSync(path.join(root, 'js', 'modules', 'action-permissions.js'), 'utf8');

function sourceOfFunction(name) {
  const start = app.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'No se encontró ' + name);
  const firstBrace = app.indexOf('{', start);
  let depth = 0;
  for (let i = firstBrace; i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error('Función incompleta: ' + name);
}

test('el selector ofrece los dos destinos y deja la venta original como acción principal', () => {
  assert.match(html, /id="ot-btn-venta-nueva"[\s\S]*Crear venta nueva/);
  assert.match(html, /id="ot-btn-venta-original"[\s\S]*Agregar a venta original/);
  assert.match(html, /class="btn btn-primary"[^>]*id="ot-btn-venta-original"/);
  assert.match(permissions, /"otConfirmarProductosAdicionales":"ot\.corregirMateriales"/);
  assert.match(permissions, /"otConfirmarVentaAdicional":"ot\.corregirMateriales"/);
});

test('los materiales conservan su venta destino y no mezclan dos ventas nuevas', () => {
  const sandbox = {
    _otCarritoAdicional: [{ codigo:'P-1', nombre:'Sensor', cantidad:2, precio:100 }],
    currentUser: 'Prueba',
    svFechaLocalISO: () => '2026-09-22',
    _redondearPrecioActual: value => Math.round(value * 100) / 100,
    Object, String, Number, Date
  };
  vm.runInNewContext(sourceOfFunction('otMaterialesConAdicionales'), sandbox);
  const original = sandbox.otMaterialesConAdicionales({ materiales:[] }, 'original', { fbKey:'venta-original', id:'#V-1' });
  assert.equal(original[0].destinoVenta, 'original');
  assert.equal(original[0].ventaDestinoFbKey, 'venta-original');

  sandbox._otCarritoAdicional = [{ codigo:'P-1', nombre:'Sensor', cantidad:1, precio:100 }];
  const nueva = sandbox.otMaterialesConAdicionales({ materiales:original }, 'nueva', { fbKey:'venta-nueva', id:'#V-2' });
  assert.equal(nueva.length, 2);
  assert.equal(nueva[1].destinoVenta, 'nueva');
  assert.equal(nueva[1].ventaDestinoId, '#V-2');
});

test('crear una venta nueva guarda venta, OT, vínculo y notificación en una sola actualización', () => {
  const nueva = sourceOfFunction('otConfirmarVentaAdicional');
  assert.match(nueva, /await otLeerSiMaterialesNoCambiaron\(ot\)/);
  assert.match(nueva, /updates\[FB_PATHS\.ventas \+ '\/' \+ ventaKey\] = venta/);
  assert.match(nueva, /\/materiales'\] = materiales/);
  assert.match(nueva, /\/ventasAdicionales\/' \+ ventaKey/);
  assert.match(nueva, /notificaciones_admin\/' \+ notificacionRef\.key/);
  assert.match(nueva, /await window\.fbUpdate\(window\.fbRef\(window\.fbDB\), updates\)/);
});

test('la sincronización con la venta original excluye materiales destinados a otra venta', () => {
  const guardar = sourceOfFunction('otGuardarCorreccionProductos');
  assert.match(guardar, /material\.destinoVenta !== 'nueva'/);
  assert.match(guardar, /materiales:materialesVentaOriginal/);
});
