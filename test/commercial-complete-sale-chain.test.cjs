'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const {memoryDB}=require('./helpers/private-finance-fixtures.cjs');
const {createLaborDb}=require('../cotizador/labor-db');
const {createCommercialOwnership}=require('../cotizador/commercial-ownership');
const {createPaymentCommands}=require('../cotizador/payment-commands');
const {createCommissionGeneration}=require('../cotizador/commission-generation');
const Pages=require('../cotizador/commercial-pages-model');
const Accounts=require('../cotizador/client-account-projection');
const History=require('../cotizador/client-history-model');

// One memory database is retained across the whole chain. No source is rebuilt
// between stages: each command must maintain the actual coordinated projections.
test('create, consult, collect, commission, account and report share one coordinated fictional sale',async()=>{
 const f=await createCoordinatedBackend({ventas:{},pagos:{},empleados:{e:{nombre:'Comisionado ficticio',estado:'Activo'}},config:{maxComisionPct:25,comisionesEmpleados:{e:{pct:25}}}});
 const actor={uid:'u',claims:{uid:'u',name:'Cobrador ficticio'}};
 f.store.query=async(p,field,value)=>Object.fromEntries(Object.entries(f.get(p)||{}).filter(([,r])=>r[field]===value));
 const raw={ref:(p='')=>({...memoryDB(f.state).ref(p),key:p.split('/').at(-1)||null,toString:()=> 'https://fixture.invalid/'+p,orderByChild(field){return{equalTo(value){return{get:async()=>({val:()=>Object.fromEntries(Object.entries(f.get(p)||{}).filter(([,r])=>r[field]===value))})};}};}})};
 const db=createLaborDb({db:raw,guard:f.guard});
 const commercial=createCommercialOwnership({db,auth:{verifyIdToken:async()=>({uid:'u'})},enabled:true});
 const commission=createCommissionGeneration({db,commercial,enabled:true,from:1,now:()=>1792530001000});
 const payments=createPaymentCommands({authorize:f.gateway.authorize,db:raw,guard:f.guard,store:f.store,enabled:true,now:()=>1792530000000});
 const sale={id:'CHAIN-FICTICIA',responsableUid:'u',clienteFbKey:'c',fecha:'2026-10-20',empleadoFbKey:'e',empleado:'Comisionado ficticio',comisionHabilitada:true,items:[{cod:'P-FICTICIO',qty:1,punit:100,sub:100,costoUnitarioCompra:20,costoUnitarioPresupuestado:20,costoTotalCompra:20,costoVersion:1}],subtotal:100,total:100,iva:0,conIva:false,descuento:0,descuentoGeneral:0,totalPagado:0,estadoPago:'pendiente_pago'};
 const creation={id:'chain-create-fictional',kind:'set',path:'sisventas/ventas/chain',value:sale};
 assert.equal((await f.gateway.write(actor,creation)).committed,true);
 const created=structuredClone(f.get('sisventas/ventas/chain'));
 assert.equal(created.total,100);assert.deepEqual(created.items,sale.items);
 const generate=()=>f.guard.run({uid:'sv-labor-service',mode:'server',operation:'chain-generation'},()=>commission.systemGenerate('chain'));
 function verify(paid){
  const meta=f.get(Pages.ROOT+'/totals/all'),report=Pages.dashboard(meta,'2026-10-20');
  assert.equal(report.monthly.salesCents,10000);assert.equal(report.monthly.paidCents,paid);
  assert.equal(report.debtCents,10000-paid);
  const account=f.get(Accounts.ROOT+'/totals/all');
  assert.equal(account.totalCents,10000);assert.equal(account.paidCents,paid);assert.equal(account.balanceCents,10000-paid);
  const source=f.get(Accounts.ROOT+'/sources/sales/chain');
  assert(source?.accountId,'The account identity must come from the live projection');
  const history=f.get(History.ROOT+'/sources/ventas/chain');
  assert(history,'History must be maintained by the same command');
  assert.equal(history.row.accountId,source.accountId);
  assert.equal(history.row.totalCents,10000);assert.equal(history.row.paidCents,paid);assert.equal(history.row.balanceCents,10000-paid);
  const actual=f.get('sisventas/ventas/chain');
  assert.equal(actual.total,created.total);assert.deepEqual(actual.items,created.items);
  assert.equal(actual.responsableUid,'u');assert.equal(actual.empleadoFbKey,'e');
 }
 function noPrematureCommission(){assert.deepEqual(f.get('sisventas/gastos'),{});assert.equal(Object.values(f.get('sisventas/ctaemp/e')||{}).filter(m=>m.tipo==='comision').length,0);}
 verify(0);assert.notEqual((await generate()).status,'generada');noPrematureCommission();
 for(const [id,amount,paid]of [['partial',40,4000],['final',60,10000]]){
  const command={id:'chain-'+id,kind:'registrar',opciones:{grupoPago:'chain-group-'+id,solicitudes:[{ventaFbKey:'chain',pagoKey:'chain-payment-'+id,monto:amount,pago:{fecha:'2026-10-20',usuario:'Cobrador ficticio',ts:1792530000000}}],montoTotal:amount}};
  assert.equal((await payments.execute(actor,command)).committed,true);verify(paid);
  const commits=f.commits.length;await payments.execute(actor,structuredClone(command));assert.equal(f.commits.length,commits);verify(paid);
  if(id==='partial'){assert.notEqual((await generate()).status,'generada');noPrematureCommission();}
 }
 assert.equal((await generate()).status,'generada');verify(10000);
 const expenses=Object.entries(f.get('sisventas/gastos')||{});assert.equal(expenses.length,1);assert.equal(expenses[0][1].monto,20);assert.equal(expenses[0][1].empleadoId||expenses[0][1].empleadoFbKey,'e');assert.equal(expenses[0][1].estado,'pendiente_aprobacion');
 const moves=Object.values(f.get('sisventas/ctaemp/e')||{});assert.equal(moves.length,1);assert.equal(moves[0].tipo,'comision');assert.equal(moves[0].estado,'pendiente');assert.equal(moves[0].gastoFbKey,expenses[0][0]);assert.equal(moves[0].monto,20);
 // A fresh guarded generation request can record its own technical receipt.
 // Its business result must remain identical; it is not the same command ID.
 const business=()=>({sales:f.get('sisventas/ventas'),payments:f.get('sisventas/pagos'),expenses:f.get('sisventas/gastos'),employeeAccounts:f.get('sisventas/ctaemp')});
 const businessBefore=structuredClone(business());
 await generate();assert.deepEqual(business(),businessBefore);verify(10000);
 assert.equal(Object.keys(f.get('sisventas/pagos')).length,2);
 assert.equal(f.get('sisventas/sentinel/privado'),'Conservar');
});
