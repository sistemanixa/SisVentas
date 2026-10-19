'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build,RETIRE_OWN}=require('../scripts/prepare-presence-retirement.cjs'),password=require('../scripts/prepare-password-access.cjs');
const {rulesProtectPasswords,passwordGuardRequired,GUARD}=require('../cotizador/password-policy'),{chatPresenceRules}=require('../scripts/chat-presence-rules.cjs');
function baseline(){return password.build({rules:{'.read':false,'.write':false,sisventas:{'.read':false,'.write':false,presencia:{'.read':'auth != null','.write':'auth != null'}},sv_chat_presencia:chatPresenceRules(),sv_chat:{'.read':false,'.write':false}}});}
test('candidata offline modifica sólo el permiso de retirar la propia conexión',()=>{
 const before=baseline(),copy=structuredClone(before),after=build(before),node=after.rules.sv_chat_presencia.$uid.$session;
 assert.deepEqual(before,copy);assert.equal(node['.write'],'('+RETIRE_OWN+') || ('+before.rules.sv_chat_presencia.$uid.$session['.write']+')');
 node['.write']=before.rules.sv_chat_presencia.$uid.$session['.write'];assert.deepEqual(after,before);
});
test('la excepción exige propietario, fila existente y eliminación completa',()=>{
 assert.match(RETIRE_OWN,/auth != null/);assert.match(RETIRE_OWN,/auth.uid === \$uid/);assert.match(RETIRE_OWN,/data.exists\(\)/);assert.match(RETIRE_OWN,/data.child\('uid'\).val\(\) === auth.uid/);assert.match(RETIRE_OWN,/!newData.exists\(\)/);
});
test('rechaza concesiones padre, esquema distinto y base sin guard',()=>{
 for(const mutate of [r=>r.rules['.write']=true,r=>r.rules.sv_chat_presencia['.write']='auth != null',r=>delete r.rules.sv_access_resets,r=>r.rules.sv_chat_presencia.$uid.$session.$other['.validate']=true]){const r=baseline();mutate(r);assert.throws(()=>build(r));}
});
test('es idempotente y la política acepta únicamente la excepción revisada',()=>{
 const before=baseline(),candidate=build(before);assert.deepEqual(build(candidate),candidate);assert.equal(rulesProtectPasswords(before),true);assert.equal(rulesProtectPasswords(candidate),true);
 assert.throws(()=>password.build(candidate),/ya preparada/);
});
test('el validador rechaza excepciones alteradas, otras rutas, lecturas y permisos ajenos sin guard',()=>{
 for(const mutate of [
  r=>r.rules.sv_chat_presencia.$uid.$session['.write']=r.rules.sv_chat_presencia.$uid.$session['.write'].replace('auth.uid === $uid','auth.uid !== $uid'),
  r=>r.rules.sv_chat_presencia.$uid.$session['.write']=r.rules.sv_chat_presencia.$uid.$session['.write'].replace('data.exists() && ',''),
  r=>r.rules.sv_chat_presencia.$uid.$session['.write']=r.rules.sv_chat_presencia.$uid.$session['.write'].replace('!newData.exists()','newData.exists()'),
  r=>r.rules.sv_chat_presencia.$uid.$session['.read']=r.rules.sv_chat_presencia.$uid.$session['.write'],
  r=>r.rules.sisventas.presencia['.write']=r.rules.sv_chat_presencia.$uid.$session['.write'],
  r=>r.rules.sv_chat['.write']='auth != null',
  r=>r.rules.sv_chat_presencia.$uid.$session['.write']=r.rules.sv_chat_presencia.$uid.$session['.write'].replace(' || (',' || true || (')
 ]){const r=build(baseline());mutate(r);assert.equal(rulesProtectPasswords(r),false);}
});
test('un guard conjuntivo sigue siendo obligatorio después de limitarlo a registros propios',()=>{
 for(const expression of [GUARD,'('+GUARD+')','(allowed && '+GUARD+') && own','(allowed && '+GUARD+') && (admin || own)','(allowed && '+GUARD+') || (other && '+GUARD+')','('+GUARD+' && own) || false',GUARD+' && data.val().matches(/[()?|&]/)'])assert.equal(passwordGuardRequired(expression),true,expression);
 const r=baseline();r.rules.sisventas.ventas={'.read':'(allowed && '+GUARD+') && admin','.write':'(allowed && '+GUARD+') && (admin || own)'};assert.equal(rulesProtectPasswords(r),true);
});
test('OR sin protección, ternarios, negación, literales y guard simulado fallan cerrados',()=>{
 for(const expression of [GUARD+' || true','(allowed && '+GUARD+') || other','!('+GUARD+')',GUARD+' === false',GUARD+' && own ? true : true','choice ? '+GUARD+' : true','choice ? true : '+GUARD,'fn('+GUARD+')',JSON.stringify(GUARD),JSON.stringify('escaped \\" '+GUARD),"data.val().matches(/"+GUARD+"/)",'((allowed && '+GUARD+') || (other && true))','('+GUARD+'))','('+GUARD,GUARD+' && (own || other) || other',GUARD+' && own, true',GUARD+' && own; true'])assert.equal(passwordGuardRequired(expression),false,expression);
});
