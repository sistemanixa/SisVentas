'use strict';
// Opt-in actual gateway/guard/store against one loopback demo namespace only.
// No ADC, provider, real data, production configuration or service startup.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{createLaborGuard,digest}=require('../cotizador/labor-guard'),{createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const Model=require('../cotizador/bonus-quantity-model'),Index=require('../cotizador/labor-index'),Permissions=require('../js/core/permission-index'),Builder=require('../scripts/prepare-bonus-batch-rules.cjs');
const host='127.0.0.1:9037',base='http://'+host,namespace='demo-bonus-batch-runtime-proof',sourceFile=process.env.SV_BONUS_BATCH_RULES_TEST_FILE;
const enabled=process.env.FIREBASE_DATABASE_EMULATOR_HOST===host&&!!sourceFile,opt={skip:!enabled,timeout:30000};let rules,seed,sequence=0;
const copy=value=>structuredClone(value);
function apply(root,patch){for(const [path,value]of Object.entries(patch)){const keys=path.split('/'),last=keys.pop();let node=root;for(const key of keys)node=node[key]||(node[key]={});if(value===null)delete node[last];else node[last]=copy(value);}return root;}
async function rest(method,path,value){const url=new URL(path+'.json',base);url.searchParams.set('ns',namespace);assert.equal(url.origin,base);assert.match(namespace,/^demo-/);const response=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(10000)}),text=await response.text();assert.equal(response.status,200,text);return text?JSON.parse(text):null;}
function fixture(){
 const permissions=Permissions.build({admin:{bloqueados:[],acciones:{gastos:{administrar:true,eliminar:true},empleados:{bonificar:true,registrarHaberes:true,pagarMovimiento:true,aprobarMovimiento:true,gestionarAdelantos:true},comisiones:{crear:true}}}}),salary={monto:500,montoPagado:500,estado:'pagado',pagos:{p:{monto:500}}};
 const state={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{admin:{activo:true,rol:'admin',nombre:'Admin ficticio'}},sv_usuarios:{profile:{uid:'admin',rol:'admin',activo:true,nombre:'Admin ficticio'}},sv_permisos:permissions,sisventas:{empleados:{e1:{nombre:'Ana ficticia',activo:true},e2:{nombre:'Bea ficticia',activo:true}},ctaemp:{e1:{salary:copy(salary)}},gastos:{salary:copy(salary)},haberes:{e1:{octubre:{total:500}}},config:{bonificaciones:{model:{nombre:'Productividad',montoSugerido:250}}},pagos:{keep:{ventaFbKey:'v',monto:72.34}},comisiones_generacion:{keep:{estado:'completada'}}}};
 return apply(state,Index.buildIndex(state.sisventas));
}
function command(){
 const group='bonus-runtime-group-fixture',plan=Model.plan({empleados:[{empleadoId:'e1',cantidad:2.5},{empleadoId:'e2',cantidad:1.125}],valorUnitario:2.35}),value={},expectedHashes={};
 for(const item of plan.items){const id=item.empleadoId,mov=Model.operationKey('bonificacion',[id,group]),expense=Model.operationKey('gasto_bonificacion',[id,group]),meta=Model.metadata(item,group,plan),base={monto:item.monto,fecha:'2026-10-22',periodoComputo:'2026-11',descripcion:'Bonificación · Trabajo terminado',motivo:'Trabajo terminado',estado:'aprobado',operacionId:group,empleadoId:id,empleadoNombre:seed.sisventas.empleados[id].nombre,legacyKey:'ctaemp/'+id+'/'+mov,bonificacionConceptoId:'model',bonificacionConceptoNombre:'Productividad',aprobadoPor:'Admin ficticio',aprobadoTs:1792700000000,ts:1792700000000,...meta};
  value['sisventas/ctaemp/'+id+'/'+mov]={...base,tipo:'bonificacion',fbKey:mov,gastoFbKey:expense,usuario:'Admin ficticio',origenCarga:'manual_empleados'};
  value['sisventas/gastos/'+expense]={...base,tipo:'Variable',tipoPagable:'bonificacion',empleadoFbKey:id,movimientoCtaKey:mov,origen:'bonificacion',categoria:'Personal',medio:'Transferencia',mes:'2026-11',periodoTrabajo:'',fechaTrabajo:'',fechaImputacion:'2026-11-01',semestre:'',mejorSueldo:null,hsExtra:null,origenLegacy:'',migradoDesdeLegacy:false,requiereAprobacion:false};
  expectedHashes['sisventas/ctaemp/'+id+'/'+mov]=digest(null);expectedHashes['sisventas/gastos/'+expense]=digest(null);expectedHashes['sisventas/empleados/'+id]=digest(seed.sisventas.empleados[id]);
 }
 return {id:'bonus-runtime-transport-'+(++sequence),kind:'atomic',purpose:'employee-bonus-batch',path:'',value,expectedHashes};
}
function runtime(hook){
 const commits=[],requests=[],store=createLaborRtdbStore({databaseURL:base+'/?ns='+namespace,accessToken:async()=>'owner',requestMs:10000,fetchImpl:async(url,init)=>{const target=new URL(url);assert.equal(target.origin,base);assert.equal(target.searchParams.get('ns'),namespace);requests.push({method:init.method,path:decodeURIComponent(target.pathname)});if(init.method==='PATCH'){const override=JSON.parse(target.searchParams.get('auth_variable_override'));assert.equal(override.uid,'admin');assert.equal(override.token.svFinancialAction,'empleados.bonificar');commits.push(JSON.parse(init.body));await hook?.();}return fetch(target,init);}}),guard=createLaborGuard({store}),db={ref:p=>({get:async()=>{const value=await rest('GET','/'+p);return {val:()=>value};}})},gateway=createLaborWriteGateway({auth:{},db,store,guard,enabled:true});
 return {commits,requests,write:body=>gateway.write({uid:'admin',claims:{uid:'admin',name:'Admin ficticio'}},body)};
}
before(async()=>{if(!enabled)return;const input=JSON.parse(fs.readFileSync(sourceFile,'utf8'));assert.equal(Builder.hash(input),Builder.BASELINE_HASH);rules=Builder.build(input);await rest('PUT','/.settings/rules',rules);},{timeout:20000});
beforeEach(async()=>{if(enabled){seed=fixture();await rest('PUT','/',seed);}});
after(async()=>{if(enabled)await rest('DELETE','/');},{timeout:10000});
test('actual gateway verifies all 3N sources and commits 2N bonuses plus indexes and receipt in one PATCH',opt,async()=>{
 const f=runtime(),b=command();assert.equal(Object.keys(b.expectedHashes).length,6);assert.equal((await f.write(b)).committed,true);const saved=await rest('GET','/');assert.equal(f.commits.length,1);assert.ok(saved.sv_labor_receipts[b.id]);
 for(const [p,v]of Object.entries(b.value)){const actual=p.split('/').reduce((n,key)=>n?.[key],saved);for(const field of ['monto','periodoComputo','bonificacionCantidad','bonificacionValorUnitario','bonificacionGrupoId','bonificacionGrupoTotal','bonificacionGrupoPersonas'])assert.equal(actual[field],v[field]);assert.deepEqual(actual.bonificacionDestinatarios,['e1','e2']);}
 for(const domain of ['empleados','haberes','config','pagos','comisiones_generacion'])assert.deepEqual(saved.sisventas[domain],seed.sisventas[domain]);assert.deepEqual(saved.sisventas.ctaemp.e1.salary,seed.sisventas.ctaemp.e1.salary);assert.deepEqual(saved.sisventas.gastos.salary,seed.sisventas.gastos.salary);
 assert.ok(!f.requests.some(req=>['/sisventas.json','/sisventas/ctaemp.json','/sisventas/gastos.json','/sisventas/empleados.json'].includes(req.path)));
 const before=copy(saved);await f.write(b);assert.equal(f.commits.length,1);assert.deepEqual(await rest('GET','/'),before);
});
for(const late of ['permission','revision','role','reset'])test('actual store rejects late '+late+' with other admin ledger grants still enabled and zero partial records',opt,async()=>{
 const b=command(),f=runtime(async()=>{if(late==='permission')await rest('PUT','/sv_permisos/admin/acciones/empleados/bonificar',false);if(late==='revision')await rest('PUT','/sv_permisos/admin/indiceRevision',999);if(late==='role')await rest('PUT','/sv_chat_roles/admin/rol','administrativo');if(late==='reset')await rest('PUT','/sv_access_resets/admin',{required:true,version:2});});
 await assert.rejects(f.write(b),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});const saved=await rest('GET','/');assert.deepEqual(saved.sisventas,seed.sisventas);assert.deepEqual(saved.sv_labor_indexes,seed.sv_labor_indexes);assert.equal(saved.sv_labor_receipts,undefined);assert.equal(f.commits.length,1);
});
test('actual source CAS detects changed or inactive employee before sending a PATCH',opt,async()=>{
 const b=command();await rest('PUT','/sisventas/empleados/e2/activo',false);const f=runtime();await assert.rejects(f.write(b),{code:'SV_CAS_CONFLICT'});assert.equal(f.commits.length,0);const saved=await rest('GET','/');assert.deepEqual(saved.sisventas.gastos,seed.sisventas.gastos);assert.deepEqual(saved.sisventas.ctaemp,seed.sisventas.ctaemp);assert.equal(saved.sv_labor_receipts,undefined);
});
