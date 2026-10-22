'use strict';
// Opt-in actual gateway/guard/store on one fixed loopback demo namespace.
// Never starts a service, reads ADC, or contacts a production/provider URL.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{createLaborGuard,digest}=require('../cotizador/labor-guard'),{createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const {normalizeRtdb}=require('../cotizador/payment-membership-index');
const Index=require('../cotizador/labor-index'),Permissions=require('../js/core/permission-index'),Sources=require('../js/core/payroll-source-snapshot'),Migration=require('../js/core/payroll-legacy-sac-model'),Builder=require('../scripts/prepare-sac-batch-rules.cjs');
const host='127.0.0.1:9037',base='http://'+host,namespace='demo-sac-batch-runtime-proof',sourceFile=process.env.SV_SAC_RULES_TEST_FILE;
const enabled=process.env.FIREBASE_DATABASE_EMULATOR_HOST===host&&!!sourceFile,opt={skip:!enabled,timeout:30000};let seed,sequence=0;
const copy=value=>structuredClone(value),at=(root,p)=>p.split('/').reduce((node,key)=>node?.[key],root)??null;
function apply(root,patch){for(const [p,value]of Object.entries(patch)){const keys=p.split('/'),last=keys.pop();let node=root;for(const key of keys)node=node[key]||(node[key]={});if(value===null)delete node[last];else node[last]=copy(value);}return root;}
async function request(method,p,value,override){const url=new URL(p+'.json',base);url.searchParams.set('ns',namespace);if(override)url.searchParams.set('auth_variable_override',JSON.stringify(override));assert.equal(url.origin,base);assert.match(namespace,/^demo-/);const response=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(10000)}),text=await response.text();return {status:response.status,value:text?JSON.parse(text):null};}
async function rest(method,p,value){const result=await request(method,p,value);assert.equal(result.status,200,JSON.stringify(result.value));return result.value;}
function fixture(){
 const permissions=Permissions.build({admin:{bloqueados:[],acciones:{gastos:{administrar:true,eliminar:true},empleados:{bonificar:true,registrarHaberes:true,pagarMovimiento:true,aprobarMovimiento:true,gestionarAdelantos:true},comisiones:{crear:true},mantenimiento:{migrar:true}}}}),salary={monto:500,montoPagado:500,estado:'pagado',pagos:{p:{monto:500}}};
 const state={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{admin:{activo:true,rol:'admin',nombre:'Admin ficticio'}},sv_usuarios:{profile:{uid:'admin',rol:'admin',activo:true,nombre:'Admin ficticio'}},sv_permisos:permissions,sisventas:{empleados:{e1:{nombre:'Ana ficticia',activo:true,fechaIngreso:'2020-01-01'},e2:{nombre:'Bea ficticia',activo:true,fechaIngreso:'2020-01-01'}},ctaemp:{e1:{salary:copy(salary)}},gastos:{salary:copy(salary),paidSac:{...copy(salary),tipo:'Fijo',tipoPagable:'aguinaldo',categoria:'Personal',fecha:'2025-12-20',semestre:'2025_S2',empleadoId:'e1',empleadoFbKey:'e1',descripcion:'SAC anterior ficticio'}},haberes:{e1:{'2026_07':{sueldo:1200},'2026_08':{sueldo:1000}},e2:{'2026_09':{sueldo:1800}}},aguinaldos:{e1:{'2024_S2':{monto:300}}},config:{cargos:{unused:{valorHora:10,diasMes:20}}},pagos:{keep:{ventaFbKey:'v',monto:72.34}},comisiones_generacion:{keep:{estado:'completada'}}}};
 state.sisventas.aguinaldos.e1['2024_S2']={monto:300,fecha:'2024-12-01',estado:'pagado',montoPagado:300,fechaPago:'2024-12-20',medioPago:'Efectivo',pagos:{p:{monto:300,fecha:'2024-12-20',medio:'Efectivo'}},ts:1733000000000};
 state.sisventas.ctaemp.e2={legacySac:{tipo:'aguinaldo',monto:450,estado:'pagado_parcial',montoPagado:200,fecha:'2023-12-01',fechaPago:'2023-12-20',semestre:'2023_S2',descripcion:'SAC histórico ficticio',pagos:{p:{monto:200,fecha:'2023-12-20',medio:'Transferencia'}},ts:1701300000000}};
 return apply(state,Index.buildIndex(state.sisventas));
}
function expense(id){return {tipo:'Fijo',tipoPagable:'aguinaldo',categoria:'Personal',estado:'Pendiente',fecha:'2026-10-22',mes:'2026-10',fechaImputacion:'2026-10-22',descripcion:'Aguinaldo '+seed.sisventas.empleados[id].nombre+' — 2do semestre 2026',monto:id==='e1'?600:900,medio:'Transferencia',empleadoId:id,empleadoFbKey:id,empleadoNombre:seed.sisventas.empleados[id].nombre,periodoTrabajo:'',fechaTrabajo:'',aprobadoTs:null,semestre:'2026_S2',mejorSueldo:id==='e1'?1200:1800,hsExtra:null,origenLegacy:'',legacyKey:'sac/'+id+'/2026_S2',migradoDesdeLegacy:false,ts:1792700000000};}
function command(){
 const ids=['e1','e2'],plan=Sources.plan({employeeIds:ids,employees:seed.sisventas.empleados,haberes:seed.sisventas.haberes,year:2026,half:2}),value={},expectedHashes={};
 for(const id of ids)value['sisventas/gastos/aguinaldo_'+id+'_2026_S2']=expense(id);
 for(const p of plan.paths)expectedHashes[p]=digest(at(seed,p));
 return {id:'sac-runtime-transport-'+(++sequence),kind:'atomic',purpose:'employee-sac-batch',path:'',value,expectedHashes};
}
function migrationCommand(paths=['sisventas/aguinaldos/e1/2024_S2','sisventas/ctaemp/e2/legacySac']){
 const entries=paths.map(sourcePath=>({sourcePath,source:at(seed,sourcePath),employeeName:seed.sisventas.empleados[Migration.describe(sourcePath).employeeId].nombre})),plan=Migration.planBatch({entries,gastos:seed.sisventas.gastos,fallbackDate:'2026-10-22',stamp:1792700000000}),expectedHashes={};
 for(const p of Migration.pathsFor(paths))expectedHashes[p]=digest(at(seed,p));
 return {id:'sac-migration-runtime-'+(++sequence),kind:'atomic',purpose:Migration.PURPOSE,path:'',value:plan.patch,expectedHashes};
}
function runtime(hook){
 const commits=[],requests=[],store=createLaborRtdbStore({databaseURL:base+'/?ns='+namespace,accessToken:async()=>'owner',requestMs:10000,fetchImpl:async(url,init)=>{const target=new URL(url);assert.equal(target.origin,base);assert.equal(target.searchParams.get('ns'),namespace);requests.push({method:init.method,path:decodeURIComponent(target.pathname)});if(init.method==='PATCH'){const override=JSON.parse(target.searchParams.get('auth_variable_override'));assert.equal(override.uid,'admin');commits.push({patch:JSON.parse(init.body),action:override.token.svFinancialAction});await hook?.();}return fetch(target,init);}}),guard=createLaborGuard({store}),db={ref:p=>({get:async()=>{const value=await rest('GET','/'+p);return {val:()=>value};}})},gateway=createLaborWriteGateway({auth:{},db,store,guard,enabled:true});
 return {commits,requests,write:body=>gateway.write({uid:'admin',claims:{uid:'admin',name:'Admin ficticio'}},body)};
}
before(async()=>{if(!enabled)return;const input=JSON.parse(fs.readFileSync(sourceFile,'utf8'));assert.equal(Builder.hash(input),Builder.BASELINE_HASH);await rest('PUT','/.settings/rules',Builder.build(input));},{timeout:20000});
beforeEach(async()=>{if(enabled){seed=fixture();await rest('PUT','/',seed);}});
after(async()=>{if(enabled)await rest('DELETE','/');},{timeout:10000});
test('actual source CAS creates SAC in one PATCH with signed registrarHaberes and preserves every old payment/source',opt,async()=>{
 const f=runtime(),b=command();assert.equal((await f.write(b)).committed,true);const saved=await rest('GET','/');assert.equal(f.commits.length,1);assert.equal(f.commits[0].action,'empleados.registrarHaberes');assert.ok(saved.sv_labor_receipts[b.id]);
 for(const [p,v]of Object.entries(b.value))assert.deepEqual(at(saved,p),JSON.parse(JSON.stringify(v),(k,x)=>x===null?undefined:x));
 for(const domain of ['empleados','haberes','config','ctaemp','aguinaldos','pagos','comisiones_generacion'])assert.deepEqual(saved.sisventas[domain],seed.sisventas[domain]);assert.deepEqual(saved.sisventas.gastos.salary,seed.sisventas.gastos.salary);assert.deepEqual(saved.sisventas.gastos.paidSac,seed.sisventas.gastos.paidSac);
 const before=copy(saved);await f.write(b);assert.equal(f.commits.length,1);assert.deepEqual(await rest('GET','/'),before);
});
test('actual current salary ceiling rejects an inflated SAC amount before sending any PATCH',opt,async()=>{
 const b=command();b.value['sisventas/gastos/aguinaldo_e1_2026_S2'].monto=999999;const f=runtime();await assert.rejects(f.write(b),{code:'SV_SAC_BATCH_INVALID'});assert.equal(f.commits.length,0);const saved=await rest('GET','/');assert.deepEqual(saved.sisventas,seed.sisventas);assert.deepEqual(saved.sv_labor_indexes,seed.sv_labor_indexes);assert.equal(saved.sv_labor_receipts,undefined);
});
test('actual SAC allows an explicit manual maximum below the current canonical ceiling',opt,async()=>{
 const b=command();for(const value of Object.values(b.value))value.monto=200;const f=runtime();assert.equal((await f.write(b)).committed,true);assert.equal(f.commits.length,1);const saved=await rest('GET','/');for(const [p,value]of Object.entries(b.value)){assert.equal(at(saved,p).monto,200);assert.equal(at(saved,p).mejorSueldo,value.mejorSueldo);}for(const domain of ['empleados','haberes','config','ctaemp','aguinaldos','pagos','comisiones_generacion'])assert.deepEqual(saved.sisventas[domain],seed.sisventas[domain]);for(const key of ['salary','paidSac'])assert.deepEqual(saved.sisventas.gastos[key],seed.sisventas.gastos[key]);
});
for(const late of ['permission','revision','role','module','reset'])test('actual receipt rejects late '+late+' even though gastos.administrar remains true, without partial records',opt,async()=>{
 const b=command(),f=runtime(async()=>{if(late==='permission')await rest('PUT','/sv_permisos/admin/acciones/empleados/registrarHaberes',false);if(late==='revision')await rest('PUT','/sv_permisos/admin/indiceRevision',999);if(late==='role')await rest('PUT','/sv_chat_roles/admin/rol','administrativo');if(late==='module')await rest('PUT','/sv_permisos/admin/indiceModulos/empleados',false);if(late==='reset')await rest('PUT','/sv_access_resets/admin',{required:true,version:2});});
 await assert.rejects(f.write(b),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});const saved=await rest('GET','/');assert.deepEqual(saved.sisventas,seed.sisventas);assert.deepEqual(saved.sv_labor_indexes,seed.sv_labor_indexes);assert.equal(saved.sv_labor_receipts,undefined);assert.equal(f.commits.length,1);assert.equal(saved.sv_permisos.admin.acciones.gastos.administrar,true);
});
test('revoked registrarHaberes is rejected before sending a business PATCH with alternate grants enabled',opt,async()=>{
 const b=command();await rest('PUT','/sv_permisos/admin/acciones/empleados/registrarHaberes',false);const f=runtime();await assert.rejects(f.write(b),error=>error.statusCode===403);assert.equal(f.commits.length,0);assert.deepEqual((await rest('GET','/')).sisventas,seed.sisventas);
});
test('actual SAC preserves a non-admin internal role with explicitly enabled registrarHaberes',opt,async()=>{
 seed.sv_chat_roles.admin.rol='administrativo';seed.sv_usuarios.profile.rol='administrativo';seed.sv_permisos.administrativo=copy(seed.sv_permisos.admin);await rest('PUT','/',seed);
 const b=command(),f=runtime();assert.equal((await f.write(b)).committed,true);assert.equal(f.commits.length,1);assert.equal(f.commits[0].action,'empleados.registrarHaberes');const saved=await rest('GET','/');for(const [p,value]of Object.entries(b.value))assert.deepEqual(at(saved,p),normalizeRtdb(value));assert.deepEqual(saved.sisventas.ctaemp,seed.sisventas.ctaemp);assert.deepEqual(saved.sisventas.haberes,seed.sisventas.haberes);
});
test('omitting the dedicated purpose cannot create a canonical SAC through a generic guard',opt,async()=>{
 const b=command();delete b.purpose;const f=runtime();await assert.rejects(f.write(b),{code:'SV_SAC_PURPOSE_REQUIRED'});assert.equal(f.commits.length,0);assert.deepEqual((await rest('GET','/')).sisventas,seed.sisventas);
});
test('revoked registrarHaberes cannot be bypassed by retagging an existing ordinary expense as SAC',opt,async()=>{
 seed.sisventas.gastos.ordinary={tipo:'Variable',monto:600,fecha:'2026-10-22',estado:'Pendiente',descripcion:'Gasto corriente ficticio'};seed.sv_permisos.admin.acciones.empleados.registrarHaberes=false;await rest('PUT','/',apply(seed,Index.buildIndex(seed.sisventas)));
 const b={id:'retag-ordinary-as-sac-001',kind:'patch',path:'sisventas/gastos/ordinary',value:{tipoPagable:'aguinaldo',empleadoId:'e1',empleadoFbKey:'e1',semestre:'2026_S2'}},f=runtime();await assert.rejects(f.write(b),{code:'SV_SAC_PURPOSE_REQUIRED'});assert.equal(f.commits.length,0);assert.deepEqual((await rest('GET','/')).sisventas,seed.sisventas);
});
test('source changed before confirmation conflicts before PATCH and keeps paid history intact',opt,async()=>{
 const b=command();await rest('PUT','/sisventas/haberes/e2/2026_09/sueldo',2000);const f=runtime();await assert.rejects(f.write(b),{code:'SV_CAS_CONFLICT'});assert.equal(f.commits.length,0);const saved=await rest('GET','/');assert.deepEqual(saved.sisventas.gastos,seed.sisventas.gastos);assert.deepEqual(saved.sisventas.ctaemp,seed.sisventas.ctaemp);assert.equal(saved.sv_labor_receipts,undefined);
});
test('actual migration commits AGU paid plus CTA partial source links in one PATCH without recreating debt',opt,async()=>{
 const b=migrationCommand(),f=runtime();assert.equal(Object.keys(b.expectedHashes).length,3);assert.equal((await f.write(b)).committed,true);assert.equal(f.commits.length,1);assert.equal(f.commits[0].action,'mantenimiento.migrar');const saved=await rest('GET','/');
 for(const path of ['sisventas/aguinaldos/e1/2024_S2','sisventas/ctaemp/e2/legacySac']){const original=at(seed,path),linked=at(saved,path),descriptor=Migration.describe(path),gasto=saved.sisventas.gastos[linked.gastoFbKey];assert.equal(linked.migradoAGastos,true);assert.equal(linked.gastoFbKey,descriptor.expenseKey);for(const [key,value]of Object.entries(original))assert.deepEqual(linked[key],value);assert.equal(gasto.montoPagado,original.montoPagado);assert.equal(gasto.estado,original.estado);assert.deepEqual(gasto.pagos,original.pagos);}
 for(const key of ['salary','paidSac'])assert.deepEqual(saved.sisventas.gastos[key],seed.sisventas.gastos[key]);for(const domain of ['haberes','pagos','comisiones_generacion','empleados','config'])assert.deepEqual(saved.sisventas[domain],seed.sisventas[domain]);
 const before=copy(saved);await f.write(b);assert.equal(f.commits.length,1);assert.deepEqual(await rest('GET','/'),before);
});
test('actual migration links a unique existing paid Gasto without replacing its payments or notes',opt,async()=>{
 const path='sisventas/aguinaldos/e1/2024_S2',source=at(seed,path),key='existingLegacySac';seed.sisventas.gastos[key]=normalizeRtdb({...Migration.build({sourcePath:path,source,employeeName:seed.sisventas.empleados.e1.nombre,fallbackDate:'2026-10-22',stamp:1792700000000}),notes:'Conservar nota y pago anterior'});source.gastoFbKey=key;await rest('PUT','/',apply(seed,Index.buildIndex(seed.sisventas)));
 const b=migrationCommand([path]),f=runtime();assert.deepEqual(Object.keys(b.value),[path]);assert.equal((await f.write(b)).committed,true);const saved=await rest('GET','/');assert.deepEqual(saved.sisventas.gastos,seed.sisventas.gastos);assert.equal(at(saved,path).gastoFbKey,key);assert.equal(f.commits.length,1);
});
test('a generic write cannot use origenLegacy to bypass the dedicated migration',opt,async()=>{
 const b=migrationCommand();delete b.purpose;const f=runtime();await assert.rejects(f.write(b),{code:'SV_SAC_MIGRATION_REVIEW_REQUIRED'});assert.equal(f.commits.length,0);assert.deepEqual((await rest('GET','/')).sisventas,seed.sisventas);
});
test('actual migration denies changed source CAS before a business PATCH',opt,async()=>{
 const b=migrationCommand();await rest('PUT','/sisventas/ctaemp/e2/legacySac/monto',451);const f=runtime();await assert.rejects(f.write(b),{code:'SV_CAS_CONFLICT'});assert.equal(f.commits.length,0);const saved=await rest('GET','/');assert.deepEqual(saved.sisventas.gastos,seed.sisventas.gastos);assert.deepEqual(saved.sisventas.aguinaldos,seed.sisventas.aguinaldos);
});
test('actual migration rejects revoked mantenimiento.migrar before PATCH despite other admin grants',opt,async()=>{
 const b=migrationCommand();await rest('PUT','/sv_permisos/admin/acciones/mantenimiento/migrar',false);const f=runtime();await assert.rejects(f.write(b),error=>error.statusCode===403);assert.equal(f.commits.length,0);assert.deepEqual((await rest('GET','/')).sisventas,seed.sisventas);
});
test('actual migration stays admin-only even when another internal role has migrar explicitly enabled',opt,async()=>{
 seed.sv_chat_roles.admin.rol='administrativo';seed.sv_usuarios.profile.rol='administrativo';seed.sv_permisos.administrativo=copy(seed.sv_permisos.admin);await rest('PUT','/',seed);
 const b=migrationCommand(),f=runtime();await assert.rejects(f.write(b),error=>error.statusCode===403);assert.equal(f.commits.length,0);assert.deepEqual((await rest('GET','/')).sisventas,seed.sisventas);
});
test('actual migration receipt rejects final revocation without partial Gasto or source links',opt,async()=>{
 const b=migrationCommand(),f=runtime(async()=>rest('PUT','/sv_permisos/admin/acciones/mantenimiento/migrar',false));await assert.rejects(f.write(b),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});const saved=await rest('GET','/');assert.deepEqual(saved.sisventas,seed.sisventas);assert.equal(saved.sv_labor_receipts,undefined);assert.equal(f.commits.length,1);assert.equal(saved.sv_permisos.admin.acciones.gastos.administrar,true);
});
// These cases deliberately isolate the real RTDB receipt from the gateway.
// They prove final same-PATCH authorization, not the SAC business validator.
for(const action of ['empleados.registrarHaberes','mantenimiento.migrar'])for(const change of ['none','permission','revision','role','module','reset'])test('raw rules '+action+' final atomic receipt after '+change,opt,async()=>{
 const migration=action==='mantenimiento.migrar',now=Date.now(),opId='sac-raw-rules-'+(++sequence),fence='sac-raw-fence-'+sequence,hash='b'.repeat(64),lease={opId,fence,digest:hash,actorUid:'admin',mode:'user',expiresAt:now+30000};
 await rest('PUT','/sv_labor_guard',lease);
 const claim={uid:'admin',token:{svLaborService:true,mode:'commit',opId,fence,digest:hash,actorUid:'admin',svFinancialAction:action,svFinancialActorRole:'admin',svFinancialPermissionRevision:seed.sv_permisos.admin.indiceRevision}},gasto=expense('e1'),business={'sisventas/gastos/rawSac':gasto};
 if(migration){gasto.semestre='2024_S2';gasto.monto=300;gasto.legacyKey='aguinaldos/e1/2024_S2';gasto.origenLegacy='aguinaldos';gasto.migradoDesdeLegacy=true;business['sisventas/aguinaldos/e1/2024_S2']={...seed.sisventas.aguinaldos.e1['2024_S2'],gastoFbKey:'rawSac',migradoAGastos:true,migradoTs:now};}
 if(change==='permission')await rest('PUT',migration?'/sv_permisos/admin/acciones/mantenimiento/migrar':'/sv_permisos/admin/acciones/empleados/registrarHaberes',false);
 if(change==='revision')await rest('PUT','/sv_permisos/admin/indiceRevision',999);
 if(change==='role')await rest('PUT','/sv_chat_roles/admin/rol','administrativo');
 if(change==='module')await rest('PUT','/sv_permisos/admin/indiceModulos/'+(migration?'configuracion':'empleados'),false);
 if(change==='reset')await rest('PUT','/sv_access_resets/admin',{required:true,version:2});
 const patch={...business,['sv_labor_receipts/'+opId]:{fence,digest:hash,actorUid:'admin',result:{ok:true,committed:true},confirmedAt:now},sv_labor_guard:null},response=await request('PATCH','/',patch,claim),saved=await rest('GET','/');
 assert.equal(saved.sv_permisos.admin.acciones.gastos.administrar,true);
 if(change==='none'){
  assert.equal(response.status,200,JSON.stringify(response.value));assert.ok(saved.sv_labor_receipts[opId]);assert.equal(saved.sv_labor_guard,undefined);
  for(const [p,value]of Object.entries(business))assert.deepEqual(at(saved,p),JSON.parse(JSON.stringify(value),(k,x)=>x===null?undefined:x));
  for(const key of ['salary','paidSac'])assert.deepEqual(saved.sisventas.gastos[key],seed.sisventas.gastos[key]);
 }else{
  assert.ok([401,403].includes(response.status),JSON.stringify(response));assert.deepEqual(saved.sisventas,seed.sisventas);assert.equal(saved.sv_labor_receipts,undefined);assert.deepEqual(saved.sv_labor_guard,lease);assert.deepEqual(saved.sv_labor_indexes,seed.sv_labor_indexes);
 }
});
