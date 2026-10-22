'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Model=require('../js/core/payroll-legacy-sac-model');
const {functionSource}=require('./helpers/app-functions.cjs');
const stamp=Date.parse('2026-10-22T15:30:00Z'),fallbackDate='2026-10-22';
const copy=value=>JSON.parse(JSON.stringify(value));
const sourcePath='sisventas/aguinaldos/e/2026_S2';
const options=(source,extra={})=>({sourcePath,source,employeeName:'Persona ficticia',fallbackDate,stamp,...extra});
function canonical(source,origin='aguinaldos',extra={}) {
 const context={Date:class extends Date{constructor(...args){super(...(args.length?args:[stamp]));}static now(){return stamp;}},svFechaLocalISO:()=>fallbackDate};
 vm.createContext(context);for(const name of ['_pagableNormMonto','_pagableNormFecha','_pagableEstadoPendiente','_pagableGastoBase','_pagableAplicarPagoLegacy'])vm.runInContext(functionSource(name),context);
 const name=extra.employeeName||'Persona ficticia',sem='2026_S2',id=origin==='aguinaldos'?sem:'mov',path='sisventas/'+origin+'/e/'+id;
 const initial=origin==='aguinaldos'?context._pagableNormFecha(source.fecha)||fallbackDate:context._pagableNormFecha(source.fechaPago||source.fechaImputacion)||context._pagableNormFecha(source.fechaTrabajo||source.fecha)||fallbackDate;
 const expense=context._pagableGastoBase({tipoPagable:'aguinaldo',tipo:'Fijo',fecha:initial,monto:origin==='aguinaldos'?source.aguinaldo||source.monto||0:source.monto||0,
  descripcion:origin==='aguinaldos'?'Aguinaldo '+name+' — 2026 — 2do semestre':(source.descripcion||'Aguinaldo')+' — '+name,
  empleadoFbKey:'e',empleadoNombre:name,semestre:origin==='aguinaldos'?sem:source.semestre||'',mejorSueldo:source.mejorSueldo||null,hsExtra:origin==='ctaemp'?source.hsExtra||null:null,origenLegacy:origin,legacyKey:path.slice('sisventas/'.length),ts:source.ts||stamp});
 return copy(origin==='ctaemp'||extra.applyPayments?context._pagableAplicarPagoLegacy(expense,source):expense);
}

test('describe produce clave determinística reversible sin colisiones por normalizar símbolos',()=>{
 const a=Model.describe('sisventas/ctaemp/e-unicodeá/mov_%'),b=Model.describe('sisventas/ctaemp/e-unicodeá/mov__');
 assert.notEqual(a.expenseKey,b.expenseKey);assert.equal(decodeURIComponent(a.expenseKey.slice('sac_legacy_'.length)),a.legacyKey);
 for(const bad of ['sisventas/haberes/e/2026_09','sisventas/aguinaldos/e/2026_S3','sisventas/ctaemp/e/a/b','sisventas/ctaemp/__proto__/a'])assert.throws(()=>Model.describe(bad),{code:Model.CODE});
});

test('una clave de destino larga generada por el modelo admite su propio backlink y replay',()=>{
 const path='sisventas/ctaemp/'+('e'.repeat(150))+'/'+('m'.repeat(150)),source={tipo:'aguinaldo',monto:100};
 const first=Model.plan({...options(source,{sourcePath:path}),gastos:{}});assert.ok(first.expenseKey.length>256);
 const repeat=Model.plan({...options(first.source,{sourcePath:path}),gastos:{[first.expenseKey]:first.expense}});
 assert.equal(repeat.unchanged,true);assert.deepEqual(repeat.patch,{});
});

test('AGU sin pagos reproduce la rama canónica, redondeo, fecha y todos sus campos',()=>{
 for(const source of [{aguinaldo:1234.567,fecha:'01/12/2026',mejorSueldo:2500,ts:100},{monto:'800.32',fecha:'2026-12-03',empleadoNombre:'Anterior'},{monto:100}]) {
  const before=copy(source);assert.deepEqual(Model.build(options(source)),canonical(source));assert.deepEqual(source,before);
 }
});

test('CTA reproduce exactamente pagos completos/parciales/sintéticos, importes y fechas del helper vigente',()=>{
 const cases=[
  {monto:100,fecha:'2026-08-01'},
  {monto:'100.45',fecha:'01/08/2026',fechaImputacion:'2026-09-02',medio:'Efectivo'},
  {monto:100,fecha:'2026-08-01',estado:'pagado',medioPago:'Efectivo',pagadoTs:20},
  {monto:100,fecha:'2026-08-01',montoPagado:25.345,fechaPago:'02/09/2026',pagos:{a:{fecha:'2026-09-02',monto:25.345,anulado:true,nota:'conservar'}},medio:'Tarjeta'},
  {monto:100,fecha:'2026-08-01',pagos:{a:{fecha:'2026-08-03',monto:20},b:{fecha:'04/09/2026',monto:30}},medioPago:'Transferencia'},
  {monto:100,fecha:'2026-08-01',montoPagado:150,pagos:{a:{monto:150,fecha:'2026-09-02'}},medioPago:'Banco'},
  {monto:100,fechaTrabajo:'2026-07-01',fechaImputacion:'2026-10-01',semestre:'2026_S2',hsExtra:3,mejorSueldo:200,ts:5,descripcion:'SAC previo'}
 ];
 for(const source0 of cases){const source={tipo:'aguinaldo',...source0},before=copy(source);assert.deepEqual(Model.build(options(source,{sourcePath:'sisventas/ctaemp/e/mov'})),canonical(source,'ctaemp'));assert.deepEqual(source,before);}
});

test('AGU pagado conserva pagos/estado/fecha/medio e historial, sin convertirlo en deuda',()=>{
 const source={aguinaldo:100,fecha:'2026-07-01',estado:'pagado_parcial',montoPagado:25,pagos:{p:{monto:25,fecha:'2026-08-02',medio:'Banco',referencia:'ficticia'}},medioPago:'Banco',audit:[{accion:'original'}]};
 const result=Model.build(options(source));assert.deepEqual(result,canonical(source,'aguinaldos',{applyPayments:true}));
 assert.equal(result.estado,'pagado_parcial');assert.equal(result.montoPagado,25);assert.equal(result.fecha,'2026-08-02');assert.deepEqual(result.pagos,source.pagos);
 const plan=Model.plan({...options(source),gastos:{}});assert.deepEqual(plan.source.audit,source.audit);assert.deepEqual(plan.source.pagos,source.pagos);
});

test('AGU con estado pagado conserva pago sintético canónico; sin historia no inventa pagos',()=>{
 assert.equal(Model.build(options({monto:100,estado:'pagado',fecha:'2026-07-01'})).pagos.pago_legacy.monto,100);
 assert.equal(Object.hasOwn(Model.build(options({monto:100,fecha:'2026-07-01'})),'pagos'),false);
});

for(const source of [null,{}, {monto:0}, {monto:100,aguinaldo:120},{monto:100,empleadoId:'otro'}, {monto:100,semestre:'2026_S1'}, {monto:100,fecha:'2026-02-30'},{monto:100,pagos:'bad'},{monto:100,pagos:{a:{monto:'bad'}}},{monto:100,anulado:true},{monto:100,estado:'Anulado'}])test('fuente incompleta/contradictoria falla antes de construir un gasto: '+JSON.stringify(source),()=>{
 assert.throws(()=>Model.plan({...options(source),gastos:{}}),{code:Model.CODE});
});

test('CTA sólo acepta tipo aguinaldo y preserva semestre vacío histórico sin inventarlo',()=>{
 assert.throws(()=>Model.build(options({tipo:'hextra',monto:100},{sourcePath:'sisventas/ctaemp/e/mov'})),{code:Model.CODE});
 assert.equal(Model.build(options({tipo:'aguinaldo',monto:100},{sourcePath:'sisventas/ctaemp/e/mov'})).semestre,'');
});

test('plan crea gasto y backlink juntos sin modificar la fuente original ni otros pagos',()=>{
 const source={monto:100,fecha:'2026-07-01',nota:'inalterada'},gastos={previo:{monto:999,pagos:{p:{monto:999}}}},before=copy({source,gastos});
 const result=Model.plan({...options(source),gastos});assert.equal(result.created,true);assert.deepEqual(Object.keys(result.patch).sort(),[sourcePath,'sisventas/gastos/'+result.expenseKey].sort());
 assert.deepEqual(result.source,{...source,gastoFbKey:result.expenseKey,migradoAGastos:true,migradoTs:stamp});assert.deepEqual({source,gastos},before);
});

test('Gastos null comprobado por CAS permite el primer gasto; undefined y shape inválido fallan cerrados',()=>{
 const opts=options({monto:100,fecha:'2026-07-01'});
 assert.equal(Model.plan({...opts,gastos:null}).created,true);
 assert.equal(Model.planBatch({entries:[{sourcePath,source:opts.source,employeeName:opts.employeeName}],gastos:null,fallbackDate,stamp}).createdCount,1);
 for(const gastos of [undefined,false,0,[], 'error'])assert.throws(()=>Model.plan({...opts,gastos}),{code:Model.CODE});
});

test('ya migrado conserva gasto pagado aunque sus pagos hayan evolucionado; replay no cambia nada',()=>{
 const source={monto:100,fecha:'2026-07-01'},first=Model.plan({...options(source),gastos:{}}),paid={...first.expense,estado:'pagado',montoPagado:100,pagos:{p:{monto:100,fecha:'2026-10-01'}},audit:[{accion:'pago posterior'}]};
 const result=Model.plan({...options(first.source,{stamp:stamp+10000}),gastos:{[first.expenseKey]:paid}});
 assert.equal(result.unchanged,true);assert.deepEqual(result.patch,{});assert.deepEqual(result.expense,paid);assert.equal(result.source.migradoTs,stamp);
});

test('gasto existente inequívoco sin marca: sólo vincula la fuente, jamás reescribe gasto/pagos',()=>{
 const source={monto:100,fecha:'2026-07-01'},expense=Model.build(options(source));expense.estado='pagado';expense.montoPagado=100;expense.pagos={p:{monto:100}};
 const result=Model.plan({...options(source),gastos:{random:expense}});assert.equal(result.created,false);assert.deepEqual(Object.keys(result.patch),[sourcePath]);assert.equal(result.source.gastoFbKey,'random');assert.deepEqual(result.expense,expense);
});

for(const mode of ['dangling','wrong-employee','wrong-amount','multiple','same-period-without-link'])test('contradicción de vínculo '+mode+' falla sin recrear/duplicar un gasto',()=>{
 const source={monto:100,fecha:'2026-07-01'},expense=Model.build(options(source)),expenses={};
 if(mode==='dangling')source.gastoFbKey='missing';
 if(mode==='wrong-employee'){source.gastoFbKey='wrong';expenses.wrong={...expense,empleadoId:'otro',empleadoFbKey:'otro'};}
 if(mode==='wrong-amount')expenses.random={...expense,monto:101};
 if(mode==='multiple'){expenses.a=expense;expenses.b=copy(expense);}
 if(mode==='same-period-without-link')expenses.a={...expense,legacyKey:'sac/e/2026_S2'};
 assert.throws(()=>Model.plan({...options(source),gastos:expenses}),{code:Model.CODE});
});

test('batch comparte Gastos, no recorta fuentes y se comprime por origen recién sobre 128 paths',()=>{
 const entries=Array.from({length:130},(_,i)=>({sourcePath:'sisventas/aguinaldos/e'+i+'/2026_S2',source:{monto:100+i},employeeName:'Persona '+i}));
 assert.equal(Model.pathsFor(entries.slice(0,127).map(e=>e.sourcePath)).length,128);
 assert.deepEqual(Model.pathsFor(entries.map(e=>e.sourcePath)),['sisventas/gastos','sisventas/aguinaldos']);
 const result=Model.planBatch({entries,gastos:{},fallbackDate,stamp});assert.equal(result.createdCount,130);assert.equal(Object.keys(result.patch).length,260);
 const roots={'sisventas/aguinaldos':Object.fromEntries(entries.map((entry,i)=>['e'+i,{'2026_S2':entry.source}]))};
 assert.deepEqual(Model.readSource(roots,entries[129].sourcePath),entries[129].source);
 assert.throws(()=>Model.pathsFor([sourcePath,sourcePath]),{code:Model.CODE});assert.throws(()=>Model.readSource({},sourcePath),{code:Model.CODE});
});

test('batch contradictorio se rechaza completo y no muta gastos ni fuentes',()=>{
 const entries=[{sourcePath,source:{monto:100},employeeName:'Persona'},{sourcePath:'sisventas/ctaemp/e/mov',source:{tipo:'aguinaldo',monto:100,semestre:'2026_S2'},employeeName:'Persona'}],before=copy(entries),gastos={};
 assert.throws(()=>Model.planBatch({entries,gastos,fallbackDate,stamp}),{code:Model.CODE});assert.deepEqual(entries,before);assert.deepEqual(gastos,{});
});

function ui(options0={}) {
 let allowed=true,wait;const calls=[],commits=[],values={'sisventas/gastos':{},[sourcePath]:{monto:100,fecha:'2026-07-01'}},events={};
 const c={Date:class extends Date{constructor(...args){super(...(args.length?args:[stamp]));}},currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},_svOperacionesSesionEpoch:1,PERMISOS_ROLES:{admin:{indiceRevision:1}},fbDB:{},location:{hash:'#/configuracion'},empData:{e:{fbKey:'e',nombre:'Persona ficticia'}},tienePermiso:action=>allowed&&action==='mantenimiento.migrar',svCapturarContextoOperacion:()=>()=>allowed,svFechaLocalISO:()=>fallbackDate,SVPayrollLegacySACModel:Model,SVLaborWrites:{atomic:async request=>{calls.push(request);if(options0.hold)await new Promise(resolve=>{wait=resolve;});if(options0.fail)throw Error('Fallo ficticio');const patch=request.build(copy(values));if(!patch)return{committed:false};Object.assign(values,copy(patch));for(const [key,value]of Object.entries(patch))if(key.startsWith('sisventas/gastos/'))values['sisventas/gastos'][key.slice('sisventas/gastos/'.length)]=copy(value);commits.push(patch);return{committed:true};}},document:{addEventListener:(n,f)=>{(events[n]||=[]).push(f);}}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/payroll-legacy-sac.js','utf8'),c);
 return{c,calls,commits,values,revoke(){allowed=false;},release(){wait?.();}};
}
test('cargar módulo no lee ni guarda, acción simple usa atomic con propósito y devuelve creados reales',async()=>{
 const f=ui();assert.equal(f.calls.length,0);const result=await f.c.SVPayrollLegacySAC.migrate(sourcePath);assert.equal(result.created,true);assert.equal(result.committed,true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].purpose,Model.PURPOSE);assert.deepEqual(Array.from(f.calls[0].paths),['sisventas/gastos',sourcePath]);
 const repeat=await f.c.SVPayrollLegacySAC.migrate(sourcePath);assert.equal(repeat.created,false);assert.equal(repeat.committed,true);assert.equal(repeat.unchanged,true);assert.equal(f.commits.length,1);
});
test('batch hace una sola atomic para todas las fuentes y cuenta altas, no intentos',async()=>{
 const f=ui(),paths=Array.from({length:130},(_,i)=>'sisventas/aguinaldos/e'+i+'/2026_S2');
 f.values['sisventas/aguinaldos']=Object.fromEntries(paths.map((_,i)=>['e'+i,{'2026_S2':{monto:100+i}}]));
 const result=await f.c.SVPayrollLegacySAC.migrateMany(paths);assert.equal(result.createdCount,130);assert.equal(f.calls.length,1);assert.equal(f.calls[0].paths.length,2);assert.equal(f.commits.length,1);
});
test('doble clic comparte batch; cambio de sesión/permiso antes del build no guarda',async()=>{
 const f=ui({hold:true}),first=f.c.SVPayrollLegacySAC.migrateMany([sourcePath]),second=f.c.SVPayrollLegacySAC.migrateMany([sourcePath]);
 assert.equal(first,second);await new Promise(setImmediate);assert.equal(f.calls.length,1);f.revoke();f.release();await assert.rejects(first);assert.equal(f.commits.length,0);
});
test('migrateMany captura el alcance al hacer clic aunque el caller mute su array antes de la microtarea',async()=>{
 const f=ui(),paths=[sourcePath],pending=f.c.SVPayrollLegacySAC.migrateMany(paths);paths[0]='sisventas/aguinaldos/otro/2026_S2';paths.push('sisventas/ctaemp/otro/mov');
 const result=await pending;assert.equal(result.createdCount,1);assert.deepEqual(Array.from(f.calls[0].paths),['sisventas/gastos',sourcePath]);
});
test('lectura/adaptador fallido se propaga como error, no como migración vacía ni éxito',async()=>{
 const f=ui({fail:true});await assert.rejects(f.c.SVPayrollLegacySAC.migrate(sourcePath),/Fallo ficticio/);assert.equal(f.commits.length,0);
 const absent=ui();absent.c.SVLaborWrites=null;await assert.rejects(absent.c.SVPayrollLegacySAC.migrate(sourcePath));assert.equal(absent.calls.length,0);
});
test('migración SAC sin permiso o en vista ajena nunca llama el adaptador',async()=>{
 for(const mode of ['permission','role','view']){const f=ui();if(mode==='permission')f.revoke();if(mode==='role')f.c.currentRole='administrativo';if(mode==='view')f.c._impersonacionOriginal={};await assert.rejects(f.c.SVPayrollLegacySAC.migrate(sourcePath));assert.equal(f.calls.length,0);}
});
