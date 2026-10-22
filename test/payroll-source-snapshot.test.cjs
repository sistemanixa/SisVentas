'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Model=require('../js/core/payroll-source-snapshot.js'),{createBackend,copy,apply}=require('./helpers/labor-ui-flow.cjs'),{load}=require('./helpers/app-functions.cjs');
const months=Array.from({length:6},(_,i)=>'2026_'+String(i+7).padStart(2,'0')),plain=value=>JSON.parse(JSON.stringify(value));
function sample(n=2,{fallback=false,shared=false}={}){const employees={},haberes={},cargos={};for(let i=0;i<n;i++){const id='e'+i,cargo='c'+(shared?0:i);employees[id]={fbKey:id,nombre:'Persona ficticia '+i,activo:true,cargoId:cargo,fechaIngreso:'2025-01-01'};haberes[id]=fallback?{}:{'2026_07':{sueldo:1000+i,pagos:{p:{monto:77}}},'2025_01':{sueldo:999999}};cargos[cargo]={valorHora:10+i,diasMes:20,nombre:'Cargo ficticio'};}return {employeeIds:Object.keys(employees),employees,haberes,cargos,year:2026,half:2};}
function get(root,path){return path.split('/').reduce((node,key)=>node&&Object.hasOwn(node,key)?node[key]:null,root)??null;}
function valuesFor(description,input){const state={sisventas:{gastos:input.gastos||{},empleados:input.employees,haberes:input.haberes,config:{cargos:input.cargos}}};return Object.fromEntries(description.paths.map(p=>[p,copy(get(state,p))]));}
function canonical(employees,haberes,cargos,{year=2026,half=2,maximum=''}={}){const context={Date,Math,parseFloat,document:{getElementById:id=>id==='agu-maximo'?{value:maximum}:null},CARGOS_DATA:cargos};load(context,['_mesesDelSemestre','_mesesTrabajadosEnSemestre','_calcularFilasAguinaldo']);return plain(context._calcularFilasAguinaldo(employees,haberes,year,half));}

test('the descriptor compares history per chosen employee plus profiles and Gastos without mutating inputs',()=>{
 const input=sample(),before=copy(input),description=Model.plan(input);assert.equal(description.strategy,'employee-history');assert.equal(description.paths.length,5);assert.equal(description.paths[0],'sisventas/gastos');assert.ok(Object.isFrozen(description)&&Object.isFrozen(description.paths)&&Object.isFrozen(description.profiles));assert.deepEqual(input,before);
 for(const id of input.employeeIds){assert.ok(description.paths.includes('sisventas/empleados/'+id));assert.ok(description.paths.includes('sisventas/haberes/'+id));}assert.equal(description.scope.cargos,'none');assert.equal(description.readScope.globalHaberesAtConfirmation,false);
 const values=valuesFor(description,input),sourceBefore=copy(values),current=Model.materialize(description,values);assert.deepEqual(values,sourceBefore);assert.deepEqual(canonical(current.employees,current.haberes,current.cargos),canonical(Object.values(input.employees),input.haberes,input.cargos));
});
test('only cargo records actually needed for fallback are compared and an absent covered cargo preserves canonical zero',()=>{
 const input=sample(3,{fallback:true,shared:true});input.haberes.e1={'2026_08':{sueldo:1500}};input.employees.e2.cargoId='missing';const description=Model.plan(input);assert.deepEqual(description.fallbackCargoIds,['c0','missing']);assert.ok(!description.paths.includes('sisventas/config/cargos'));const current=Model.materialize(description,valuesFor(description,input));assert.equal(current.cargos.missing,null);assert.deepEqual(canonical(current.employees,current.haberes,current.cargos),canonical(Object.values(input.employees),input.haberes,input.cargos));
});
test('salary projections preserve truthiness, legacy numeric strings and missing months exactly',()=>{
 const input=sample(1);input.haberes.e0={'2026_07':{sueldo:'1500'},'2026_08':{sueldo:0},'2026_09':{sueldo:false},'2026_10':{sueldo:''},'2026_11':{sueldo:-50},'2026_12':{otros:20}};const description=Model.plan(input),current=Model.materialize(description,valuesFor(description,input));assert.equal(current.haberes.e0['2026_07'].sueldo,'1500');assert.equal(current.haberes.e0['2026_09'].sueldo,false);assert.equal(current.haberes.e0['2026_12'],undefined);assert.deepEqual(canonical(current.employees,current.haberes,current.cargos),canonical(Object.values(input.employees),input.haberes,input.cargos));
});
test('adaptive paths preserve all selected people and never exceed128 or split the batch',()=>{
 for(const [n,fallback]of [[1,false],[18,false],[19,false],[42,true],[43,true],[64,false],[130,false],[250,true]]){const input=sample(n,{fallback}),description=Model.plan(input);assert.ok(description.paths.length<=128,n+' sources');assert.equal(new Set(description.paths).size,description.paths.length);assert.equal(description.ids.length,n);assert.ok(!description.paths.some(p=>p==='sisventas'||p==='sisventas/config'));const current=Model.materialize(description,valuesFor(description,input));assert.equal(current.employees.length,n);assert.deepEqual(canonical(current.employees,current.haberes,current.cargos),canonical(Object.values(input.employees),input.haberes,input.cargos));}
 assert.equal(Model.plan(sample(18)).strategy,'employee-history');assert.equal(Model.plan(sample(19)).strategy,'employee-history');const cargoParent=Model.plan(sample(43,{fallback:true}));assert.deepEqual(cargoParent.scope,{haberes:'employee',employees:'selected',cargos:'all'});const employeeParent=Model.plan(sample(64));assert.deepEqual(employeeParent.scope,{haberes:'employee',employees:'all',cargos:'none'});const global=Model.plan(sample(130));assert.equal(global.scope.haberes,'all');assert.equal(global.readScope.globalHaberesAtConfirmation,true);
});
for(const change of ['missing-value','missing-employee','inactive','identity','cargo','entry-date','name','fallback-new'])test('materialize refuses '+change+' instead of silently dropping a person or using local copies',()=>{
 const input=sample(),description=Model.plan(input),values=valuesFor(description,input),employeePath='sisventas/empleados/e0';
 if(change==='missing-value')delete values[description.paths[1]];
 if(change==='missing-employee')values[employeePath]=null;
 if(change==='inactive')values[employeePath].activo=false;
 if(change==='identity')values[employeePath].fbKey='someone-else';
 if(change==='cargo')values[employeePath].cargoId='new-cargo';
 if(change==='entry-date')values[employeePath].fechaIngreso='2026-10-01';
 if(change==='name')values[employeePath].nombre='Otra identidad';
 if(change==='fallback-new')values['sisventas/haberes/e0']={};
 assert.throws(()=>Model.materialize(description,values),{code:Model.REPLAN_CODE,svLaborAttempted:false});
});
test('a cargo root already covered by the plan may provide a newly needed fallback, but no unobserved child is invented',()=>{
 const input=sample(43,{fallback:true});input.haberes.e0={'2026_07':{sueldo:1000}};const description=Model.plan(input);assert.equal(description.scope.cargos,'all');const values=valuesFor(description,input);values['sisventas/haberes/e0']={};const current=Model.materialize(description,values);assert.deepEqual(current.cargos.c0,input.cargos.c0);assert.equal(canonical(current.employees,current.haberes,current.cargos)[0].mejorSueldo,1600);
});
test('all missing, zero, false and negative salary variants use the same canonical fallback and rounding',()=>{
 for(const salary of [null,0,false,'',-1,'-20',[],{},'no-numérico']){const input=sample(1);input.haberes.e0={'2026_07':{sueldo:salary}};const description=Model.plan(input),current=Model.materialize(description,valuesFor(description,input));assert.deepEqual(canonical(current.employees,current.haberes,current.cargos,{maximum:'123,45'}),canonical(Object.values(input.employees),input.haberes,input.cargos,{maximum:'123,45'}));}
});
test('bad references, incomplete preview sources and invalid semester/budget fail before any transport',()=>{
 for(const patch of [{employeeIds:[]},{employeeIds:['e0','e0']},{employeeIds:['../e']},{employeeIds:['constructor']},{year:999},{half:3},{budget:129},{budget:2},{haberes:{}},{employees:{}}])assert.throws(()=>Model.plan({...sample(1),...patch}),{code:Model.REPLAN_CODE});
});
test('the browser API is the same pure model without DOM, fetch, timers or SDK dependencies',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/core/payroll-source-snapshot.js'),'utf8'),context={window:{}};vm.createContext(context);vm.runInContext(source,context);const input=sample(2,{fallback:true}),browser=context.window.SVPayrollSourceSnapshot;assert.deepEqual(plain(browser.plan(input)),plain(Model.plan(input)));assert.equal(typeof browser.materialize,'function');
});

// Load the actual candidate financial module. Rows from a previous preview
// never become the authority for the values inside its synchronous CAS build.
function actualFlow(input=sample(2)){
 const f=createBackend({empleados:Object.fromEntries(Object.entries(input.employees).map(([id,row])=>{const next=copy(row);delete next.fbKey;return [id,next];})),haberes:copy(input.haberes),config:{maxComisionPct:10,cargos:copy(input.cargos)},gastos:input.gastos||{historical:{monto:88,montoPagado:88,estado:'pagado',pagos:{paid:{monto:88}},adjuntos:{keep:'Ficticio'}}}}),page=f.page(),description=Model.plan(input);
 page.load(['_mesesDelSemestre','_mesesTrabajadosEnSemestre']);page.context.CARGOS_DATA=copy(input.cargos);page.context.SVPayrollSourceSnapshot=Model;page.context.SVPayrollSemester={assertConfirmation(){}};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/modules/payroll.js'),'utf8'),page.context);
 page.context.SVPayrollSemester={assertConfirmation(){}};
 const capture={employees:copy(Object.values(input.employees)),haberes:copy(input.haberes),period:{year:input.year,half:input.half},maximum:''};
 return {f,page,description,async save(){return page.context.SVPayrollFinancial.save(capture,input.year+'_S'+input.half,'2026-10-22','2do semestre 2026','frozen_operation',true);}};
}
test('current salary changes after the SDK read are detected by the real gateway and recalculated with the real SAC function',async()=>{
 const flow=actualFlow(sample(1));let changed=false;flow.f.setHook(()=>{if(!changed){changed=true;apply(flow.f.state,{'sisventas/haberes/e0/2026_07/sueldo':2000});}});await flow.save();assert.equal(flow.f.commands.length,2);assert.equal(flow.f.commits.length,1);const g=Object.values(flow.f.state.sisventas.gastos).find(g=>g.tipoPagable==='aguinaldo');assert.equal(g.monto,1000);assert.equal(g.mejorSueldo,2000);assert.deepEqual(flow.f.get('sisventas/haberes/e0/2026_07/pagos'),{p:{monto:77}});
});
for(const change of ['inactive','entry-date','cargo'])test('real source CAS rejects employee '+change+' after preparation without a partial SAC',async()=>{
 const flow=actualFlow(sample(2));let changed=false;flow.f.setHook(()=>{if(!changed){changed=true;apply(flow.f.state,{['sisventas/empleados/e0/'+(change==='inactive'?'activo':change==='entry-date'?'fechaIngreso':'cargoId')]:change==='inactive'?false:change==='entry-date'?'2026-10-01':'new'});}});await assert.rejects(flow.save(),{code:Model.REPLAN_CODE});assert.equal(flow.f.commits.length,0);assert.ok(!Object.values(flow.f.state.sisventas.gastos).some(g=>g.tipoPagable==='aguinaldo'));
});
test('fallback cargo rates are real CAS sources and a changed rate is used only after a successful retry',async()=>{
 const flow=actualFlow(sample(1,{fallback:true}));let changed=false;flow.f.setHook(()=>{if(!changed){changed=true;apply(flow.f.state,{'sisventas/config/cargos/c0/valorHora':20});}});await flow.save();assert.equal(flow.f.commands.length,2);assert.equal(flow.f.commits.length,1);const g=Object.values(flow.f.state.sisventas.gastos).find(g=>g.tipoPagable==='aguinaldo');assert.equal(g.mejorSueldo,3200);assert.equal(g.monto,1600);
});
test('lost acknowledgement and a later deliberate retry preserve paid SAC and all historical payments without a duplicate',async()=>{
 const flow=actualFlow(sample(2)),fetch=flow.page.context.fetch;let lost=true;flow.page.context.fetch=async(...args)=>{const result=await fetch(...args);if(lost){lost=false;throw Error('Acknowledgement lost in fictitious transport');}return result;};await assert.rejects(flow.save(),/Acknowledgement lost/);assert.equal(flow.f.commits.length,1);
 const bonuses=Object.entries(flow.f.state.sisventas.gastos).filter(([,g])=>g.tipoPagable==='aguinaldo');for(const [id,g]of bonuses)apply(flow.f.state,{['sisventas/gastos/'+id]:{...g,estado:'pagado',montoPagado:g.monto,pagos:{p:{monto:g.monto,comprobante:'FICTICIO'}}}});const before=copy(flow.f.state.sisventas);const result=await flow.save();assert.equal(result.unchanged,true);assert.equal(flow.f.commits.length,1);assert.deepEqual(flow.f.state.sisventas,before);
});
test('a large group keeps one atomic commit, all recipients, honest global fallback and untouched histories',async()=>{
 const flow=actualFlow(sample(135,{fallback:true}));assert.ok(flow.description.paths.length<=128);assert.equal(flow.description.readScope.globalHaberesAtConfirmation,true);await flow.save();assert.equal(flow.f.commits.length,1);assert.equal(Object.values(flow.f.state.sisventas.gastos).filter(g=>g.tipoPagable==='aguinaldo').length,135);assert.deepEqual(flow.f.get('sisventas/gastos/historical/pagos'),{paid:{monto:88}});assert.deepEqual(flow.f.get('sisventas/haberes'),sample(135,{fallback:true}).haberes);
});
