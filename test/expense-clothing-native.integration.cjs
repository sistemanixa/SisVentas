'use strict';
// Run only with a separately started demo emulator and a reviewed native runtime.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const dep=createRequire(process.env.SV_SECURITY_TOOLS+'/package.json'),{initializeTestEnvironment}=dep('@firebase/rules-unit-testing'),sdk=dep('firebase/database');
const host='127.0.0.1:14781',ns='demo-expense-clothing';let env,native;
const who={uid:'office',claims:{uid:'office'}};
const data={fecha:'2026-11-14',tipo:'Variable',categoria:'Indumentaria',descripcion:'Compra ficticia',monto:3456.78,montoPagado:0,estado:'pendiente',medio:'Efectivo',indumentaria:{schema:1,items:[{name:'Remera ficticia',size:'M',color:'Azul',quantity:3}]}};
before(async()=>{
 assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,host);assert.ok(process.env.SV_EXPENSE_CLOTHING_NATIVE);assert.ok(process.env.SV_EXPENSE_CLOTHING_RULES);
 native=createRequire(path.join(process.env.SV_EXPENSE_CLOTHING_NATIVE,'index.js'));
 env=await initializeTestEnvironment({projectId:ns,database:{host:'127.0.0.1',port:14781,rules:fs.readFileSync(process.env.SV_EXPENSE_CLOTHING_RULES,'utf8')}});
});
after(async()=>env?.cleanup());
const change=patch=>env.withSecurityRulesDisabled(c=>sdk.update(sdk.ref(c.database()),patch));
beforeEach(async()=>{await env.clearDatabase();await change({sv_labor_config:{schema:1,ready:true},sv_record_list_config:{schema:1,ready:true},sv_chat_roles:{office:{activo:true,rol:'administrativo'}},sv_permisos:{administrativo:{indiceVersion:2,indiceRevision:5,indiceModulos:{empleados:true,gastos:true},acciones:{}}},sisventas:{ventas:{sentinel:{total:123}},pagos:{sentinel:{monto:45}},ctaemp:{sentinel:{saldo:789}}}});});
function runtime(){
 const store=native('./labor-rtdb-store').createLaborRtdbStore({databaseURL:'http://'+host+'/?ns='+ns,accessToken:async()=>'owner'}),guard=native('./labor-guard').createLaborGuard({store,operationalSummaries:true}),db={ref:p=>({get:async()=>({val:()=>store.read(p)})})};
 const create=native('./admin-expense-create').createAdminExpenseCreate({authorize:async()=>{},db,guard,enabled:true,clothingEnabled:true}),edit=native('./admin-expense-edit').createAdminExpenseEdit({authorize:async()=>{},store,guard,enabled:true,clothingEnabled:true});return {store,guard,create,edit};
}
test('native REST and deployed rules atomically create the expense, summary and clothing; retry recovers one receipt',async()=>{
 const {store,create}=runtime(),body={id:'native-fictional-create-001',projection:'complete',datos:data},result=await create.create(who,body);
 assert.equal((await store.read('sisventas/gastos/'+result.key)).monto,3456.78);assert.equal((await store.read('sv_employee_clothing')).events[0].quantity,3);
 assert.equal((await store.read('sisventas/listados_resumen/gastos/'+result.key)).monto,3456.78);
 assert.deepEqual(await create.create(who,body),result);assert.equal((await store.read('sv_employee_clothing')).events.length,1);
 assert.deepEqual(await store.read('sisventas/ventas'),{sentinel:{total:123}});assert.deepEqual(await store.read('sisventas/pagos'),{sentinel:{monto:45}});
});
test('permission revoked immediately before PATCH rejects both records under actual rules',async()=>{
 const {store,create}=runtime(),commit=store.commit.bind(store);store.commit=async(p,l,a)=>{await change({'sv_permisos/administrativo/acciones/empleados/indumentaria':false});return commit(p,l,a);};
 await assert.rejects(create.create(who,{id:'native-fictional-revoke-001',projection:'complete',datos:data}));
 assert.equal(await store.read('sisventas/gastos'),null);assert.equal(await store.read('sv_employee_clothing'),null);
});
test('native old expense completion preserves payments; employee delivery creates no new expense',async()=>{
 const {store,guard,edit}=runtime(),old={...data,montoPagado:100,pagos:{original:{monto:100,fecha:'2026-11-01',medio:'Efectivo'}}};delete old.indumentaria;
 await change({'sisventas/gastos/old':old,'sisventas/empleados/person':{nombre:'Persona ficticia',activo:true}});
 const base=native('./admin-expense-edit').base,digest=native('./labor-guard').digest;
 await edit.execute(who,{id:'native-complete-old-001',key:'old',expectedHash:digest(base(old)),datos:{...data,montoPagado:100}});
 const expense=await store.read('sisventas/gastos/old'),stock=await store.read('sv_employee_clothing');assert.deepEqual(expense.pagos,old.pagos);
 const resources=native('./employee-resources').create({authorize:async()=>{},store,guard,enabled:true}),garment=Object.values(stock.garments)[0];
 await resources.execute(who,{id:'native-deliver-person-001',domain:'clothing',expectedRevision:stock.revision,permissionRevision:5,command:{type:'employee.deliver',garmentId:garment.id,variantId:garment.variants[0].id,employeeId:'person',quantity:1}});
 assert.deepEqual(await store.read('sisventas/gastos/old'),expense);assert.equal(Object.keys(await store.read('sisventas/gastos')).length,1);
 await assert.rejects(resources.execute(who,{id:'native-receive-again-001',domain:'clothing',expectedRevision:stock.revision+1,permissionRevision:5,command:{type:'stock.receive',garmentId:garment.id,variantId:garment.variants[0].id,gastoRef:'old',quantity:1,unitCost:1}}),/ya ingresaron/);
});
