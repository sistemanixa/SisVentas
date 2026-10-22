'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createBackend,copy,apply}=require('./helpers/labor-ui-flow.cjs');
const {digest}=require('../cotizador/labor-guard'),Policy=require('../cotizador/labor-sac-batch'),Legacy=require('../cotizador/payroll-legacy-sac-model'),Sources=require('../js/core/payroll-source-snapshot'),Permissions=require('../js/core/permission-index');
const actor={uid:'u',claims:{uid:'u',name:'Admin ficticio'}};
function fixture(n=2){const empleados={},haberes={};for(let i=0;i<n;i++){const id='e'+i;empleados[id]={nombre:'Persona ficticia '+i,activo:true,fechaIngreso:'2020-01-01',cargoId:'c'};haberes[id]={'2026_07':{sueldo:1000+i,pagos:{keep:{monto:50}}}};}return createBackend({empleados,haberes,config:{maxComisionPct:10,cargos:{c:{valorHora:10,diasMes:20}}},gastos:{paid:{tipoPagable:'aguinaldo',monto:90,montoPagado:90,estado:'pagado',pagos:{p:{monto:90}},semestre:'2025_S2',empleadoId:'e0'}}});}
function command(f,{id='sac-batch-transport-001',n=Object.keys(f.state.sisventas.empleados).length,duplicate=false}={}){
 const ids=Object.keys(f.state.sisventas.empleados).slice(0,n),plan=Sources.plan({employeeIds:ids,employees:f.state.sisventas.empleados,haberes:f.state.sisventas.haberes,year:2026,half:2}),page=f.page(),value={},expectedHashes={};
 for(const [index,employee]of ids.entries()){const row=f.get('sisventas/empleados/'+employee),key=page.context._claveOperacionConcurrente('aguinaldo',duplicate?[employee,'2026_S2','operation_001']:[employee,'2026_S2']);value['sisventas/gastos/'+key]=copy(page.context._pagableGastoBase({fecha:'2026-10-22',tipo:'Fijo',tipoPagable:'aguinaldo',descripcion:'Aguinaldo '+row.nombre+' — 2do semestre 2026',monto:(1000+index)/2,medio:'Transferencia',empleadoFbKey:employee,empleadoNombre:row.nombre,semestre:'2026_S2',mejorSueldo:1000+index,legacyKey:'sac/'+employee+'/2026_S2',ts:1792700000000+index}));}
 for(const path of plan.paths)expectedHashes[path]=digest(f.get(path));
 return {id,kind:'atomic',path:'',purpose:Policy.PURPOSE,value,expectedHashes};
}
const write=(f,body)=>f.gateway.write(actor,body);
const noWrite=(f,before)=>{assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,before);assert.equal(f.state.sv_labor_guard??null,null);};
function permissions(f,options){f.state.sv_permisos=Permissions.build({admin:{bloqueados:[],acciones:{gastos:{administrar:true},empleados:{registrarHaberes:true},mantenimiento:{migrar:true}},...options}});}
function migration(f,paths,{id='sac-migration-transport-001',stamp=1792700000000}={}){
 const sources=Legacy.pathsFor(paths),entries=paths.map(sourcePath=>({sourcePath,source:f.get(sourcePath),employeeName:f.get('sisventas/empleados/'+sourcePath.split('/')[2])?.nombre||''})),plan=Legacy.planBatch({entries,gastos:f.get('sisventas/gastos')||{},fallbackDate:'2026-10-22',stamp});
 return {id,kind:'atomic',path:'',purpose:Legacy.PURPOSE,value:plan.patch,expectedHashes:Object.fromEntries(sources.map(p=>[p,digest(f.get(p))]))};
}

test('SAC backend ships the byte-identical legacy model and its complete Docker closure',()=>{assert.equal(fs.readFileSync(require.resolve('../cotizador/payroll-legacy-sac-model'),'utf8'),fs.readFileSync(require.resolve('../js/core/payroll-legacy-sac-model'),'utf8'));assert.match(fs.readFileSync(require.resolve('../cotizador/Dockerfile'),'utf8'),/COPY labor-sac-batch\.js payroll-legacy-sac-model\.js \./);});
test('new SAC is one protected batch with current sources and no changes to any previous payment',async()=>{
 const f=fixture(),before=copy(f.state.sisventas),b=command(f);Policy.describe(b);assert.equal((await write(f,b)).committed,true);assert.equal(f.commits.length,1);for(const [p,v]of Object.entries(b.value))assert.deepEqual(f.get(p),v);
 for(const domain of ['empleados','haberes','config','ctaemp'])assert.deepEqual(f.state.sisventas[domain],before[domain]);assert.deepEqual(f.state.sisventas.gastos.paid,before.gastos.paid);assert.equal(f.get('sv_labor_receipts/'+b.id).result.committed,true);
 const after=copy(f.state);await write(f,b);assert.deepEqual(f.state,after);assert.equal(f.commits.length,1);
});
test('large source fallback retains all selected employees and one business PATCH',async()=>{const f=fixture(135),b=command(f);assert.ok(Object.keys(b.expectedHashes).length<=128);await write(f,b);assert.equal(f.commits.length,1);assert.equal(Object.values(f.state.sisventas.gastos).filter(g=>g.semestre==='2026_S2').length,135);});
for(const mode of ['inflated-amount','wrong-best','short-employment','fallback-inflated','string-best-type'])test('SAC source ceiling rejects '+mode+' although all CAS hashes are current',async()=>{const f=fixture(1);if(mode==='short-employment')f.state.sisventas.empleados.e0.fechaIngreso='2026-11-01';if(mode==='fallback-inflated')f.state.sisventas.haberes.e0={};if(mode==='string-best-type')f.state.sisventas.haberes.e0['2026_07'].sueldo='1000';const b=command(f),v=Object.values(b.value)[0];if(mode==='inflated-amount')v.monto=999999;if(mode==='wrong-best')v.mejorSueldo=999999;if(mode==='fallback-inflated'){b.expectedHashes['sisventas/config/cargos/c']=digest(f.get('sisventas/config/cargos/c'));v.mejorSueldo=1600;v.monto=801;}const before=copy(f.state.sisventas);await assert.rejects(write(f,b),{code:'SV_SAC_BATCH_INVALID'});noWrite(f,before);});
for(const mode of ['manual-maximum','partial-months','fallback','legacy-string'])test('SAC ceiling preserves canonical '+mode+' without new reads or changing histories',async()=>{const f=fixture(1);if(mode==='partial-months')f.state.sisventas.empleados.e0.fechaIngreso='2026-11-30';if(mode==='fallback')f.state.sisventas.haberes.e0={};if(mode==='legacy-string')f.state.sisventas.haberes.e0['2026_07'].sueldo='1000';const b=command(f),v=Object.values(b.value)[0];if(mode==='manual-maximum')v.monto=123.45;if(mode==='partial-months')v.monto=166.67;if(mode==='fallback'){b.expectedHashes['sisventas/config/cargos/c']=digest(f.get('sisventas/config/cargos/c'));v.mejorSueldo=1600;v.monto=800;}if(mode==='legacy-string')v.mejorSueldo='1000';await write(f,b);assert.equal(f.commits.length,1);assert.deepEqual(f.get(Object.keys(b.value)[0]),v);assert.ok(!f.reads.some(([kind,p])=>kind==='server'&&p.startsWith('sisventas/haberes/')));});
for(const mode of ['purpose','gastos-source','employee-source','salary-source','extra-source','child-target','paid-new','wrong-name','wrong-employee','wrong-key','different-date','different-semester','history','extra-write','negative','fraction-cent','invalid-day','fallback-source','existing-target'])test('new SAC rejects '+mode+' before any commit',async()=>{
 const f=fixture(),b=command(f),paths=Object.keys(b.value),first=paths[0],value=b.value[first];
 if(mode==='purpose')delete b.purpose;
 if(mode==='gastos-source')delete b.expectedHashes['sisventas/gastos'];
 if(mode==='employee-source')delete b.expectedHashes['sisventas/empleados/e0'];
 if(mode==='salary-source')delete b.expectedHashes['sisventas/haberes/e0'];
 if(mode==='extra-source')b.expectedHashes['sisventas/ventas/v']=digest(f.get('sisventas/ventas/v'));
 if(mode==='child-target'){delete b.value[first];b.value[first+'/monto']=50;}
 if(mode==='paid-new')value.estado='pagado';
 if(mode==='wrong-name')value.empleadoNombre='Otro';
 if(mode==='wrong-employee')value.empleadoId='e1';
 if(mode==='wrong-key'){b.value[first+'_other']=value;delete b.value[first];}
 if(mode==='different-date')b.value[paths[1]].fecha='2026-10-23';
 if(mode==='different-semester')b.value[paths[1]].semestre='2026_S1';
 if(mode==='history')value.pagos={p:{monto:20}};
 if(mode==='extra-write')b.value['sisventas/empleados/e0/nota']='extra';
 if(mode==='negative')value.monto=-1;
 if(mode==='fraction-cent')value.monto=1.001;
 if(mode==='invalid-day')value.fecha='2026-02-31';
 if(mode==='fallback-source'){f.state.sisventas.haberes.e0={};b.expectedHashes['sisventas/haberes/e0']=digest({});}
 if(mode==='existing-target'){apply(f.state,{[first]:value});b.expectedHashes['sisventas/gastos']=digest(f.get('sisventas/gastos'));}
 const before=copy(f.state.sisventas);await assert.rejects(write(f,b));noWrite(f,before);
});
for(const mode of ['permission','revision','role','inactive','module'])test('fresh '+mode+' is revalidated after sources, even with another administrator grant',async()=>{
 const f=fixture();permissions(f);const b=command(f),before=copy(f.state.sisventas),read=f.store.readAsUser;let changed=false;
 f.store.readAsUser=async(path,a)=>{const value=await read(path,a);if(!changed&&path.startsWith('sisventas/haberes/')){changed=true;if(mode==='permission')f.state.sv_permisos.admin.acciones.empleados.registrarHaberes=false;if(mode==='revision')f.state.sv_permisos.admin.indiceRevision++;if(mode==='role')f.state.sv_chat_roles.u.rol='administrativo';if(mode==='inactive')f.state.sv_chat_roles.u.activo=false;if(mode==='module')f.state.sv_permisos.admin.indiceModulos.empleados=false;}return value;};
 await assert.rejects(write(f,b));noWrite(f,before);assert.equal(f.state.sv_permisos.admin.acciones.gastos.administrar,true);
});
test('an explicitly enabled internal role may register SAC, but a distributor and mismatched claim never do',async()=>{
 const f=fixture(1);f.state.sv_chat_roles.u.rol='administrativo';f.state.sv_permisos=Permissions.build({administrativo:{bloqueados:[],acciones:{empleados:{registrarHaberes:true},gastos:{administrar:true}}}});await write(f,command(f));assert.equal(f.commits.length,1);
 for(const variant of ['distributor','claim']){const g=fixture(1),b=command(g);if(variant==='distributor')g.state.sv_chat_roles.u.rol='distribuidor';await assert.rejects(g.gateway.write(variant==='claim'?{uid:'u',claims:{uid:'other'}}:actor,b),{statusCode:403});assert.equal(g.commits.length,0);}
});
test('denying one source read rejects the entire batch before any financial write',async()=>{const f=fixture(),b=command(f),read=f.store.readAsUser,before=copy(f.state.sisventas);f.store.readAsUser=async(p,a)=>{if(p==='sisventas/haberes/e1')throw Object.assign(Error('denied'),{statusCode:403});return read(p,a);};await assert.rejects(write(f,b),{statusCode:403});noWrite(f,before);});
test('regular payment and history edits of an existing SAC retain their previous guard contracts',async()=>{const f=fixture(1),b=command(f);await write(f,b);const p=Object.keys(b.value)[0];await write(f,{id:'sac-payment-history-001',kind:'patch',path:'',value:{[p+'/montoPagado']:10,[p+'/estado']:'pagado_parcial',[p+'/pagos/p']:{monto:10}}});assert.equal(f.get(p).montoPagado,10);assert.equal(f.get(p).mejorSueldo,1000);await write(f,{id:'sac-history-note-001',kind:'patch',path:p,value:{nota:'Historia conservada'}});assert.equal(f.get(p).nota,'Historia conservada');});
for(const kind of ['set','patch','atomic-parent'])test('ordinary expense cannot be retagged as SAC through generic '+kind,async()=>{const f=fixture(1),b=command(f),p=Object.keys(b.value)[0],value=b.value[p];apply(f.state,{[p]:{tipo:'Variable',monto:20,descripcion:'Gasto común'}});permissions(f);f.state.sv_permisos.admin.acciones.empleados.registrarHaberes=false;const before=copy(f.state.sisventas),body=kind==='atomic-parent'?{id:'generic-expense-retag-001',kind:'atomic',path:'',value:{'sisventas/gastos':{...f.get('sisventas/gastos'),[p.split('/')[2]]:value}},expectedHashes:{'sisventas/gastos':digest(f.get('sisventas/gastos'))}}:{id:'generic-expense-retag-001',kind,path:p,value};await assert.rejects(write(f,body),{code:'SV_SAC_PURPOSE_REQUIRED'});noWrite(f,before);});

test('legacy paid CTA and paid AGU migrate together with exact payments and source links in one PATCH',async()=>{
 const f=fixture();apply(f.state,{'sisventas/ctaemp/e0/legacy':{tipo:'aguinaldo',monto:123.45,semestre:'2024_S2',fecha:'2024-12-22',estado:'pagado_parcial',montoPagado:23.45,pagos:{p:{monto:23.45,fecha:'2024-12-23',comprobante:'Ficticio'}}},'sisventas/aguinaldos/e1/2023_S2':{monto:99,fecha:'2023-12-22',estado:'pagado',pagos:{p:{monto:99,fecha:'2023-12-22'}}}});
 const paths=['sisventas/ctaemp/e0/legacy','sisventas/aguinaldos/e1/2023_S2'],b=migration(f,paths),before=copy(f.state.sisventas);await write(f,b);assert.equal(f.commits.length,1);for(const p of paths){const record=f.get(p),expense=f.get('sisventas/gastos/'+record.gastoFbKey);assert.deepEqual(expense.pagos,f.get(p).pagos);assert.equal(expense.montoPagado,p.includes('ctaemp')?23.45:99);for(const [key,v]of Object.entries(before[p.split('/')[1]][p.split('/')[2]][p.split('/')[3]]))assert.deepEqual(record[key],v);}
 const second=migration(f,paths,{id:'sac-migration-noop-002'});assert.deepEqual(second.value,{});assert.deepEqual(f.state.sisventas.haberes,before.haberes);
});
test('source-only backlink recovery leaves an existing, later paid expense byte-identical',async()=>{
 const f=fixture(1),path='sisventas/aguinaldos/e0/2024_S2',source={monto:100,fecha:'2024-12-20'};apply(f.state,{[path]:source});const first=migration(f,[path]),expensePath=Object.keys(first.value).find(p=>p.includes('/gastos/')),paid={...first.value[expensePath],estado:'pagado',montoPagado:100,pagos:{p:{monto:100}},adjuntos:{keep:'PDF'}};apply(f.state,{[expensePath]:paid});const b=migration(f,[path]);assert.deepEqual(Object.keys(b.value),[path]);await write(f,b);assert.deepEqual(f.get(expensePath),paid);assert.equal(f.get(path).gastoFbKey,expensePath.split('/').at(-1));
});
test('128 historical sources use only Gastos and origin parents without splitting or repeated root GETs',async()=>{
 const f=fixture(128),paths=[];for(let i=0;i<128;i++){const p='sisventas/aguinaldos/e'+i+'/2024_S2';paths.push(p);apply(f.state,{[p]:{monto:100+i,fecha:'2024-12-20'}});}const b=migration(f,paths);assert.deepEqual(Object.keys(b.expectedHashes),['sisventas/gastos','sisventas/aguinaldos']);await write(f,b);assert.equal(f.commits.length,1);assert.equal(f.reads.filter(([kind,p])=>kind==='user'&&p==='sisventas/gastos').length,1);assert.ok(!f.reads.some(([kind,p])=>kind==='server'&&p.startsWith('sisventas/gastos/')));assert.equal(Object.values(f.state.sisventas.gastos).filter(g=>g.origenLegacy==='aguinaldos').length,128);
});
for(const mode of ['missing-source','wrong-amount','erase-payment','wrong-source','missing-link','extra-source-field','wrong-grant','extra-expense'])test('migration rejects '+mode+' without partial data or false history',async()=>{
 const f=fixture(1),p='sisventas/ctaemp/e0/legacy';apply(f.state,{[p]:{tipo:'aguinaldo',monto:100,fecha:'2024-12-20',estado:'pagado',pagos:{p:{monto:100,fecha:'2024-12-20'}},semestre:'2024_S2'}});const b=migration(f,[p]),expensePath=Object.keys(b.value).find(p=>p.includes('/gastos/'));
 if(mode==='missing-source')delete b.expectedHashes[p];if(mode==='wrong-amount')b.value[expensePath].monto=99;if(mode==='erase-payment')delete b.value[expensePath].pagos;if(mode==='wrong-source')b.value[p].monto=99;if(mode==='missing-link')delete b.value[p];if(mode==='extra-source-field')b.value[p].nota='inventada';if(mode==='wrong-grant'){permissions(f);f.state.sv_permisos.admin.acciones.mantenimiento.migrar=false;}if(mode==='extra-expense')b.value['sisventas/gastos/extra']=b.value[expensePath];const before=copy(f.state.sisventas);await assert.rejects(write(f,b));noWrite(f,before);
});
for(const variant of ['AGU-leaf','AGU-parent','CTA-leaf','CTA-retag','CTA-parent'])test('generic '+variant+' cannot manufacture a historical SAC source',async()=>{
 const f=fixture(1),before=copy(f.state.sisventas);let path=variant.startsWith('AGU')?'sisventas/aguinaldos/e0/2024_S2':'sisventas/ctaemp/e0/new',value=variant.startsWith('AGU')?{monto:100}:{tipo:'aguinaldo',monto:100};if(variant==='CTA-retag'){apply(f.state,{[path]:{tipo:'otro',monto:100}});apply(before,{[path.slice('sisventas/'.length)]:{tipo:'otro',monto:100}});}if(variant.endsWith('parent')){path=path.split('/').slice(0,3).join('/');value=variant.startsWith('AGU')?{'2024_S2':value}:{new:value};}
 await assert.rejects(write(f,{id:'generic-source-bypass-001',kind:'set',path,value}),{code:'SV_SAC_MIGRATION_REVIEW_REQUIRED'});noWrite(f,before);
});
test('payment/history changes and deletion of actual historical sources remain possible',async()=>{const f=fixture(1),p='sisventas/ctaemp/e0/legacy';apply(f.state,{[p]:{tipo:'aguinaldo',monto:100}});await write(f,{id:'legacy-source-payment-001',kind:'patch',path:p,value:{estado:'pagado',montoPagado:100,pagos:{p:{monto:100}}}});assert.equal(f.get(p).montoPagado,100);await write(f,{id:'legacy-source-delete-001',kind:'set',path:p,value:null});assert.equal(f.get(p),null);});

test('authorized ancestor data is reused only within its attempt and staged overlays stay isolated',async()=>{
 const f=fixture(1),saved=f.get('sisventas/gastos');await f.guard.run({...actor,mode:'user',opId:'ancestor-snapshot-attempt-001'},async scope=>{assert.deepEqual(await scope.getAsUser('sisventas/gastos'),saved);assert.equal((await scope.get('sisventas/gastos/paid')).monto,90);await scope.update({'sisventas/gastos/paid/nota':'staged'});assert.equal((await scope.get('sisventas/gastos/paid')).nota,'staged');assert.equal((await scope.getAsUser('sisventas/gastos')).paid.nota,'staged');});
 assert.equal(f.reads.filter(([kind,p])=>kind==='server'&&p==='sisventas/gastos/paid').length,0);const before=f.reads.length;await f.guard.run({...actor,mode:'user',opId:'ancestor-snapshot-attempt-002'},async scope=>{await scope.get('sisventas/gastos/paid');});assert.ok(f.reads.slice(before).some(([kind,p])=>kind==='server'&&p==='sisventas/gastos/paid'));
});
test('a denied ancestor never supplies a child and a changed authorized ancestor conflicts with an earlier raw child',async()=>{
 const f=fixture(1),read=f.store.readAsUser;f.store.readAsUser=async()=>{throw Object.assign(Error('denied'),{statusCode:403});};await assert.rejects(f.guard.run({...actor,mode:'user',opId:'denied-ancestor-attempt-001'},scope=>scope.getAsUser('sisventas/gastos')),{statusCode:403});assert.equal(f.commits.length,0);
 f.store.readAsUser=read;await assert.rejects(f.guard.run({...actor,mode:'user',opId:'changed-ancestor-attempt-001'},async scope=>{await scope.get('sisventas/gastos/paid');apply(f.state,{'sisventas/gastos/paid/monto':91});await scope.getAsUser('sisventas/gastos');}),{code:'SV_CAS_CONFLICT'});assert.equal(f.commits.length,0);
});
test('reusing an authorized parent never skips an explicit child authorization or its new-version comparison',async()=>{
 const f=fixture(1);await assert.rejects(f.guard.run({...actor,mode:'user',opId:'child-authorization-attempt-001'},async scope=>{await scope.getAsUser('sisventas/gastos');assert.equal(await scope.get('sisventas/gastos/missing'),null);apply(f.state,{'sisventas/gastos/paid/monto':91});await scope.getAsUser('sisventas/gastos/paid');}),{code:'SV_CAS_CONFLICT'});assert.ok(f.reads.some(([kind,p])=>kind==='user'&&p==='sisventas/gastos/paid'));assert.equal(f.commits.length,0);
});
