const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.v2.0.306.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const context = { Array, Object, Number, Set, console, document: { querySelectorAll: () => [] } };
vm.createContext(context);

const permisosInicio = app.indexOf('var PERMISOS_DEFAULT =');
const permisosFin = app.indexOf('var _paginaAntesDeNotif', permisosInicio);
const catalogoInicio = app.indexOf('var TODOS_MODULOS =');
const catalogoFin = app.indexOf('// DASHBOARD WIDGETS', catalogoInicio);
assert.notEqual(permisosInicio, -1);
assert.notEqual(permisosFin, -1);
assert.notEqual(catalogoInicio, -1);
assert.notEqual(catalogoFin, -1);
vm.runInContext(app.slice(permisosInicio, permisosFin), context);
vm.runInContext(app.slice(catalogoInicio, catalogoFin), context);

test('Roles incorpora los módulos que antes faltaban', () => {
  const ids = new Set(context.TODOS_MODULOS.map((mod) => mod.id));
  ['asistente', 'kits', 'actualizadorprecios', 'ctaemp', 'tesoreria', 'notificaciones', 'tablero']
    .forEach((id) => assert.ok(ids.has(id), `Falta ${id} en Roles`));
});

test('Una configuración legacy bloquea Kits y Asistente para técnico', () => {
  const legacy = context.normalizarPermisosRolesGuardados({
    tecnico: { bloqueados: ['clientes'] },
    vendedor: { bloqueados: [] },
    administrativo: { bloqueados: [] },
    admin: { bloqueados: [] }
  });
  assert.ok(legacy.tecnico.bloqueados.includes('kits'));
  assert.ok(legacy.tecnico.bloqueados.includes('asistente'));
  assert.ok(legacy.tecnico.bloqueados.includes('tablero'));
  assert.ok(!legacy.tecnico.bloqueados.includes('ctaemp'));
});

test('Una ruta nueva del menú aparece automáticamente y requiere autorización explícita', () => {
  context.document.querySelectorAll = () => [{
    getAttribute: () => "showPage('inventario',this)",
    textContent: ' Inventario avanzado '
  }];
  const mod = context.obtenerTodosModulosRoles().find((item) => item.id === 'inventario');
  assert.deepEqual(JSON.parse(JSON.stringify(mod)), {
    id: 'inventario', label: 'Inventario avanzado', nuevo: true
  });

  context.PERMISOS_ROLES = {
    tecnico: { bloqueados: [], permitidos: [] },
    vendedor: { bloqueados: [], permitidos: ['inventario'] }
  };
  assert.equal(context.permisoConfiguradoParaRol('inventario', 'tecnico'), false);
  assert.equal(context.permisoConfiguradoParaRol('inventario', 'vendedor'), true);
});

test('Toda ruta actual del menú ya se muestra en la configuración de Roles', () => {
  const menuIds = [...html.matchAll(/onclick="showPage\('([^']+)'/g)].map((match) => match[1]);
  const ids = new Set(context.TODOS_MODULOS.map((mod) => mod.id));
  menuIds.forEach((id) => assert.ok(ids.has(id), `La ruta ${id} debe poder configurarse por rol`));
});
