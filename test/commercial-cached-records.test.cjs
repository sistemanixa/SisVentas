'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/core/commercial-ownership.js','utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>value===null?null:JSON.parse(JSON.stringify(value));
function setup(transport){
 const listeners={},calls=[],delivered=[];
 const c={window:null,currentUserUid:'owner-a',currentRole:'administrativo',PERMISOS_ROLES:{administrativo:{indiceRevision:7},admin:{indiceRevision:2}},fbAuth:{currentUser:{uid:'owner-a',getIdToken:async()=>'fictitious-token'}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'http://transport.invalid'},AbortSignal,queueMicrotask,document:{hidden:false,addEventListener:(name,fn)=>listeners[name]=fn,getElementById:()=>null},addEventListener(){},console:{warn(){}}};
 c.window=c;c.fetch=async(url,options)=>{calls.push({url,options});return transport?transport(url,options):response({visible:{responsableUid:'owner-a',items:[{cod:'DEMO',qty:2}],total:100}});};
 vm.runInNewContext(source,c);
 return {c,calls,listeners,delivered,api:c.SVCommercialOwnership,async load(domain='ventas'){c.SVCommercialOwnership.onValue(domain,snapshot=>delivered.push(plain(snapshot.val())));await turn();}};
}
function response(records,etag='W/"fictitious-1"'){return {ok:true,status:200,headers:{get:()=>etag},json:async()=>({ok:true,records})};}

test('cachedRecords no ofrece una colección antes de su respuesta autorizada ni inicia consultas',async()=>{
 let finish;const s=setup(()=>new Promise(resolve=>finish=resolve));
 assert.equal(s.api.cachedRecords('ventas'),null);assert.equal(s.calls.length,0);
 s.api.onValue('ventas',()=>{});await turn();
 assert.equal(s.api.cachedRecords('ventas'),null);assert.equal(s.calls.length,1);
 finish(response({visible:{responsableUid:'owner-a'}}));await turn();
 assert.deepEqual(plain(s.api.cachedRecords('ventas')),{visible:{responsableUid:'owner-a'}});
 for(let i=0;i<5;i++)s.api.cachedRecords('ventas');
 assert.equal(s.calls.length,1);assert.equal(s.api.cachedRecords('presupuestos'),null);assert.equal(s.api.cachedRecords('desconocido'),null);
});

test('cachedRecords entrega copias independientes incluso de ítems anidados',async()=>{
 const s=setup();await s.load();const original=plain(s.api.cachedRecords('ventas')),copy=s.api.cachedRecords('ventas');
 copy.visible.items[0].qty=999;copy.visible.total=0;copy.intruder={total:1};delete copy.visible.responsableUid;
 assert.deepEqual(plain(s.api.cachedRecords('ventas')),original);assert.deepEqual(s.delivered[0],original);assert.equal(s.calls.length,1);
});

for(const [name,change] of [
 ['el objeto actual de Firebase Auth',c=>{c.fbAuth.currentUser={uid:'owner-a',getIdToken:async()=>'replacement-token'};}],
 ['el UID efectivo',c=>{c.currentUserUid='owner-b';}],
 ['el rol efectivo',c=>{c.currentRole='admin';}],
 ['la revisión de permisos',c=>{c.PERMISOS_ROLES.administrativo.indiceRevision++;}],
 ['la desaparición de la sesión Auth',c=>{c.fbAuth.currentUser=null;}]
])test('cachedRecords descarta la colección cuando cambia '+name,async()=>{
 const s=setup();await s.load();assert.ok(s.api.cachedRecords('ventas'));change(s.c);
 assert.equal(s.api.cachedRecords('ventas'),null);assert.equal(s.calls.length,1);
});

test('cerrar sesión o cancelar la suscripción elimina su caché sin consultar otra vez',async()=>{
 const s=setup();await s.load();s.listeners['sisventas:session-ended']();assert.equal(s.api.cachedRecords('ventas'),null);assert.equal(s.calls.length,1);
 const other=setup();const unsubscribe=other.api.onValue('presupuestos',()=>{});await turn();assert.ok(other.api.cachedRecords('presupuestos'));unsubscribe();assert.equal(other.api.cachedRecords('presupuestos'),null);assert.equal(other.calls.length,1);
});

test('403 invalida la caché y una consulta fallida posterior no la recupera',async()=>{
 let status=200;const s=setup(()=>status===200?response({visible:{responsableUid:'owner-a'}}):{ok:false,status,json:async()=>({ok:false,mensaje:'Acceso ficticio revocado'})});
 await s.load();assert.ok(s.api.cachedRecords('ventas'));status=403;await s.api.refresh('ventas');assert.equal(s.api.cachedRecords('ventas'),null);
 status=503;await s.api.refresh('ventas');assert.equal(s.api.cachedRecords('ventas'),null);assert.equal(s.calls.length,3);
});

test('304 conserva la representación autorizada sin JSON ni consultas de cachedRecords',async()=>{
 let count=0,jsonReads=0;const s=setup((_,options)=>{count++;if(count===1)return response({visible:{responsableUid:'owner-a',total:100}});assert.equal(options.headers['If-None-Match'],'W/"fictitious-1"');return {status:304,json(){jsonReads++;throw Error('304 no lleva JSON');}};});
 await s.load();const initial=plain(s.api.cachedRecords('ventas'));await s.api.refresh('ventas');
 assert.deepEqual(plain(s.api.cachedRecords('ventas')),initial);assert.equal(jsonReads,0);assert.equal(s.delivered.length,1);assert.equal(s.calls.length,2);
});

test('un fallo transitorio conserva la caché autorizada sin tratarlo como una revocación',async()=>{
 let status=200;const s=setup(()=>status===200?response({visible:{responsableUid:'owner-a'}}):{ok:false,status,json:async()=>({ok:false,mensaje:'Red ficticia interrumpida'})});
 await s.load();const initial=plain(s.api.cachedRecords('ventas'));status=503;await s.api.refresh('ventas');assert.deepEqual(plain(s.api.cachedRecords('ventas')),initial);assert.equal(s.calls.length,2);
});

test('una respuesta tardía no vuelve a habilitar una caché cerrada por logout',async()=>{
 let finish;const s=setup(()=>new Promise(resolve=>finish=resolve));s.api.onValue('ventas',()=>{});await turn();s.listeners['sisventas:session-ended']();finish(response({visible:{responsableUid:'owner-a'}}));await turn();assert.equal(s.api.cachedRecords('ventas'),null);assert.equal(s.calls.length,1);
});

test('cambiar la revisión durante la lectura no certifica la respuesta con permisos nuevos',async()=>{
 let finish;const s=setup(()=>new Promise(resolve=>finish=resolve));s.api.onValue('ventas',()=>{});await turn();s.c.PERMISOS_ROLES.administrativo.indiceRevision++;
 finish(response({visible:{responsableUid:'owner-a'}}));await turn();assert.equal(s.api.cachedRecords('ventas'),null);
});
