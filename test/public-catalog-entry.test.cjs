'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const source = fs.readFileSync('js/core/public-catalog-entry.js', 'utf8');
function setup(href = 'https://example.com/catalogo.html', data = new Map(), state = null) {
  const root = {
    location: { href }, crypto: { randomUUID: () => 'test-unique-token' },
    history: { state, replaceState(next, _, url) { this.state = next; root.location.href = url; } },
    localStorage: { get length() { return data.size; }, key: i => [...data.keys()][i], getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }
  };
  vm.runInNewContext(source, { window: root, URL, Date, Object });
  return { root, api: root.SVPublicCatalogEntry, data };
}
test('acceso directo, parámetro viejo y token inventado no muestran regreso', () => {
  for (const query of ['', '?desde=ofertas', '?entrada=inventada', '?desde=ofertas&producto=abc']) {
    const x = setup('https://example.com/catalogo.html' + query);
    assert.equal(x.api.consume(), false);
    assert.equal(new URL(x.root.location.href).searchParams.has('desde'), false);
  }
});
test('el clic en Ofertas crea una entrada de un uso y elimina el marcador de la URL', () => {
  const offers = setup('https://example.com/index.html#/distribuidora');
  const href = offers.api.createHref(), catalog = setup(href, offers.data);
  assert.equal(catalog.api.consume(), true);
  assert.equal(catalog.root.location.href, 'https://example.com/catalogo.html');
  assert.equal(setup(href, offers.data).api.consume(), false);
  assert.equal(setup(catalog.root.location.href, offers.data).api.consume(), false);
});
test('recargar y navegar la ficha conserva el contexto solo en su historial', () => {
  const offers = setup(), catalog = setup(offers.api.createHref(), offers.data);
  assert.equal(catalog.api.consume(), true);
  const detail = setup('https://example.com/catalogo.html?producto=abc', offers.data, catalog.root.history.state);
  assert.equal(detail.api.consume(), true);
  assert.equal(new URL(detail.root.location.href).searchParams.get('producto'), 'abc');
  assert.equal(setup(detail.root.location.href, offers.data).api.consume(), false);
  assert.equal(setup('https://example.com/catalogo.html?desde=ofertas', offers.data, detail.root.history.state).api.consume(), false);
});
test('entradas vencidas o almacenamiento bloqueado fallan sin enlace interno', () => {
  const data = new Map([['sv-catalog-entry:old', String(Date.now() - 1)]]);
  assert.equal(setup('https://example.com/catalogo.html?entrada=old', data).api.consume(), false);
  const x = setup('https://example.com/catalogo.html?entrada=blocked');
  Object.defineProperty(x.root, 'localStorage', { get() { throw Error('blocked'); } });
  assert.equal(x.api.consume(), false);
  assert.equal(x.api.createHref(), 'https://example.com/catalogo.html');
});
test('la navegación interna conserva contexto y las páginas cargan la protección', () => {
  assert.match(fs.readFileSync('js/public-catalog.js', 'utf8'), /history\.pushState\(history\.state/);
  for (const file of ['catalogo.html', 'index.html']) assert.match(fs.readFileSync(file, 'utf8'), /public-catalog-entry\.js\?v=/);
  const portal = fs.readFileSync('js/modules/paraguay-shopping-access.js', 'utf8');
  assert.match(portal, /data-public-catalog href="\.\/catalogo\.html"/);
  assert.match(portal, /addEventListener\('click', preparePublicCatalog\)/);
});
