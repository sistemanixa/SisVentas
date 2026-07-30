const test = require('node:test');
const assert = require('node:assert/strict');

const Bridge = require('../js/v3/app-bridge.js');

function runtime(eligible = true) {
  const modules = {};
  Bridge.modules.forEach((name) => {
    modules[name] = { module: name, eligible, active: false, reason: eligible ? 'shadow-only' : 'shadow-blocked' };
  });
  return {
    activationStatus: () => ({ modules }),
    activate(name) {
      if (modules[name].eligible) modules[name] = { module: name, eligible: true, active: true, reason: 'active' };
      return modules[name];
    },
    deactivate(name) {
      modules[name] = { module: name, eligible, active: false, reason: eligible ? 'shadow-only' : 'shadow-blocked' };
    },
    rollback() {
      Object.keys(modules).forEach((name) => {
        modules[name] = { module: name, eligible, active: false, reason: eligible ? 'shadow-only' : 'shadow-blocked' };
      });
    }
  };
}

test('ningún módulo se activa mientras su adaptador de aplicación no esté conectado', () => {
  const bridge = Bridge.create({}, { runtime: runtime(true) });

  assert.equal(bridge.status('presupuestos').wired, false);
  assert.equal(bridge.activate('presupuestos').active, false);
  assert.equal(bridge.status('presupuestos').reason, 'not-wired');
});

test('un módulo conectado sólo se activa después de aprobar su compuerta sombra', () => {
  let activated = 0;
  let deactivated = 0;
  const bridge = Bridge.create({}, { runtime: runtime(true) });
  bridge.register('presupuestos', {
    onActivate: () => { activated += 1; },
    onDeactivate: () => { deactivated += 1; },
    total: (record) => bridge.canonical.budget(record).total
  });

  assert.equal(bridge.status('presupuestos').wired, true);
  assert.equal(bridge.status('presupuestos').active, false);
  assert.equal(bridge.activate('presupuestos').active, true);
  assert.equal(activated, 1);
  assert.equal(bridge.invoke('presupuestos', 'total', [{ conIva: false, items: [{ qty: 2, punit: 50 }] }], () => -1), 100);

  bridge.deactivate('presupuestos');
  assert.equal(deactivated, 1);
  assert.equal(bridge.invoke('presupuestos', 'total', [{}], () => 77), 77);
});

test('una compuerta bloqueada conserva siempre el comportamiento estable', () => {
  const bridge = Bridge.create({}, { runtime: runtime(false) });
  bridge.register('ventasPagos', { summary: () => 'v3' });

  assert.equal(bridge.activate('ventasPagos').active, false);
  assert.equal(bridge.invoke('ventasPagos', 'summary', [], () => 'v2'), 'v2');
});

test('rollback desactiva juntos todos los módulos conectados', () => {
  const bridge = Bridge.create({}, { runtime: runtime(true) });
  bridge.register('presupuestos', {});
  bridge.register('ordenesTrabajo', {});
  bridge.activate('presupuestos');
  bridge.activate('ordenesTrabajo');

  const rolledBack = bridge.rollback();
  assert.equal(rolledBack.modules.presupuestos.active, false);
  assert.equal(rolledBack.modules.ordenesTrabajo.active, false);
});

test('un error al refrescar una vista nunca impide el rollback', () => {
  const bridge = Bridge.create({}, { runtime: runtime(true) });
  bridge.register('productosProveedores', {
    onDeactivate: () => { throw new Error('vista desmontada'); }
  });
  bridge.activate('productosProveedores');

  assert.equal(bridge.status('productosProveedores').active, true);
  const rolledBack = bridge.rollback();
  assert.equal(rolledBack.modules.productosProveedores.active, false);
  assert.equal(bridge.status('productosProveedores').active, false);
});

test('cerrar sesión revierte toda activación V3 antes del próximo usuario', () => {
  const listeners = {};
  const bridge = Bridge.create({
    document: {
      addEventListener: (name, callback) => { listeners[name] = callback; },
      dispatchEvent: () => {}
    }
  }, { runtime: runtime(true) });
  bridge.register('presupuestos', {});
  bridge.activate('presupuestos');

  assert.equal(bridge.status('presupuestos').active, true);
  listeners['sisventas:session-ended']();
  assert.equal(bridge.status('presupuestos').active, false);
});

test('los servicios canónicos están disponibles aun con las pantallas en modo estable', () => {
  const bridge = Bridge.create({}, { runtime: runtime(false) });
  const budget = bridge.canonical.budget({
    conIva: true,
    items: [{ qty: 1, punit: 1000 }]
  });
  const products = bridge.canonical.productProviders([], []);

  assert.equal(budget.total, 1210);
  assert.equal(products.summary().catalogProducts, 0);
});
