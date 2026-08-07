const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'js', 'app.v2.0.290.js');
const app = fs.readFileSync(appPath, 'utf8');

function sourceOfFunction(signature) {
  const start = app.indexOf(signature);
  assert.notEqual(start, -1, 'No se encontró: ' + signature);
  const startBrace = app.indexOf('{', start);
  let depth = 0;
  for (let i = startBrace; i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error('No se pudo extraer: ' + signature);
}

function crearContextoBase(opciones = {}) {
  const updates = [];
  let ventasPagosPersistirGuardarVentaCalls = 0;
  let crearRegistroOTSeguroCalls = 0;
  const SP_ESTADOS = {
    nuevo:       { label:'Nuevo', badge:'b-blue' },
    diagnostico: { label:'En diagnostico', badge:'b-amber' },
    visita:      { label:'Visita requerida', badge:'b-red' },
    ot_activa: { label: 'OT activa', badge: 'b-purple' }
  };
  const notifications = [];
  const context = {
    SP_DATA: {
      'reclamo-test': {
        fbKey: 'reclamo-test',
        cliente: 'Cliente A',
        descripcion: 'No carga luz',
        estado: 'nuevo',
        ts: Date.now(),
        historial: []
      }
    },
    SP_MODAL_KEY: 'reclamo-test',
    otData: opciones.otData || [],
    _spOTGeneracionPorReclamo: {},
    prodData: {
      'p1': {
        cod: 'P-VIS',
        nombre: 'visita tÃ©cnica',
        venta: 1200,
        iva: 21,
        esManoDeObra: true
      }
    },
    empData: [{ activo: true, nombre: 'TÃ©cnico 1' }],
    CHECKLISTS: {
      preparacion: [],
      instalacion: [],
      verificacion: []
    },
    notifications,
    ventasPagosPersistirGuardarVentaCalls: 0,
    crearRegistroOTSeguroCalls: 0,
    updates: updates,
    document: {
      elements: {},
      getElementById(id) {
        if (!this.elements[id]) {
          this.elements[id] = { style: {}, innerHTML: '', textContent: '', value: '' };
        }
        return this.elements[id];
      },
      querySelector() { return null; }
    },
    // Dependencias de runtime usadas por las funciones evaluadas
    notify: (msg) => notifications.push(msg),
    svPrompt() { return Promise.resolve('0'); },
    svFormatFecha(v) { return String(v || ''); },
    spFormatFecha(v) { return String(v || ''); },
    escapeHTML(v) { return String(v || ''); },
    spRenderAcciones() {},
    spRenderLista() {},
    spActualizarMetricas() {},
    spAbrirModal() {},
    spCerrarModal() {},
    verOT() {},
    spVerVenta() {},
    svFechaLocalISO() { return '2026-01-01'; },
    fechaVentaOrdenISO(fecha) { return fecha || '2026-01-01'; },
    _svResolverClienteRegistro(reclamo) { return { id: 'C-1', numero: 'C-1', fbKey: 'C-1' }; },
    window: {
      _svResolverClienteRegistro(obj) { return { id: 'C-1', numero: 'C-1', fbKey: 'C-1' }; },
      fbDB: {},
      fbRef: (_db, ref) => ref,
      fbUpdate: (pathRef, update) => {
        updates.push({ path: pathRef, update: update });
        if (typeof pathRef === 'string' && pathRef.indexOf('sisventas/reclamos/') === 0) {
          const key = String(pathRef).replace('sisventas/reclamos/', '');
          if (!context.SP_DATA[key]) context.SP_DATA[key] = { fbKey: key };
          context.SP_DATA[key] = Object.assign({}, context.SP_DATA[key], update);
        }
        return Promise.resolve();
      },
      fbPush: () => { throw new Error('No usado'); }
    },
    ventasPagosPersistirGuardarVenta(v) {
      ventasPagosPersistirGuardarVentaCalls += 1;
      context.ventasPagosPersistirGuardarVentaCalls = ventasPagosPersistirGuardarVentaCalls;
      return Promise.resolve(Object.assign({}, v, { fbKey: 'venta-fb-' + ventasPagosPersistirGuardarVentaCalls }));
    },
    crearRegistroOTSeguro(ot, opts) {
      crearRegistroOTSeguroCalls += 1;
      context.crearRegistroOTSeguroCalls = crearRegistroOTSeguroCalls;
      if (opciones.failOT) {
        return Promise.reject(new Error('Falla al crear OT'));
      }
      return Promise.resolve({
        key: 'ot-fb-' + crearRegistroOTSeguroCalls,
        id: 'OT-TEST-' + String(crearRegistroOTSeguroCalls).padStart(3, '0')
      });
    },
    SP_ESTADOS,
    currentUser: 'Analista'
  };

  context.window.fbPush = (pathRef, ot) => {
    if (typeof context.crearRegistroOTSeguro === 'function' && pathRef && String(pathRef).indexOf('ordenesTrabajo') >= 0) {
      return Promise.resolve({ key: 'ot-fb-' + context.crearRegistroOTSeguroCalls, id: ot && ot.id || 'OT-TEST-001' });
    }
    return Promise.resolve({ key: 'legacy' });
  };
  context.window.crearRegistroOTSeguro = context.crearRegistroOTSeguro;

  const bootstrap = [
    sourceOfFunction('function _buscarOTCanonicaPorClave(otKey, otId)'),
    sourceOfFunction('function spCambiarEstado(nuevoEstado, extraDatos, reclamoKey)'),
    sourceOfFunction('function spPasarAVisitaYGenerarOT(reclamoKey)'),
    sourceOfFunction('async function spGenerarOT(reclamoKey)'),
    sourceOfFunction('function spAbrirModal(fbKey)'),
    sourceOfFunction('function spVerOT(otKey)')
  ].join('\n\n');

  vm.runInNewContext(bootstrap, context);
  return { context, updates };
}

test('bloqueo por reclamo en doble clic: solo una creación de reclamo->venta->OT', async () => {
  const { context, updates } = crearContextoBase();
  const p1 = context.spPasarAVisitaYGenerarOT('reclamo-test');
  const p2 = context.spPasarAVisitaYGenerarOT('reclamo-test');
  await Promise.all([p1, p2]);

  assert.equal(context.ventasPagosPersistirGuardarVentaCalls, 1);
  assert.equal(context.crearRegistroOTSeguroCalls, 1);
  assert.ok(updates.some(u => String(u.path).indexOf('sisventas/reclamos/reclamo-test') >= 0 && u.update.estado === 'ot_activa'));
  assert.equal(context.SP_DATA['reclamo-test'].estado, 'ot_activa');
});

test('dos ejecuciones concurrentes del mismo reclamo convergen en un solo vínculo', async () => {
  const { context } = crearContextoBase();
  await Promise.all([
    context.spPasarAVisitaYGenerarOT('reclamo-test'),
    context.spPasarAVisitaYGenerarOT('reclamo-test')
  ]);
  assert.equal(context.SP_DATA['reclamo-test'].otKey, 'ot-fb-1');
  assert.equal(context.SP_DATA['reclamo-test'].otId, 'OT-TEST-001');
});

test('OT creada con id canÃ³nico y vÃ­nculo reclamo-OT consistente', async () => {
  const { context, updates } = crearContextoBase();
  await context.spPasarAVisitaYGenerarOT('reclamo-test');
  const reclamo = context.SP_DATA['reclamo-test'];
  assert.equal(reclamo.otKey, 'ot-fb-1');
  assert.equal(reclamo.otId, 'OT-TEST-001');
  const ultimaActualizacion = updates.filter(u => String(u.path).includes('sisventas/reclamos/reclamo-test')).pop().update;
  assert.equal(ultimaActualizacion.otId, 'OT-TEST-001');
  assert.equal(ultimaActualizacion.otKey, 'ot-fb-1');
});

test('boton Ver OT (simulado por modal) abre la OT canÃ³nica correspondiente', () => {
  const { context } = crearContextoBase({ otData: [{ fbKey: 'ot-fb-canonica', id: 'OT-CANONICA', otId:'OT-CANONICA' }] });
  context.SP_DATA['reclamo-test'].otKey = 'ot-key-stale';
  context.SP_DATA['reclamo-test'].otId = 'OT-CANONICA';

  context.spAbrirModal('reclamo-test');
  const html = context.document.getElementById('sp-modal-ot-link').innerHTML;
  assert.ok(html.includes("spVerOT('ot-fb-canonica')"));
});

test('falla en OT no deja estado ot_activa', async () => {
  const { context, updates } = crearContextoBase({ failOT: true });
  await context.spPasarAVisitaYGenerarOT('reclamo-test');
  const estadosReclamo = updates
    .filter(u => String(u.path).indexOf('sisventas/reclamos/reclamo-test') >= 0)
    .map(u => u.update.estado);
  assert.ok(estadosReclamo.includes('visita'));
  assert.ok(!estadosReclamo.includes('ot_activa'));
  assert.equal(context.SP_DATA['reclamo-test'].estado, 'visita');
});
