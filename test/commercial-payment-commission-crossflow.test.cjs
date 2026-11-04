const test=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const {createPaymentCommands}=require('../cotizador/payment-commands');
const {createCommissionGeneration}=require('../cotizador/commission-generation');
const {createCommercialOwnership}=require('../cotizador/commercial-ownership');
const {createLaborDb}=require('../cotizador/labor-db');
const {createCommissionEvent}=require('../cotizador/commission-event');
const {memoryDB}=require('./helpers/private-finance-fixtures.cjs');
async function fixture(missing){
 const sale={id:'SALE-FICTICIA',responsableUid:'autor-original-ficticio',clienteFbKey:'c',empleadoFbKey:'e',empleado:'Comisionado original ficticio',comisionHabilitada:true,items:[{cod:'P',qty:1,punit:100,sub:100,...(missing?{}:{costoUnitarioPresupuestado:0,costoUnitarioCompra:0,costoVersion:1})}],subtotal:100,total:100,iva:0,conIva:false,totalPagado:0,estadoPago:'pendiente_pago'};
 const backend=await createCoordinatedBackend({ventas:{v:sale},empleados:{e:{nombre:'Comisionado original ficticio',estado:'Activo'}},config:{maxComisionPct:25,comisionesEmpleados:{e:{pct:25}}}});
 backend.store.query=async(path,field,value)=>Object.fromEntries(Object.entries(backend.get(path)||{}).filter(([,record])=>record[field]===value));
 const raw={ref:(path='')=>({...memoryDB(backend.state).ref(path),key:path.split('/').at(-1)||null,toString:()=> 'https://fixture.invalid/'+path,orderByChild(field){return {equalTo(value){return {get:async()=>({val:()=>Object.fromEntries(Object.entries(backend.get(path)||{}).filter(([,record])=>record[field]===value))})};}};}})};
 const db=createLaborDb({db:raw,guard:backend.guard}),commercial=createCommercialOwnership({db,auth:{verifyIdToken:async()=>({uid:'u'})},enabled:true});
 const service=createCommissionGeneration({db,commercial,enabled:true,from:1,now:()=>1792530001000});
 const payments=createPaymentCommands({authorize:backend.gateway.authorize,db:raw,guard:backend.guard,store:backend.store,enabled:true,now:()=>1792530000000});
 const command=(id,amount)=>({id,kind:'registrar',opciones:{grupoPago:'group-'+id,solicitudes:[{ventaFbKey:'v',pagoKey:'payment-'+id,monto:amount,pago:{fecha:'2026-10-20',usuario:'Cobrador distinto ficticio',ts:1792530000000}}],montoTotal:amount}});
 const generate=()=>backend.guard.run({uid:'sv-labor-service',mode:'server',operation:'commission-crossflow'},()=>service.systemGenerate('v'));
 return {...backend,payments,command,generate,db,service};
}
for(const missing of [false,true])test('real coordinated payment and system generation retain original commission owner; missing cost '+missing,async()=>{
 const f=await fixture(missing),actor={uid:'u',claims:{uid:'u',name:'Cobrador distinto ficticio'}};
 const partial=f.command('partial-ficticio',40);await f.payments.execute(actor,partial);const partialResult=await f.generate();assert.notEqual(partialResult.status,'generada');assert.equal(Object.keys(f.get('sisventas/gastos')||{}).length,0);
 const full=f.command('full-ficticio',60);const ack=await f.payments.execute(actor,full),count=f.commits.length;assert.equal(ack.committed,true);await f.payments.execute(actor,structuredClone(full));assert.equal(f.commits.length,count);
 const result=await f.generate();assert.equal(result.status,missing?'revision':'generada');const expenses=Object.values(f.get('sisventas/gastos')||{});
 assert.equal(expenses.length,missing?0:1);if(!missing){assert.equal(expenses[0].monto,25);assert.equal(expenses[0].empleadoId||expenses[0].empleadoFbKey,'e');await f.generate();assert.equal(Object.keys(f.get('sisventas/gastos')).length,1);}
 assert.equal(f.get('sisventas/ventas/v/empleadoFbKey'),'e');assert.equal(Object.keys(f.get('sisventas/pagos')).length,2);
 assert.equal(f.get('sisventas/ventas/v/responsableUid'),'autor-original-ficticio');
});

test('authenticated fixture event invokes real coordinated systemGenerate once across duplicate deliveries',async()=>{
 const f=await fixture(false),actor={uid:'u',claims:{uid:'u',name:'Cobrador ficticio'}};
 await f.payments.execute(actor,f.command('event-full-ficticio',100));
 const identity={email:'worker@fixture.invalid',email_verified:true,iss:'https://accounts.google.com',aud:'https://receiver.fixture.invalid'},checks=[];
 const event=createCommissionEvent({db:f.db,commissions:f.service,audience:identity.aud,caller:identity.email,instance:'fixture-instance',enabled:true,verifyToken:async(token,audience)=>{checks.push({token,audience});assert.equal(token,'SIGNED-FIXTURE');assert.equal(audience,identity.aud);return {...identity};},coordinate:(input,work)=>f.guard.run({uid:'sv-labor-service',mode:'server',operation:'commission-event-fixture',input},work)});
 const request={method:'POST',headers:{authorization:'Bearer SIGNED-FIXTURE','ce-specversion':'1.0','ce-type':'google.firebase.database.ref.v1.written','ce-instance':'fixture-instance','ce-id':'delivery-fixture-1','ce-source':'//firebasedatabase.googleapis.com/projects/fixture/locations/us-central1/instances/fixture-instance','ce-ref':'sisventas/pagos/payment-event-full-ficticio'}};
 await event.handle(request);const commits=f.commits.length;
 await event.handle(request);await event.handle({...request,headers:{...request.headers,'ce-id':'delivery-fixture-2'}});
 assert.equal(f.commits.length,commits);const expenses=Object.values(f.get('sisventas/gastos'));assert.equal(expenses.length,1);assert.equal(expenses[0].monto,25);assert.equal(expenses[0].empleadoId||expenses[0].empleadoFbKey,'e');assert.equal(f.get('sisventas/ventas/v/responsableUid'),'autor-original-ficticio');assert.equal(checks.length,3);
});

for(const field of ['aud','email'])test('event fixture rejects wrong '+field+' before any coordinated commit',async()=>{
 const f=await fixture(false),identity={email:'worker@fixture.invalid',email_verified:true,iss:'https://accounts.google.com',aud:'https://receiver.fixture.invalid'},before=structuredClone(f.state);
 const event=createCommissionEvent({db:f.db,commissions:f.service,audience:identity.aud,caller:identity.email,instance:'fixture-instance',enabled:true,verifyToken:async()=>({...identity,[field]:'wrong.fixture.invalid'}),coordinate:()=>assert.fail('Denied event must not coordinate')});
 await assert.rejects(event.handle({method:'POST',headers:{authorization:'Bearer SIGNED-FIXTURE'}}),{statusCode:403});assert.equal(f.commits.length,0);assert.deepEqual(f.state,before);
});
