const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('css/app.css', 'utf8');

assert.ok(css.includes('#oc-material-list-modal .modal{width:min(96vw,1120px);max-width:1120px}'),
  'El ancho normal no debe impedir que el controlador aplique el modo maximizado');
assert.match(css, /#oc-material-list-modal \.modal\.sv-modal-manageable\[data-sv-modal-maximizado="1"\]\{[^}]*width:calc\(100vw - 16px\)!important;max-width:none!important/,
  'El maximizado debe prevalecer incluso si una hoja responsive conserva el ancho del modal normal');
assert.match(css, /#oc-material-list-modal \.modal\.sv-modal-manageable\[data-sv-modal-maximizado="1"\] \.modal-body\{[^}]*flex:1 1 auto[^}]*overflow:hidden/,
  'La ventana maximizada debe reservar el alto para su contenido interno');
assert.match(css, /data-sv-modal-maximizado="1"\][^\n]*\.oc-material-table-wrap\{[^}]*overflow:auto!important/,
  'La tabla debe desplazarse dentro de la ventana maximizada');

console.log('OK lista-compras-maximizada-v375');
