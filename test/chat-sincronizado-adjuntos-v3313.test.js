const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.v3.3.13.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

test('chat publica y escucha el estado escribiendo por conversación', () => {
  assert.match(app, /function chatInputCambio\(/);
  assert.match(app, /sisventas\/chat_escribiendo/);
  assert.match(app, /está escribiendo…/);
  assert.match(index, /id="chat-typing"/);
});

test('la lectura remota manda sobre el contador local de cualquier dispositivo', () => {
  assert.match(app, /_chatAvisosPendientesLocales = total;\s*var totalVisible = total;/);
  assert.doesNotMatch(app, /Math\.max\(total, _chatAvisosPendientesLocales\)/);
});

test('limpiar se limita a la conversación abierta', () => {
  assert.match(app, /canal === 'directos'/);
  assert.match(app, /solamente los mensajes de la conversación abierta/);
  assert.match(index, /Limpiar conversación/);
});

test('chat admite un conjunto cerrado de adjuntos seguros', () => {
  assert.match(index, /\.pdf,.txt,.csv,.docx,.xlsx/);
  assert.match(app, /function chatEnviarArchivo\(/);
  assert.match(app, /file\.size > 10 \* 1024 \* 1024/);
  assert.match(app, /archivoUrl/);
  assert.match(app, /noopener noreferrer/);
});
