'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCommissionOperations}=require('../cotizador/commission-operations');
const {digest}=require('../cotizador/labor-guard');

function fixture({role='admin',blocked,distribute,active=true,permissions}={}){
 const config=permissions===undefined?{indiceRevision:7,...(blocked===undefined?{}:{bloqueados:blocked}),...(distribute===undefined?{}:{acciones:{comisiones:{distribuir:distribute}}})}:permissions,token={uid:'fixture-user',name:'Persona ficticia'},reads=[];
 const service=createCommissionOperations({auth:{async verifyIdToken(value,revoked){assert.equal(value,'FICTICIO');assert.equal(revoked,true);return token;}},db:{ref(path){reads.push(path);return {async get(){return {val:()=>path==='sv_chat_roles/'+token.uid?{activo:active,rol:role,nombre:'Persona ficticia'}:config};}};}}});
 return {config,token,reads,authorize:()=>service.authorize({headers:{authorization:'Bearer FICTICIO'}})};
}

test('redistribución permite bloqueos ajenos ausentes, en array o como objeto disperso sin perder contexto de permisos',async()=>{
 for(const blocked of [undefined,null,[],{},['productos'],[null,'productos'],{2:'productos',9:'agenda'}, {2:null,9:' productos '}]){
  const f=fixture({blocked,distribute:true}),actor=await f.authorize();
  assert.equal(actor.uid,'fixture-user');assert.equal(actor.role,'admin');assert.equal(actor.permissionRevision,7);assert.equal(actor.permissionDigest,digest(f.config));assert.equal(actor.claims,f.token);assert.equal(f.reads.length,2);
 }
});

test('redistribución bloqueada conserva403 tanto para arrays como para objetos dispersos aunque distribuir sea true',async()=>{
 for(const blocked of [['productos','comisiones'],{3:'productos',11:'comisiones'},[null,' comisiones '],{3:null,11:' comisiones '}]){
  const f=fixture({blocked,distribute:true});await assert.rejects(f.authorize(),error=>error.statusCode===403&&/permiso/.test(error.message));
 }
});

test('la configuración o los bloqueos malformados fallan cerrados con403 incluso para admin',async()=>{
 for(const permissions of [false,true,0,5,'', 'comisiones',[]]){
  await assert.rejects(fixture({permissions}).authorize(),{statusCode:403});
 }
 for(const blocked of [false,true,0,5,'','comisiones', [''],[' '],[false],[true],[1],{9:1},{9:false},{9:{modulo:'comisiones'}},[['comisiones']]]){
  await assert.rejects(fixture({blocked,distribute:true}).authorize(),{statusCode:403});
 }
});

test('ausencia de configuración conserva los permisos heredados sin convertir formas inválidas en ausencia',async()=>{
 assert.equal((await fixture({permissions:null}).authorize()).role,'admin');
 for(const role of ['administrativo','vendedor'])await assert.rejects(fixture({role,permissions:null}).authorize(),{statusCode:403});
});

test('permiso explícito false rechaza administrador y empleado sin depender de la forma de bloqueos',async()=>{
 for(const role of ['admin','administrativo','vendedor'])for(const blocked of [[],{4:'productos'}]){
  await assert.rejects(fixture({role,blocked,distribute:false}).authorize(),{statusCode:403});
 }
});

test('permiso heredado conserva administrador y exige autorización explícita a los demás roles',async()=>{
 assert.equal((await fixture({blocked:{4:'productos'}}).authorize()).role,'admin');
 for(const role of ['administrativo','tecnico','vendedor','tecnico_vendedor']){
  await assert.rejects(fixture({role,blocked:{4:'productos'}}).authorize(),{statusCode:403});
  assert.equal((await fixture({role,blocked:{4:'productos'},distribute:true}).authorize()).role,role);
 }
});

test('un usuario desactivado o rol externo no llega a consultar el permiso de redistribución',async()=>{
 for(const config of [{active:false},{role:'distribuidor'}]){
  const f=fixture({...config,distribute:true});await assert.rejects(f.authorize(),{statusCode:403});assert.equal(f.reads.length,1);
 }
});
