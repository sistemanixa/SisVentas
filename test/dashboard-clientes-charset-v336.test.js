const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.336.js'), 'utf8');

test('volver al dashboard usa render agrupado y cacheado', () => {
  const bloqueNavegacion = app.slice(app.indexOf("if (id === 'dashboard')"), app.indexOf("if (id === 'ctaemp')"));
  assert.match(bloqueNavegacion, /solicitarRenderDashboard\(false\)/);
  assert.doesNotMatch(bloqueNavegacion, /renderKPIsDashboard\(\)/);
  assert.match(app, /DASHBOARD_ULTIMA_REVISION === DASHBOARD_DATOS_REVISION/);
  assert.match(app, /if \(DASHBOARD_RENDER_PROGRAMADO && !forzar\) return/);
  assert.ok((app.match(/marcarDashboardDatosSucios\(\)/g) || []).length >= 7);
});

test('la pantalla inicial no espera doce segundos a los nodos grandes', () => {
  const inicio = app.indexOf('function _completarLogin');
  const fin = app.indexOf('// selCli definida arriba', inicio);
  const bloque = app.slice(inicio, fin);
  assert.doesNotMatch(bloque, /svEsperarCargaInicial\(12000\)\.then/);
  assert.match(bloque, /classList\.add\('visible'\)/);
  assert.match(bloque, /setTimeout\(fbCargarTodo, 180\)/);
  assert.ok(bloque.indexOf("classList.add('visible')") > bloque.indexOf('setTimeout(fbCargarTodo, 180)'));
});

test('los recursos activos no contienen secuencias de codificación dañada', () => {
  const archivos = ['index.html', 'js/app.v2.0.336.js', 'js/app.js'];
  const patron = /[\u00c2\u00c3\u00e2\u00ef\ufffd]/u;
  archivos.forEach((archivo) => {
    const texto = fs.readFileSync(path.join(root, archivo), 'utf8');
    assert.equal(patron.test(texto), false, `${archivo} contiene mojibake`);
  });
});

test('el reparador visual conserva texto correcto y recupera datos históricos', () => {
  const inicio = app.indexOf('function svTextoLegible');
  const fin = app.indexOf('function escapeHTML', inicio);
  const contexto = { window:{} };
  vm.createContext(contexto);
  vm.runInContext(app.slice(inicio, fin), contexto);
  assert.equal(contexto.svTextoLegible('Técnica válida'), 'Técnica válida');
  assert.equal(contexto.svTextoLegible('Generaci\u00C3\u00B3n'), 'Generación');
  assert.equal(contexto.svTextoLegible('\u00C2\u00A1Atención!'), '¡Atención!');
});

test('los clientes solo se agrupan mediante vínculo explícito', () => {
  const inicio = app.indexOf('var _clientesGruposAbiertos');
  const fin = app.indexOf('function renderTablaClientes', inicio);
  const contexto = {
    clientesData: [
      {fbKey:'principal', id:'1', nombre:'GERARDO TOYOS'},
      {fbKey:'sede_a', id:'2', nombre:'GERARDO TOYOS', clientePrincipalFbKey:'principal', dir:'LURO 5801'},
      {fbKey:'homonimo', id:'3', nombre:'GERARDO TOYOS', dir:'OTRA DIRECCIÓN'}
    ],
    Set, String, Array, Object, document:{ querySelector:() => null }
  };
  vm.createContext(contexto);
  vm.runInContext(app.slice(inicio, fin), contexto);
  assert.equal(contexto.clienteRaizRegistro(contexto.clientesData[1]).fbKey, 'principal');
  assert.equal(contexto.clientesDelGrupo(contexto.clientesData[0]).length, 2);
  assert.equal(contexto.clientesDelGrupo(contexto.clientesData[2]).length, 1);
});

test('un cliente principal no se puede eliminar mientras tenga sedes', () => {
  assert.match(app, /No se puede eliminar el cliente principal mientras tenga/);
  assert.match(app, /clientePrincipalFbKey/);
});

test('Clientes limita el DOM inicial y permite cargar más filas', () => {
  assert.match(app, /var _clientesLimiteVista = 80/);
  assert.match(app, /lista = lista\.slice\(0, limite\)/);
  assert.match(app, /function mostrarMasClientes\(\)/);
});
