'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Builder=require('../scripts/prepare-sac-batch-rules.cjs'),Bonus=require('../scripts/prepare-bonus-batch-rules.cjs');
const Fence=require('../scripts/prepare-labor-fence-rules.cjs'),Removal=require('../scripts/prepare-expense-removal-rules.cjs');
const clone=value=>structuredClone(value);
function base(){
 const anyAction="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && (root.child('sv_permisos/admin/acciones/empleados/registrarHaberes').val() === true || root.child('sv_permisos/admin/acciones/empleados/bonificar').val() === true || root.child('sv_permisos/admin/acciones/gastos/administrar').val() === true)";
 const fenced=Fence.build({rules:{'.read':false,'.write':false,sisventas:{'.write':false,config:{'.write':false},gastos:{'.write':anyAction,'.read':'existing expense read','.indexOn':['tipoPagable'],$gasto:{'.validate':'existing validation'}},ctaemp:{'.write':anyAction,'.read':'existing account read',$empleado:{'.read':'existing employee account read'}},pagos:{'.write':false},auditoria_pagos:{'.write':false}},sv_permisos:{'.write':'auth != null'}}});
 const removed=Removal.build(fenced,{expectedHash:Removal.hash(fenced)});
 return Bonus.build(removed,{expectedHash:Bonus.hash(removed)});
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
function fixture(action='empleados.registrarHaberes',role='admin'){
 const now=1000,uid='fixture-user',opId='sac-batch-operation',fence='sac-batch-fence',digest='a'.repeat(64);
 const root={sv_labor_guard:{mode:'user',opId,fence,digest,actorUid:uid,expiresAt:2000},sv_labor_config:{schema:1,ready:true},sv_chat_roles:{[uid]:{activo:true,rol:role}},sv_permisos:{[role]:{indiceVersion:2,indiceRevision:7,indiceModulos:{empleados:true,configuracion:true,gastos:true,ctaemp:true},acciones:{empleados:{bonificar:true,registrarHaberes:true,gestionarAdelantos:true,pagarMovimiento:true,aprobarMovimiento:true},gastos:{administrar:true,eliminar:true},comisiones:{crear:true},mantenimiento:{migrar:true}}}},sisventas:{ctaemp:{},gastos:{}}};
 const auth={uid,token:{svLaborService:true,mode:'commit',opId,fence,digest,actorUid:uid,svFinancialAction:action,svFinancialActorRole:role,svFinancialPermissionRevision:7}};
 const next=clone(root);delete next.sv_labor_guard;next.sv_labor_receipts={[opId]:{fence,digest,actorUid:uid}};
 const evaluate=(expression,parts=[])=>vm.runInNewContext(expression,{auth,now,$op:opId,root:new Snapshot(root),data:new Snapshot(root,parts),newData:new Snapshot(next,parts)});
 return {root,next,auth,uid,role,evaluate,allowed:()=>evaluate(candidate.rules.sv_labor_receipts.$op['.write'],['sv_labor_receipts',opId]),previous:()=>evaluate(input.rules.sv_labor_receipts.$op['.write'],['sv_labor_receipts',opId])};
}

test('only restricts one mandatory receipt, preserving every existing grant and the input',()=>{
 const before=clone(input),result=Builder.build(input,{expectedHash:Builder.hash(input)});
 assert.deepEqual(input,before);assert.deepEqual(changes(input,result),['rules/sv_labor_receipts/$op/.write']);
 assert.equal(result.rules.sv_labor_receipts.$op['.write'],'('+Builder.baselineReceipt+') && '+Builder.receiptContext);
 result.rules.sisventas.gastos['.indexOn'].push('consumer-change');assert.deepEqual(input.rules.sisventas.gastos['.indexOn'],['tipoPagable']);
});
test('pins the published6 semantic baseline and rejects unreviewed sources by default',()=>{
 assert.equal(Builder.BASELINE_HASH,'a4b9a66f6ae6f272683bfcbf9c4cd6245436aa3f6bdc9e96de4aa098722ca4ad');
 assert.throws(()=>Builder.build(input),/Base/);assert.throws(()=>Builder.build(input,{expectedHash:'b'.repeat(64)}),/Base/);
});
for(const change of ['unknown-receipt','ancestor-root','ancestor-domain','already-restricted'])test('rejects unexpected reviewed structure: '+change,()=>{
 const value=clone(input);if(change==='unknown-receipt')value.rules.sv_labor_receipts.$op['.write']='true';if(change==='ancestor-root')value.rules['.write']='true';if(change==='ancestor-domain')value.rules.sisventas['.write']='true';if(change==='already-restricted')value.rules.sv_labor_receipts.$op['.write']=candidate.rules.sv_labor_receipts.$op['.write'];
 assert.throws(()=>Builder.build(value,{expectedHash:Builder.hash(value)}),/recibos|ancestro/);
});
for(const value of [null,{},[],{rules:[]},{rules:{}},{rules:{sisventas:[]}}])test('rejects malformed source '+JSON.stringify(value),()=>assert.throws(()=>Builder.build(value,{expectedHash:Builder.hash(value)}),/Base|ancestro/));
for(const action of ['empleados.registrarHaberes','mantenimiento.migrar']){
 const [domain,permission]=action.split('.'),module=domain==='empleados'?'empleados':'configuracion';
 test(action+' retains the valid signed user context',()=>assert.equal(fixture(action).allowed(),true));
 test(action+' revocation rejects the entire receipt even when gastos.administrar stays true',()=>{
  const f=fixture(action);f.root.sv_permisos.admin.acciones[domain][permission]=false;
  assert.equal(f.evaluate(candidate.rules.sisventas.gastos['.write'],['sisventas','gastos']),true);
  assert.equal(f.previous(),true);assert.equal(f.allowed(),false);
 });
 for(const variant of ['permission','permission-string','revision','module','index-version','inactive','role-current','role-claim','missing-profile','not-service','token-mode','guard-mode','uid','actor-uid','fence','operation','digest','expired','lease-missing','receipt-missing','receipt-fence','receipt-digest','receipt-actor','receipt-existing','guard-not-released','not-ready','wrong-schema','reset-required','password-required','access-version'])test(action+' rejects incomplete or revoked context: '+variant,()=>{
  const f=fixture(action),p=f.root.sv_permisos.admin;
  if(variant==='permission')p.acciones[domain][permission]=false;if(variant==='permission-string')p.acciones[domain][permission]='true';if(variant==='revision')p.indiceRevision++;if(variant==='module')p.indiceModulos[module]=false;if(variant==='index-version')p.indiceVersion=1;
  if(variant==='inactive')f.root.sv_chat_roles[f.uid].activo=false;if(variant==='role-current')f.root.sv_chat_roles[f.uid].rol='administrativo';if(variant==='role-claim')f.auth.token.svFinancialActorRole='administrativo';if(variant==='missing-profile')delete f.root.sv_chat_roles[f.uid];
  if(variant==='not-service')delete f.auth.token.svLaborService;if(variant==='token-mode')f.auth.token.mode='acquire';if(variant==='guard-mode')f.root.sv_labor_guard.mode='server';if(variant==='uid')f.auth.uid='other';if(variant==='actor-uid')f.auth.token.actorUid='other';
  if(variant==='fence')f.auth.token.fence='other';if(variant==='operation')f.auth.token.opId='other';if(variant==='digest')f.auth.token.digest='b'.repeat(64);if(variant==='expired')f.root.sv_labor_guard.expiresAt=999;if(variant==='lease-missing')delete f.root.sv_labor_guard;
  const receipt=f.next.sv_labor_receipts['sac-batch-operation'];if(variant==='receipt-missing')delete f.next.sv_labor_receipts;if(variant==='receipt-fence')receipt.fence='other';if(variant==='receipt-digest')receipt.digest='other';if(variant==='receipt-actor')receipt.actorUid='other';if(variant==='receipt-existing')f.root.sv_labor_receipts=clone(f.next.sv_labor_receipts);if(variant==='guard-not-released')f.next.sv_labor_guard=clone(f.root.sv_labor_guard);
  if(variant==='not-ready')f.root.sv_labor_config.ready=false;if(variant==='wrong-schema')f.root.sv_labor_config.schema=2;if(variant==='reset-required')f.root.sv_access_resets={[f.uid]:{required:true}};if(variant==='password-required')f.auth.token.svPasswordChangeRequired=true;if(variant==='access-version')f.root.sv_access_resets={[f.uid]:{version:2}};
  assert.equal(f.allowed(),false);
 });
 test(action+' retains original administrator defaults and matching access version',()=>{
  const f=fixture(action);delete f.root.sv_permisos.admin.acciones[domain][permission];assert.equal(f.allowed(),true);
  delete f.root.sv_permisos.admin;f.auth.token.svFinancialPermissionRevision=null;assert.equal(f.allowed(),true);
  f.root.sv_access_resets={[f.uid]:{version:'v2',required:false}};f.auth.token.svAccessVersion='v2';assert.equal(f.allowed(),true);
 });
}
for(const role of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico'])test('SAC retains explicitly enabled internal role: '+role,()=>{
 const f=fixture('empleados.registrarHaberes',role);assert.equal(f.allowed(),true);
 delete f.root.sv_permisos[role].acciones.empleados.registrarHaberes;assert.equal(f.allowed(),role==='admin');
});
for(const role of ['administrativo','vendedor','tecnico_vendedor','tecnico','distribuidor','unknown'])test('migration stays administrator-only despite explicit permission: '+role,()=>assert.equal(fixture('mantenimiento.migrar',role).allowed(),false));
for(const role of ['distribuidor','distribuidora','compras_paraguay','unknown'])test('SAC does not introduce unsupported role: '+role,()=>assert.equal(fixture('empleados.registrarHaberes',role).allowed(),false));
test('unrelated financial actions and prior restrictions retain the previous decision',()=>{
 for(const action of [undefined,'','gastos.administrar','gastos.eliminar','empleados.bonificar','cobranzas.registrar','cobranzas.anular','mantenimiento.normalizar']){
  const f=fixture();f.auth.token.svFinancialAction=action;f.root.sv_permisos.admin.acciones.empleados.registrarHaberes=false;f.root.sv_permisos.admin.acciones.mantenimiento.migrar=false;
  assert.equal(f.allowed(),f.previous(),String(action));f.root.sv_labor_guard.expiresAt=999;assert.equal(f.allowed(),f.previous(),String(action)+' expired');
 }
 for(const action of ['empleados.bonificar','gastos.eliminar']){
  const f=fixture(action),[domain,permission]=action.split('.');f.root.sv_permisos.admin.acciones[domain][permission]=false;
  assert.equal(f.previous(),false);assert.equal(f.allowed(),false);
 }
});
test('import is pure and never reads a private baseline or contacts a service',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../scripts/prepare-sac-batch-rules.cjs'),'utf8'),calls=[],module={exports:{}};
 const context={module,structuredClone,console:{log(){calls.push('log');}},process:{argv:[]},require:name=>{
  if(name==='node:fs')return new Proxy({},{get(_target,key){calls.push('fs.'+String(key));throw Error('Filesystem side effect');}});
  if(name==='node:crypto'||name==='node:path')return require(name);
  if(name==='./prepare-bonus-batch-rules.cjs')return Bonus;
  throw Error('Unexpected dependency '+name);
 }};
 vm.runInNewContext(source,context);assert.equal(typeof module.exports.build,'function');assert.deepEqual(calls,[]);
});
