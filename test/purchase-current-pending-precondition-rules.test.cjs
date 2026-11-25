'use strict';
// Predicate-only synthetic matrix, NOT a genuine command/native commit proof.
const {test}=require('node:test'),a=require('node:assert/strict'),Rule=require('../scripts/lib/purchase-current-pending-precondition-rules.cjs');
function fixture(){return{now:100,auth:{uid:'fiction',token:{svPurchaseSourceCostVersion:0,svPurchaseSourceCostKind:Rule.kind,svPurchaseSourceCostOrderKey:'order',svLaborService:true,mode:'commit',svFinancialAction:'ordenes.editar',actorUid:'fiction',fence:'fence',opId:'op',digest:'digest',svFinancialActorRole:'admin',svFinancialPermissionRevision:7,svAccessVersion:'qa'}},data:{sv_labor_guard:{mode:'user',actorUid:'fiction',fence:'fence',opId:'op',digest:'digest',expiresAt:200},sv_chat_roles:{fiction:{activo:true,rol:'admin'}},sv_permisos:{admin:{indiceVersion:2,indiceRevision:7,indiceModulos:{ordenes:true,configuracion:true},acciones:{ordenes:{editar:true},mantenimiento:{migrar:true}}}},sv_access_resets:{fiction:{required:false,version:'qa'}},sisventas:{ordenes:{order:{original:true}}}}};}
function root(value){return{child(path){let v=value;for(const k of String(path).split('/'))v=v?.[k];return root(v??null);},val(){return value??null;},exists(){return value!==undefined&&value!==null;},isNumber(){return typeof value==='number';},isString(){return typeof value==='string';}};}
function evaluate(expression,f){return Function('auth','root','now','return ('+expression+');')(f.auth,root(f.data),f.now);}
const input={rules:{'.read':false,'.write':true,sisventas:{'.write':'auth != null || auth.token.other === true',ordenes:{'.write':true,$record:{'.write':true,'.validate':'newData.exists()'}},$other:{'.write':true}},sv_labor_guard:{'.write':true},sv_labor_receipts:{$op:{'.write':true}},closed:{'.write':false}}};
function grants(node,out=[]){if(Object.hasOwn(node,'.write')&&node['.write']!==false)out.push(node['.write']);for(const[k,v]of Object.entries(node))if(!k.startsWith('.'))grants(v,out);return out;}
test('all grants including true root, parents, wildcard, guard and receipt are only narrowed',()=>{
 const original=structuredClone(input),result=Rule.prepare(input);a.deepEqual(input,original);a.equal(result.manifest.grantsAdded,false);a.equal(result.rules.rules.closed['.write'],false);a.equal(result.rules.rules.sisventas.ordenes.$record['.validate'],'newData.exists()');a.equal(grants(result.rules.rules).length,7);
 for(const expression of grants(result.rules.rules))a.equal(evaluate(expression,fixture()),true,'synthetic predicate control only');
});
const failures={
 version:f=>f.auth.token.svPurchaseSourceCostVersion=1,
 wrongAction:f=>f.auth.token.svFinancialAction='ordenes.eliminar',
 mode:f=>f.auth.token.mode='abort',service:f=>f.auth.token.svLaborService=false,
 actor:f=>f.auth.token.actorUid='other',guardActor:f=>f.data.sv_labor_guard.actorUid='other',
 guardMode:f=>f.data.sv_labor_guard.mode='server',fence:f=>f.data.sv_labor_guard.fence='other',
 operation:f=>f.data.sv_labor_guard.opId='other',digest:f=>f.data.sv_labor_guard.digest='other',expired:f=>f.data.sv_labor_guard.expiresAt=100,
 active:f=>f.data.sv_chat_roles.fiction.activo=false,role:f=>f.data.sv_chat_roles.fiction.rol='administrativo',
 claimedRole:f=>f.auth.token.svFinancialActorRole='administrativo',indexVersion:f=>f.data.sv_permisos.admin.indiceVersion=1,
 revision:f=>f.data.sv_permisos.admin.indiceRevision=8,orders:f=>f.data.sv_permisos.admin.indiceModulos.ordenes=false,
 config:f=>f.data.sv_permisos.admin.indiceModulos.configuracion=false,editar:f=>f.data.sv_permisos.admin.acciones.ordenes.editar=false,
 migrar:f=>f.data.sv_permisos.admin.acciones.mantenimiento.migrar=false,password:f=>f.auth.token.svPasswordChangeRequired=true,
 reset:f=>f.data.sv_access_resets.fiction.required=true,resetVersion:f=>f.data.sv_access_resets.fiction.version='new',
 order:f=>delete f.data.sisventas.ordenes.order
};
for(const[name,mutate]of Object.entries(failures))test('synthetic stale/forged '+name+' cannot bypass any ancestor or OR',()=>{
 const f=fixture();mutate(f);for(const expression of grants(Rule.prepare(input).rules.rules))a.equal(evaluate(expression,f),false);
});
test('other/default kinds retain each original grant exactly; no new branch authorizes writes',()=>{
 for(const kind of ['',undefined,'receive','prepare','reconcile']){const f=fixture();f.auth.token.svPurchaseSourceCostKind=kind;failures.role(f);const before=grants(input.rules),after=grants(Rule.prepare(input).rules.rules);for(let i=0;i<before.length;i++)a.equal(evaluate(after[i],f),evaluate(String(before[i]),f));}
});
