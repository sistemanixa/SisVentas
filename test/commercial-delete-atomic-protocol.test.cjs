'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('./helpers/commercial-delete-atomic-fixture.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs');
const Rules=require('../scripts/lib/commercial-delete-atomic-rules.cjs'),Protocol=require('../cotizador/commercial-delete-commit-protocol'),Attestation=require('../cotizador/commercial-delete-attestation');
function context(f,operation='saleDelete'){
 const domain={saleDelete:'ventas',orderDelete:'ordenes',otDelete:'ordenes_trabajo'}[operation],inputKey={saleDelete:'ventaKey',orderDelete:'orderKey',otDelete:'otKey'}[operation],lease={mode:operation==='orderDelete'?'command':'user',actorUid:'u',fence:'fixture-fence',digest:'a'.repeat(64),opId:'fixture-delete-atomic',expiresAt:Date.now()+30000};
 const actor={uid:'u',claims:{uid:'u'},mode:lease.mode,role:'admin',permissionRevision:1,opId:lease.opId,operation:{saleDelete:'sale-delete',orderDelete:'purchase-order-delete',otDelete:'ot-delete'}[operation],input:{[inputKey]:'s'}};
 apply(f.state,{sv_labor_guard:lease,'sv_permisos/admin':{indiceRevision:1}});
 if(domain!=='ventas')apply(f.state,{['sisventas/'+domain+'/s']:{id:'FICTITIOUS'}});
 const patch={['sisventas/'+domain+'/s']:null,sv_labor_guard:null,['sv_labor_receipts/'+lease.opId]:{fence:lease.fence,digest:lease.digest,actorUid:'u'}};
 return {domain,lease,actor,patch,operation};
}
for(const operation of Attestation.OPERATIONS)test('opaque proof emits reserved claims and permits atomic '+operation,async()=>{
 const f=await F.create(),c=context(f,operation),proof=await f.verifier.verify({...f.input,operation});
 const claims=await f.protocol.claims({...c,proof,readFresh:f.input.read,runtime:f.runtime});assert.equal(claims.svCommercialDeleteVersion,1);assert.equal(F.checkCommit(f,c.patch,c.lease,c.actor,claims),true);
 assert.equal(F.checkCommit(f,c.patch,c.lease,c.actor,Protocol.reservedClaims()),false,'deleting an origin always requires claim version 1');
});
for(const target of [Attestation.PATH,Attestation.PATH+'/signature',Attestation.PATH+'/rulesSha256',Attestation.PATH+'/activationId','sv_operational_read_config/ready','sv_client_history_config/ready','sv_client_accounts_config/generation','sv_commercial_pages/v1/coverage/ready','sv_sale_financial_dependencies/v1/coverage/ready'])test('PATCH rules reject post-claim revocation: '+target,async()=>{
 const f=await F.create(),c=context(f),proof=await f.verifier.verify(f.input),claims=await f.protocol.claims({...c,proof,readFresh:f.input.read,runtime:f.runtime});
 apply(f.state,{[target]:target===Attestation.PATH?null:target.endsWith('generation')?'different':false});assert.equal(F.checkCommit(f,c.patch,c.lease,c.actor,claims),false);
});
for(const mutation of ['root','parent','collection','rootWildcard','domainWildcard','receiptParent','metadataChild','unknownGrant'])test('builder rejects bypass authority '+mutation,async()=>{
 const f=await F.create(),b=F.baseline();if(mutation==='root')b.rules['.write']='auth != null';if(mutation==='parent')b.rules.sisventas['.write']='auth != null';if(mutation==='collection')b.rules.sisventas.ventas['.write']='auth != null';if(mutation==='rootWildcard')b.rules.$any={'.write':'auth != null'};if(mutation==='domainWildcard')b.rules.sisventas.$any={$id:{'.write':'auth != null'}};if(mutation==='receiptParent')b.rules.sv_labor_receipts['.write']='auth != null';if(mutation==='metadataChild')b.rules.sv_labor_guard.any={'.write':'auth != null'};if(mutation==='unknownGrant')b.rules.sisventas.ventas.$record['.write']=true;
 assert.throws(()=>Rules.prepare(b,{pins:f.pins}));
});
test('builder preserves input and read/validate rules; descendant grant cannot delete its parent origin',async()=>{
 const f=await F.create(),b=F.baseline(),before=structuredClone(b),rules=Rules.prepare(b,{pins:f.pins});assert.deepEqual(b,before);
 const c=context(f),after=structuredClone(f.state);apply(after,c.patch);
 const childRule=rules.rules.sisventas.ventas.$record.detalle['.write'];
 assert.equal(F.allowed(childRule,{before:f.state,after,path:['sisventas','ventas','s','detalle'],auth:{uid:'u',token:{}},id:'s'}),false);
});
test('cloned proof, wrong operation, missing receipt or mixed origin cannot derive claims',async()=>{
 const f=await F.create(),c=context(f),proof=await f.verifier.verify(f.input);
 for(const mutate of [x=>x.proof={...proof},x=>x.actor={...c.actor,operation:'other'},x=>delete x.patch['sv_labor_receipts/'+c.lease.opId],x=>x.patch['sisventas/ordenes/s']=null]){
  const input={...c,patch:structuredClone(c.patch),proof,readFresh:f.input.read,runtime:f.runtime};mutate(input);await assert.rejects(f.protocol.claims(input));
 }
});
test('real guard commit rejects authority removed after final protocol check, without mutating sale',async()=>{
 for(const target of [Attestation.PATH,'sv_operational_read_config/ready']){
  const f=await F.create(),proof=await f.verifier.verify(f.input),before=structuredClone(f.state.sisventas),commit=f.store.commit;
  f.store.commit=async(patch,lease,actor)=>{const claims=await f.protocol.claims({patch,lease,actor,proof,readFresh:f.input.read,runtime:f.runtime});apply(f.state,{[target]:target===Attestation.PATH?null:false});if(!F.checkCommit(f,patch,lease,actor,claims))throw Object.assign(Error('Atomic authority rejected'),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});return commit(patch,lease,actor);};
  await assert.rejects(f.guard.run({uid:'u',claims:{uid:'u'},mode:'user',role:'admin',permissionRevision:1,opId:'real-atomic-proof',operation:'sale-delete',input:{ventaKey:'s'}},async scope=>{await f.verifier.assertCurrent({proof,readFresh:scope.get,runtime:f.runtime});scope.beforeCommit(({readFresh})=>f.verifier.assertCurrent({proof,readFresh,runtime:f.runtime}));await scope.update({'sisventas/ventas/s':null});return {committed:true};}),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});
  assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,before);
 }
});
test('all incoming reserved namespace claims are neutralized, including unknown legacy names',async()=>{
 const f=await F.create(),incoming={uid:'u',svCommercialDeleteVersion:1,svCommercialDeleteSignature:'old-fictional',svCommercialDeleteUnknownFuture:true,svCommercialDeletePinsSha256:'stale'};
 const before=structuredClone(incoming),claims=await f.protocol.claims({patch:{'sisventas/gastos/other':{monto:1}},actor:{claims:incoming}});
 assert.equal(claims.svCommercialDeleteVersion,0);assert.equal(claims.svCommercialDeleteSignature,null);assert.equal(claims.svCommercialDeleteUnknownFuture,null);assert.equal(claims.svCommercialDeletePinsSha256,null);assert.deepEqual(incoming,before);
 assert.equal(Object.hasOwn(claims,'uid'),false);
});
test('rules do not embed their own digest or pins, avoiding a self-referential cut hash',async()=>{
 const f=await F.create(),other=structuredClone(f.pins);other.rulesSha256='f'.repeat(64);other.manifestSha256='e'.repeat(64);other.activationId='other';
 assert.deepEqual(Rules.prepare(F.baseline()),Rules.prepare(F.baseline(),{pins:f.pins}));assert.throws(()=>Rules.prepare(F.baseline(),{pins:{ready:true}}));
 assert.deepEqual(Rules.prepare(F.baseline(),{pins:f.pins}),Rules.prepare(F.baseline(),{pins:other}));
 const serialized=JSON.stringify(f.rules);assert.equal(serialized.includes(f.pins.rulesSha256),false);assert.equal(serialized.includes(f.pins.manifestSha256),false);
});
test('empty object and individual field removals cannot bypass mandatory deletion claim',async()=>{
 for(const mode of ['empty','fields']){
  const f=await F.create(),c=context(f);delete c.patch['sisventas/ventas/s'];
  if(mode==='empty')c.patch['sisventas/ventas/s']={};else for(const field of Object.keys(f.get('sisventas/ventas/s')))c.patch['sisventas/ventas/s/'+field]=null;
  assert.equal(F.checkCommit(f,c.patch,c.lease,c.actor,Protocol.reservedClaims()),false,mode);
 }
});
test('sale cascade claims authorize only OTs linked to the admitted sale',async()=>{
 const f=await F.create(),c=context(f),proof=await f.verifier.verify(f.input);apply(f.state,{'sisventas/ordenes_trabajo/linked':{id:'OT-FICTITIOUS',ventaFbKey:'s'}});c.patch['sisventas/ordenes_trabajo/linked']=null;
 const claims=await f.protocol.claims({...c,proof,readFresh:f.input.read,runtime:f.runtime});assert.deepEqual(claims.svCommercialDeleteOTKeys,{linked:true});assert.equal(F.checkCommit(f,c.patch,c.lease,c.actor,claims),true);
 apply(f.state,{'sisventas/ordenes_trabajo/linked/ventaFbKey':'other'});await assert.rejects(f.protocol.claims({...c,proof,readFresh:f.input.read,runtime:f.runtime}),{code:'SV_COMMERCIAL_DELETE_PROTOCOL'});
});
test('real saleDelete commit and receipt replay succeed with opaque claims and generated atomic rules',async()=>{
 const f=await F.create();apply(f.state,{'sv_permisos/admin':{indiceVersion:2,indiceRevision:1,indiceModulos:{venta:true},acciones:{ventas:{eliminar:true}}}});
 f.store.saleDeleteFenceReady=true;f.store.saleDeleteActivityFenceReady=true;f.store.saleDeleteFinancialEvidence=require('../cotizador/sale-financial-dependencies-provider').create();
 const proof=await f.verifier.verify(f.input),commit=f.store.commit;let checks=0;
 f.store.commit=async(patch,lease,actor)=>{const claims=await f.protocol.claims({patch,lease,actor,proof,readFresh:f.input.read,runtime:f.runtime});assert.equal(F.checkCommit(f,patch,lease,actor,claims),true);checks++;return commit(patch,lease,actor);};
 const command=require('../cotizador/sale-delete-command').createSaleDeleteCommand({guard:f.guard,store:f.store,enabled:true,verifyActor:async()=>{}}),body={id:'actual-sale-atomic',ventaKey:'s',expectedHash:require('../cotizador/labor-guard').digest(f.get('sisventas/ventas/s'))},actor={uid:'u',claims:{uid:'u',svCommercialDeleteVersion:1,svCommercialDeleteSignature:'old-claim'}};
 const result=await command.execute(actor,body);assert.equal(result.committed,true);assert.equal(f.get('sisventas/ventas/s'),null);assert.equal(f.commits.length,1);assert.equal(checks,1);
 assert.deepEqual(await command.execute(actor,body),result);assert.equal(f.commits.length,1);assert.equal(checks,1);
});
test('commit cannot revoke its own authority in the same atomic PATCH',async()=>{
 const f=await F.create(),c=context(f),proof=await f.verifier.verify(f.input),claims=await f.protocol.claims({...c,proof,readFresh:f.input.read,runtime:f.runtime});
 for(const target of [Attestation.PATH,'sv_operational_read_config/ready']){
  const patch={...c.patch,[target]:target===Attestation.PATH?null:false};assert.equal(F.checkCommit(f,patch,c.lease,c.actor,claims),false);await assert.rejects(f.protocol.claims({...c,patch,proof,readFresh:f.input.read,runtime:f.runtime}));
 }
});
test('builder rejects malformed target collection nodes without producing a candidate',async()=>{
 for(const value of [true,[],1,'auth != null']){const b=F.baseline();b.rules.sisventas.ventas=value;assert.throws(()=>Rules.prepare(b));}
});
test('non-destructive coordinated write retains original authority without a deletion proof',async()=>{
 const f=await F.create(),c=context(f);c.patch['sisventas/ventas/s']={...f.get('sisventas/ventas/s'),total:101};apply(f.state,{[Attestation.PATH]:null,'sv_operational_read_config/ready':false});
 const claims=await f.protocol.claims({...c,readFresh:f.input.read,runtime:f.runtime});assert.equal(claims.svCommercialDeleteVersion,0);assert.equal(F.checkCommit(f,c.patch,c.lease,c.actor,claims),true);
});
test('guard acquire and abort keep their existing no-proof contracts',async()=>{
 const f=await F.create(),c=context(f),base=structuredClone(f.state);delete base.sv_labor_guard;
 const after=structuredClone(base);after.sv_labor_guard=c.lease;
 const auth={uid:'sv-labor-service',token:{svLaborService:true,mode:'acquire',fence:c.lease.fence,opId:c.lease.opId,digest:c.lease.digest,actorUid:'u',...Protocol.reservedClaims()}};
 assert.equal(F.allowed(f.rules.rules.sv_labor_guard['.write'],{before:base,after,path:['sv_labor_guard'],auth}),true);
 auth.token.mode='abort';assert.equal(F.allowed(f.rules.rules.sv_labor_guard['.write'],{before:after,after:base,path:['sv_labor_guard'],auth}),true);
});
