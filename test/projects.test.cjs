'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const M=require('../js/core/projects-model'),{createProjects}=require('../cotizador/projects');
const directory=[{uid:'owner',name:'Responsable'},{uid:'editor',name:'Colaborador'},{uid:'reader',name:'Lector'}];
const actor=(uid='owner',role='vendedor')=>({uid,name:uid,role,enabled:true,createAllowed:true,editAllowed:true,quoteAllowed:true});
const ctx=(id='record')=>({id,now:100,directory});
function project(){return M.apply(null,{type:'create',data:{name:'Proyecto de prueba',clientId:'c',clientName:'Cliente ficticio',members:[{uid:'editor',access:'editor'},{uid:'reader',access:'viewer'}]}},actor(),ctx('project'));}
test('el propietario permanece y los integrantes editan solo según el acceso asignado',()=>{
 const p=project();assert.equal(p.members.owner.access,'owner');assert.equal(M.view(p,actor('outside')),false);assert.equal(M.view(null,actor('admin','admin')),false);
 assert.equal(M.view(p,actor('reader')),true);assert.equal(M.edit(p,actor('reader')),false);assert.equal(M.edit(p,actor('editor')),true);assert.equal(M.manage(p,actor('editor')),false);
 assert.throws(()=>M.apply(p,{type:'members',revision:p.revision,members:[]},actor('editor'),ctx()),/responsable/);
 const revised=M.apply(p,{type:'members',revision:p.revision,members:[]},actor(),ctx());assert.deepEqual(Object.keys(revised.members),['owner']);assert.equal(M.view(revised,actor('editor')),false);
});
test('cantidad desconocida se conserva como pendiente y no se modifica el original',()=>{
 const p=project(),before=JSON.stringify(p);const n=M.apply(p,{type:'need-save',revision:p.revision,data:{title:'Recorrido de cable',area:'Exterior',kind:'material',qty:'',unit:'m',status:'revisar'}},actor('editor'),ctx());
 assert.equal(JSON.stringify(p),before);assert.equal(n.needs[0].qty,null);assert.equal(M.stats(n).pending,1);
 for(const qty of [-1,0,'infinito',100001])assert.throws(()=>M.apply(p,{type:'need-save',revision:p.revision,data:{title:'Prueba',kind:'equipo',qty,unit:'u',status:'pendiente'}},actor(),ctx()),/cantidad/);
});
test('revision obsoleta y solo lectura no reemplazan cambios',()=>{
 const p=project();assert.throws(()=>M.apply(p,{type:'update',revision:0,data:p},actor(),ctx()),e=>e.statusCode===409);
 assert.throws(()=>M.apply(p,{type:'need-remove',revision:p.revision,id:'other'},actor('reader'),ctx()),e=>e.statusCode===403);
 assert.throws(()=>M.apply(p,{type:'members',revision:p.revision,members:[{uid:'inactivo',access:'editor'}]},actor(),ctx()),/inactivo/);
});
test('los borradores solo incluyen necesidades existentes y no hacen cálculos comerciales',()=>{
 let p=project();p=M.apply(p,{type:'need-save',revision:p.revision,data:{title:'Instalación',kind:'mano',qty:4,unit:'horas',status:'definido'}},actor(),ctx('need'));
 const b=M.apply(p,{type:'budget-brief',revision:p.revision,data:{title:'Alternativa',needIds:['need']}},actor(),ctx('brief'));
 assert.equal(b.budgets[0].kind,'brief');assert.equal('total'in b.budgets[0],false);
 assert.throws(()=>M.apply(p,{type:'budget-brief',revision:p.revision,data:{title:'Error',needIds:['other']}},actor(),ctx()),/necesidades/);
 assert.throws(()=>M.apply(b,{type:'need-remove',revision:b.revision,id:'need'},actor(),ctx()),e=>e.statusCode===409);
});
test('vincular valida cliente, no duplica documentos y no permite trasplantar sus costos',()=>{
 const p=project(),quote={id:'quote',clientId:'c',title:'Propuesta',compra:900};
 const b=M.apply(p,{type:'budget-link',revision:p.revision,data:{total:1,compra:1}},actor(),{...ctx(),quote});assert.equal(b.budgets[0].sourceId,'quote');assert.equal('compra'in b.budgets[0],false);assert.equal('total'in b.budgets[0],false);
 assert.throws(()=>M.apply(p,{type:'budget-link',revision:p.revision,data:{}},actor(),{...ctx(),quote:{...quote,clientId:'other'}}),/mismo|cliente/);
 assert.throws(()=>M.apply(b,{type:'budget-link',revision:b.revision,data:{}},actor(),{...ctx('other'),quote}),e=>e.statusCode===409);
 assert.throws(()=>M.apply(b,{type:'update',revision:b.revision,data:{...b,clientId:'other'}},actor(),ctx()),e=>e.statusCode===409);
 const hidden=M.project(b,{...actor('reader'),quoteAllowed:false},[{...quote,total:100}]);assert.equal(hidden.budgets[0].kind,'restricted');assert.equal('quote'in hidden.budgets[0],false);assert.equal('sourceId'in hidden.budgets[0],false);
});
test('identificadores, estados heredados del prototipo y miembros repetidos se rechazan',()=>{
 for(const id of ['../a','__proto__','constructor','bad.id'])assert.throws(()=>M.key(id));
 const p=project();assert.throws(()=>M.apply(p,{type:'update',revision:p.revision,data:{...p,stage:'constructor'}},actor(),ctx()),/Estado/);
 assert.throws(()=>M.apply(p,{type:'members',revision:p.revision,members:[{uid:'reader',access:'viewer'},{uid:'reader',access:'editor'}]},actor(),ctx()),/repetido/);
});
function fixture(){
 const data={sv_chat_roles:{owner:{rol:'vendedor',activo:true},editor:{rol:'tecnico',activo:true},reader:{rol:'tecnico',activo:true},outside:{rol:'vendedor',activo:true}},sv_chat_directorio:Object.fromEntries(directory.map(p=>[p.uid,{nombre:p.name,activo:true}])),sisventas:{clientes:{c:{nombre:'Cliente',secret:'no exponer'}},presupuestos:{quote:{numero:'PP-PRUEBA',clienteFbKey:'c',total:100,compra:90,items:{a:{desc:'Equipo',qty:1,punit:100,compra:90}}}}}};
 const read=p=>p.split('/').reduce((o,k)=>o?.[k],data)??null;
 const write=(p,v)=>{const a=p.split('/'),last=a.pop();let o=data;for(const k of a)o=o[k]||(o[k]={});o[last]=structuredClone(v);};
 let lock=Promise.resolve(),counter=0;
 const db={ref:p=>({get:async()=>({val:()=>structuredClone(read(p))}),on:(_,fn)=>queueMicrotask(fn),off:()=>{},transaction:fn=>{const result=lock.then(()=>{const next=fn(structuredClone(read(p)));if(next===undefined)return {committed:false};write(p,next);return {committed:true,snapshot:{val:()=>structuredClone(next)}};});lock=result.catch(()=>{});return result;}})};
 const auth={verifyIdToken:async token=>{if(token==='bad')throw Error();return {uid:token};}};
 const service=createProjects({auth,db,enabled:true,now:()=>1000,uuid:()=> 'id-'+(++counter)});
 return {data,db,service,request:uid=>({headers:{authorization:'Bearer '+uid}})};
}
test('el servidor verifica sesión, módulo, identidad activa y bandera antes de leer proyectos',async()=>{
 const f=fixture();await assert.rejects(f.service.authorize({headers:{}}),e=>e.statusCode===401);await assert.rejects(f.service.authorize(f.request('bad')),e=>e.statusCode===401);
 f.data.sv_chat_roles.owner.activo=false;await assert.rejects(f.service.authorize(f.request('owner')),e=>e.statusCode===403);f.data.sv_chat_roles.owner.activo=true;
 f.data.sv_permisos={vendedor:{bloqueados:['proyectos']}};await assert.rejects(f.service.authorize(f.request('owner')),e=>e.statusCode===403);
 const disabled=createProjects({auth:{verifyIdToken:async()=>({uid:'reader'})},db:f.db});await assert.rejects(disabled.authorize(f.request('reader')),e=>e.statusCode===503);
});

test('permisos y nombre empiezan juntos después del rol válido y la autorización espera ambos',async()=>{
 for(const order of [['sv_permisos/vendedor','sv_chat_directorio/owner/nombre'],['sv_chat_directorio/owner/nombre','sv_permisos/vendedor']]){
  const f=fixture(),reads=[],gates=new Map();let finished=false;
  for(const path of order){let resolve;const promise=new Promise(done=>resolve=done);gates.set(path,{promise,resolve});}
  const original=f.db.ref;f.db.ref=path=>{const ref=original(path);return {...ref,get:()=>{reads.push(path);return gates.get(path)?.promise||ref.get();}};};
  const task=f.service.authorize(f.request('owner')).then(value=>{finished=true;return value;});
  await new Promise(setImmediate);
  assert.deepEqual(reads,['sv_chat_roles/owner','sv_permisos/vendedor','sv_chat_directorio/owner/nombre']);assert.equal(finished,false);
  const values={'sv_permisos/vendedor':{acciones:{proyectos:{crear:false,editar:true,presupuestar:false}}},'sv_chat_directorio/owner/nombre':'Nombre actual'};
  gates.get(order[0]).resolve({val:()=>values[order[0]]});await new Promise(setImmediate);assert.equal(finished,false);
  gates.get(order[1]).resolve({val:()=>values[order[1]]});const result=await task;
  assert.equal(result.name,'Nombre actual');assert.equal(result.createAllowed,false);assert.equal(result.editAllowed,true);assert.equal(result.quoteAllowed,false);
  assert.equal(reads.includes('sv_proyectos'),false);
 }
});

test('una petición nueva vuelve a verificar revocación y permisos sin reutilizar la autorización previa',async()=>{
 const {createBusinessAuth}=require('../cotizador/user-access'),f=fixture(),reads=[],checks=[];let revoked=false;
 f.data.sv_proyectos={one:project()};const original=f.db.ref;f.db.ref=path=>{reads.push(path);return original(path);};
 const auth=createBusinessAuth({verifyIdToken:async(token,checkRevoked)=>{checks.push(checkRevoked);if(revoked)throw Error('Revocada');return {uid:token};}},f.db);
 const service=createProjects({auth,db:f.db,enabled:true}),list=async()=>service.list(await service.authorize(f.request('owner')));
 assert.equal((await list()).projects.length,1);assert.ok(reads.includes('sv_access_resets/owner'));
 reads.length=0;f.data.sv_permisos={vendedor:{bloqueados:['proyectos']}};await assert.rejects(list(),e=>e.statusCode===403);
 assert.ok(reads.includes('sv_access_resets/owner'));assert.ok(reads.includes('sv_permisos/vendedor'));assert.equal(reads.includes('sv_proyectos'),false);
 reads.length=0;revoked=true;await assert.rejects(list(),e=>e.statusCode===401);assert.deepEqual(reads,[]);assert.deepEqual(checks,[true,true,true]);
});

test('rol inactivo, servicio apagado y acceso restablecido pendiente no consultan auxiliares ni devuelven proyectos',async()=>{
 const {createBusinessAuth}=require('../cotizador/user-access');
 for(const scenario of ['inactivo','apagado','clave-pendiente','version-antigua']){
  const f=fixture(),reads=[];f.data.sv_proyectos={one:project()};
  if(scenario==='inactivo')f.data.sv_chat_roles.owner.activo=false;
  if(scenario==='clave-pendiente')f.data.sv_access_resets={owner:{required:true}};
  if(scenario==='version-antigua')f.data.sv_access_resets={owner:{required:false,version:'nueva'}};
  const original=f.db.ref;f.db.ref=path=>{reads.push(path);return original(path);};
  const auth=createBusinessAuth({verifyIdToken:async(_,checkRevoked)=>{assert.equal(checkRevoked,true);return {uid:'owner',svAccessVersion:'anterior'};}},f.db);
  const service=createProjects({auth,db:f.db,enabled:scenario!=='apagado'});
  await assert.rejects(async()=>service.list(await service.authorize(f.request('owner'))),e=>e.statusCode===({inactivo:403,apagado:503,'clave-pendiente':401,'version-antigua':401})[scenario]);
  assert.ok(reads.includes('sv_access_resets/owner'));assert.equal(reads.includes('sv_permisos/vendedor'),false);assert.equal(reads.some(path=>path.startsWith('sv_chat_directorio/')),false);assert.equal(reads.includes('sv_proyectos'),false);
 }
});
test('el servidor filtra la lista, omite datos privados y resiste dos escrituras concurrentes',async()=>{
 const f=fixture(),owner=await f.service.authorize(f.request('owner'));const saved=await f.service.save(owner,{type:'create',data:{name:'Seguridad',clientId:'c',members:[{uid:'reader',access:'viewer'}]}});
 assert.equal((await f.service.list(await f.service.authorize(f.request('outside')))).projects.length,0);
 const reader=await f.service.authorize(f.request('reader'));assert.equal((await f.service.list(reader)).projects.length,1);assert.equal(reader.quoteAllowed,false);
 const p=saved.project;const updates=await Promise.allSettled(['Uno','Dos'].map(name=>f.service.save(owner,{type:'update',projectId:p.id,revision:p.revision,data:{...p,name}})));
 assert.equal(updates.filter(x=>x.status==='fulfilled').length,1);assert.equal(updates.find(x=>x.status==='rejected').reason.statusCode,409);
 const options=await f.service.options(owner,p.id);assert.equal(options.clients[0].secret,undefined);assert.equal(options.budgets[0].compra,undefined);assert.equal(options.budgets[0].items[0].compra,undefined);
 const latest=(await f.service.list(owner)).projects[0];const linked=await f.service.save(owner,{type:'budget-link',projectId:latest.id,revision:latest.revision,data:{sourceId:'quote'}});assert.equal(linked.project.budgets[0].quote.total,100);
 const r=(await f.service.list(reader)).projects[0];assert.equal(r.budgets[0].quote,undefined);
});
test('el modelo servido por Docker es la copia exacta de la fuente canónica del navegador',()=>{
 assert.equal(fs.readFileSync('js/core/projects-model.js','utf8').replaceAll('\r\n','\n'),fs.readFileSync('cotizador/projects-model.js','utf8').replaceAll('\r\n','\n'));
});

test('RTDB puede omitir arrays vacíos y cantidades desconocidas sin romper la edición',()=>{
 const p=project();delete p.needs;delete p.budgets;delete p.activity;
 const n=M.apply(p,{type:'need-save',revision:p.revision,data:{title:'Medir recorrido',kind:'tarea',status:'pendiente'}},actor(),ctx('need'));
 assert.equal(n.needs[0].qty,null);delete n.needs[0].qty;
 assert.equal(M.project(n,actor()).needs[0].qty,null);
 assert.deepEqual(M.project(p,actor()).budgets,[]);
});

test('Proyectos hereda el bloqueo de sesiones temporales y versiones anteriores de acceso',async()=>{
 const {createBusinessAuth}=require('../cotizador/user-access'),f=fixture();
 for(const token of [{uid:'owner',svPasswordChangeRequired:true},{uid:'owner',svAccessVersion:'old'}]){
  f.data.sv_access_resets={owner:{required:false,version:'new'}};
  const auth=createBusinessAuth({verifyIdToken:async(_,revoked)=>{assert.equal(revoked,true);return token;}},f.db);
  await assert.rejects(createProjects({auth,db:f.db,enabled:true}).authorize(f.request('owner')),e=>e.statusCode===401);
 }
});

test('listado vacío, proyectos ajenos o sin presupuesto vinculado no leen el historial comercial',async()=>{
 const f=fixture(),paths=[],original=f.db.ref;f.db.ref=p=>{paths.push(p);return original(p);};const own=actor();
 const list=await f.service.list(own);assert.equal(list.projects.length,0);assert.deepEqual(paths,['sv_proyectos']);
 f.data.sv_proyectos={one:project()};paths.length=0;assert.equal((await f.service.list(actor('outside'))).projects.length,0);assert.deepEqual(paths,['sv_proyectos']);
 paths.length=0;assert.equal((await f.service.list(own)).projects.length,1);assert.deepEqual(paths,['sv_proyectos']);
 f.data.sv_proyectos.one.budgets=[{id:'linked',kind:'linked',sourceId:'quote',title:'Vinculado',needIds:[]}];paths.length=0;
 assert.equal((await f.service.list(own)).projects[0].budgets[0].quote.total,100);assert.ok(paths.includes('sisventas/presupuestos'));
 paths.length=0;await f.service.list({...own,quoteAllowed:false});assert.deepEqual(paths,['sv_proyectos']);
});
