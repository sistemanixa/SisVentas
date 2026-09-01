const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('css/app.css', 'utf8');
assert.match(css, /\.nav-item\{[^}]*margin-bottom:4px/,
  'Los accesos del menú lateral deben conservar cuatro píxeles de separación');

console.log('sidebar-spacing.test.js OK');
