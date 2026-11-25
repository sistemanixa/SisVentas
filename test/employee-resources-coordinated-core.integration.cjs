'use strict';
// Core únicamente: módulos reales del checkout explícito, RESTStore con DB ficticia.
// No sustituye Rules/emulador ni prueba interfaz. No relaja la policy si falla.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
assert.ok(process.env.SV_EMPLOYEE_RESOURCES_CORE_SOURCE,'Indicar checkout revisado en SV_EMPLOYEE_RESOURCES_CORE_SOURCE');
const source=path.resolve(process.env.SV_EMPLOYEE_RESOURCES_CORE_SOURCE),at=file=>require(path.join(source,file));
const who={uid:'office',claims:{uid:'office'}},now=Date.parse('2026-11-25T15:00:00Z');
const expense={fecha:'2026-11-25',tipo:'Variable',categoria:'Indumentaria',descripcion:'Compra ficticia core coordinada',monto:3456.78,montoPagado:0,estado:'pendiente',medio:'Efectivo',indumentaria:{schema:1,items:[{name:'Remera ficticia',size:'M',color:'Azul',quantity:3}]}};
async function fixture(t,{seedClothing=false}={}){
 const files=['cotizador/labor-guard.js','cotizador/labor-rtdb-store.js','cotizador/employee-resources-policy.js','cotizador/admin-expense-create.js','cotizador/sale-financial-dependencies-model.js'];
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(source,file))).digest('hex'),pins=Object.fromEntries(files.map(file=>[file,hash(file)]));
 t.diagnostic('SOURCE_SHA256 '+JSON.stringify(pins));t.after(()=>{for(const file of files)assert.equal(hash(file),pins[file],'Fuente cambió durante prueba: '+file);});
 const {apply}=at('test/helpers/labor-ui-flow.cjs'),{memoryDB}=at('test/helpers/private-finance-fixtures.cjs');
 const input={ventas:{},pagos:{},gastos:seedClothing?{seed:expense}:{},ctaemp:{},comisiones_generacion:{},empleados:{person:{nombre:'Persona ficticia',activo:true}}};
 const coordinated=await at('test/helpers/coordinated-backend.cjs').createCoordinatedBackend(input),db=memoryDB(coordinated.state);
 apply(db.root,{sv_chat_roles:{office:{activo:true,rol:'administrativo'}},sv_permisos:{administrativo:{indiceVersion:2,indiceRevision:5,indiceModulos:{empleados:true,gastos:true},acciones:{}}},sv_labor_config:{schema:1,ready:true},sv_record_list_config:{schema:1,ready:true},sv_operational_read_config:{schema:1,ready:true}});
 const Financial=at('cotizador/sale-financial-dependencies-model'),prepared=await Financial.prepare({ventas:db.root.sisventas.ventas,gastos:db.root.sisventas.gastos,ctaemp:db.root.sisventas.ctaemp,comisiones_generacion:db.root.sisventas.comisiones_generacion,sv_commission_generation:db.root.sv_commission_generation??null},{generation:'fiction-clothing-core'});
 apply(db.root,prepared.patch);assert.deepEqual(db.root.sv_sale_financial_dependencies.v1.coverage,prepared.coverage);Financial.validateCoverage(prepared.coverage);
 assert.equal(db.root.sv_client_accounts_config.ready,true);assert.equal(db.root.sv_client_history_config.ready,true);
 if(seedClothing){const Clothing=at('cotizador/employee-clothing-model'),Model=at('cotizador/expense-clothing-model');apply(db.root,{sv_employee_clothing:Model.plan(Clothing.create(),expense,{key:'seed',operationId:'fiction-seed-clothing',actorId:who.uid,at:new Date(now).toISOString()})});}
 const requests=[],patches=[],commitPlans=[],ref=db.ref.bind(db);
 const {createLaborRtdbStore}=at('cotizador/labor-rtdb-store'),{createLaborGuard}=at('cotizador/labor-guard');
 const store=createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=fiction-clothing-core-no-network',now:()=>now,accessToken:async()=>'FIXTURE_ONLY',fetchImpl:async(url,options)=>{
  const target=new URL(url);assert.equal(target.hostname,'127.0.0.1');const record=decodeURIComponent(target.pathname).slice(1,-5);requests.push({method:options.method,path:record});let value=null;
  if(options.method==='GET'){assert.ok(record,'No root GET');value=(await ref(record).get()).val();if(target.searchParams.has('orderBy')){const query=Object.fromEntries([...target.searchParams].filter(([key])=>!['ns','auth_variable_override'].includes(key)).map(([key,value])=>[key,JSON.parse(value)]));value=at('test/helpers/stock-reference-query-fixture.cjs').queryRows(value,query);}}
  else if(options.method==='PUT')apply(db.root,{[record]:JSON.parse(options.body)});
  else if(options.method==='DELETE')apply(db.root,{[record]:null});
  else if(options.method==='PATCH'){const patch=JSON.parse(options.body);patches.push(structuredClone(patch));apply(db.root,patch);}
  else assert.fail('Método inesperado');return{ok:true,status:200,body:{cancel:async()=>{}},json:async()=>structuredClone(value)};
 }});
 assert.equal(store.employeeResourcesCommitVersion,1);
 const guard=createLaborGuard({store,now:()=>now,operationalSummaries:true,clientAccounts:true,clientHistory:true,commercialPages:true,saleFinancialDependencies:true,delay:async()=>{}});
 for(const key of ['clientAccounts','clientHistory','saleFinancialDependencies'])assert.equal(guard[key],true,key);
 const commit=store.commit.bind(store);store.commit=async(p,l,a)=>{commitPlans.push(structuredClone(p));try{return await commit(p,l,a);}catch(error){t.diagnostic('REAL_COMMIT_REJECTED '+JSON.stringify({operation:a.operation,code:error.code,message:error.message,paths:Object.keys(p),financialPaths:Object.keys(p).filter(key=>key.startsWith('sv_sale_financial_dependencies/'))}));throw error;}};
 const gateway=at('cotizador/labor-write-gateway').createLaborWriteGateway({auth:{verifyIdToken:async(token,revoked)=>{assert.equal(token,'FIXTURE_ONLY');assert.equal(revoked,true);return who.claims;}},db,store,guard,enabled:true});
 const create=at('cotizador/admin-expense-create').createAdminExpenseCreate({authorize:gateway.authorize,db,guard,enabled:true,clothingEnabled:true,now:()=>now});
 const resources=at('cotizador/employee-resources').create({authorize:gateway.authorize,store,guard,enabled:true,now:()=>now});
 return{db,store,guard,create,resources,requests,patches,commitPlans,req:{method:'POST',headers:{authorization:'Bearer FIXTURE_ONLY'}}};
}
test('alta indumentaria con cobertura G/H/Financial preparada confirma gasto y prendas en un commit real',async t=>{
 const f=await fixture(t),body={id:'fiction-clothing-coordinated-create',projection:'complete',datos:expense},actor=await f.create.authorize(f.req);
 const before=structuredClone(f.db.root.sisventas);let result;
 try{result=await f.create.create(actor,body);}catch(error){assert.equal(f.patches.length,0,'Rechazo de policy no puede escribir parcialmente');assert.deepEqual(f.db.root.sisventas,before);assert.equal(f.db.root.sv_employee_clothing,undefined);t.diagnostic('ATOMIC_REJECTION: cero PATCH y originales intactos');throw error;}
 assert.equal(result.committed,true);assert.equal(f.patches.length,1);assert.equal(f.db.root.sisventas.gastos[result.key].monto,expense.monto);assert.equal(f.db.root.sv_employee_clothing.events[0].quantity,3);
 assert.deepEqual(f.db.root.sisventas.ventas,before.ventas);assert.deepEqual(f.db.root.sisventas.pagos,before.pagos);
 assert.deepEqual(await f.create.create(actor,body),result);assert.equal(f.patches.length,1);
});
test('EmployeeResources real entrega prendas preparadas sin crear otro gasto con G/H/Financial activos',async t=>{
 const f=await fixture(t,{seedClothing:true}),stock=f.db.root.sv_employee_clothing,garment=Object.values(stock.garments)[0],before=structuredClone(f.db.root.sisventas.gastos);
 const actor=await f.create.authorize(f.req),body={id:'fiction-clothing-coordinated-deliver',domain:'clothing',expectedRevision:stock.revision,permissionRevision:5,command:{type:'employee.deliver',garmentId:garment.id,variantId:garment.variants[0].id,employeeId:'person',quantity:1}};
 const result=await f.resources.execute(actor,body);assert.equal(result.committed,true);assert.equal(f.patches.length,1);assert.deepEqual(f.db.root.sisventas.gastos,before);assert.equal(f.db.root.sv_employee_clothing.events.at(-1).quantity,1);
});
