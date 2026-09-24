const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readActiveApp } = require('./helpers/active-app');

const source = readActiveApp().source;
const core = source.slice(
  source.indexOf('function _cobroNuevaClave('),
  source.indexOf('function _svMontoPagadoVenta(')
);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function setup() {
  const db = {
    ventas:{
      v1:{id:'V-1',total:100,totalPagado:0,estadoPago:'pendiente_pago'},
      v2:{id:'V-2',total:200,totalPagado:0,estadoPago:'pendiente_pago'}
    },
    pagos:{}
  };
  const writes = [];
  const parts = path => String(path || '').replace(/^sisventas\/?/,'').split('/').filter(Boolean);
  const get = path => parts(path).reduce((value,key) => value == null ? null : value[key],db);
  const put = (path,value) => {
    const keys=parts(path);
    if (!keys.length) throw new Error('No se reemplaza la raíz en la prueba');
    let target=db;
    for (const key of keys.slice(0,-1)) target=target[key]||(target[key]={});
    if (value===null) delete target[keys.at(-1)];
    else target[keys.at(-1)]=clone(value);
  };
  const window = {
    fbDB:{},
    fbRef(_db,path){ return String(path || '').replace(/^sisventas\/?/,''); },
    async fbGet(path){ return {val:()=>clone(get(path))}; },
    async fbRunTransaction(path,fn){
      const next=fn(clone(get(path)));
      if (next===undefined) return {committed:false,snapshot:{val:()=>clone(get(path))}};
      put(path,next);
      return {committed:true,snapshot:{val:()=>clone(next)}};
    },
    fbOnDisconnect(){ return {remove:async()=>{},cancel:async()=>{}}; },
    async fbUpdate(_root,updates){
      writes.push(clone(updates));
      Object.entries(updates).forEach(([path,value])=>put(path,value));
    }
  };
  const context=vm.createContext({
    window, Date, Math, Object, Array, Promise, String, Number, parseFloat,
    currentUser:'Admin', _svModeloVentasV3Cache:{},
    ventaValidaParaMetricas:venta=>!venta.anulada,
    _svPagoValido:pago=>!pago.anulado,
    _svRegistroPerteneceVenta:(pago,venta)=>pago.ventaFbKey===venta.fbKey,
    _svResumenPagoLegacyVenta:venta=>Number(venta.totalPagado)||0,
    _svTotalVentaCanonico:venta=>Number(venta.total)||0
  });
  vm.runInContext(core,context);
  return {context,db,writes,put};
}

test('Cobranzas registra pago, saldo y comprobante en una única escritura',async()=>{
  const t=setup();
  const doc={nombre:'pago.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,AA==',ts:10};
  const result=await t.context.registrarCobrosCanonicos({
    grupoPago:'cobro_1',origen:'cobranzas',montoTotal:40,comprobante:doc,
    solicitudes:[{ventaFbKey:'v1',ventaId:'V-1',monto:40,pagoKey:'p1',pago:{fecha:'2026-09-23'}}]
  });
  assert.equal(result.length,1);
  assert.equal(t.writes.length,1);
  assert.equal(t.db.pagos.p1.origen,'cobranzas');
  assert.equal(t.db.pagos.p1.grupoPago,'cobro_1');
  assert.equal(t.db.pagos.p1.comprobanteRef,'cobro_1');
  assert.equal(t.db.pagos.p1.comprobanteAdjunto.data,undefined);
  assert.deepEqual(t.db.cobros_adjuntos.cobro_1,doc);
  assert.equal(t.db.ventas.v1.totalPagado,40);
  assert.equal(t.db.ventas.v1.estadoPago,'seniado');
});

test('Cuenta Corriente imputa un cobro agrupado a varias ventas y guarda un solo archivo',async()=>{
  const t=setup();
  const doc={nombre:'transferencia.jpg',tipo:'image/jpeg',data:'data:image/jpeg;base64,AA==',ts:20};
  await t.context.registrarCobrosCanonicos({
    grupoPago:'cc_1',origen:'cuenta_corriente',montoTotal:150,comprobante:doc,
    solicitudes:[
      {ventaFbKey:'v1',ventaId:'V-1',monto:100,pagoKey:'p1',pago:{}},
      {ventaFbKey:'v2',ventaId:'V-2',monto:50,pagoKey:'p2',pago:{}}
    ]
  });
  assert.equal(Object.keys(t.db.pagos).length,2);
  assert.equal(Object.keys(t.db.cobros_adjuntos).length,1);
  assert.equal(t.db.pagos.p1.comprobanteRef,'cc_1');
  assert.equal(t.db.pagos.p2.comprobanteRef,'cc_1');
  assert.equal(t.db.ventas.v1.estadoPago,'pago_total');
  assert.equal(t.db.ventas.v2.estadoPago,'seniado');
  assert.equal(t.db.ventas.v2.totalPagado,50);
});

test('reintentar el mismo grupo no duplica pagos ni vuelve a escribir',async()=>{
  const t=setup();
  const options={grupoPago:'reintento_1',origen:'venta',montoTotal:25,solicitudes:[{ventaFbKey:'v1',ventaId:'V-1',monto:25,pagoKey:'p1',pago:{}}]};
  await t.context.registrarCobrosCanonicos(options);
  const again=await t.context.registrarCobrosCanonicos(options);
  assert.equal(again.length,1);
  assert.equal(Object.keys(t.db.pagos).length,1);
  assert.equal(t.writes.length,1);
  assert.equal(t.db.ventas.v1.totalPagado,25);
});

test('un saldo modificado aborta pagos, venta, grupo y comprobante',async()=>{
  const t=setup();
  t.put('pagos/anterior',{ventaFbKey:'v1',monto:90});
  await assert.rejects(t.context.registrarCobrosCanonicos({
    grupoPago:'invalido_1',origen:'cuenta_corriente',montoTotal:20,
    comprobante:{nombre:'x.pdf',data:'data:application/pdf;base64,AA=='},
    solicitudes:[{ventaFbKey:'v1',ventaId:'V-1',monto:20,pagoKey:'p1',pago:{}}]
  }),/saldo/);
  assert.equal(t.writes.length,0);
  assert.equal(t.db.pagos.p1,undefined);
  assert.equal(t.db.cobros_grupos,undefined);
  assert.equal(t.db.cobros_adjuntos,undefined);
  assert.equal(t.db.ventas.v1.totalPagado,0);
  assert.equal(t.db.control_cobros,undefined);
});

test('la lectura conserva compatibilidad con las dos rutas históricas',()=>{
  const start=source.indexOf('function _cobroRutasComprobante(');
  const end=source.indexOf('async function verOAdjuntarDocumentoCobro(',start);
  const context=vm.createContext({});
  vm.runInContext(source.slice(start,end),context);
  assert.deepEqual(Array.from(context._cobroRutasComprobante({fbKey:'p1'},'p1')),['sisventas/cobros_adjuntos/p1']);
  assert.deepEqual(Array.from(context._cobroRutasComprobante({fbKey:'p2',comprobanteCuenta:true,pagoCuentaGrupo:'cc_viejo'},'p2')),[
    'sisventas/cobros_adjuntos/p2','sisventas/cobros_cuenta_adjuntos/cc_viejo'
  ]);
  assert.deepEqual(Array.from(context._cobroRutasComprobante({fbKey:'p3',comprobanteRef:'grupo_nuevo'},'p3')),[
    'sisventas/cobros_adjuntos/grupo_nuevo','sisventas/cobros_adjuntos/p3'
  ]);
  assert.deepEqual(Array.from(context._cobroRutasComprobante(null,'cc_viejo')),[
    'sisventas/cobros_adjuntos/cc_viejo','sisventas/cobros_cuenta_adjuntos/cc_viejo'
  ]);
});

test('anular conserva el comprobante y recalcula pago y venta en una sola escritura',async()=>{
  const start=source.indexOf('async function anularPago(');
  const end=source.indexOf('var _cobFiltroActual',start);
  const updates=[];
  const pago={fbKey:'p1',ventaFbKey:'v1',monto:40,comprobanteRef:'grupo_1'};
  const otro={fbKey:'p2',ventaFbKey:'v1',monto:10};
  const venta={fbKey:'v1',id:'V-1',total:100};
  const context=vm.createContext({
    window:{
      fbDB:{},_historialPagosCompleto:[pago,otro],
      tienePermiso:()=>true,
      fbRef:(_db,path)=>path,
      fbUpdate:async(_path,data)=>{updates.push(clone(data));}
    },
    Date,Object,currentUser:'Admin',_svModeloVentasV3Cache:{},
    svConfirm:async()=>true,svPrompt:async()=>'',notify:()=>{},
    _svResolverVentaRegistro:()=>venta,
    _svResumenPagoVentaDesdeLista:(_venta,pagos)=>{
      const pagado=pagos.filter(item=>!item.anulado).reduce((total,item)=>total+item.monto,0);
      return {pagado,estadoPago:pagado?'seniado':'pendiente_pago'};
    }
  });
  vm.runInContext(source.slice(start,end),context);
  await context.anularPago('p1');
  assert.equal(updates.length,1);
  assert.equal(updates[0]['pagos/p1/anulado'],true);
  assert.equal(updates[0]['pagos/p1/estado'],'anulado');
  assert.equal(updates[0]['ventas/v1/totalPagado'],10);
  assert.equal(updates[0]['ventas/v1/estadoPago'],'seniado');
  assert.equal(Object.keys(updates[0]).some(path=>path.includes('cobros_adjuntos')),false);
});

test('Detalle, Cobranzas y Cuenta Corriente muestran el comprobante mediante el lector común',()=>{
  assert.match(source,/verOAdjuntarDocumentoCobro\(\\'\'\+escapeHTML\(p\.fbKey\)/);
  assert.match(source,/function _ccBotonesComprobantes[\s\S]*verOAdjuntarDocumentoCobro/);
  assert.match(source,/var comprobantePagoBtn = p\.fbKey[\s\S]*verOAdjuntarDocumentoCobro/);
});

test('el origen identifica Detalle, Cobranzas y Cuenta Corriente sin cambiar el modelo',()=>{
  assert.match(source,/irACobranzasConVenta\(this\.dataset\.vid,\\'venta\\'\)/);
  assert.match(source,/window\._cobOrigenVentaId = origen === 'venta' \? vid : null/);
  assert.match(source,/origen:\s+window\._cobOrigenVentaId \? 'venta' : 'cobranzas'/);
  assert.match(source,/origen:'cuenta_corriente'/);
});
