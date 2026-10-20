'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs');
const settle=()=>new Promise(setImmediate);
function trace(f,intercept=async()=>{}){
 const reads=[],ref=f.db.ref.bind(f.db);f.db.ref=path=>{const target=ref(path);return {...target,get:async()=>{reads.push(path);await intercept(path);return target.get();}};};return reads;
}
function contextOnce(reads){for(const p of ['sv_usuarios','sv_chat_roles','sv_permisos'])assert.equal(reads.filter(x=>x===p).length,1,p);}
function noBroad(reads){for(const p of ['sisventas/ventas','sisventas/presupuestos'])assert.ok(!reads.includes(p),p);}
test('un conjunto exacto comparte contexto fresco, deduplica IDs y omite faltantes o referencias inválidas',async()=>{
 const f=fixture(),actor=await f.auth('a','presupuestos'),reads=trace(f),before=structuredClone(f.db.root);
 f.db.root.sisventas.presupuestos.other={responsableUid:'b',total:20};const snapshot=structuredClone(f.db.root);
 const rows=await f.api.visibleRecordsByIds(actor,'presupuestos',['budget','budget','other','missing','../empleados',null,{}]);
 assert.deepEqual(Object.keys(rows),['budget']);assert.equal(rows.budget.total,200);contextOnce(reads);noBroad(reads);
 assert.deepEqual(reads.filter(p=>p.startsWith('sisventas/')).sort(),['sisventas/presupuestos/budget','sisventas/presupuestos/missing','sisventas/presupuestos/other']);assert.deepEqual(f.db.root,snapshot);assert.equal(before.sisventas.presupuestos.budget.total,200);
});
test('una nueva operación vuelve a leer contexto y propiedad sin reutilizar el resultado anterior',async()=>{
 const f=fixture(),actor=await f.auth('a','presupuestos'),reads=trace(f);
 assert.ok((await f.api.visibleRecordsByIds(actor,'presupuestos',['budget'])).budget);reads.length=0;
 f.db.root.sisventas.presupuestos.budget.responsableUid='b';assert.deepEqual(Object.keys(await f.api.visibleRecordsByIds(actor,'presupuestos',['budget'])),[]);contextOnce(reads);noBroad(reads);
});
test('ventas canónicas, fuente legacy, admin y Ver como conservan el mismo acceso de ficha puntual',async()=>{
 const f=fixture(),a=await f.auth('a'),b=await f.auth('b'),view=await f.auth('admin','ventas','b'),admin=await f.auth('admin');
 f.db.root.sisventas.ventas.one.responsableUid='a';const reads=trace(f);
 assert.deepEqual(Object.keys(await f.api.visibleRecordsByIds(a,'ventas',['one','converted','other'])).sort(),['converted','one']);
 assert.deepEqual(Object.keys(await f.api.visibleRecordsByIds(b,'ventas',['one','converted','other'])),['other']);
 assert.deepEqual(Object.keys(await f.api.visibleRecordsByIds(view,'ventas',['one','converted','other'])),['other']);
 assert.deepEqual(Object.keys(await f.api.visibleRecordsByIds(admin,'ventas',['one','converted','other'])).sort(),['converted','one','other']);noBroad(reads);
});
test('legados con más de30 vínculos usan un máximo de6 lecturas simultáneas y no descargan colecciones',async()=>{
 const f=fixture(),actor=await f.auth('a','presupuestos');for(let i=0;i<37;i++)f.db.root.sisventas.presupuestos['p'+i]={responsableUid:'a',total:i};
 const gates=[];let active=0,peak=0;const reads=trace(f,async path=>{if(!path.startsWith('sisventas/'))return;active++;peak=Math.max(peak,active);await new Promise(r=>gates.push(()=>{active--;r();}));});
 let finished=false;const pending=f.api.visibleRecordsByIds(actor,'presupuestos',Array.from({length:37},(_,i)=>'p'+i)).then(rows=>{finished=true;return rows;});
 await settle();assert.equal(peak,6);assert.equal(gates.length,6);
 while(!finished){for(const release of gates.splice(0))release();await settle();}
 assert.equal(Object.keys(await pending).length,37);assert.equal(peak,6);contextOnce(reads);noBroad(reads);
});
test('un fallo de infraestructura se propaga y no se convierte en una lista parcial autorizada',async()=>{
 const f=fixture(),actor=await f.auth('a','presupuestos');let pendingRelease;const error=Object.assign(Error('Falla ficticia'),{code:'UNAVAILABLE'});
 const reads=trace(f,async path=>{if(path.endsWith('/broken'))throw error;if(path.endsWith('/slow'))await new Promise(r=>pendingRelease=r);});
 const pending=f.api.visibleRecordsByIds(actor,'presupuestos',['broken','slow']);let ended=false;pending.catch(()=>{ended=true;});await settle();assert.equal(ended,false,'Espera consultas ya enviadas');pendingRelease();await assert.rejects(pending,e=>e===error);noBroad(reads);
});
test('conjunto vacío o sólo referencias inválidas no lee datos y dominio desconocido falla cerrado',async()=>{
 const f=fixture(),actor=await f.auth('a'),reads=trace(f);
 for(const ids of [[],['../root',null,{}]])assert.deepEqual(Object.keys(await f.api.visibleRecordsByIds(actor,'ventas',ids)),[]);
 await assert.rejects(f.api.visibleRecordsByIds(actor,'usuarios',['a']),{statusCode:404});await assert.rejects(f.api.visibleRecordsByIds(actor,'ventas','one'),{statusCode:404});assert.deepEqual(reads,[]);
});
test('claves heredadas con espacios y Unicode conservan acceso y no se confunden con identidades',async()=>{
 const f=fixture(),actor=await f.auth('a','presupuestos'),ids=['presupuesto legado','Presupuesto ñ 日本語','x'.repeat(128)];
 for(const id of ids)f.db.root.sisventas.presupuestos[id]={responsableUid:'a',total:100};
 f.db.root.sisventas.presupuestos['ajeno ñ']={responsableUid:'b',total:200};const reads=trace(f);
 const rows=await f.api.visibleRecordsByIds(actor,'presupuestos',[...ids,'ajeno ñ']);
 assert.deepEqual(Object.keys(rows).sort(),ids.sort());assert.equal(rows['Presupuesto ñ 日本語'].total,100);contextOnce(reads);noBroad(reads);
 assert.deepEqual(reads.filter(p=>p.startsWith('sisventas/')).sort(),[...ids,'ajeno ñ'].map(id=>'sisventas/presupuestos/'+id).sort());
});
test('claves especiales, controles y rutas se descartan antes de cualquier lectura',async()=>{
 const f=fixture(),actor=await f.auth('a','presupuestos'),reads=trace(f);
 const invalid=['__proto__','constructor','prototype','hasOwnProperty','a/b','a.b','a#b','a$b','a[b','a]b','a\u0000b','a\u007fb','x'.repeat(129),'',12];
 assert.deepEqual(Object.keys(await f.api.visibleRecordsByIds(actor,'presupuestos',invalid)),[]);assert.deepEqual(reads,[]);
});
test('un contexto fallido espera las consultas ya iniciadas y no empieza lecturas de fichas',async()=>{
 const f=fixture(),actor=await f.auth('a','presupuestos'),pending=[],error=Object.assign(Error('Contexto ficticio no disponible'),{code:'UNAVAILABLE'});
 const reads=trace(f,async path=>{if(path==='sv_usuarios')throw error;if(['sv_chat_roles','sv_permisos'].includes(path))await new Promise(resolve=>pending.push(resolve));});
 let ended=false;const request=f.api.visibleRecordsByIds(actor,'presupuestos',['budget']);request.catch(()=>{ended=true;});
 await settle();assert.equal(ended,false);assert.equal(pending.length,2);assert.equal(reads.some(p=>p.startsWith('sisventas/')),false);
 for(const release of pending)release();await assert.rejects(request,e=>e===error);assert.equal(reads.length,3);
});
