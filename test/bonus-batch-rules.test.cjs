'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Builder=require('../scripts/prepare-bonus-batch-rules.cjs');
const Fence=require('../scripts/prepare-labor-fence-rules.cjs'),Removal=require('../scripts/prepare-expense-removal-rules.cjs');
const clone=value=>structuredClone(value);
function base(){
 const anyAction="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && (root.child('sv_permisos/admin/acciones/empleados/bonificar').val() === true || root.child('sv_permisos/admin/acciones/empleados/registrarHaberes').val() === true || root.child('sv_permisos/admin/acciones/empleados/gestionarAdelantos').val() === true || root.child('sv_permisos/admin/acciones/gastos/administrar').val() === true)";
 const fenced=Fence.build({rules:{'.read':false,'.write':false,sisventas:{'.write':false,config:{'.write':false},gastos:{'.write':anyAction,'.read':'existing expense read','.indexOn':['tipoPagable'],$gasto:{'.validate':'existing validation'}},ctaemp:{'.write':anyAction,'.read':'existing account read',$empleado:{'.read':'existing employee account read'}},pagos:{'.write':false},auditoria_pagos:{'.write':false}},sv_permisos:{'.write':'auth != null'}}});
 return Removal.build(fenced,{expectedHash:Removal.hash(fenced)});
}
function changes(a,b,p='',result=[]){if(JSON.stringify(a)===JSON.stringify(b))return result;const object=v=>v&&typeof v==='object'&&!Array.isArray(v);if(object(a)||object(b))for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))changes(a?.[key],b?.[key],p?p+'/'+key:key,result);else result.push(p);return result;}
function at(root,keys){let value=root;for(const key of keys){if(!value||typeof value!=='object'||!Object.hasOwn(value,key))return null;value=value[key];}return value??null;}
class Snapshot{
 constructor(root,keys=[]){this.root=root;this.keys=keys;}
 child(value){return new Snapshot(this.root,[...this.keys,...String(value).split('/')]);}
 parent(){return new Snapshot(this.root,this.keys.slice(0,-1));}
 val(){return at(this.root,this.keys);}
 exists(){return this.val()!==null;}
 isString(){return typeof this.val()==='string';}
 isNumber(){return typeof this.val()==='number';}
 hasChildren(keys){return keys.every(key=>this.child(key).exists());}
}
const input=base(),candidate=Builder.build(input,{expectedHash:Builder.hash(input)});
function fixture(role='admin'){
 const now=1000,uid='fixture-user',opId='bonus-batch-operation',fence='bonus-batch-fence',digest='a'.repeat(64);
 const root={sv_labor_guard:{mode:'user',opId,fence,digest,actorUid:uid,expiresAt:2000},sv_labor_config:{schema:1,ready:true},sv_chat_roles:{[uid]:{activo:true,rol:role}},sv_permisos:{[role]:{indiceVersion:2,indiceRevision:7,indiceModulos:{empleados:true,gastos:true,ctaemp:true},acciones:{empleados:{bonificar:true,registrarHaberes:true,gestionarAdelantos:true,pagarMovimiento:true,aprobarMovimiento:true},gastos:{administrar:true,eliminar:true},comisiones:{crear:true}}}},sisventas:{ctaemp:{},gastos:{}}};
 const auth={uid,token:{svLaborService:true,mode:'commit',opId,fence,digest,actorUid:uid,svFinancialAction:'empleados.bonificar',svFinancialActorRole:role,svFinancialPermissionRevision:7}};
 const next=clone(root);delete next.sv_labor_guard;next.sv_labor_receipts={[opId]:{fence,digest,actorUid:uid}};
 const evaluate=(expression,parts=[])=>vm.runInNewContext(expression,{auth,now,$op:opId,root:new Snapshot(root),data:new Snapshot(root,parts),newData:new Snapshot(next,parts)});
 return {root,next,auth,uid,role,evaluate,allowed:()=>evaluate(candidate.rules.sv_labor_receipts.$op['.write'],['sv_labor_receipts',opId]),previous:()=>evaluate(input.rules.sv_labor_receipts.$op['.write'],['sv_labor_receipts',opId])};
}

test('only restricts the mandatory receipt and preserves every other rule and the input',()=>{
 const before=clone(input),result=Builder.build(input,{expectedHash:Builder.hash(input)});
 assert.deepEqual(input,before);assert.deepEqual(changes(input,result),['rules/sv_labor_receipts/$op/.write']);
 assert.equal(result.rules.sv_labor_receipts.$op['.write'],'('+Builder.baselineReceipt+') && '+Builder.receiptContext);
 result.rules.sisventas.gastos['.indexOn'].push('consumer-change');assert.deepEqual(input.rules.sisventas.gastos['.indexOn'],['tipoPagable']);
});
test('pins the published semantic baseline and rejects any unreviewed source by default',()=>{
 assert.equal(Builder.BASELINE_HASH,'2cf231b801aa720eee482b3c1d3203b37b5ded6c2b99ae0d6009433e04e24aea');
 assert.throws(()=>Builder.build(input),/Base/);assert.throws(()=>Builder.build(input,{expectedHash:'b'.repeat(64)}),/Base/);
});
for(const change of ['unknown-receipt','ancestor-root','ancestor-domain','already-restricted'])test('rejects a reviewed hash with an unexpected structure: '+change,()=>{
 const value=clone(input);if(change==='unknown-receipt')value.rules.sv_labor_receipts.$op['.write']='true';if(change==='ancestor-root')value.rules['.write']='true';if(change==='ancestor-domain')value.rules.sisventas['.write']='true';if(change==='already-restricted')value.rules.sv_labor_receipts.$op['.write']=candidate.rules.sv_labor_receipts.$op['.write'];
 assert.throws(()=>Builder.build(value,{expectedHash:Builder.hash(value)}),/recibos|ancestro/);
});
for(const value of [null,{},[],{rules:[]},{rules:{}},{rules:{sisventas:[]}}])test('rejects malformed sources '+JSON.stringify(value),()=>assert.throws(()=>Builder.build(value,{expectedHash:Builder.hash(value)}),/Base|ancestro/));
test('valid signed user bonus context is admitted by the existing receipt fence',()=>assert.equal(fixture().allowed(),true));
test('revoking bonificar denies the receipt even though other admin actions still authorize both ledgers',()=>{
 const f=fixture();f.root.sv_permisos.admin.acciones.empleados.bonificar=false;
 assert.equal(f.evaluate(candidate.rules.sisventas.ctaemp['.write'],['sisventas','ctaemp']),true);
 assert.equal(f.evaluate(candidate.rules.sisventas.gastos['.write'],['sisventas','gastos']),true);
 assert.equal(f.previous(),true);assert.equal(f.allowed(),false);
});
for(const role of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico'])test('preserves an explicitly enabled existing role without granting ledger access: '+role,()=>{
 const f=fixture(role);assert.equal(f.allowed(),true);
 delete f.root.sv_permisos[role].acciones.empleados.bonificar;assert.equal(f.allowed(),role==='admin');
});
for(const role of ['distribuidor','distribuidora','compras_paraguay','unknown'])test('does not add an unsupported role: '+role,()=>assert.equal(fixture(role).allowed(),false));
test('preserves the original admin default when the role configuration is absent',()=>{
 const f=fixture();delete f.root.sv_permisos.admin;f.auth.token.svFinancialPermissionRevision=null;assert.equal(f.allowed(),true);
});
const variants=['permission','revision','module','index-version','inactive','role-current','role-claim','missing-profile','not-service','token-mode','guard-mode','uid','actor-uid','fence','operation','digest','expired','lease-missing','receipt-missing','receipt-fence','receipt-digest','receipt-actor','receipt-existing','guard-not-released','not-ready','wrong-schema','reset-required','password-required','access-version','permission-string'];
for(const variant of variants)test('rejects incomplete or revoked batch context: '+variant,()=>{
 const f=fixture(),p=f.root.sv_permisos.admin;
 if(variant==='permission')p.acciones.empleados.bonificar=false;if(variant==='revision')p.indiceRevision++;if(variant==='module')p.indiceModulos.empleados=false;if(variant==='index-version')p.indiceVersion=1;
 if(variant==='inactive')f.root.sv_chat_roles[f.uid].activo=false;if(variant==='role-current')f.root.sv_chat_roles[f.uid].rol='administrativo';if(variant==='role-claim')f.auth.token.svFinancialActorRole='administrativo';if(variant==='missing-profile')delete f.root.sv_chat_roles[f.uid];
 if(variant==='not-service')delete f.auth.token.svLaborService;if(variant==='token-mode')f.auth.token.mode='acquire';if(variant==='guard-mode')f.root.sv_labor_guard.mode='server';if(variant==='uid')f.auth.uid='other';if(variant==='actor-uid')f.auth.token.actorUid='other';
 if(variant==='fence')f.auth.token.fence='other';if(variant==='operation')f.auth.token.opId='other';if(variant==='digest')f.auth.token.digest='b'.repeat(64);if(variant==='expired')f.root.sv_labor_guard.expiresAt=999;if(variant==='lease-missing')delete f.root.sv_labor_guard;
 const receipt=f.next.sv_labor_receipts['bonus-batch-operation'];if(variant==='receipt-missing')delete f.next.sv_labor_receipts;if(variant==='receipt-fence')receipt.fence='other';if(variant==='receipt-digest')receipt.digest='other';if(variant==='receipt-actor')receipt.actorUid='other';if(variant==='receipt-existing')f.root.sv_labor_receipts=clone(f.next.sv_labor_receipts);if(variant==='guard-not-released')f.next.sv_labor_guard=clone(f.root.sv_labor_guard);
 if(variant==='not-ready')f.root.sv_labor_config.ready=false;if(variant==='wrong-schema')f.root.sv_labor_config.schema=2;if(variant==='reset-required')f.root.sv_access_resets={[f.uid]:{required:true}};if(variant==='password-required')f.auth.token.svPasswordChangeRequired=true;if(variant==='access-version')f.root.sv_access_resets={[f.uid]:{version:2}};if(variant==='permission-string')p.acciones.empleados.bonificar='true';
 assert.equal(f.allowed(),false);
});
test('a matching password access version remains valid',()=>{
 const f=fixture();f.root.sv_access_resets={[f.uid]:{version:'v2',required:false}};f.auth.token.svAccessVersion='v2';assert.equal(f.allowed(),true);
});
test('unrelated actions retain the exact previous receipt decision',()=>{
 for(const action of [undefined,'','gastos.administrar','gastos.eliminar','cobranzas.registrar','cobranzas.anular','mantenimiento.normalizar']){
  const f=fixture();f.auth.token.svFinancialAction=action;assert.equal(f.allowed(),f.previous(),String(action));
  f.root.sv_labor_guard.expiresAt=999;assert.equal(f.allowed(),f.previous(),String(action)+' expired');
 }
});
test('the preceding expense-removal revocation condition remains mandatory',()=>{
 const f=fixture();f.auth.token.svFinancialAction='gastos.eliminar';f.auth.token.svFinancialActorRole='admin';assert.equal(f.allowed(),true);
 f.root.sv_permisos.admin.acciones.gastos.eliminar=false;assert.equal(f.previous(),false);assert.equal(f.allowed(),false);
});
test('import is pure and never reads a private baseline or contacts a service',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../scripts/prepare-bonus-batch-rules.cjs'),'utf8'),calls=[],module={exports:{}};
 const context={module,structuredClone,console:{log(){calls.push('log');}},process:{argv:[]},require:name=>{
  if(name==='node:fs')return new Proxy({},{get(_target,key){calls.push('fs.'+String(key));throw Error('Filesystem side effect');}});
  if(name==='node:crypto'||name==='node:path')return require(name);
  if(name==='../cotizador/labor-fence-policy')return require('../cotizador/labor-fence-policy');
  if(name==='./prepare-expense-removal-rules.cjs')return Removal;
  throw Error('Unexpected dependency '+name);
 }};
 vm.runInNewContext(source,context);assert.equal(typeof module.exports.build,'function');assert.deepEqual(calls,[]);
});
