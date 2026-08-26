const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('un cargo puede liquidarse únicamente por comisión', () => {
  assert.match(html, /value="solo_comision">Solo comisión · sin valor hora/);
  assert.match(app, /modalidadRemuneracion: soloComision \? 'solo_comision' : 'horas'/);
  assert.match(app, /valorHora: soloComision \? 0/);
  assert.match(app, /diasMes: soloComision \? 0/);
  assert.match(app, /valorHoraExtra: soloComision \? 0/);
  assert.match(app, /soloComision\?'Comisiones'/);
});

test('las categorías pueden escribirse y los ceros guardados no recuperan valores predeterminados', () => {
  assert.match(html, /id="cargo-categoria-base" list="cargo-categorias-list"/);
  assert.match(app, /c\.valorHora == null \? 5000 : c\.valorHora/);
  assert.match(app, /c\.diasMes == null \? 23 : c\.diasMes/);
  assert.match(app, /c\.valorHoraExtra == null \? 7500 : c\.valorHoraExtra/);
  assert.match(app, /Object\.values\(CARGOS_DATA\|\|\{\}\).*categoriaBase/);
});
