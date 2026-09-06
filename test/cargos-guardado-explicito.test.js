const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.v3.2.3.js', 'utf8');
const mobile = fs.readFileSync('js/modules/configuration-mobile.js', 'utf8');

assert.match(app, /async function cargosGuardarValoresAtomico/,
  'Cargos debe tener un único guardado atómico por fila');
assert.match(app, /await window\.fbUpdate\(window\.fbRef\(window\.fbDB\), actualizaciones\)/,
  'La confirmación debe esperar la escritura real de todos los campos');
assert.match(app, /boton\.textContent = 'Guardando\.\.\.'/,
  'El botón debe informar que la escritura está en curso');
assert.match(app, /boton\.textContent = 'Guardado ✓'/,
  'El botón debe confirmar solo después de guardar');
assert.doesNotMatch(mobile, /onchange="cargosEditarRapido/,
  'La vista móvil no debe autoguardar al salir del campo');
assert.match(mobile, /data-cargo-save[\s\S]{0,180}guardarCargoMobile331/,
  'La vista móvil debe requerir el mismo botón Guardar');
assert.match(app, /presioná Guardar para confirmar/,
  'Copiar la hora extra no debe escribir automáticamente');

console.log('cargos-guardado-explicito.test.js OK');
