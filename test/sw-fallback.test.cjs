const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function offlineRequest(mode, saved) {
  const events = {};
  const page = { html: true };
  vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
    self: { location: { origin: 'http://localhost' }, addEventListener: (name, fn) => events[name] = fn },
    URL, Request: class {}, Response,
    fetch: async () => { throw Error('Offline'); },
    caches: { match: async key => key === './index.html' ? page : saved },
  });
  let response;
  events.fetch({ request: { method: 'GET', mode, url: 'http://localhost/js/module.js' }, respondWith: value => response = value });
  return { response, page };
}

test('sin red un módulo ausente no recibe HTML como JavaScript', async () => {
  const { response } = offlineRequest('cors');
  assert.equal((await response).type, 'error');
});
test('sin red una navegación conserva la página de respaldo', async () => {
  const { response, page } = offlineRequest('navigate');
  assert.equal(await response, page);
});
test('sin red un módulo existente conserva su respaldo', async () => {
  const saved = { js: true };
  assert.equal(await offlineRequest('cors', saved).response, saved);
});
