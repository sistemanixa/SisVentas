const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.v3.7.2.js', 'utf8');

function bloque(desde, hasta) {
  const inicio = app.indexOf(desde);
  const fin = app.indexOf(hasta, inicio + desde.length);
  assert.ok(inicio >= 0 && fin > inicio, `No se encontró el bloque ${desde}`);
  return app.slice(inicio, fin);
}

function contextoOT() {
  const context = {
    window: {},
    console,
    currentUser: 'Prueba',
    FB_PATHS: { ordenesTrabajo:'sisventas/ordenes_trabajo', ventas:'sisventas/ventas' },
    _svTxtNombre: valor => String(valor || '').trim().toLocaleLowerCase('es-AR'),
    _svTxtClave: valor => String(valor || '').trim().toLocaleLowerCase('es-AR'),
    _svResolverVentaRegistro: () => null,
    _svRegistroPerteneceVenta: (ot, venta) => {
      const refs = [ot.ventaId, ot.venta, ot.ventaFbKey, ot.ventaKey].map(String);
      return refs.includes(String(venta.id)) || refs.includes(String(venta.fbKey));
    },
    fechaVentaTimestamp: (fecha, ts) => {
      if (ts) return Number(ts);
      const partes = String(fecha || '').split(/[\/-]/).map(Number);
      if (partes.length !== 3) return 0;
      const ymd = partes[0] > 1900 ? partes : [partes[2], partes[1], partes[0]];
      return new Date(ymd[0], ymd[1] - 1, ymd[2]).getTime();
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(
    bloque('function ventaDetalleOTFinalizada', 'function ventaDetalleRepararVinculoOT') +
    bloque('function ventaDetalleRepararVinculoOT', 'function abrirCobrosDesdeDetalleVenta'),
    context
  );
  return context;
}

test('V-910160 no adopta la OT-094 manual y finalizada sólo por coincidir el cliente', () => {
  const ctx = contextoOT();
  const venta = {
    id:'#V-910160', fbKey:'-P2JHNFvtFPtEugXuHmb', cliente:'XIMENA PALERMO',
    clienteFbKey:'cli_47342', fecha:'24/09/2026', estadoInst:'pendiente_inst',
    items:[{ cod:'P-60878' }, { cod:'P-20' }]
  };
  const ot094 = {
    id:'OT-094', fbKey:'-P-psXTW9oq28veCJO-s', origen:'manual',
    cliente:'XIMENA PALERMO', clienteFbKey:'cli_47342', fecha:'2026-09-29',
    estado:'completada', materiales:[], checks:{ preparacion:[true], instalacion:[true] },
    firmaClienteUrl:'data:image/png;base64,firma-historica', fechaFirma:'2026-08-28'
  };
  ctx.otData = [ot094];

  assert.equal(ctx.ventaDetalleResolverOT(venta), null);
  assert.equal(ctx.ventaDetalleRepararVinculoOT(venta, { soloLectura:true }), null);
  assert.equal(venta.estadoInst, 'pendiente_inst');
  assert.equal(venta.otId, undefined);
});

test('un vínculo explícito sigue resolviendo la OT correspondiente', () => {
  const ctx = contextoOT();
  const ot = { id:'OT-101', fbKey:'ot-key-101', ventaId:'#V-101', estado:'programada' };
  const venta = { id:'#V-101', fbKey:'venta-key-101', otId:'ot-key-101' };
  ctx.otData = [ot];
  assert.equal(ctx.ventaDetalleResolverOT(venta), ot);
});

test('la compatibilidad histórica exige huella de venta, material y fecha cercana', () => {
  const ctx = contextoOT();
  const venta = {
    id:'#V-200', clienteFbKey:'cli-1', fecha:'2026-09-24', items:[{cod:'P-1'}]
  };
  const ot = {
    id:'OT-200', clienteFbKey:'cli-1', fecha:'2026-09-25', origen:'venta',
    ventaId:'#V-inexistente', materiales:[{codigo:'P-1'}]
  };
  ctx.otData = [ot];
  assert.equal(ctx.ventaDetalleResolverOT(venta), ot);
});

test('consultar una venta en modo lectura nunca cambia su estado de instalación', () => {
  const ctx = contextoOT();
  const venta = { id:'#V-300', fbKey:'venta-300', estadoInst:'pendiente_inst' };
  const ot = { id:'OT-300', fbKey:'ot-300', estado:'completada' };
  assert.equal(ctx.ventaDetalleRepararVinculoOT(venta, { soloLectura:true, otForzada:ot }), ot);
  assert.deepEqual(venta, { id:'#V-300', fbKey:'venta-300', estadoInst:'pendiente_inst' });
});

test('una OT finalizada no puede cambiar de visita, pero conserva ediciones no estructurales', () => {
  const ctx = contextoOT();
  const ot = {
    estado:'completada', ventaId:'#V-1', clienteFbKey:'cli-1',
    tecnico:'Mauro Bechir', fecha:'2026-08-28', hora:'09:00', tipoVisita:'Instalación nueva'
  };
  assert.equal(ctx.otCambioEstructuralEnFinalizada(ot, {
    ventaId:'#V-1', clienteKey:'cli-1', tecnico:'Mauro Bechir',
    fecha:'2026-08-28', hora:'09:00', tipoVisita:'Instalación nueva'
  }), false);
  assert.equal(ctx.otCambioEstructuralEnFinalizada(ot, { fecha:'2026-09-29' }), true);
  assert.equal(ctx.otCambioEstructuralEnFinalizada(ot, { tecnico:'Marcos Tello' }), true);
  assert.equal(ctx.otCambioEstructuralEnFinalizada(ot, { ventaId:'#V-910160' }), true);
  const transferencia = bloque('async function cambiarTecnicoOT', 'function renderAvisoProximasVacaciones');
  assert.match(transferencia, /ventaDetalleOTFinalizada\(ot\)/);
  assert.match(transferencia, /generá una OT nueva/);
});

test('el guardado general no puede reponer firmas desde una copia desactualizada', () => {
  const guardado = bloque('function fbGuardarOT', 'function fbSeedDatos');
  [
    'firmaClienteUrl', 'firmaStoragePath', 'firmada', 'fechaFirma',
    'firmaTecnicoUrl', 'firmaTecnicoStoragePath', 'firmadaTecnico', 'fechaFirmaTecnico'
  ].forEach(campo => assert.match(guardado, new RegExp(`'${campo}'`), campo));
});
