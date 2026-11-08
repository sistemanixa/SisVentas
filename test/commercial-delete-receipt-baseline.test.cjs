'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Known=require('../scripts/lib/commercial-delete-receipt-baseline.cjs'),Rules=require('../scripts/lib/commercial-delete-atomic-rules.cjs');
const F=require('./helpers/commercial-delete-atomic-fixture.cjs'),Protocol=require('../cotizador/commercial-delete-commit-protocol');
const {apply}=require('./helpers/labor-ui-flow.cjs');
for(const [name,original]of Object.entries(Known.variants))test('exact '+name+' receipt retains all previous restrictions under atomic narrowing',async()=>{
 const f=await F.create(),b=F.baseline();b.rules.sv_labor_receipts.$op['.write']=original;
 const before=structuredClone(b),candidate=Rules.prepare(b,{pins:f.pins});assert.deepEqual(b,before);assert.equal(candidate.rules.sv_labor_receipts.$op['.write'].slice(0,original.length+4),'('+original+') &');
 const lease={mode:'user',actorUid:'u',fence:'fence-fixture',opId:'receipt-baseline-fixture',digest:'a'.repeat(64),expiresAt:Date.now()+30000};
 apply(f.state,{sv_labor_guard:lease,'sv_permisos/admin':{indiceVersion:2,indiceRevision:1,indiceModulos:{gastos:true,empleados:true,configuracion:true},acciones:{gastos:{eliminar:false},empleados:{bonificar:false,registrarHaberes:false},mantenimiento:{migrar:false}}}});
 const after=structuredClone(f.state);apply(after,{sv_labor_guard:null,['sv_labor_receipts/'+lease.opId]:{fence:lease.fence,digest:lease.digest,actorUid:'u'}});
 const actor={mode:'user',uid:'u',claims:{uid:'u'},role:'admin',permissionRevision:1},auth=F.service(actor,lease,Protocol.reservedClaims());
 Object.assign(auth.token,{svFinancialActorRole:'admin',svFinancialPermissionRevision:1});
 for(const action of ['', 'gastos.eliminar','empleados.bonificar','empleados.registrarHaberes','mantenimiento.migrar']){
  auth.token.svFinancialAction=action;
  const args={before:f.state,after,path:['sv_labor_receipts',lease.opId],auth};
  const prior=F.allowed(original.replaceAll('$op','auth.token.opId'),args),next=F.allowed(candidate.rules.sv_labor_receipts.$op['.write'].replaceAll('$op','auth.token.opId'),args);
  assert.equal(next,prior,action||'ordinary receipt');
  const denied=new Set(name==='base'?[]:name==='expenseRemoval'?['gastos.eliminar']:name==='bonus'?['gastos.eliminar','empleados.bonificar']:['gastos.eliminar','empleados.bonificar','empleados.registrarHaberes','mantenimiento.migrar']);assert.equal(prior,!denied.has(action),name+': '+action);
 }
});
for(const value of [true,false,'true','',Known.variants.sac+' ', '('+Known.variants.sac+') || true','('+Known.variants.sac+') && true'])test('unknown receipt expression is not recognized: '+String(value).slice(0,35),async()=>{
 assert.equal(Known.recognized(value),false);const f=await F.create(),b=F.baseline();b.rules.sv_labor_receipts.$op['.write']=value;if(value===false)assert.doesNotThrow(()=>Rules.prepare(b,{pins:f.pins}));else assert.throws(()=>Rules.prepare(b,{pins:f.pins}));
});
test('receipt recognition does not authorize the same expression at another metadata path',async()=>{
 const f=await F.create(),b=F.baseline();b.rules.sv_labor_guard['.write']=Known.variants.sac;assert.throws(()=>Rules.prepare(b,{pins:f.pins}));
});
