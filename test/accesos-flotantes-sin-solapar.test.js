const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('WhatsApp interno e IA se retraen a la derecha y aparecen con hover o teclado', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /@media\(min-width:1025px\)[\s\S]*?#chat-fab,#ia-fab\{[\s\S]*?right:-30px!important/);
  assert.match(css, /#chat-fab::before,#ia-fab::before\{[\s\S]*?inset:-14px -36px -14px -36px/);
  assert.match(css, /#chat-fab:hover,#chat-fab:focus-visible,[\s\S]*?#ia-fab:hover,#ia-fab:focus-visible\{[\s\S]*?right:0!important[\s\S]*?transform:none/);
});
