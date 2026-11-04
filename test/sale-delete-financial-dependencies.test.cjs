'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs'),Evidence=require('./helpers/sale-delete-financial-evidence.cjs');
const {createSaleDeleteCommand}=require('../cotizador/sale-delete-command'),{digest}=require('../cotizador/labor-guard'),{load}=require('./helpers/app-functions.cjs');
async function fixture(){
 const sale={id:'V-FIXTURE',fecha:'2026-11-02',clienteFbKey:'c',responsableUid:'u',comisionHabilitada:true,subtotal:100,total:100,items:[{qty:1,punit:100,costoUnitarioCompra:20,costoTotalCompra:20,costoUnitarioPresupuestado:20}],costoTotal:20},backend=await createCoordinatedBackend({ventas:{s:sale}});
 apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceRevision:1,indiceModulos:{venta:true},acciones:{ventas:{eliminar:true}}}});Evidence.install(backend);backend.store.saleDeleteFenceReady=true;backend.store.saleDeleteActivityFenceReady=true;
 return {...backend,actor:{uid:'u',claims:{uid:'u'}},body:{id:'financial-sale-delete-fixture',ventaKey:'s',expectedHash:digest(sale)},command:createSaleDeleteCommand({guard:backend.guard,store:backend.store,enabled:true,verifyActor:async()=>{}})};
}
test('real commission expense and employee movement veto deletion without changing report totals',async()=>{
 const f=await fixture(),expense={tipo:'Comisión',tipoPagable:'comision',ventaFbKey:'s',ventaId:'V-FIXTURE',empleadoNombre:'Empleado ficticio',monto:7.35,fecha:'2026-11-03',estado:'aprobado'};
 apply(f.state,{'sisventas/gastos/g':expense,'sisventas/ctaemp/e/m':{...expense,tipo:'comision',gastoFbKey:'g'}});const before=f.get('sisventas'),helper=load({},['_fechaMes','_fechaEnMes','_rentEsComision','_rentGastoValido','ventaEstaAnulada','_reporteComisionesPorEmpleado']);
 const total=()=>helper._reporteComisionesPorEmpleado([{...f.get('sisventas/ventas/s'),fbKey:'s'}],[f.get('sisventas/gastos/g')],{},'2026-11')['Empleado ficticio'];assert.equal(total(),7.35);
 await assert.rejects(f.command.execute(f.actor,f.body),{code:'SV_SALE_DELETE_FINANCIAL_DEPENDENCY'});assert.deepEqual(f.get('sisventas'),before);assert.equal(total(),7.35);assert.equal(f.commits.length,0);
});
test('ordinary sale requires complete financial evidence, never an absent cache',async()=>{const f=await fixture();delete f.store.saleDeleteFinancialEvidence;f.reads.length=0;assert.equal(f.command.capability(),false);await assert.rejects(f.command.execute(f.actor,f.body),{code:'SV_SALE_DELETE_FENCE_REQUIRED'});assert.equal(f.reads.length,0);assert.equal(f.commits.length,0);});
test('certified empty RAM sources allow ordinary sale deletion',async()=>{const f=await fixture();await f.command.execute(f.actor,f.body);assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/ventas/s'),null);});
test('historical confirmed receipt remains recoverable without repeating deletion against later dependencies',async()=>{const f=await fixture(),result={ok:true,committed:true,ventaKey:'s'};apply(f.state,{['sv_labor_receipts/'+f.body.id]:{actorUid:'u',fence:'historic-fixture',digest:digest(f.body),result,confirmedAt:1},'sisventas/gastos/g':{ventaFbKey:'s',tipoPagable:'comision',monto:8}});assert.deepEqual(await f.command.execute(f.actor,f.body),result);assert.equal(f.commits.length,0);assert.equal(f.get('sisventas/gastos/g/monto'),8);});
test('actual manual commission generation and deletion share the same guard',async()=>{
 const f=await fixture(),page=f.page(),acquire=f.store.acquire;let reached,release;const started=new Promise(resolve=>{reached=resolve;}),barrier=new Promise(resolve=>{release=resolve;});let first=true;
 load(page.context,['obtenerCostoItemVenta']);
 f.store.acquire=async lease=>{await acquire(lease);if(first){first=false;reached();await barrier;}};
 const generation=page.context._generarComisionVentaAtomica({fbKey:'e'},{ventaFbKey:'s',ventaId:'V-FIXTURE',pct:10,gananciaBase:80,monto:8,fecha:'2026-11-03',tipo:'comision',descripcion:'Comisión ficticia',ts:1});
 await Promise.race([started,generation.then(()=>{throw Error('generation finished before acquire');})]);const deletion=f.command.execute(f.actor,f.body);release();await generation;await assert.rejects(deletion);assert.equal(f.commits.length,1);assert(f.get('sisventas/ventas/s'));assert(Object.values(f.get('sisventas/gastos')).some(expense=>expense.monto===8&&expense.ventaFbKey==='s'));
});
