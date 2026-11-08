'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Parent=require('../scripts/lib/commercial-delete-sales-parent.cjs'),Fence=require('../cotizador/labor-fence-policy'),{digest}=require('../cotizador/labor-guard');
const {Snapshot}=require('./helpers/commercial-delete-atomic-fixture.cjs');
function baseline(){return {rules:{'.read':false,'.write':false,sisventas:{'.write':false,ventas:{'.read':"auth != null",'.write':Parent.PARENT,'.indexOn':['fecha'],$venta:{'.write':"auth != null && auth.uid === 'u' && data.child('locked').val() !== true",'.validate':"newData.hasChildren(['id'])",detalle:{'.write':"auth.uid === 'u'",'.validate':'newData.isString()'}}},ordenes:{'.write':false},ordenes_trabajo:{'.write':false}},...Fence.metadataRules(),private:{'.read':false,'.write':false}}};}
function evaluate(expression,before,after,path,auth){if(expression===undefined||expression===false)return false;return new Function('root','data','newData','auth','now','$venta','return ('+expression+');')(new Snapshot(before),new Snapshot(before,path),new Snapshot(after,path),auth,1000,'s');}
function scenario(actor,action,live,locked=false){
 const lease={fence:'fence-fixture',opId:'operation-fixture',digest:'a'.repeat(64),actorUid:'u',mode:actor==='server'?'server':actor==='command'?'command':'user',expiresAt:live?2000:900};
 const before={sisventas:{ventas:action==='create'?{}:{s:{id:'V-FIXTURE',locked,total:100}}},sv_labor_config:{schema:1,ready:true},sv_chat_roles:{u:{activo:true,rol:'admin'}},sv_permisos:{admin:{indiceRevision:1}},sv_labor_receipts:{},...(live?{sv_labor_guard:lease}:{})};
 const after=structuredClone(before);delete after.sv_labor_guard;after.sv_labor_receipts[lease.opId]={fence:lease.fence,digest:lease.digest,actorUid:'u'};
 if(action==='delete')delete after.sisventas.ventas.s;else after.sisventas.ventas.s={id:'V-FIXTURE',total:101};
 const sdk=actor.startsWith('sdk'),auth={uid:sdk?(actor==='sdk'?'u':'other'):actor==='user'?'u':'sv-labor-service',token:sdk?{}:{svLaborService:true,mode:'commit',fence:lease.fence,opId:lease.opId,digest:lease.digest,actorUid:'u',actorRole:'admin',actorPermissionRevision:1,actorPasswordChangeRequired:false}};
 return {before,after,auth};
}
test('only exact reviewed parent envelope is relocated; original row/read/validation and source are preserved',()=>{
 assert.equal(digest(Parent.PARENT),Parent.EXPECTED_SHA256);const input=baseline(),before=structuredClone(input),out=Parent.prepare(input);assert.deepEqual(input,before);
 assert.equal(out.rules.sisventas.ventas['.write'],false);assert.equal(out.rules.sisventas.ventas.$venta['.write'],'('+Fence.financialRule(3,'false')+') || ('+before.rules.sisventas.ventas.$venta['.write']+')');
 const rest=structuredClone(out);rest.rules.sisventas.ventas['.write']=before.rules.sisventas.ventas['.write'];rest.rules.sisventas.ventas.$venta['.write']=before.rules.sisventas.ventas.$venta['.write'];assert.deepEqual(rest,before);
});
for(const actor of ['sdk','sdk-other','user','server','command'])for(const live of [false,true])for(const action of ['create','edit','delete'])test('permission equivalence '+actor+' '+(live?'lease':'idle')+' '+action,()=>{
 const input=baseline(),out=Parent.prepare(input),{before,after,auth}=scenario(actor,action,live);
 const original=evaluate(input.rules.sisventas.ventas['.write'],before,after,['sisventas','ventas'],auth)||evaluate(input.rules.sisventas.ventas.$venta['.write'],before,after,['sisventas','ventas','s'],auth);
 const rewritten=evaluate(out.rules.sisventas.ventas['.write'],before,after,['sisventas','ventas'],auth)||evaluate(out.rules.sisventas.ventas.$venta['.write'],before,after,['sisventas','ventas','s'],auth);
 assert.equal(rewritten,original);
 assert.equal(original,['sdk','user'].includes(actor)||live&&['server','command'].includes(actor));
});
test('SDK row-relative locked test is not rebound to collection data',()=>{
 const input=baseline(),out=Parent.prepare(input),{before,after,auth}=scenario('sdk','edit',false,true);assert.equal(evaluate(input.rules.sisventas.ventas.$venta['.write'],before,after,['sisventas','ventas','s'],auth),false);assert.equal(evaluate(out.rules.sisventas.ventas.$venta['.write'],before,after,['sisventas','ventas','s'],auth),false);
});
for(const mutation of ['otherParent','spacing','closedParent','root','dataParent','rootWildcard','domainWildcard','extraRecord','extraWildcard','missingRow','booleanRow','arrayRow','wrongChild'])test('unknown or ambiguous baseline is rejected: '+mutation,()=>{
 const b=baseline();if(mutation==='otherParent')b.rules.sisventas.ventas['.write']=Fence.financialRule(2,"auth.uid === 'u'");if(mutation==='spacing')b.rules.sisventas.ventas['.write']+=' ';if(mutation==='closedParent')b.rules.sisventas.ventas['.write']=false;if(mutation==='root')b.rules['.write']='true';if(mutation==='dataParent')b.rules.sisventas['.write']='true';if(mutation==='rootWildcard')b.rules.$other={'.write':'true'};if(mutation==='domainWildcard')b.rules.sisventas.$other={$id:{'.write':'true'}};if(mutation==='extraRecord')b.rules.sisventas.ventas.literal={'.write':false};if(mutation==='extraWildcard')b.rules.sisventas.ventas.$other={'.write':false};if(mutation==='missingRow')delete b.rules.sisventas.ventas.$venta;if(mutation==='booleanRow')b.rules.sisventas.ventas.$venta['.write']=true;if(mutation==='arrayRow')b.rules.sisventas.ventas.$venta=[];if(mutation==='wrongChild'){b.rules.sisventas.ventas.$record=b.rules.sisventas.ventas.$venta;delete b.rules.sisventas.ventas.$venta;}
 assert.throws(()=>Parent.prepare(b));
});
test('reviewed parent relocation composes with Atomic after narrowing; Atomic never accepts original parent',()=>{
 const Atomic=require('../scripts/lib/commercial-delete-atomic-rules.cjs'),input=baseline();
 assert.throws(()=>Atomic.prepare(input));assert.doesNotThrow(()=>Atomic.prepare(Parent.prepare(input)));
});
