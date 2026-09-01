const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('js/modules/configuration-mobile.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.match(source, /closest\('#cfg-tabs-main \.cfg-tab'\)/,
  'La vista móvil debe reaccionar al clic real de cualquier solapa');
assert.match(source, /setTimeout\(refresh331,80\)/,
  'La vista alternativa debe generarse después de que cambie el panel');
assert.match(source, /setTimeout\(refresh331,3200\)/,
  'Debe existir un reintento posterior a la carga asíncrona de Firebase');
assert.match(source, /SisVentas\.initResizableTables/,
  'Al abrir una solapa debe liberarse la grilla pendiente una vez que ya es visible');
assert.match(index, /configuration-mobile\.js\?v=3\.2\.3-config-tabs/,
  'El navegador debe invalidar la copia anterior del controlador de Configuración');

console.log('configuration-mobile-tabs.test.js OK');
