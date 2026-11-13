'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Service=require('../cotizador/employee-resources'),Policy=require('../cotizador/employee-resources-policy'),Clothing=require('../cotizador/employee-clothing-model'),Categories=require('../cotizador/expense-categories-model'),Overlay=require('../scripts/lib/employee-resources-runtime-overlay.cjs'),Rules=require('../scripts/lib/employee-resources-rules.cjs');
const identity={uid:'office',claims:{uid:'office'}},profile={activo:true,rol:'administrativo'},cfg={indiceVersion:2,indiceRevision:5,indiceModulos:{empleados:true,gastos:true},acciones:{}};
test('defaults laborales y excepciones configuradas conservan sesión, reset y módulos',()=>{
 assert.equal(Service.context(identity,profile,cfg,null,'clothing').role,'administrativo');
 assert.throws(()=>Service.context(identity,profile,{...cfg,acciones:{empleados:{indumentaria:false}}},null,'clothing'));
 assert.throws(()=>Service.context({...identity,viewing:true},profile,cfg,null,'clothing'));
 assert.throws(()=>Service.context(identity,profile,cfg,{required:true},'clothing'));
 assert.throws(()=>Service.context(identity,{...profile,rol:'tecnico'},cfg,null,'clothing'));
 assert.equal(Service.context(identity,{...profile,rol:'tecnico'},{...cfg,acciones:{empleados:{indumentaria:true}}},null,'clothing').role,'tecnico');
});
test('modelos servidor y navegador coinciden salvo dependencia monetaria canónica',()=>{
 for(const name of ['employee-clothing-model','expense-categories-model']){
  const browser=fs.readFileSync(path.join(__dirname,'../js/core/'+name+'.js'),'utf8').replaceAll('\r\n','\n').replace("require('./commercial-money.v1.js')","require('./office-stock-money.js')");
  assert.equal(fs.readFileSync(path.join(__dirname,'../cotizador/'+name+'.js'),'utf8').replaceAll('\r\n','\n'),browser);
 }
});
test('capacidad de una operación exacta no sirve para otro fence, actor, root o valor',()=>{
 const actor={uid:'office',mode:'user',opId:'operation-test',operation:'employee-resources-categories',role:'administrativo',permissionRevision:5},lease={actorUid:'office',opId:actor.opId,fence:'fence-test'};
 const state=Categories.create(Categories.createState(),{operationId:actor.opId,expectedRevision:0,name:'Prueba'});Policy.issue(actor,lease,'categories',state);
 assert.equal(Policy.validate(actor,lease,{sv_expense_categories:state}).svEmployeeResourcesVersion,1);
 assert.throws(()=>Policy.validate(actor,{...lease,fence:'other'},{sv_expense_categories:state}));
 assert.throws(()=>Policy.validate(actor,lease,{sv_expense_categories:state,'sisventas/gastos/e':{monto:1}}));
 assert.throws(()=>Policy.validate(actor,lease,{sv_expense_categories:{...state,revision:99}}));
 assert.equal(Policy.token({...actor,employeeResources:{}},lease).svEmployeeResourcesVersion,0);
});
test('sin adapter nativo verificado falla cerrado aunque exista Admin',async()=>{
 const service=Service.create({authorize:async()=>identity,store:{read:async()=>null},guard:{run:async()=>{}},enabled:true});
 await assert.rejects(service.read(identity,'clothing'),{code:'SV_EMPLOYEE_RESOURCES_NOT_READY'});
});
test('composición de reglas sólo agrega dos raíces cerradas al SDK y no abre padres',()=>{
 const base={rules:{'.read':false,'.write':false,sisventas:{'.write':false}}},before=JSON.stringify(base),r=Rules.build(base);
 assert.equal(JSON.stringify(base),before);assert.equal(r.rules.sv_employee_clothing['.read'],false);assert.equal(r.rules.sv_expense_categories['.read'],false);
 for(const name of ['sv_employee_clothing','sv_expense_categories'])for(const fragment of ['svEmployeeResourcesVersion','sv_access_resets','indiceRevision','sv_labor_guard','sv_labor_receipts'])assert.ok(r.rules[name]['.write'].includes(fragment),fragment);
 assert.throws(()=>Rules.build({rules:{'.write':true}}));assert.throws(()=>Rules.build(r));
});
test('overlay nativo requiere anchors exactos y neutraliza claims reservados antes de emitir',()=>{
 const sample="const override=service('commit',lease,actor);\nconst api={read,acquire,commit,abort,";
 const transformed=Overlay.store(sample);assert.match(transformed,/reserved\(actor\?\.claims\)/);assert.match(transformed,/validate\(actor,lease,patch\)/);assert.match(transformed,/employeeResourcesCommitVersion:1/);assert.throws(()=>Overlay.store(transformed));
});
