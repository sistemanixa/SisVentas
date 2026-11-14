'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs'),Permissions=require('../js/core/permission-index');
const {createAdminExpenseCreate}=require('../cotizador/admin-expense-create'),{createAdminExpenseEdit,base}=require('../cotizador/admin-expense-edit');
const {digest}=require('../cotizador/labor-guard'),Policy=require('../cotizador/employee-resources-policy'),Clothing=require('../cotizador/employee-clothing-model'),Model=require('../cotizador/expense-clothing-model');
const apparel={schema:1,items:[{name:'Remera ficticia',size:'M',color:'Negro',quantity:3},{name:'Pantalón ficticio',size:'42',color:'Azul',quantity:2}]};
const expense={fecha:'2026-11-14',tipo:'Variable',categoria:'Indumentaria',descripcion:'Compra ficticia de ropa',monto:50000.25,montoPagado:0,estado:'pendiente',medio:'Efectivo',empleadoId:null,indumentaria:apparel};
const who={uid:'u',claims:{uid:'u'}};
function fixture(initial={},enabled=true){
 const f=createBackend(initial);f.state.sv_permisos=Permissions.build({admin:{bloqueados:[],acciones:{}}});
 f.state.sv_record_list_config={schema:1,ready:true};
 const commit=f.store.commit.bind(f.store);f.store.commit=async(p,l,a)=>{if(a.employeeResources)Policy.validate(a,l,p);return commit(p,l,a);};
 const db={ref:p=>({get:async()=>({val:()=>copy(f.get(p))})})};
 const create=createAdminExpenseCreate({authorize:async()=>who,db,guard:f.guard,enabled:true,clothingEnabled:enabled});
 const edit=createAdminExpenseEdit({authorize:async()=>who,store:f.store,guard:f.guard,enabled:true,clothingEnabled:enabled});
 return {...f,create,edit,body:(id='fictional-clothing-purchase-001',changes={})=>({id,projection:'complete',datos:{...copy(expense),...changes}})};
}
test('one atomic expense, initial payment, attachment and stock receipt; identical retry cannot duplicate either',async()=>{
 const f=fixture(),body=f.body();body.datos.montoPagado=100;body.datos.pagos={p:{monto:100,medio:'Efectivo'}};body.foto='data:image/png;base64,QQ==';
 const result=await f.create.create(who,body),g=f.get('sisventas/gastos/'+result.key),stock=f.get('sv_employee_clothing');
 assert.equal(f.commits.length,1);assert.deepEqual(g.pagos,body.datos.pagos);assert.equal(g.monto,50000.25);assert.deepEqual(Clothing.inventory(stock).map(r=>r.quantity),[3,2]);
 assert.equal(stock.expenseReceipts[result.key].amount,50000.25);assert.equal(f.get('sisventas/gastos_adjuntos/'+result.key+'/fotoBase64'),body.foto);
 assert.deepEqual(await f.create.create(who,body),result);assert.equal(f.commits.length,1);assert.equal(Object.keys(f.get('sisventas/gastos')).length,1);
 await assert.rejects(f.create.create(who,f.body('fictional-clothing-purchase-002')),/Ya existe/);assert.equal(f.commits.length,1);
});
test('completing an old expense preserves all payments and permits later text edits without receiving twice',async()=>{
 const old={...copy(expense),indumentaria:undefined,montoPagado:200,pagos:{legacy:{monto:200,comprobante:'CONSERVAR'}},nota:'Conservar'};delete old.indumentaria;
 const f=fixture({gastos:{old}}),body={id:'fictional-complete-old-001',key:'old',expectedHash:digest(base(old)),datos:{...copy(expense),montoPagado:200}};
 await f.edit.execute(who,body);assert.deepEqual(f.get('sisventas/gastos/old/pagos'),old.pagos);assert.equal(Object.keys(f.get('sisventas/gastos')).length,1);
 const stock=copy(f.get('sv_employee_clothing')),current=f.get('sisventas/gastos/old');
 await f.edit.execute(who,{...body,id:'fictional-descriptive-002',expectedHash:digest(base(current)),datos:{...body.datos,descripcion:'Texto actualizado'}});
 assert.deepEqual(f.get('sv_employee_clothing'),stock);assert.deepEqual(f.get('sisventas/gastos/old/pagos'),old.pagos);
 const next=f.get('sisventas/gastos/old');await assert.rejects(f.edit.execute(who,{...body,id:'fictional-change-stock-003',expectedHash:digest(base(next)),datos:{...body.datos,indumentaria:{schema:1,items:[{...apparel.items[0],quantity:99}]}}}),/ya ingresadas/);
});
test('a lost acknowledgement recovers the committed expense without adding stock a second time',async()=>{
 const f=fixture(),commit=f.store.commit.bind(f.store),body=f.body();let lost=true;
 f.store.commit=async(...args)=>{await commit(...args);if(lost){lost=false;throw Error('Respuesta perdida después de guardar');}};
 await assert.rejects(f.create.create(who,body),/Respuesta perdida/);assert.equal(f.commits.length,1);
 const result=await f.create.create(who,body);assert.ok(result.key);assert.equal(f.commits.length,1);assert.equal(f.get('sv_employee_clothing').events.length,2);
});
test('two distinct purchases serialize against current stock and reuse the same garments',async()=>{
 const f=fixture();await Promise.all([f.create.create(who,f.body()),f.create.create(who,f.body('fictional-second-purchase',{descripcion:'Segunda compra ficticia'}))]);
 assert.equal(f.commits.length,2);assert.equal(Object.keys(f.get('sisventas/gastos')).length,2);assert.deepEqual(Clothing.inventory(f.get('sv_employee_clothing')).map(r=>r.quantity),[6,4]);
});
for(const kind of ['disabled','wrong-category','fixed','permission','commit-rejection'])test(kind+' leaves both expense and stock untouched',async()=>{
 const f=fixture({},kind!=='disabled'),body=f.body();
 if(kind==='wrong-category')body.datos.categoria='Servicios';if(kind==='fixed')body.datos.tipo='Fijo';
 if(kind==='permission')f.state.sv_permisos.admin.acciones.empleados={indumentaria:false};
 if(kind==='commit-rejection')f.store.commit=async()=>{throw Error('Commit rechazado');};
 await assert.rejects(f.create.create(who,body));assert.equal(f.commits.length,0);assert.deepEqual(f.get('sisventas/gastos'),{});assert.equal(f.get('sv_employee_clothing'),null);
});
test('old manual intake is detected instead of silently adding the same clothes again',async()=>{
 const f=fixture({gastos:{old:{...copy(expense),indumentaria:undefined}}});delete f.state.sisventas.gastos.old.indumentaria;
 f.state.sv_employee_clothing={...Clothing.create(),events:[{gastoRef:'old',type:'stock.receive'}]};
 await assert.rejects(f.edit.execute(who,{id:'fictional-legacy-receipt',key:'old',expectedHash:digest(base(f.get('sisventas/gastos/old'))),datos:copy(expense)}),/ya tiene prendas/);assert.equal(f.commits.length,0);
});
test('same garment names and variants reuse existing stock, and excessive quantities fail safely',()=>{
 const opts={key:'expense1',operationId:'fictional-operation-one',actorId:'u',at:'2026-11-14T15:00:00Z'},a=Model.plan(Clothing.create(),expense,opts),b=Model.plan(a,expense,{...opts,key:'expense2',operationId:'fictional-operation-two'});
 assert.equal(Object.keys(b.garments).length,2);assert.deepEqual(Clothing.inventory(b).map(r=>r.quantity),[6,4]);
 assert.throws(()=>Model.normalize({schema:1,items:[apparel.items[0],apparel.items[0]]}),/repetidos/);
});
test('expense capability rejects a changed expense, additional business record, forged actor or fence',()=>{
 const actor={uid:'u',mode:'user',opId:'fictional-operation',operation:'admin-expense-create',role:'admin',permissionRevision:1},lease={actorUid:'u',opId:actor.opId,fence:'one'},patch={'sisventas/gastos/g':copy(expense),sv_employee_clothing:{schema:1}};
 Policy.issueExpense(actor,lease,'g',patch,patch.sv_employee_clothing);assert.equal(Policy.validate(actor,lease,patch).svEmployeeResourcesVersion,1);
 assert.throws(()=>Policy.validate(actor,lease,{...patch,'sisventas/ventas/v':{total:0}}));
 assert.throws(()=>Policy.validate(actor,lease,{...patch,'sisventas/gastos/g':{...expense,monto:1}}));
 assert.throws(()=>Policy.validate({...actor,uid:'other'},lease,patch));assert.throws(()=>Policy.validate(actor,{...lease,fence:'two'},patch));
});
