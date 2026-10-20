'use strict';
const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const {createProjects} = require('../cotizador/projects');
const Model = require('../cotizador/projects-model');
const previousOwnership = process.env.COMMERCIAL_OWNERSHIP_ENABLED;
before(() => {process.env.COMMERCIAL_OWNERSHIP_ENABLED = 'true';});
after(() => {if(previousOwnership === undefined) delete process.env.COMMERCIAL_OWNERSHIP_ENABLED; else process.env.COMMERCIAL_OWNERSHIP_ENABLED = previousOwnership;});
const actor = (uid='owner', extra={}) => ({uid,name:'Autor vigente',role:'vendedor',enabled:true,createAllowed:true,editAllowed:true,quoteAllowed:true,clientAllowed:true,...extra});
function fixture() {
  const data = {
    sv_usuarios: {one:{uid:'owner',nombre:'Responsable ficticio',rol:'vendedor'},two:{uid:'other',nombre:'Otra persona',rol:'vendedor'}},
    sv_chat_roles: {owner:{activo:true,rol:'vendedor'},other:{activo:true,rol:'vendedor'}},
    sv_chat_directorio: {owner:{nombre:'Responsable ficticio'},other:{nombre:'Otra persona'}},
    sv_permisos: {vendedor:{indiceVersion:2,indiceModulos:{proyectos:true,presupuesto:true,clientes:true},bloqueados:[]}},
    sv_proyectos: {},
    sisventas: {clientes:{client:{nombre:'Cliente ficticio'}},presupuestos:{
      quote:{numero:'PP-DEMO',clienteFbKey:'client',responsableUid:'owner',tituloSolucion:'Título inicial',total:100,compra:70,items:[{desc:'Equipo ficticio',qty:2,punit:50,compra:35}]},
      other:{numero:'PP-AJENO',clienteFbKey:'client',responsableUid:'other',total:999,items:[]}
    }}
  };
  const reads=[],events=[],authCalls=[],failures=new Map(); let sequence=0,lock=Promise.resolve(),afterCommit=null,beforeRead=null;
  const get = path => path.split('/').reduce((node,key) => node && Object.hasOwn(node,key) ? node[key] : null,data) ?? null;
  function set(path,value) {const parts=path.split('/'),last=parts.pop();let node=data;for(const key of parts)node=node[key] ||= {};node[last]=structuredClone(value);}
  const db={ref(path) {return {
    async get() {reads.push(path);if(beforeRead)await beforeRead(path);if(failures.has(path))throw failures.get(path);return {val:()=>structuredClone(get(path))};},
    on(type,next) {events.push(['on',path,type]);queueMicrotask(() => next({val:()=>structuredClone(get(path))}));},
    off(type) {events.push(['off',path,type]);},
    transaction(update) {const task=lock.then(() => {events.push(['tx',path]);const next=update(structuredClone(get(path)));if(next===undefined)return {committed:false};set(path,next);if(afterCommit)afterCommit(path);return {committed:true,snapshot:{val:()=>structuredClone(next)}};});lock=task.catch(()=>{});return task;}
  };}};
  const auth={async verifyIdToken(token,revoked) {authCalls.push({token,revoked});if(token==='revoked')throw Error('Revocado');return {uid:token};}};
  const service=createProjects({auth,db,enabled:true,now:()=>1000,uuid:()=> 'operation-'+(++sequence)});
  const project=Model.apply(null,{type:'create',data:{name:'Proyecto ficticio',clientId:'client',members:[]}},actor(),{directory:[{uid:'owner',name:'Nombre conservado'}],id:'project',now:100});
  data.sv_proyectos.project=project;
  return {data,reads,events,authCalls,failures,service,project,setAfterCommit(callback){afterCommit=callback;},setBeforeRead(callback){beforeRead=callback;},
    request(uid='owner'){return {headers:{authorization:'Bearer '+uid}};},
    link(sourceId='quote',id='linked') {project.budgets.push({id,kind:'linked',sourceId,title:'Snapshot conservado',needIds:[],createdAt:100});},
    need(extra={}) {return {type:'need-save',projectId:'project',revision:project.revision,data:{title:'Relevar cable',kind:'tarea',status:'pendiente'},...extra};}
  };
}
const noCollections = reads => assert.ok(!reads.includes('sisventas/presupuestos')&&!reads.includes('sisventas/ventas'),'No descargar historiales comerciales');
const flush = () => new Promise(resolve => setImmediate(resolve));
function retainLinkedReads(f) {
  const started=[],pending=[];let active=0,peak=0;
  f.setBeforeRead(async path => {
    if(!path.startsWith('sisventas/presupuestos/'))return;
    started.push(path);active++;peak=Math.max(peak,active);
    try {await new Promise((resolve,reject) => pending.push({resolve,reject}));} finally {active--;}
  });
  return {started,pending,get peak(){return peak;},release(){for(const read of pending.splice(0))read.resolve();}};
}
function legacyLinks(f,count=37) {
  for(let i=0;i<count;i++) {
    const id='legacy-'+i;
    f.data.sisventas.presupuestos[id]={...f.data.sisventas.presupuestos.other,numero:'PP-LEGACY-'+i,total:i+1};
    f.link(id,'linked-'+i);
  }
}
function linkedListFixture() {
  const f=fixture();
  f.data.sisventas.presupuestos.second={...f.data.sisventas.presupuestos.quote,numero:'PP-SEGUNDO',total:250};
  f.data.sisventas.presupuestos.deleted={...f.data.sisventas.presupuestos.quote,eliminado:true};
  f.data.sisventas.presupuestos.hidden={...f.data.sisventas.presupuestos.quote,numero:'PP-OCULTO'};
  f.data.sisventas.presupuestos.unlinked={...f.data.sisventas.presupuestos.quote,numero:'PP-DISPONIBLE'};
  for(const id of ['quote','other','deleted','missing','../other','other/nested'])f.link(id,'link-'+f.project.budgets.length);
  f.data.sv_proyectos.second={...structuredClone(f.project),id:'second-project',name:'Segundo proyecto',updatedAt:200,budgets:[
    {id:'duplicate',kind:'linked',sourceId:'quote',title:'Otro título conservado',needIds:[]},
    {id:'second',kind:'linked',sourceId:'second',title:'Segundo vínculo',needIds:[]},
    {id:'brief',kind:'brief',title:'Alcance sin emitir',notes:'Conservar',needIds:[]}
  ]};
  f.data.sv_proyectos.hidden={...structuredClone(f.project),id:'hidden-project',owner:'other',members:{other:{access:'owner',name:'Otra persona'}},budgets:[{id:'hidden',kind:'linked',sourceId:'hidden',title:'Proyecto ajeno',needIds:[]}]};
  return f;
}
async function broadListProjection(f,person=actor()) {
  // Options conserva la búsqueda amplia original y la misma proyección de precio.
  const {budgets}=await f.service.options(person);
  return {canCreate:person.createAllowed,projects:Object.values(f.data.sv_proyectos).filter(p=>Model.view(p,person)).map(p=>Model.project(p,person,budgets)).sort((a,b)=>b.updatedAt-a.updatedAt)};
}

test('crear sin vínculos sólo consulta el directorio requerido y conserva autor y nombres', async () => {
  const f=fixture(),result=await f.service.save(actor(),{type:'create',data:{name:'Nuevo proyecto',members:[{uid:'other',access:'viewer'}]}});
  assert.deepEqual(f.reads.sort(),['sv_chat_directorio','sv_chat_roles']);
  assert.equal(result.project.members.owner.name,'Responsable ficticio');assert.equal(result.project.members.other.name,'Otra persona');
  assert.equal(result.project.activity[0].actor,'Autor vigente');assert.equal(result.project.revision,1);assert.equal(f.events.filter(e=>e[0]==='tx').length,1);
});

test('guardar una necesidad sin vínculos realiza cero GET auxiliares y libera su escucha', async () => {
  const f=fixture(),result=await f.service.save(actor(),f.need());
  assert.deepEqual(f.reads,[]);assert.equal(result.project.needs[0].title,'Relevar cable');assert.equal(result.project.members.owner.name,'Nombre conservado');
  assert.deepEqual(f.events.map(e=>e[0]),['on','tx','off']);
});

test('actualizar ficha y quitar necesidad o borrador no consultan directorios ni presupuestos', async () => {
  for(const type of ['update','need-remove','budget-remove']) {
    const f=fixture(),body={type,projectId:'project',revision:1,id:'missing',data:{...f.project,name:'Nueva ficha'}};
    await f.service.save(actor(),body);assert.deepEqual(f.reads,[]);assert.equal(f.data.sv_proyectos.project.revision,2);
  }
});

test('integrantes conserva consulta de cuentas activas y autorización exclusiva del responsable', async () => {
  const f=fixture();await f.service.save(actor(),{type:'members',projectId:'project',revision:1,members:[{uid:'other',access:'editor'}]});
  assert.deepEqual(f.reads.sort(),['sv_chat_directorio','sv_chat_roles']);assert.equal(f.data.sv_proyectos.project.members.owner.access,'owner');
  f.data.sv_chat_roles.other.activo=false;
  await assert.rejects(f.service.save(actor(),{type:'members',projectId:'project',revision:2,members:[{uid:'other',access:'editor'}]}),{statusCode:400});
  await assert.rejects(f.service.save(actor('other'),{type:'members',projectId:'project',revision:2,members:[]}),{statusCode:403});
});

test('resuelve sólo la ficha vinculada usando propiedad comercial y proyección segura', async () => {
  const f=fixture();f.link();const result=await f.service.save(actor(),f.need());
  noCollections(f.reads);assert.deepEqual(f.reads.filter(p=>p.startsWith('sisventas/')),['sisventas/presupuestos/quote']);
  assert.equal(f.reads.includes('sv_chat_directorio'),false);assert.equal(f.reads.length,4);
  assert.equal(result.project.budgets[0].title,'Snapshot conservado');assert.equal(result.project.budgets[0].quote.title,'Título inicial');
  assert.equal(result.project.budgets[0].quote.total,100);assert.equal('compra' in result.project.budgets[0].quote,false);assert.equal('compra' in result.project.budgets[0].quote.items[0],false);
});

test('vínculos repetidos se resuelven una vez y borradores no provocan GET', async () => {
  const f=fixture();f.link();f.link('quote','linked-duplicate');f.project.budgets.push({id:'brief',kind:'brief',title:'Alcance',needIds:[]});
  const result=await f.service.save(actor(),f.need());
  assert.equal(f.reads.filter(p=>p==='sisventas/presupuestos/quote').length,1);assert.equal(result.project.budgets.length,3);noCollections(f.reads);
});

test('varios vínculos comparten un contexto comercial dentro de la operación y leen sólo sus fichas', async () => {
  const f=fixture();f.data.sisventas.presupuestos.second={...f.data.sisventas.presupuestos.quote,numero:'PP-SEGUNDO'};
  f.link();f.link('second','linked-second');f.link('quote','duplicate');
  const result=await f.service.save(actor(),f.need());
  assert.equal(f.reads.length,5);assert.equal(f.reads.filter(p=>p==='sv_usuarios').length,1);assert.equal(f.reads.filter(p=>p==='sv_chat_roles').length,1);assert.equal(f.reads.filter(p=>p==='sv_permisos').length,1);
  assert.deepEqual(f.reads.filter(p=>p.startsWith('sisventas/')).sort(),['sisventas/presupuestos/quote','sisventas/presupuestos/second']);
  assert.equal(result.project.budgets.length,3);noCollections(f.reads);
});

test('presupuesto ajeno, eliminado, ausente o referencia inválida quedan restringidos sin filtrar detalles', async () => {
  for(const id of ['other','missing','deleted','../other','other/nested']) {
    const f=fixture();f.data.sisventas.presupuestos.deleted={...f.data.sisventas.presupuestos.quote,eliminado:true};f.link(id);
    const result=await f.service.save(actor(),f.need()),linked=result.project.budgets[0];
    assert.equal(linked.kind,'restricted');assert.equal('quote' in linked,false);assert.equal('sourceId' in linked,false);noCollections(f.reads);
    assert.ok(!f.reads.some(p=>p.includes('..')||p.endsWith('/other/nested')));
  }
});

test('actor sin permiso de presupuestos no consulta ni devuelve datos comerciales', async () => {
  const f=fixture();f.link();const result=await f.service.save(actor('owner',{quoteAllowed:false}),f.need());
  assert.deepEqual(f.reads,[]);assert.equal(result.project.budgets[0].kind,'restricted');assert.equal('sourceId' in result.project.budgets[0],false);
});

test('fallo de infraestructura sigue rechazando en vez de presentar presupuesto inexistente', async () => {
  const f=fixture();f.link();const failure=Object.assign(Error('Servicio temporalmente no disponible'),{statusCode:503});
  f.failures.set('sisventas/presupuestos/quote',failure);
  await assert.rejects(f.service.save(actor(),f.need()),error=>error===failure);
  assert.equal(f.data.sv_proyectos.project.revision,2);assert.equal(f.events.at(-1)[0],'off');
});

test('vincular valida antes de guardar y relee después de la transacción sin descargar otros presupuestos', async () => {
  const f=fixture();f.setAfterCommit(()=>{f.data.sisventas.presupuestos.quote.tituloSolucion='Título actualizado';});
  const result=await f.service.save(actor(),{type:'budget-link',projectId:'project',revision:1,data:{sourceId:'quote'}});
  assert.equal(f.reads.length,8);assert.equal(f.reads.filter(p=>p==='sisventas/presupuestos/quote').length,2);noCollections(f.reads);
  assert.equal(result.project.budgets[0].title,'Título inicial');assert.equal(result.project.budgets[0].quote.title,'Título actualizado');
});

test('propiedad cambiada durante el guardado restringe la respuesta sin reutilizar la ficha previa', async () => {
  const f=fixture();f.setAfterCommit(()=>{f.data.sisventas.presupuestos.quote.responsableUid='other';});
  const result=await f.service.save(actor(),{type:'budget-link',projectId:'project',revision:1,data:{sourceId:'quote'}});
  assert.equal(result.project.budgets[0].kind,'restricted');assert.equal('quote' in result.project.budgets[0],false);
  assert.equal('sourceId' in result.project.budgets[0],false);assert.equal(f.data.sv_proyectos.project.budgets[0].sourceId,'quote');
});

test('vincular una ficha ajena o ausente conserva404 y no inicia la transacción', async () => {
  for(const id of ['other','missing']) {
    const f=fixture();await assert.rejects(f.service.save(actor(),{type:'budget-link',projectId:'project',revision:1,data:{sourceId:id}}),{statusCode:404});
    assert.equal(f.events.length,0);noCollections(f.reads);
  }
});

test('revisión antigua y proyecto ajeno o de sólo lectura no escriben ni resuelven vínculos', async () => {
  for(const [person,revision,status] of [[actor(),0,409],[actor('outside'),1,404],[actor('owner',{editAllowed:false}),1,403]]) {
    const f=fixture();f.link();const before=structuredClone(f.project);
    await assert.rejects(f.service.save(person,f.need({revision})),{statusCode:status});
    assert.deepEqual(f.project,before);assert.deepEqual(f.reads,[]);assert.equal(f.events.at(-1)[0],'off');
  }
});

test('autorizar cada operación vuelve a verificar Auth y permisos vigentes sin caché entre peticiones', async () => {
  const f=fixture();await f.service.save(await f.service.authorize(f.request()),f.need());
  f.data.sv_permisos.vendedor.bloqueados=['proyectos'];
  await assert.rejects(f.service.authorize(f.request()),{statusCode:403});
  assert.equal(f.authCalls.length,2);assert.ok(f.authCalls.every(call=>call.revoked===true));
});

test('compatibilidad sin ownership mantiene proyección y sólo lee el presupuesto exacto', async () => {
  process.env.COMMERCIAL_OWNERSHIP_ENABLED='false';
  try {
    const f=fixture();f.link('other');const result=await f.service.save(actor(),f.need());
    assert.deepEqual(f.reads,['sisventas/presupuestos/other']);assert.equal(result.project.budgets[0].quote.total,999);noCollections(f.reads);
  } finally {process.env.COMMERCIAL_OWNERSHIP_ENABLED='true';}
});

test('sin variable ownership los 37 vínculos legados conservan visibilidad con un máximo de seis GET simultáneos', async () => {
  delete process.env.COMMERCIAL_OWNERSHIP_ENABLED;
  const f=fixture();legacyLinks(f);const held=retainLinkedReads(f),pending=f.service.save(actor(),f.need());
  try {
    await flush();assert.equal(held.started.length,6);assert.equal(held.peak,6);
    for(let wave=0;wave<7;wave++){held.release();await flush();}
    const result=await pending;
    assert.equal(held.started.length,37);assert.equal(held.peak,6);assert.equal(result.project.budgets.length,37);
    assert.deepEqual(result.project.budgets.map(b=>b.quote.total),Array.from({length:37},(_,i)=>i+1));
    assert.ok(result.project.budgets.every(b=>b.kind==='linked'));noCollections(f.reads);
    assert.equal(f.reads.length,37);assert.equal(f.events.at(-1)[0],'off');
  } finally {held.release();await pending.catch(()=>{});process.env.COMMERCIAL_OWNERSHIP_ENABLED='true';}
});

test('sin variable ownership un fallo detiene la cola y espera los otros GET ya iniciados antes de rechazar', async () => {
  delete process.env.COMMERCIAL_OWNERSHIP_ENABLED;
  const f=fixture();legacyLinks(f);const held=retainLinkedReads(f),failure=Object.assign(Error('Lectura interrumpida'),{statusCode:503});
  let settled=false;const pending=f.service.save(actor(),f.need()).then(value=>({value}),error=>({error})).finally(()=>{settled=true;});
  try {
    await flush();assert.equal(held.started.length,6);
    held.pending.shift().reject(failure);await flush();
    assert.equal(settled,false,'La respuesta debe esperar las otras cinco lecturas en vuelo');assert.equal(held.started.length,6);
    held.release();const result=await pending;
    assert.equal(result.error,failure);assert.equal(held.started.length,6);assert.equal(held.peak,6);noCollections(f.reads);
    assert.equal(f.data.sv_proyectos.project.revision,2);assert.equal(f.events.at(-1)[0],'off');
  } finally {held.release();await pending;process.env.COMMERCIAL_OWNERSHIP_ENABLED='true';}
});

test('el guardado conserva la proyección de un presupuesto con clave heredada de espacios y Unicode', async () => {
  const f=fixture(),id='presupuesto legado ñ';f.data.sisventas.presupuestos[id]={...f.data.sisventas.presupuestos.quote};f.link(id);
  const result=await f.service.save(actor(),f.need());
  assert.equal(result.project.budgets[0].kind,'linked');assert.equal(result.project.budgets[0].sourceId,id);
  assert.equal(result.project.budgets[0].quote.id,id);assert.equal(result.project.budgets[0].quote.total,100);
  assert.equal(f.reads.filter(p=>p==='sisventas/presupuestos/'+id).length,1);noCollections(f.reads);
});

test('listado resuelve IDs únicos de todos los proyectos visibles con un solo contexto y conserva la proyección amplia', async () => {
  const f=linkedListFixture(),expected=await broadListProjection(f),before=structuredClone(f.data);f.reads.length=0;
  const result=await f.service.list(actor());
  assert.deepEqual(result,expected);assert.deepEqual(f.data,before);assert.deepEqual(f.events,[]);noCollections(f.reads);
  assert.equal(result.projects.length,2);assert.deepEqual(result.projects.map(p=>p.id),['second-project','project']);
  assert.deepEqual(f.reads.filter(p=>p.startsWith('sisventas/')).sort(),['deleted','missing','other','quote','second'].map(id=>'sisventas/presupuestos/'+id));
  for(const path of ['sv_usuarios','sv_chat_roles','sv_permisos'])assert.equal(f.reads.filter(p=>p===path).length,1);
  assert.equal(f.reads.length,9);assert.equal(result.projects[1].budgets.filter(b=>b.kind==='restricted').length,5);
  assert.equal(result.projects[0].budgets[0].title,'Otro título conservado');assert.equal(result.projects[0].budgets[2].notes,'Conservar');
});

test('listado sin permiso de presupuestos mantiene todos los vínculos restringidos y cero lecturas comerciales', async () => {
  const f=linkedListFixture(),person=actor('owner',{quoteAllowed:false}),expected=await broadListProjection(f,person);f.reads.length=0;
  const result=await f.service.list(person);
  assert.deepEqual(result,expected);assert.deepEqual(f.reads,['sv_proyectos']);
  assert.ok(result.projects.flatMap(p=>p.budgets).every(b=>b.kind==='restricted'&&!('sourceId' in b)&&!('quote' in b)));
});

test('proyectos ocultos y vínculos inválidos no aportan IDs ni obligan a leer contexto o historiales', async () => {
  const f=linkedListFixture();delete f.data.sv_proyectos.second;
  f.project.budgets=f.project.budgets.filter(b=>b.sourceId.includes('/'));
  const expected=await broadListProjection(f);f.reads.length=0;
  const result=await f.service.list(actor());assert.deepEqual(result,expected);assert.deepEqual(f.reads,['sv_proyectos']);
});

test('listado con ownership apagado o ausente conserva visibilidad heredada leyendo sólo las fichas vinculadas', async () => {
  try {
    for(const mode of ['false',undefined]) {
      if(mode===undefined)delete process.env.COMMERCIAL_OWNERSHIP_ENABLED;else process.env.COMMERCIAL_OWNERSHIP_ENABLED=mode;
      const f=linkedListFixture(),expected=await broadListProjection(f);f.reads.length=0;
      const result=await f.service.list(actor());assert.deepEqual(result,expected);noCollections(f.reads);
      assert.equal(result.projects[1].budgets.find(b=>b.sourceId==='other').quote.total,999);
      assert.equal(f.reads.length,6);assert.deepEqual(f.reads.filter(p=>p.startsWith('sisventas/')).sort(),['deleted','missing','other','quote','second'].map(id=>'sisventas/presupuestos/'+id));
    }
  } finally {process.env.COMMERCIAL_OWNERSHIP_ENABLED='true';}
});

test('listado agrupa 37 legados entre proyectos y limita seis lecturas también sin ownership', async () => {
  try {
    for(const mode of ['true',undefined]) {
      if(mode===undefined)delete process.env.COMMERCIAL_OWNERSHIP_ENABLED;else process.env.COMMERCIAL_OWNERSHIP_ENABLED=mode;
      const f=fixture();legacyLinks(f);for(const p of Object.values(f.data.sisventas.presupuestos))p.responsableUid='owner';
      f.data.sv_proyectos.second={...structuredClone(f.project),id:'second',updatedAt:200,budgets:f.project.budgets.splice(18)};
      const expected=await broadListProjection(f);f.reads.length=0;
      const held=retainLinkedReads(f),pending=f.service.list(actor());
      try {
        await flush();assert.equal(held.started.length,6);
        for(let wave=0;wave<7;wave++){held.release();await flush();}
        const result=await pending;assert.deepEqual(result,expected);assert.equal(held.started.length,37);assert.equal(held.peak,6);noCollections(f.reads);
        if(mode==='true')for(const path of ['sv_usuarios','sv_chat_roles','sv_permisos'])assert.equal(f.reads.filter(p=>p===path).length,1);
      } finally {held.release();await pending.catch(()=>{});}
    }
  } finally {process.env.COMMERCIAL_OWNERSHIP_ENABLED='true';}
});

test('fallo en un listado detiene nuevas fichas y espera las ya iniciadas sin devolver datos parciales', async () => {
  try {
    for(const mode of ['true',undefined]) {
      if(mode===undefined)delete process.env.COMMERCIAL_OWNERSHIP_ENABLED;else process.env.COMMERCIAL_OWNERSHIP_ENABLED=mode;
      const f=fixture();legacyLinks(f);const before=structuredClone(f.data),held=retainLinkedReads(f),failure=Object.assign(Error('Servicio no disponible'),{statusCode:503});
      let settled=false;const pending=f.service.list(actor()).then(value=>({value}),error=>({error})).finally(()=>{settled=true;});
      try {
        await flush();assert.equal(held.started.length,6);held.pending.shift().reject(failure);await flush();
        assert.equal(settled,false);assert.equal(held.started.length,6);held.release();
        const result=await pending;assert.equal(result.error,failure);assert.equal('value' in result,false);assert.equal(held.started.length,6);noCollections(f.reads);
        assert.deepEqual(f.data,before);assert.deepEqual(f.events,[]);
      } finally {held.release();await pending;}
    }
  } finally {process.env.COMMERCIAL_OWNERSHIP_ENABLED='true';}
});

test('opciones sigue ofreciendo presupuestos disponibles que ningún proyecto tiene vinculado', async () => {
  const f=linkedListFixture(),result=await f.service.options(actor());
  assert.ok(f.reads.includes('sisventas/presupuestos'));assert.ok(result.budgets.some(b=>b.id==='unlinked'));assert.ok(result.budgets.some(b=>b.id==='hidden'));
  assert.equal(result.budgets.some(b=>b.id==='other'||b.id==='deleted'),false);
});
