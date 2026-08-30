const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('WhatsApp interno e IA no cubren acciones ni totales en escritorio', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /@media\(min-width:1025px\)[\s\S]*?#chat-fab\{left:76px!important;right:auto!important/);
  assert.match(css, /@media\(min-width:1025px\)[\s\S]*?#ia-fab\{left:76px!important;right:auto!important/);
});
