const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('css/app.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
assert.match(css, /\.nav-item\{[^}]*margin-bottom:4px/,
  'Los accesos del menú lateral deben conservar cuatro píxeles de separación');
assert.match(html, /showPage\('asistente',this\)[^>]*margin:0 4px 9px/,
  'El acceso destacado no debe anular la separación con Presupuestos');

console.log('sidebar-spacing.test.js OK');
