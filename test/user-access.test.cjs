'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const {createUserAccess, createBusinessAuth} = require('../cotizador/user-access');
const {createPasswordEmail} = require('../cotizador/password-email');
const {build} = require('../scripts/prepare-password-access.cjs');
const {fixture}=require('./helpers/user-access-fixture.cjs');

const denied = (promise,status) => assert.rejects(promise,e=>e.statusCode===status);
test('Acceso: apagado por defecto y denegación de no-admin/inactivo/permiso bloqueado sin cambios Auth',async()=>{
  const f=fixture({enabled:false});await denied(f.service.temporary(f.request('admin'),{profileKey:'p'}),503);
  const g=fixture();await denied(g.service.temporary(g.request('other'),{profileKey:'p'}),403);
  g.data.sv_chat_roles.admin.activo=false;await denied(g.service.temporary(g.request('admin'),{profileKey:'p'}),403);
  g.data.sv_chat_roles.admin.activo=true;g.data.sv_permisos.admin={acciones:{usuarios:{gestionarClave:false}}};await denied(g.service.email(g.request('admin'),{profileKey:'p'}),403);
  assert.equal(g.updates.length,0);
});
test('Acceso: sesión admin antigua, UID ambiguo y correo divergente no pueden cambiar claves',async()=>{
  const f=fixture();f.tokens.admin.auth_time-=301;await denied(f.service.temporary(f.request('admin'),{profileKey:'p'}),401);
  f.tokens.admin.auth_time+=301;f.data.sv_usuarios.duplicate={...f.data.sv_usuarios.p};await denied(f.service.temporary(f.request('admin'),{profileKey:'p'}),409);
  delete f.data.sv_usuarios.duplicate;f.data.sv_usuarios.p.mail='different@example.test';await denied(f.service.email(f.request('admin'),{profileKey:'p'}),409);
  assert.equal(f.updates.length,0);assert.equal(f.emails.length,0);
});
test('Acceso: clave temporal solo en respuesta/Auth, bloqueo previo, cambio obligatorio y tokens viejos denegados',async()=>{
  const f=fixture(),before=JSON.stringify(f.data.sv_usuarios);
  const result=await f.service.temporary(f.request('admin'),{profileKey:'p',uid:'other'});
  assert.ok(result.password.length>=20);assert.equal(f.passwords.worker,result.password);
  assert.equal(JSON.stringify(f.data).includes(result.password),false);assert.equal(JSON.stringify(f.data.sv_usuarios),before);
  assert.equal(f.users.worker.customClaims.unrelated,true);
  const version=f.get('sv_access_resets/worker').version;
  f.tokens.temp={uid:'worker',...f.users.worker.customClaims,firebase:{sign_in_provider:'password'}};
  const business=createBusinessAuth(f.auth,f.db);
  await denied(business.verifyIdToken('old'),403);await denied(business.verifyIdToken('temp'),403);
  await denied(f.service.complete(f.request('old'),{password:'Another-strong-password'}),403);
  await denied(f.service.complete(f.request('temp'),{password:result.password}),400);
  await denied(f.service.complete(f.request('temp'),{password:'short'}),400);
  assert.equal((await f.service.complete(f.request('temp'),{password:'Personal-new-key-2026'})).completed,true);
  assert.equal(f.passwords.worker,'Personal-new-key-2026');assert.equal(f.get('sv_access_resets/worker').required,false);
  assert.equal(f.get('sv_access_resets/worker').digest,undefined);assert.equal(JSON.stringify(f.data).includes('Personal-new-key-2026'),false);
  await denied(business.verifyIdToken('old'),403);await denied(business.verifyIdToken('temp'),403);
  f.tokens.ready={uid:'worker',svAccessVersion:version,svPasswordChangeRequired:false};assert.equal((await business.verifyIdToken('ready')).uid,'worker');
});
test('Acceso: correo usa el email de Auth validado por UID, no el suministrado en la petición',async()=>{
  const f=fixture();assert.equal((await f.service.email(f.request('admin'),{profileKey:'p',email:'attacker@example.test'})).sent,true);
  assert.deepEqual(f.emails,['worker@example.test']);assert.equal(f.updates.length,0);
  await denied(f.service.email(f.request('admin'),{profileKey:'p'}),429);
});
test('Acceso: un fallo parcial mantiene bloqueo sin filtrar error/clave y permite recuperación controlada',async()=>{
  const f=fixture({failPassword:true});await assert.rejects(f.service.temporary(f.request('admin'),{profileKey:'p'}),e=>e.statusCode===503&&!e.message.includes('SENSITIVE'));
  assert.equal(f.users.worker.disabled,true);assert.equal(f.get('sv_access_resets/worker').required,true);assert.equal(f.get('sv_access_resets/worker').phase,'failed');
  await denied(createBusinessAuth(f.auth,f.db).verifyIdToken('old'),403);
});
test('Acceso: una operación en curso y una clave vencida no se completan ni se desbloquean',async()=>{
  const f=fixture();await f.service.temporary(f.request('admin'),{profileKey:'p'});f.advance();f.set('sv_access_resets/worker/phase','completing');
  await denied(f.service.temporary(f.request('admin'),{profileKey:'p'}),409);
  f.set('sv_access_resets/worker/phase','ready');f.set('sv_access_resets/worker/expiresAt',0);
  f.tokens.temp={uid:'worker',...f.users.worker.customClaims,firebase:{sign_in_provider:'password'}};
  await denied(f.service.complete(f.request('temp'),{password:'Personal-new-key-2026'}),403);assert.equal(f.get('sv_access_resets/worker').required,true);
});
test('Acceso: la bandera de habilitación no permite asignar claves si las reglas efectivas no están protegidas',async()=>{
  const f=fixture();f.db.getRulesJSON=async()=>({rules:{items:{'.read':true}}});
  await denied(f.service.temporary(f.request('admin'),{profileKey:'p'}),503);assert.equal(f.updates.length,0);
});
test('Correo Firebase: sin configuración falla cerrado; solicita plantilla PASSWORD_RESET sin enlaces o claves',async()=>{
  await denied(createPasswordEmail({})('a@example.test'),503);
  let request;const send=createPasswordEmail({apiKey:'FAKE_PUBLIC_KEY',fetchImpl:async(url,options)=>{request={url,...options};return {ok:true};}});
  await send('worker@example.test');assert.deepEqual(JSON.parse(request.body),{requestType:'PASSWORD_RESET',email:'worker@example.test'});
  assert.equal(request.url.startsWith('https://identitytoolkit.googleapis.com/'),true);
});
test('Reglas de clave temporal: composición conserva base/validaciones y no permite secretos bajo permiso padre',()=>{
  const base={rules:{'.read':false,'.write':false,items:{'.read':'auth != null','.write':'auth.uid === "a"','.validate':'newData.isString()'}}};
  const built=build(base);assert.equal(base.rules.items['.read'],'auth != null');assert.equal(built.rules.items['.validate'],base.rules.items['.validate']);
  assert.match(built.rules.items['.read'],/sv_access_resets/);assert.deepEqual(built.rules.sv_access_resets,{'.read':false,'.write':false});
  assert.throws(()=>build({rules:{'.read':true}}));assert.throws(()=>build(built));
});
