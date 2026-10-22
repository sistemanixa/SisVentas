'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {restrict,hash}=require('../scripts/prepare-payment-index-rules.cjs'),{build}=require('../scripts/prepare-labor-fence-rules.cjs');
const clone=value=>structuredClone(value);
function candidate(){const input=build({rules:{'.write':false,sisventas:{'.write':false,config:{'.write':false},pagos:{'.write':false},gastos:{'.read':'auth != null','.write':false,$gasto:{'.validate':'true'}},ctaemp:{'.read':'auth != null','.write':false,$empleado:{'.read':'auth != null'}},auditoria_pagos:{'.read':'auth != null','.write':false}}}});return {input,result:restrict(input,{expectedHash:hash(input)})};}
function at(root,parts){let value=root;for(const part of parts){if(value===null||typeof value!=='object'||!Object.hasOwn(value,part))return null;value=value[part];}return value??null;}
class Snapshot{
 constructor(root,parts=[]){this.root=root;this.parts=parts;}
 val(){return at(this.root,this.parts);}
 child(path){return new Snapshot(this.root,[...this.parts,...String(path).split('/')]);}
 parent(){return new Snapshot(this.root,this.parts.slice(0,-1));}
 exists(){return this.val()!==null;}
 isNumber(){return typeof this.val()==='number';}
 isString(){return typeof this.val()==='string';}
 hasChildren(keys){return keys.every(key=>this.child(key).exists());}
}
function fixture(){
 const now=1000,opId='removal-operation',fence='removal-fence',digest='a'.repeat(64),uid='admin',auditKey='audit-demo';
 const root={sv_labor_guard:{opId,fence,digest,actorUid:uid,mode:'user',expiresAt:2000},sv_labor_config:{schema:1,ready:true},sv_chat_roles:{admin:{activo:true,rol:'admin'}},sv_permisos:{admin:{indiceVersion:2,indiceRevision:7,indiceModulos:{gastos:true},acciones:{gastos:{administrar:false,eliminar:true}}}},sisventas:{gastos:{g:{monto:100,montoPagado:100,estado:'pagado'}},ctaemp:{e:{m:{monto:100}}}}};
 const auth={uid,token:{svLaborService:true,mode:'commit',opId,fence,digest,actorUid:uid,svFinancialAction:'gastos.eliminar',svFinancialActorRole:'admin',svFinancialPermissionRevision:7}};
 const next=clone(root);delete next.sv_labor_guard;next.sv_labor_receipts={[opId]:{fence,digest,actorUid:uid}};
 const marker={uid,usuario:'Admin ficticio',ts:1000,auditKey},audit={accion:'baja_administrativa_gasto',gastoFbKey:'g',gastoAnterior:clone(root.sisventas.gastos.g),uid,usuario:marker.usuario,ts:marker.ts};
 next.sisventas.gastos.g.bajaAdministrativa=marker;next.sisventas.auditoria_pagos={[auditKey]:audit};
 const rules=candidate().result.rules.sisventas;
 function allowed(kind){
  const paths={marker:'sisventas/gastos/g/bajaAdministrativa',expense:'sisventas/gastos/g',audit:'sisventas/auditoria_pagos/audit-demo',movement:'sisventas/ctaemp/e/m'},expressions={marker:rules.gastos.$gasto.bajaAdministrativa['.write'],expense:rules.gastos.$gasto['.write'],audit:rules.auditoria_pagos.$audit['.write'],movement:rules.ctaemp.$empleado.$movimiento['.write']},parts=paths[kind].split('/');
  return vm.runInNewContext(expressions[kind],{auth,now,root:new Snapshot(root),data:new Snapshot(root,parts),newData:new Snapshot(next,parts),$gasto:'g',$audit:auditKey,$empleado:'e',$movimiento:'m'});
 }
 return {root,next,auth,marker,audit,allowed};
}
test('la candidata conserva los padres, las lecturas y las validaciones anteriores',()=>{
 const {input,result}=candidate(),before=clone(input);assert.deepEqual(input,before);
 for(const domain of ['gastos','auditoria_pagos','ctaemp'])for(const key of ['.write','.read','.indexOn'])assert.deepEqual(result.rules.sisventas[domain][key],input.rules.sisventas[domain][key]);
 assert.equal(result.rules.sisventas.gastos.$gasto['.validate'],input.rules.sisventas.gastos.$gasto['.validate']);assert.equal(result.rules.sisventas.ctaemp.$empleado['.read'],input.rules.sisventas.ctaemp.$empleado['.read']);assert.equal(result.rules.sisventas.ctaemp.$empleado['.write'],undefined);
 assert.deepEqual(result.rules.sisventas.haberes,input.rules.sisventas.haberes);assert.deepEqual(result.rules.sisventas.ventas,input.rules.sisventas.ventas);assert.deepEqual(result.rules.sisventas.gastos_adjuntos,input.rules.sisventas.gastos_adjuntos);
});
test('administrar falso y eliminar verdadero admiten sólo el contexto interno exacto',()=>{
 const f=fixture();assert.equal(f.allowed('marker'),true);assert.equal(f.allowed('audit'),true);delete f.next.sisventas.gastos.g;assert.equal(f.allowed('expense'),true);delete f.next.sisventas.ctaemp.e.m;assert.equal(f.allowed('movement'),true);
});
for(const variant of ['not-service','action','role-claim','uid','actor-uid','inactive','role-current','permission','module','index-version','revision','expired','fence','digest','operation','lease-user-mode','receipt','release','not-ready','reset-required','password-required','access-version'])test('rechaza contexto interno incompleto o revocado: '+variant,()=>{
 const f=fixture();
 if(variant==='not-service')delete f.auth.token.svLaborService;if(variant==='action')delete f.auth.token.svFinancialAction;if(variant==='role-claim')f.auth.token.svFinancialActorRole='administrativo';if(variant==='uid')f.auth.uid='other';if(variant==='actor-uid')f.auth.token.actorUid='other';if(variant==='inactive')f.root.sv_chat_roles.admin.activo=false;if(variant==='role-current')f.root.sv_chat_roles.admin.rol='administrativo';if(variant==='permission')f.root.sv_permisos.admin.acciones.gastos.eliminar=false;if(variant==='module')f.root.sv_permisos.admin.indiceModulos.gastos=false;if(variant==='index-version')f.root.sv_permisos.admin.indiceVersion=1;if(variant==='revision')f.root.sv_permisos.admin.indiceRevision++;if(variant==='expired')f.root.sv_labor_guard.expiresAt=999;if(variant==='fence')f.auth.token.fence='other';if(variant==='digest')f.auth.token.digest='b'.repeat(64);if(variant==='operation')f.auth.token.opId='other';if(variant==='lease-user-mode')f.root.sv_labor_guard.mode='server';if(variant==='receipt')delete f.next.sv_labor_receipts;if(variant==='release')f.next.sv_labor_guard=clone(f.root.sv_labor_guard);if(variant==='not-ready')f.root.sv_labor_config.ready=false;if(variant==='reset-required')f.root.sv_access_resets={admin:{required:true}};if(variant==='password-required')f.auth.token.svPasswordChangeRequired=true;if(variant==='access-version')f.root.sv_access_resets={admin:{version:2}};
 assert.equal(f.allowed('marker'),false);delete f.next.sisventas.gastos.g;delete f.next.sisventas.ctaemp.e.m;assert.equal(f.allowed('expense'),false);assert.equal(f.allowed('movement'),false);assert.equal(f.allowed('audit'),false);
});
test('las concesiones nuevas no admiten edición de gasto ni de movimiento',()=>{
 const f=fixture();f.next.sisventas.gastos.g.monto=99;f.next.sisventas.ctaemp.e.m.monto=99;assert.equal(f.allowed('expense'),false);assert.equal(f.allowed('movement'),false);
});
for(const variant of ['missing-audit','wrong-action','wrong-expense','wrong-uid','wrong-user','wrong-time','existing-audit','existing-marker','missing-expense'])test('marker debe ser nuevo y enlazar la auditoría nueva del mismo commit: '+variant,()=>{
 const f=fixture();
 if(variant==='missing-audit')delete f.next.sisventas.auditoria_pagos;if(variant==='wrong-action')f.audit.accion='other';if(variant==='wrong-expense')f.audit.gastoFbKey='other';if(variant==='wrong-uid')f.audit.uid='other';if(variant==='wrong-user')f.audit.usuario='other';if(variant==='wrong-time')f.audit.ts++;if(variant==='existing-audit')f.root.sisventas.auditoria_pagos={'audit-demo':clone(f.audit)};if(variant==='existing-marker')f.root.sisventas.gastos.g.bajaAdministrativa=clone(f.marker);if(variant==='missing-expense')delete f.root.sisventas.gastos.g;
 assert.equal(f.allowed('marker'),false);
});
test('un gasto archivado no recibe concesión para purga física',()=>{
 const f=fixture();f.root.sisventas.gastos.g.bajaAdministrativa=clone(f.marker);delete f.next.sisventas.gastos.g;assert.equal(f.allowed('expense'),false);
});
test('auditoría estrecha sólo se crea con acción y UID de eliminación',()=>{
 for(const action of ['baja_administrativa_gasto','eliminar_gasto','eliminar_adelanto_vinculado']){const f=fixture();f.audit.accion=action;assert.equal(f.allowed('audit'),true);}
 const f=fixture();f.audit.accion='other';assert.equal(f.allowed('audit'),false);f.audit.accion='eliminar_gasto';f.audit.uid='other';assert.equal(f.allowed('audit'),false);f.audit.uid='admin';f.root.sisventas.auditoria_pagos={'audit-demo':{prior:true}};assert.equal(f.allowed('audit'),false);
});
test('un wildcard descendiente desconocido no se convierte en concesión',()=>{
 const {input}=candidate();input.rules.sisventas.gastos.$gasto['.write']='true';assert.throws(()=>restrict(input),/no reconocida/);delete input.rules.sisventas.gastos.$gasto['.write'];input.rules.sisventas.ctaemp.$other={};assert.throws(()=>restrict(input),/ambiguo/);
});
