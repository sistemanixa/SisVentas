const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const source = require('./helpers/active-app').readActiveApp().source;

function setup() {
  const c = {
    window: { _ccCuentaKeyActual:'grupo-1', _ccClienteKeyActual:'firebase-1', _ccNombreActual:'Cliente',
      _ccMapActual:{'grupo-1':{key:'grupo-1',clienteFbKey:'firebase-1',legacyId:'antiguo'}} },
    ventasList:[
      {fbKey:'v1',clientePrincipalKey:'grupo-1',clienteFbKey:'secundario',fecha:'01/09/2026',total:100,pagado:20},
      {fbKey:'v2',clientePrincipalKey:'otro',clienteFbKey:'otro',cliente:'Cliente',fecha:'01/08/2026',total:200,pagado:0},
      {fbKey:'v3',clientePrincipalKey:'grupo-1',clienteFbKey:'secundario',fecha:'01/08/2026',total:30,pagado:30},
      {fbKey:'v4',clientePrincipalKey:'grupo-1',fecha:'01/08/2026',total:100,anulada:true}
    ],
    ventaValidaParaMetricas:v=>!v.anulada,
    _svClaveClientePrincipalRegistro:v=>v.clientePrincipalKey,
    _svTxtNombre:v=>String(v||'').toLowerCase(),
    _svSaldoPendienteVenta:v=>v.total-v.pagado
  };
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('function _ccDatosActuales('),source.indexOf('function actualizarVistaPagoCuentaCorriente(')),c);
  return c;
}

test('pago reconoce la clave unificada del resumen y excluye otro cliente, saldadas y anuladas',()=>{
  const c=setup();
  assert.deepEqual(Array.from(c._ccVentasPendientesActuales(),v=>v.fbKey),['v1']);
  const plan=c._ccPlanImputacion(50);
  assert.equal(plan.plan[0].monto,50);
  assert.equal(plan.plan[0].saldoRestante,30);
  assert.equal(plan.sinImputar,0);
});

test('sesiones anteriores resuelven la cuenta por clave Firebase aunque el mapa use la agrupada',()=>{
  const c=setup();delete c.window._ccCuentaKeyActual;
  assert.equal(c._ccDatosActuales().key,'grupo-1');
  assert.equal(c._ccVentasPendientesActuales().length,1);
});

test('consulta de pago construye un solo índice de clientes y lo renueva en cada consulta',()=>{
  const c=setup();let builds=0,lookups=0,index;
  c._svCrearIndiceClientes=()=>{builds++;index={revision:builds};return index;};
  c._svClaveClientePrincipalRegistro=(venta,received)=>{lookups++;assert.equal(received,index);return venta.clientePrincipalKey;};
  assert.deepEqual(Array.from(c._ccVentasPendientesActuales(),v=>v.fbKey),['v1']);
  assert.equal(builds,1);assert.equal(lookups,3);
  c.ventasList[0].pagado=100;
  assert.equal(c._ccVentasPendientesActuales().length,0);assert.equal(builds,2);
});

test('importe vacío o cero no recorre ventas ni calcula saldos de imputación',()=>{
  const c=setup();c._ccVentasPendientesActuales=()=>assert.fail('No debe consultar ventas sin importe');
  for(const monto of [0,'',null,undefined,'no es importe']){
    const result=c._ccPlanImputacion(monto);assert.equal(result.plan.length,0);assert.equal(result.sinImputar,0);
  }
});
