'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load,functionSource}=require('./helpers/app-functions.cjs');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const {fixture}=require('./helpers/startup-screen-fixture.cjs');

test('arranque real aplica permisos, prioriza la ruta y retira una única espera al recibir sus datos',async()=>{
 const f=fixture(),task=f.c.svIniciarCargaPantalla();await settle();f.flush();
 assert.deepEqual(f.calls,['permisos','ruta','datos']);assert.equal(f.boot.classList.contains('sv-intro-loading'),false);
 assert.equal(f.boot.style.display,'flex');assert.equal(f.message.textContent,'Esperando órdenes de trabajo, clientes, productos.');
 f.tick(300);f.tokens.clientes.ready();f.flush();
 f.tick(200);f.tokens.productos.ready();f.flush();assert.equal(f.message.textContent,'Esperando órdenes de trabajo.');
 f.tick(900);f.tokens.ordenes_trabajo.ready();f.flush();
 assert.equal((await task).ready,true);assert.equal(f.boot.style.display,'none');
 assert.equal(f.body.querySelector('[data-sv-data-status]'),null,'No aparece otra espera después de cerrar el inicio');
 assert.equal(f.now(),1400);
});

test('el reloj de3200ms no cierra la espera del módulo ni fuerza100% mientras falta OT',async()=>{
 const f=fixture();f.c.fbCargarTodo=()=>f.calls.push('datos');const task=f.c.svIniciarCargaPantalla();await settle();f.flush();
 for(const key of ['clientes','productos'])f.c.SVDataReadiness.beginSource(key).ready();f.flush();f.tick(3200);await settle();
 assert.equal(f.boot.style.display,'flex');assert.equal(f.bar.style.width,'67%');assert.equal(f.c.svEstadoCargaInicial().completo,false);
 f.c.svPintarCargaInicial();assert.equal(f.message.textContent,'Esperando órdenes de trabajo.','Un listener comercial legacy no pisa el progreso de la ruta');
 f.tick(9800);f.c.SVDataReadiness.beginSource('ordenes_trabajo').ready();f.flush();assert.equal((await task).ready,true);assert.equal(f.boot.style.display,'none');
});

test('si fallan los permisos no inicia datos y ofrece reintento en el mismo inicio',async()=>{
 const f=fixture({permissionFailure:true});const result=await f.c.svIniciarCargaPantalla();f.flush();
 assert.deepEqual(f.calls,['permisos']);assert.equal(result.ready,false);assert.equal(f.boot.style.display,'flex');assert.match(f.message.textContent,/permisos/);
 const retry=f.boot.querySelector('button');assert.equal(retry.textContent,'Reintentar carga');assert.equal(retry.disabled,false);assert.equal(retry.className,'btn btn-sm');
 f.permissionsFail(false);f.c.fbCargarTodo=()=>f.calls.push('datos');retry.onclick();await settle();f.flush();
 assert.equal(f.calls.filter(c=>c==='permisos').length,2);assert.equal(f.calls.filter(c=>c==='datos').length,1);assert.equal(f.boot.querySelector('button'),null);
 for(const key of ['clientes','productos','ordenes_trabajo'])f.c.SVDataReadiness.beginSource(key).ready();f.flush();await settle();assert.equal(f.boot.style.display,'none');
});

test('salir durante permisos no abre la ruta ni inicia datos y la respuesta anterior no tapa otra sesión',async()=>{
 const f=fixture({heldPermissions:true}),old=f.c.svIniciarCargaPantalla();await settle();
 f.c.isAuthenticated=false;f.emit('sisventas:session-ended');f.c.currentUserUid='otra-persona';f.c.fbAuth.currentUser={uid:'otra-persona'};f.boot.style.display='sesion-nueva';
 f.release();assert.equal((await old).cancelled,true);assert.deepEqual(f.calls,['permisos']);assert.equal(f.boot.style.display,'sesion-nueva');
});

test('salir antes de iniciar la promesa de permisos no genera una lectura tardía',async()=>{
 const f=fixture(),task=f.c.svIniciarCargaPantalla();f.c.isAuthenticated=false;f.emit('sisventas:session-ended');
 assert.equal((await task).cancelled,true);assert.deepEqual(f.calls,[]);
});

test('el arranque espera a que la página vuelva al frente antes de consultar permisos o datos',async()=>{
 const f=fixture();let visible;
 f.c.SVForegroundSession={waitVisible:()=>new Promise(resolve=>visible=resolve)};
 const task=f.c.svIniciarCargaPantalla();await settle();assert.deepEqual(f.calls,[]);
 visible();await settle();assert.deepEqual(f.calls,['permisos']);
 visible();await settle();f.flush();assert.deepEqual(f.calls,['permisos','ruta','datos']);
 for(const key of ['clientes','productos','ordenes_trabajo'])f.tokens[key].ready();f.flush();assert.equal((await task).ready,true);
});

for(const cancelled of [false,true])test('un fallo '+(cancelled?'de contexto de pantalla':'al abrir las fuentes')+' no se informa como permisos',async()=>{
 const f=fixture();
 if(cancelled)f.c.SVDataReadiness.waitForPage=async()=>({cancelled:true});
 else f.c.fbCargarTodo=()=>{throw Error('Inicializador ficticio fallido');};
 const result=await f.c.svIniciarCargaPantalla();f.flush();
 assert.deepEqual(Array.from(result.errors),['pantalla']);assert.equal(f.boot.style.display,'flex');assert.match(f.message.textContent,/preparar esta pantalla/);assert.doesNotMatch(f.message.textContent,/permisos/);
 assert.equal(f.boot.querySelector('button').disabled,false);
});

test('un error de datos muestra el error recuperable común y no otra espera incompleta',async()=>{
 const f=fixture();f.c.fbCargarTodo=()=>f.calls.push('datos');const task=f.c.svIniciarCargaPantalla();await settle();f.flush();
 for(const key of ['clientes','productos'])f.c.SVDataReadiness.beginSource(key).ready();f.c.SVDataReadiness.beginSource('ordenes_trabajo').error();f.flush();
 const result=await task;assert.equal(result.ready,false);assert.equal(f.boot.style.display,'none');
 const error=f.body.querySelector('[data-sv-data-status]');assert.equal(error.classList.contains('sv-data-error'),true);assert.match(error.querySelector('strong').textContent,/No se pudieron cargar/);assert.equal(error.querySelector('button').textContent,'Reintentar carga');
});

test('la función de entrada usa la espera real sin el cierre3200 ni el retardo de ruta2100',()=>{
 const entry=functionSource('_completarLogin');assert.match(entry,/svIniciarCargaPantalla\(\)/);assert.doesNotMatch(entry,/svEsperarCargaInicial\(3200\)|modoIntroRecarga|\}, 2100,/);
 const bootstrap=functionSource('fbCargarTodo');assert.ok(bootstrap.indexOf('svCargarDatosDePaginaActual();')<bootstrap.indexOf('fbCargarClientes();'));
});

test('permisos colgados vencen con reintento y el snapshot tardío no pisa la revisión del nuevo intento',async()=>{
 const f=fixture(),requests=[],applied=[];
 f.c.fbDB={};f.c.fbRef=(_db,path)=>path;f.c.svRutaPermisos=()=> 'sv_permisos';
 f.c.fbGet=ref=>{assert.equal(ref,'sv_permisos');return new Promise(resolve=>requests.push(resolve));};
 f.c.aplicarPermisosRolesGuardados=data=>{applied.push(data.revision);f.c.PERMISOS_ROLES.admin.indiceRevision=data.revision;};
 f.c.applyRole=()=>f.emit('sisventas:role-changed');
 load(f.c,['cargarPermisosRoles']);
 const old=f.c.svIniciarCargaPantalla();await settle();f.flush();assert.equal(requests.length,1);
 f.tick(15001);assert.equal((await old).ready,false);f.flush();
 assert.equal(f.boot.style.display,'flex');assert.match(f.message.textContent,/permisos/);assert.deepEqual(Array.from(f.c.SVDataReadiness.statusFor('dashboard').errors),[],'El plazo de datos no vence mientras se verifican permisos');
 f.boot.querySelector('button').onclick();await settle();f.flush();assert.equal(requests.length,2);
 requests[1]({val:()=>({revision:2})});await settle();f.flush();assert.deepEqual(applied,[2]);
 assert.equal(f.calls.filter(call=>call==='datos').length,1);assert.equal(f.boot.style.display,'flex');
 requests[0]({val:()=>({revision:99})});await settle();f.flush();assert.deepEqual(applied,[2],'El transporte SDK viejo termina, pero su respuesta ya no se aplica');
 f.tick(14999);assert.equal(f.boot.style.display,'flex');assert.deepEqual(Array.from(f.c.SVDataReadiness.statusFor('ordentrabajo').errors),[],'La pantalla conserva su propio plazo completo de datos');
 for(const key of ['clientes','productos','ordenes_trabajo'])f.tokens[key].ready();f.flush();await settle();assert.equal(f.boot.style.display,'none');
 assert.equal(f.c.PERMISOS_ROLES.admin.indiceRevision,2);assert.equal(requests.length,2);
});

test('cancelar con un GET SDK retenido libera la espera sin aplicar después su payload',async()=>{
 const f=fixture(),applied=[];let reply;
 f.c.fbDB={};f.c.fbRef=(_db,path)=>path;f.c.svRutaPermisos=()=> 'sv_permisos';f.c.fbGet=()=>new Promise(resolve=>reply=resolve);
 f.c.aplicarPermisosRolesGuardados=data=>applied.push(data);f.c.applyRole=()=>{};load(f.c,['cargarPermisosRoles']);
 const task=f.c.svIniciarCargaPantalla();await settle();f.c.isAuthenticated=false;f.emit('sisventas:session-ended');
 assert.equal((await task).cancelled,true);reply({val:()=>({revision:9})});await settle();assert.deepEqual(applied,[]);assert.deepEqual(f.calls,[]);
});
