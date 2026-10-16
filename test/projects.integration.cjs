'use strict';
const {test,before,after}=require('node:test'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const dep=createRequire(path.resolve(process.env.SV_SECURITY_TOOLS||'tmp/firebase-security-tools','package.json'));
const {initializeTestEnvironment,assertFails}=dep('@firebase/rules-unit-testing'),{ref,set,get,update}=dep('firebase/database');let env;
const assert=require('node:assert/strict'),{createProjects}=require('../cotizador/projects');
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador demo loopback');
 env=await initializeTestEnvironment({projectId:'demo-sisventas-projects',database:{host:'127.0.0.1',port:9005,rules:fs.readFileSync('security/database.password-access.candidate.json','utf8')}});
 await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{sv_chat_roles:{admin:{rol:'admin',activo:true},owner:{rol:'vendedor',activo:true},reader:{rol:'tecnico',activo:true},outside:{rol:'tecnico',activo:true}},sv_proyectos:{private:{owner:'owner',members:{owner:{access:'owner'},reader:{access:'viewer'}},name:'Ficticio'}}}));
});
after(async()=>env?.cleanup());
for(const uid of ['admin','owner','reader','outside'])test(uid+' no puede saltarse el servicio leyendo o escribiendo directamente proyectos',async()=>{
 const db=env.authenticatedContext(uid).database();
 for(const p of ['sv_proyectos','sv_proyectos/private','sv_proyectos/private/name'])await assertFails(get(ref(db,p)));
 await assertFails(set(ref(db,'sv_proyectos/private/name'),'No permitido'));
 await assertFails(update(ref(db),{'sv_proyectos/private/members/outside':{access:'owner'},'sv_proyectos/private/name':'Falso'}));
});
test('la colección privada tampoco queda expuesta al acceso anónimo',async()=>{
 const db=env.unauthenticatedContext().database();await assertFails(get(ref(db,'sv_proyectos')));await assertFails(set(ref(db,'sv_proyectos/new'),{name:'Falso'}));
});

test('el servicio guarda y recupera necesidades y borradores en RTDB real emulado',async()=>{
 const admin=require(process.env.SV_PROJECTS_ADMIN_MODULE||'firebase-admin');
 const app=admin.initializeApp({projectId:'demo-sisventas-projects',databaseURL:'https://demo-sisventas-projects.firebaseio.com'},'projects-integration');
 try{
  const db=app.database();await db.ref('sv_chat_directorio').set({owner:{nombre:'Responsable ficticio',activo:true},reader:{nombre:'Lector ficticio',activo:true}});
  const service=createProjects({auth:{verifyIdToken:async uid=>({uid})},db,enabled:true});
  const actor=await service.authorize({headers:{authorization:'Bearer owner'}});
  let {project:p}=await service.save(actor,{type:'create',data:{name:'Proyecto emulado',members:[{uid:'reader',access:'viewer'}]}});
  assert.deepEqual(p.needs,[]);assert.deepEqual(p.budgets,[]);
  ({project:p}=await service.save(actor,{type:'need-save',projectId:p.id,revision:p.revision,data:{title:'Relevar cableado',kind:'tarea',status:'pendiente'}}));
  assert.equal(p.needs[0].qty,null);
  ({project:p}=await service.save(actor,{type:'budget-brief',projectId:p.id,revision:p.revision,data:{title:'Alcance inicial',needIds:[p.needs[0].id]}}));
  assert.equal(p.budgets[0].needIds[0],p.needs[0].id);
  const reader=await service.authorize({headers:{authorization:'Bearer reader'}});
  await assert.rejects(service.save(reader,{type:'update',projectId:p.id,revision:p.revision,data:{...p,name:'No permitido'}}),e=>e.statusCode===403);
  const listed=(await service.list(actor)).projects.find(x=>x.id===p.id);assert.equal(listed.needs[0].qty,null);assert.equal(listed.budgets.length,1);
  const writes=await Promise.allSettled(['Primero','Segundo'].map(name=>service.save(actor,{type:'update',projectId:p.id,revision:p.revision,data:{...p,name}})));
  assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);assert.equal(writes.find(r=>r.status==='rejected').reason.statusCode,409);
  p=writes.find(r=>r.status==='fulfilled').value.project;
  ({project:p}=await service.save(actor,{type:'members',projectId:p.id,revision:p.revision,members:[]}));
  assert.equal((await service.list(reader)).projects.some(x=>x.id===p.id),false);
  await assert.rejects(service.save(reader,{type:'need-save',projectId:p.id,revision:p.revision,data:{title:'Intrusión',kind:'tarea',status:'pendiente'}}),e=>e.statusCode===404);
 }finally{await app.delete();}
});
