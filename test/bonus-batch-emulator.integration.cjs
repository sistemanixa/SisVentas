'use strict';
// Opt-in RTDB rule proof only. One demo namespace on fixed loopback; no ADC,
// SDK, gateway, guard, provider or production requests. Does not start a service.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Builder=require('../scripts/prepare-bonus-batch-rules.cjs'),Permissions=require('../js/core/permission-index'),Model=require('../js/core/bonus-quantity-model');
const host='127.0.0.1:9037',base='http://'+host,namespace='demo-bonus-batch-rules-proof';
const sourceFile=process.env.SV_BONUS_BATCH_RULES_TEST_FILE||process.env.SV_RULES_TEST_FILE;
const enabled=process.env.FIREBASE_DATABASE_EMULATOR_HOST===host&&!!sourceFile,opt={skip:!enabled,timeout:30000};
const modelPath=path.join(__dirname,'../js/core/bonus-quantity-model.js'),MODEL_HASH='e2c0661c573a4b2c5b57df5a78e4f35029422158a5bcd391a1ea82e943346980';
const CANDIDATE_HASH='a4b9a66f6ae6f272683bfcbf9c4cd6245436aa3f6bdc9e96de4aa098722ca4ad';
const clone=value=>structuredClone(value),sha=text=>crypto.createHash('sha256').update(text).digest('hex');
let baseline,candidate,sequence=0;const evidence=[];
async function request(method,pathname,value,override){
 const url=new URL(pathname+'.json',base);url.searchParams.set('ns',namespace);
 if(override)url.searchParams.set('auth_variable_override',JSON.stringify(override));
 assert.equal(url.origin,base);assert.equal(url.hostname,'127.0.0.1');assert.match(namespace,/^demo-/);
 const response=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(10000)});
 const text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch{body=text;}
 return {status:response.status,body};
}
async function owner(method,p,value){const result=await request(method,p,value);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;}
function seed(){
 const actions={gastos:{administrar:true,eliminar:true},empleados:{bonificar:true,registrarHaberes:true,gestionarAdelantos:true,pagarMovimiento:true,aprobarMovimiento:true},comisiones:{crear:true}};
 const permissions=Permissions.build({admin:{indiceRevision:4,bloqueados:[],acciones:clone(actions)},administrativo:{indiceRevision:4,bloqueados:[],acciones:clone(actions)}});
 const paid={descripcion:'Haber anterior ficticio',monto:500,montoPagado:500,estado:'pagado',pagos:{p:{monto:500,fecha:'2026-10-01',medio:'Transferencia'}}};
 return {sv_labor_config:{schema:1,ready:true},sv_chat_roles:{admin:{activo:true,rol:'admin',nombre:'Admin ficticio'}},sv_usuarios:{profile:{uid:'admin',activo:true,rol:'admin',nombre:'Admin ficticio'}},sv_permisos:permissions,
  sv_labor_indexes:{sentinel:{untouched:true}},sisventas:{empleados:{e1:{nombre:'Ana ficticia',activo:true},e2:{nombre:'Bea ficticia',activo:true}},gastos:{salary:clone(paid)},ctaemp:{e1:{salary:clone(paid)},e2:{salary:clone(paid)}},haberes:{e1:{'2026_10':{sueldo:500,total:500}},e2:{'2026_10':{sueldo:500,total:500}}},pagos:{keep:{ventaFbKey:'sale',monto:72.34}},comisiones_generacion:{keep:{estado:'completada'}},config:{bonificaciones:{model:{nombre:'Trabajo ficticio',montoSugerido:100.2}}}}};
}
function businessPatch(){
 const group='bonus-batch-emulator-group',plan=Model.plan({empleados:[{empleadoId:'e1',cantidad:'2.5'},{empleadoId:'e2',cantidad:'1.25'}],valorUnitario:'100.20'}),patch={};
 for(const item of plan.items){
  const employee=item.empleadoId,movementKey=Model.operationKey('bonificacion',[employee,group]),expenseKey=Model.operationKey('gasto_bonificacion',[employee,group]),legacy='ctaemp/'+employee+'/'+movementKey;
  const shared={...Model.metadata(item,group,plan),empleadoId:employee,empleadoFbKey:employee,empleadoNombre:employee==='e1'?'Ana ficticia':'Bea ficticia',monto:item.monto,montoPagado:0,fecha:'2026-10-22',periodoComputo:'2026-11',descripcion:'Bonificación · Trabajo ficticio',motivo:'Trabajo ficticio',bonificacionConceptoId:'model',bonificacionConceptoNombre:'Trabajo ficticio',estado:'aprobado',legacyKey:legacy,operacionId:group,ts:1792681200000};
  patch['sisventas/ctaemp/'+employee+'/'+movementKey]={...shared,tipo:'bonificacion',fbKey:movementKey,gastoFbKey:expenseKey};
  patch['sisventas/gastos/'+expenseKey]={...shared,tipo:'Variable',tipoPagable:'bonificacion',origen:'bonificacion',requiereAprobacion:false,movimientoCtaKey:movementKey};
 }
 return patch;
}
async function fixture(variant,action='empleados.bonificar'){
 await owner('PUT','/.settings/rules',variant==='baseline'?baseline:candidate);
 await owner('PUT','/',seed());const initial=await owner('GET','/'),now=Date.now(),opId='bonus-rules-operation-'+(++sequence),fence='bonus-rules-fence-'+sequence,digest='a'.repeat(64);
 const lease={opId,fence,digest,actorUid:'admin',mode:'user',expiresAt:now+30000};
 const token={svLaborService:true,mode:'commit',opId,fence,digest,actorUid:'admin',svFinancialAction:action,svFinancialActorRole:'admin',svFinancialPermissionRevision:initial.sv_permisos.admin.indiceRevision};
 const acquisition=await request('PUT','/sv_labor_guard',lease,{uid:'sv-labor-service',token:{...token,mode:'acquire'}});assert.equal(acquisition.status,200,JSON.stringify(acquisition.body));
 const business=businessPatch(),receipt={fence,digest,actorUid:'admin',result:{ok:true,committed:true},confirmedAt:now};
 const patch={...business,['sv_labor_receipts/'+opId]:receipt,sv_labor_guard:null};
 return {variant,initial,lease,token,business,patch,override:{uid:'admin',token}};
}
function denied(result){assert.ok([401,403].includes(result.status),'Expected rule denial, got '+result.status+' '+JSON.stringify(result.body));}
async function assertCommitted(f,business=f.business){
 const saved=await owner('GET','/');
 for(const [p,value]of Object.entries(business)){let actual=saved;for(const key of p.split('/'))actual=actual[key];assert.deepEqual(actual,value,p);}
 assert.equal(saved.sv_labor_guard,undefined);assert.deepEqual(Object.keys(saved.sv_labor_receipts),[f.lease.opId]);
 for(const branch of ['haberes','pagos','config','comisiones_generacion','empleados'])assert.deepEqual(saved.sisventas[branch],f.initial.sisventas[branch],branch);
 assert.deepEqual(saved.sisventas.gastos.salary,f.initial.sisventas.gastos.salary);
 for(const employee of ['e1','e2'])assert.deepEqual(saved.sisventas.ctaemp[employee].salary,f.initial.sisventas.ctaemp[employee].salary);
 assert.deepEqual(saved.sv_labor_indexes,f.initial.sv_labor_indexes);return saved;
}
async function assertRejected(f){
 const saved=await owner('GET','/');assert.deepEqual(saved.sisventas,f.initial.sisventas,'No partial ledger/employee/salary/payment changes');assert.deepEqual(saved.sv_labor_indexes,f.initial.sv_labor_indexes);assert.equal(saved.sv_labor_receipts,undefined);
 // A rejected multipath PATCH did not release its lease either.
 assert.deepEqual(saved.sv_labor_guard,f.lease);return saved;
}
async function commit(f,expectedAllowed,{business=f.business}={}){
 const response=await request('PATCH','/',f.patch,f.override);
 if(expectedAllowed){assert.equal(response.status,200,JSON.stringify(response.body));await assertCommitted(f,business);}else{denied(response);await assertRejected(f);}
 return response;
}
before(async()=>{
 if(!enabled)return;assert.equal(sha(fs.readFileSync(modelPath)),MODEL_HASH,'Quantity model must stay frozen for this proof');
 baseline=JSON.parse(fs.readFileSync(sourceFile,'utf8'));assert.equal(Builder.hash(baseline),Builder.BASELINE_HASH);candidate=Builder.build(baseline);assert.equal(Builder.hash(candidate),CANDIDATE_HASH);
},{timeout:20000});
after(async()=>{
 if(!enabled)return;await owner('DELETE','/');assert.equal(sha(fs.readFileSync(modelPath)),MODEL_HASH,'Quantity model stayed frozen');
 const report={namespace,host,baselineHash:Builder.hash(baseline),candidateHash:Builder.hash(candidate),modelHash:MODEL_HASH,tests:evidence,
  scope:'Actual RTDB engine, direct internal-actor multipath PATCH of two CTA/two Gastos plus receipt/guard cleanup. No gateway/preflight/policy proof and no automatic index derivation; separate backend tests own those guarantees.',
  privilege:'Owner is used only to seed this demo namespace, install reviewed local rules and inject explicit revocation immediately before the actor PATCH. Final PATCH uses the internal actor auth override and is evaluated by the real rules.'};
 if(process.env.SV_BONUS_BATCH_EVIDENCE_FILE)fs.writeFileSync(process.env.SV_BONUS_BATCH_EVIDENCE_FILE,JSON.stringify(report,null,2)+'\n');
},{timeout:15000});

for(const variant of ['baseline','candidate'])test(variant+' accepts one complete two-employee PATCH with quantity/unit/group metadata',opt,async()=>{
 const f=await fixture(variant);assert.equal(Object.keys(f.business).length,4);assert.equal(Object.keys(f.patch).length,6);
 const response=await commit(f,true);const saved=await owner('GET','/'),rows=Object.entries(f.business).map(([p])=>p.split('/').reduce((v,k)=>v[k],saved));
 for(const row of rows){assert.equal(row.bonificacionValorUnitario,100.2);assert.deepEqual(row.bonificacionDestinatarios,['e1','e2']);assert.equal(row.bonificacionGrupoTotal,375.75);assert.equal(row.bonificacionGrupoPersonas,2);assert.equal(row.periodoComputo,'2026-11');}
 assert.deepEqual([...new Set(rows.map(row=>row.bonificacionCantidad))].sort(),[1.25,2.5]);assert.deepEqual([...new Set(rows.map(row=>row.monto))].sort((a,b)=>a-b),[125.25,250.5]);
 evidence.push({variant,case:'authorized-batch',status:response.status,businessRecords:4,commits:1,metadataPreserved:true});
});
for(const variant of ['baseline','candidate'])test(variant+' bonificar revoked immediately before commit with all alternative admin permissions still true',opt,async()=>{
 const f=await fixture(variant);await owner('PUT','/sv_permisos/admin/acciones/empleados/bonificar',false);
 const cfg=await owner('GET','/sv_permisos/admin');for(const name of ['registrarHaberes','gestionarAdelantos','pagarMovimiento','aprobarMovimiento'])assert.equal(cfg.acciones.empleados[name],true);assert.equal(cfg.acciones.gastos.administrar,true);assert.equal(cfg.acciones.comisiones.crear,true);
 const response=await commit(f,variant==='baseline');evidence.push({variant,case:'bonificar-revoked-other-permissions-true',status:response.status,allOrNone:true});
});
const mutations={
 inactive:async()=>owner('PUT','/sv_chat_roles/admin/activo',false),
 role:async()=>owner('PUT','/sv_chat_roles/admin/rol','administrativo'),
 revision:async()=>owner('PUT','/sv_permisos/admin/indiceRevision',999),
 'employee-module':async()=>owner('PUT','/sv_permisos/admin/indiceModulos/empleados',false),
 'index-version':async()=>owner('PUT','/sv_permisos/admin/indiceVersion',1),
 reset:async()=>owner('PUT','/sv_access_resets/admin',{required:true,version:2}),
 'access-version':async()=>owner('PUT','/sv_access_resets/admin',{required:false,version:2}),
 'labor-config':async()=>owner('PUT','/sv_labor_config/ready',false)
};
for(const [change,mutate]of Object.entries(mutations))for(const variant of ['baseline','candidate'])test(variant+' actual commit after '+change+' changes preserves whole-transaction behavior',opt,async()=>{
 const f=await fixture(variant);await mutate(f);
 // Existing generic user rules do not bind the claim role/revision/bonus
 // module. Their alternative admin grants remain allowed in those three cases.
 const allowed=variant==='baseline'&&['role','revision','employee-module'].includes(change);
 const response=await commit(f,allowed);evidence.push({variant,case:change,status:response.status,allOrNone:true});
});
for(const variant of ['baseline','candidate'])test(variant+' retains another financial action while bonificar is false',opt,async()=>{
 const f=await fixture(variant,'gastos.administrar');await owner('PUT','/sv_permisos/admin/acciones/empleados/bonificar',false);
 const ordinary={'sisventas/gastos/ordinary':{descripcion:'Gasto corriente ficticio',tipo:'Variable',monto:12.34,fecha:'2026-10-22',estado:'pendiente_pago'}};
 f.patch={...ordinary,['sv_labor_receipts/'+f.lease.opId]:f.patch['sv_labor_receipts/'+f.lease.opId],sv_labor_guard:null};
 const response=await commit(f,true,{business:ordinary});const saved=await owner('GET','/');for(const p of Object.keys(f.business))assert.equal(p.split('/').reduce((v,k)=>v?.[k],saved),undefined);
 evidence.push({variant,case:'other-action-unchanged',status:response.status});
});
for(const variant of ['baseline','candidate'])test(variant+' denies an ordinary actor token without the trusted service marker',opt,async()=>{
 const f=await fixture(variant);delete f.token.svLaborService;const response=await commit(f,false);evidence.push({variant,case:'no-service-marker',status:response.status,allOrNone:true});
});
for(const variant of ['baseline','candidate'])test(variant+' refuses a second raw PATCH after its one-shot receipt without changing the saved batch',opt,async()=>{
 const f=await fixture(variant);await commit(f,true);const before=await owner('GET','/'),response=await request('PATCH','/',f.patch,f.override);denied(response);assert.deepEqual(await owner('GET','/'),before);
 evidence.push({variant,case:'raw-patch-replay',status:response.status,unchanged:true});
});
