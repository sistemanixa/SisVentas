'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const periodModel=require('../js/core/activity-period.v1.js');
const {source,index}=require('./helpers/active-app').readActiveApp();
const start=source.indexOf('var LOG_ACTIVIDAD_DATA ='),end=source.indexOf('\nfunction cargarCargos()',start),chunk=source.slice(start,end);
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(setImmediate);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}

function fixture(mode='30d'){
 const requests=[],constraints=[],refs=[],events=new Map(),writes=[],notices=[];let today='2026-10-24';
 function node(id){return {id,style:{display:''},isConnected:true,hidden:false,disabled:false,innerHTML:'',textContent:'',value:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;},remove(){delete nodes[id];},classList:{contains:()=>true}};}
 const nodes=Object.fromEntries(['page-configuracion','cfg-actividad','act-estado','act-tabla','act-tbody','act-actualizar','act-limpiar','act-filtro-periodo','act-alcance','act-ver-todo','act-filtro-usuario','act-filtro-accion','sv331-actividad-list'].map(id=>[id,node(id)]));
 nodes['act-filtro-periodo'].value=mode;
 const c={window:null,console,Promise,isAuthenticated:true,currentUserUid:'fictional-user',currentRole:'admin',PERMISOS_ROLES:{admin:{indiceRevision:1}},_svOperacionesSesionEpoch:1,_impersonacionOriginal:null,
  fbAuth:{currentUser:{uid:'fictional-user'}},fbDB:{},SVActivityPeriod:periodModel,svFechaLocalISO:()=>today,
  SVForegroundSession:{isVisible:()=>true},document:{hidden:false,getElementById:id=>nodes[id]||null,addEventListener(name,handler){if(!events.has(name))events.set(name,[]);events.get(name).push(handler);}},
  permisoModulo:()=>true,svPuedeLeerDominio:()=>true,tienePermiso:()=>true,
  fbRef(db,value){assert.equal(db,c.fbDB);const ref={kind:'reference',path:value};refs.push(ref);return ref;},
  fbOrderByChild(value){const constraint={kind:'orderByChild',value};constraints.push(constraint);return constraint;},
  fbStartAt(value){const constraint={kind:'startAt',value};constraints.push(constraint);return constraint;},
  fbEndAt(value){const constraint={kind:'endAt',value};constraints.push(constraint);return constraint;},
  fbQuery(ref,...queryConstraints){return {kind:'query',reference:ref,constraints:queryConstraints};},
  fbGet(query){const request=deferred();requests.push({...request,query});return request.promise;},
  fbSet(...args){writes.push(args);assert.fail('No operations are saved in this fixture');},
  fetch(){assert.fail('No network');},setInterval(){assert.fail('No polling');},setTimeout(){assert.fail('No clock producer');},
  notify:notice=>notices.push(notice),escapeHTML:value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))};
 c.window=c;vm.createContext(c);vm.runInContext(chunk,c);
 return {c,nodes,requests,constraints,refs,writes,notices,clock(value){today=value;},period:()=>periodModel.create('30d',today),emit(name,detail){for(const handler of events.get(name)||[])handler({detail});},deliver(data,i=requests.length-1){requests[i].resolve({val:()=>data});},fail(error=Error('Fictitious query index missing'),i=requests.length-1){requests[i].reject(error);}};
}
const item=(id,fecha)=>({usuario:'Persona '+id%5,accion:'Acción '+id%3,detalle:'Detalle '+id,fecha});

test('30d default sends one query with fecha ordering and two exact bounded endpoints',async()=>{
 const f=fixture(),p=f.c.cargarLogActividad(),period=f.period();
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].query.kind,'query');assert.equal(f.requests[0].query.reference.path,'sisventas/log_actividad');
 assert.deepEqual(f.requests[0].query.constraints,[{kind:'orderByChild',value:'fecha'},{kind:'startAt',value:period.fromInclusive},{kind:'endAt',value:period.toExclusive}]);
 assert.equal(f.refs.length,1);assert.equal(f.nodes['act-actualizar'].disabled,true);assert.match(f.nodes['act-alcance'].textContent,/Filtro aplicado: últimos 30 días/);assert.equal(f.nodes['act-ver-todo'].hidden,false);
 f.deliver({first:item(1,period.fromInclusive)});assert.equal(await p,true);assert.equal(f.c.LOG_ACTIVIDAD_DATA.length,1);assert.equal(f.writes.length,0);
});
test('SDK inclusive end is filtered to the exclusive midnight; day31 and legacy rows stay out',async()=>{
 const f=fixture(),period=f.period(),p=f.c.cargarLogActividad();
 const before=new Date(Date.parse(period.fromInclusive)-1).toISOString(),last=new Date(Date.parse(period.toExclusive)-1).toISOString();
 const rows={before:item(0,before),first:item(1,period.fromInclusive),last:item(2,last),boundary:item(3,period.toExclusive),future:item(4,new Date(Date.parse(period.toExclusive)+1).toISOString()),legacy:item(5,'2026-10-24'),missing:{detalle:'fecha desconocida'},malformed:null};
 const beforeJSON=JSON.stringify(rows);f.deliver(rows);assert.equal(await p,true);assert.deepEqual(clone(f.c.LOG_ACTIVIDAD_DATA),[rows.last,rows.first]);assert.equal(JSON.stringify(rows),beforeJSON);assert.match(f.nodes['act-alcance'].textContent,/fecha incompleta.*Todo el historial/);assert.doesNotMatch(f.nodes['act-tbody'].innerHTML,/Detalle 0|Detalle 3|Detalle 4|Detalle 5|desconocida/);
});
test('numeric object keys and sparse arrays keep the stable tie order before the existing300 limit',async()=>{
 for(const array of [false,true]){
  const f=fixture(),period=f.period(),data=array?new Array(400):{};
  for(let i=0;i<350;i++)data[String(i*2)]=item(i,period.fromInclusive);
  data.legacy=item(999,'legacy');data.endpoint=item(1000,period.toExclusive);
  const expected=Object.values(periodModel.filter(data,period)).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).slice(0,300),p=f.c.cargarLogActividad();f.deliver(data);assert.equal(await p,true);
  assert.equal(f.c.LOG_ACTIVIDAD_DATA.length,300);assert.deepEqual(clone(f.c.LOG_ACTIVIDAD_DATA),expected);assert.equal(f.c.LOG_ACTIVIDAD_DATA[0],data[0]);assert.equal(f.c.LOG_ACTIVIDAD_DATA[299],data[598]);
 }
});
test('simultaneous 30d entries share pending query; post-ACK refresh remains explicit',async()=>{
 const f=fixture(),first=f.c.cargarLogActividad(),second=f.c.cargarLogActividad(),third=f.c.cargarLogActividad();assert.equal(first,second);assert.equal(first,third);assert.equal(f.requests.length,1);
 f.deliver(null);assert.equal(await first,true);assert.equal(f.c.svActividadListaConfirmada(),true);f.emit('sisventas:foreground-restored');f.emit('visibilitychange');assert.equal(f.requests.length,1);
 const refresh=f.c.cargarLogActividad();assert.equal(f.requests.length,2);assert.equal(f.requests[1].query.kind,'query');f.deliver(null);await refresh;
});
test('crossing a local midnight starts a query for the new day instead of joining yesterday',async()=>{
 const f=fixture(),old=f.c.cargarLogActividad();f.clock('2026-10-25');const current=f.c.cargarLogActividad();assert.notEqual(current,old);assert.equal(f.requests.length,2);
 assert.equal(f.requests[1].query.constraints[2].value,f.period().toExclusive);f.requests[0].resolve({val:()=>assert.fail('Yesterday response must be retired before decoding')});assert.equal(await old,false);f.deliver(null,1);assert.equal(await current,true);
});
for(const [from,to]of [['30d','all'],['all','30d']])test('changing '+from+' to '+to+' retires its response before val and only decodes current mode',async()=>{
 const f=fixture(from),old=f.c.cargarLogActividad();f.nodes['act-filtro-periodo'].value=to;const current=f.c.cargarLogActividad();assert.equal(f.requests.length,2);
 f.requests[0].resolve({val:()=>assert.fail('Retired period must not be decoded')});assert.equal(await old,false);const row=item(1,f.period().fromInclusive);f.deliver({row},1);assert.equal(await current,true);assert.deepEqual(clone(f.c.LOG_ACTIVIDAD_DATA),[row]);assert.equal(f.requests[1].query.kind,to==='all'?'reference':'query');
});
for(const change of ['mode','selector-node','model'])test('changing '+change+' without opening another load still prevents decoding',async()=>{
 const f=fixture(),p=f.c.cargarLogActividad();if(change==='mode')f.nodes['act-filtro-periodo'].value='all';if(change==='selector-node')f.nodes['act-filtro-periodo']={...f.nodes['act-filtro-periodo']};if(change==='model')f.c.SVActivityPeriod={...periodModel};
 f.requests[0].resolve({val:()=>assert.fail('Retired mode/selector/model snapshot must not be decoded')});assert.equal(await p,false);assert.equal(f.c.LOG_ACTIVIDAD_DATA.length,0);assert.equal(f.nodes['act-tabla'].hidden,true);
});
for(const missing of ['fbQuery','fbOrderByChild','fbStartAt','fbEndAt'])test('missing '+missing+' fails closed with no root GET fallback',async()=>{
 const f=fixture();delete f.c[missing];assert.equal(await f.c.cargarLogActividad(),false);assert.equal(f.requests.length,0);assert.equal(f.c._actividadLectura.status,'error');assert.match(f.nodes['act-estado'].innerHTML,/Reintentar/);assert.equal(f.nodes['act-tabla'].hidden,true);assert.equal(f.writes.length,0);
});
test('missing index/query rejection offers manual retry and never reads the root as fallback',async()=>{
 const f=fixture(),first=f.c.cargarLogActividad();f.fail();assert.equal(await first,false);assert.equal(f.requests.length,1);assert.equal(f.requests[0].query.kind,'query');assert.equal(f.c._actividadLectura.status,'error');assert.match(f.nodes['act-estado'].innerHTML,/Reintentar/);assert.equal(f.nodes['act-tabla'].hidden,true);assert.equal(f.nodes['act-actualizar'].disabled,false);
 f.emit('sisventas:foreground-restored');await tick();assert.equal(f.requests.length,1);const retry=f.c.cargarLogActividad();assert.equal(f.requests.length,2);assert.equal(f.requests[1].query.kind,'query');f.deliver(null);assert.equal(await retry,true);assert.equal(f.c.LOG_ACTIVIDAD_DATA.length,0);
});
test('invalid period or absent period model cannot issue a data request',async()=>{
 for(const mode of ['7d','invalid']){const f=fixture(mode);assert.equal(await f.c.cargarLogActividad(),false);assert.equal(f.requests.length,0);assert.equal(f.nodes['act-tabla'].hidden,true);}
 const f=fixture();delete f.c.SVActivityPeriod;assert.equal(await f.c.cargarLogActividad(),false);assert.equal(f.requests.length,0);
});
test('explicit all mode preserves full-history root request, original sort300, filters and exact HTML',async()=>{
 const baseline=fs.readFileSync(path.join(__dirname,'../js/app.v3.14.15.js'),'utf8'),baseStart=baseline.indexOf('var LOG_ACTIVIDAD_DATA ='),baseEnd=baseline.indexOf('\nfunction cargarCargos()',baseStart),baseChunk=baseline.slice(baseStart,baseEnd);
 const object={};for(let i=0;i<350;i++)object[String(i)]=item(i,i%13?'2026-10-'+String(i%20+1).padStart(2,'0')+'T12:00:00.000Z':'');
 for(const data of [object,Object.values(object),null]){
  const current=fixture('all'),original=fixture('all');vm.runInContext(baseChunk,original.c);
  current.nodes['act-filtro-usuario'].value=original.nodes['act-filtro-usuario'].value='Persona 2';current.nodes['act-filtro-accion'].value=original.nodes['act-filtro-accion'].value='Acción 1';
  const a=current.c.cargarLogActividad(),b=original.c.cargarLogActividad();assert.equal(current.requests[0].query.kind,'reference');assert.equal(current.constraints.length,0);assert.equal(current.requests[0].query.path,'sisventas/log_actividad');current.deliver(data);original.deliver(data);assert.equal(await a,await b);
  assert.deepEqual(clone(current.c.LOG_ACTIVIDAD_DATA),clone(original.c.LOG_ACTIVIDAD_DATA));for(const id of ['act-tbody','act-filtro-usuario','act-filtro-accion']){assert.equal(current.nodes[id].innerHTML,original.nodes[id].innerHTML);assert.equal(current.nodes[id].value,original.nodes[id].value);}
  assert.equal(current.nodes['act-ver-todo'].hidden,true);assert.equal(current.nodes['act-alcance'].textContent,'Todo el historial · hasta 300 actividades por fecha.');
 }
});
test('explicit all does not require range-query SDK helpers or discard legacy rows',async()=>{
 const f=fixture('all');for(const name of ['fbQuery','fbOrderByChild','fbStartAt','fbEndAt'])delete f.c[name];const rows={old:item(1,'2010-01-01T00:00:00.000Z'),future:item(2,'2030-01-01T00:00:00.000Z'),legacy:item(3,'')},p=f.c.cargarLogActividad();assert.equal(f.requests[0].query.kind,'reference');f.deliver(rows);assert.equal(await p,true);assert.equal(f.c.LOG_ACTIVIDAD_DATA.length,3);
});
test('scope selector defaults to30d and its visible all-history action changes mode via the real loader',async()=>{
 const select=index.match(/<select\b[^>]*id="act-filtro-periodo"[\s\S]*?<\/select>/)?.[0];assert.ok(select);assert.match(select,/aria-label="Período de actividad"/);assert.match(select,/onchange="cargarLogActividad\(\)"/);assert.ok(select.indexOf('value="30d"')<select.indexOf('value="all"'));
 const action=index.match(/<button\b[^>]*id="act-ver-todo"[^>]*>/)?.[0],handler=action?.match(/onclick="([^"]*)"/)?.[1];assert.ok(handler);
 const f=fixture(),first=f.c.cargarLogActividad();f.deliver(null);await first;assert.equal(f.nodes['act-ver-todo'].hidden,false);assert.match(f.nodes['act-alcance'].textContent,/25\/09\/2026 al 24\/10\/2026/);vm.runInContext(handler,f.c);assert.equal(f.nodes['act-filtro-periodo'].value,'all');assert.equal(f.requests.length,2);assert.equal(f.requests[1].query.kind,'reference');f.deliver(null);await f.c._actividadLectura.promise;assert.equal(f.nodes['act-ver-todo'].hidden,true);
});
