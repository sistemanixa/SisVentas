const test = require('node:test');
const assert = require('node:assert/strict');
const { readActiveApp } = require('./helpers/active-app');

const active = readActiveApp();

test('una imagen interna no expone su Base64 como URL al usuario', () => {
  assert.match(active.index, /id="pf-imagen-guardada-estado"/);
  assert.match(active.source, /var imagenEsInterna = \/\^data:image\\\//i);
  assert.match(active.source, /\.value = imagenEsInterna \? '' : p\.imagenUrl/);
  assert.match(active.source, /Imagen guardada en el sistema/);
});

test('una URL real continúa visible y editable', () => {
  assert.match(active.index, /id="pf-imagen-url"[^>]+placeholder="https:\/\/\.\.\."/);
  assert.match(active.source, /_actualizarEstadoImagenProducto\(''\);[\s\S]*?prodImagenUrlActual = url/);
});
