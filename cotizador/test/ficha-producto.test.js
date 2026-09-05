const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarFicha, fichaDesdeApi, validarUrlFicha, identidadAlta, protegerNavegacionFicha } = require('../ficha-producto');

test('ficha conserva datos informados, limpia HTML y señala faltantes', () => {
  const ficha = normalizarFicha({ nombre: ' Cerradura F-102T ', detalle: '<b>WiFi</b><script>robar()</script>', imagenUrl: '/images/P2822.jpg' }, 'https://www.biosegur.com.ar/producto--det--P2822');
  assert.equal(ficha.nombre, 'Cerradura F-102T');
  assert.equal(ficha.detalle, 'WiFi');
  assert.equal(ficha.imagenUrl, 'https://www.biosegur.com.ar/images/P2822.jpg');
  assert.deepEqual(ficha.faltantes, ['marca']);
  assert.equal(normalizarFicha({ imagenUrl: 'javascript:alert(1)' }).imagenUrl, '');
  assert.equal(normalizarFicha({ imagenUrl: 'http://127.0.0.1/secret' }).imagenUrl, '');
});

test('URL exacta rechaza home, imágenes, credenciales y otros dominios', () => {
  const url = 'https://www.biosegur.com.ar/producto--det--P2822';
  assert.equal(validarUrlFicha(url, 'biosegur'), url);
  for (const invalida of ['https://www.biosegur.com.ar/', 'https://www.biosegur.com.ar/images/a.jpg', 'https://usuario:clave@www.biosegur.com.ar/producto', 'https://biosegur.com.ar.ejemplo.com/producto', 'http://127.0.0.1/producto']) {
    assert.throws(() => validarUrlFicha(invalida, 'biosegur'));
  }
});

test('alta desde URL puede obtener el nombre, pero cotizar existentes mantiene la comparación', () => {
  const validar = (pedido, titulo) => ({ ok: pedido === titulo && !!pedido });
  assert.equal(identidadAlta('', 'Cerradura F-102T', true, validar).ok, true);
  assert.equal(identidadAlta('', '', true, validar).ok, false);
  assert.equal(identidadAlta('', 'Cerradura F-102T', false, validar).ok, false);
  assert.equal(identidadAlta('F-100', 'F-102T', true, validar).ok, false);
});

test('API de producto agrega marca e imagen sin inferirlas del nombre', () => {
  const ficha = fichaDesdeApi({ title: 'Cerradura F-102T', attributes: [{ id: 'BRAND', value_name: 'Trinktech' }], pictures: [{ secure_url: 'https://http2.mlstatic.com/a.jpg' }] });
  assert.equal(ficha.marca, 'Trinktech');
  assert.equal(ficha.imagenUrl, 'https://http2.mlstatic.com/a.jpg');
  assert.deepEqual(ficha.faltantes, ['detalle']);
  assert.equal(fichaDesdeApi({ title: 'Trinktech F-102T' }).marca, '');
});

test('la navegación de alta impide salir al login de otro dominio', async () => {
  let handler;
  await protegerNavegacionFicha({ route: async (_, fn) => { handler = fn; } }, 'biosegur');
  const consultar = url => handler({ request: () => ({ isNavigationRequest: () => true, url: () => url }), continue: () => 'ok', abort: () => 'bloqueado' });
  assert.equal(consultar('https://www.biosegur.com.ar/login'), 'ok');
  assert.equal(consultar('https://otro.com/login'), 'bloqueado');
});
