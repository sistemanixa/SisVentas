'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../cotizador/commercial-pages-model'),P=require('../cotizador/commercial-pages-projections');
const app=process.env.SV_CREATOR_MONTH_APP_SOURCE?fs.readFileSync(process.env.SV_CREATOR_MONTH_APP_SOURCE,'utf8').replace(/\r\n/g,'\n'):require('./helpers/active-app').readActiveApp().source;
function actual(name){const start=app.search(new RegExp('^function '+name+'\\(','m'));assert(start>=0,name);const ends=/^\}/gm;ends.lastIndex=start;for(let m;(m=ends.exec(app));){const code=app.slice(start,m.index+1);try{new vm.Script(code);return code;}catch(_){}}throw Error(name);}
const helper={};vm.createContext(helper);vm.runInContext(actual('ventaResponsableComercialReporte'),helper);
const sale=(extra={})=>({id:'V-FICTICIA',fecha:'2026-11-04',total:123.456,subtotal:123.456,conIva:false,cliente:'Cliente ficticio',responsableUid:'owner-a',creadaPor:'Creador A',...extra});
function renderCount(records,creator){class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-11-04T12:00:00-03:00']));}}const nodes={};for(const id of ['dash-adm-ventas','dash-adm-ventas-sub'])nodes[id]={textContent:''};const c={Date:Clock,currentUser:creator,ventasList:Object.values(records),pptoData:[],document:{getElementById:id=>nodes[id]||null}};vm.createContext(c);vm.runInContext(actual('ventaResponsableComercialReporte'),c);vm.runInContext(actual('renderDashAdministrativo'),c);c.renderDashAdministrativo();assert.equal(nodes['dash-adm-ventas-sub'].textContent,nodes['dash-adm-ventas'].textContent+' este mes');return Number(nodes['dash-adm-ventas'].textContent);}
const build=sales=>M.build({sales,payments:{},owner:s=>s.responsableUid||'',generation:'creator-month-fixture'});
const count=(meta,creator,month='2026-11')=>M.creatorMonthCount(meta,{creator,month});
const meta=(built,scope='all')=>built.patch[M.ROOT+'/totals/'+scope];
function state(built){const data=structuredClone(built.patch);return {data,read:async p=>structuredClone(data[p]??null),apply:patch=>Object.assign(data,structuredClone(patch))};}

test('existing Pages display author is not the exact report creator; new evidence matches the actual helper',()=>{
 const cases=[sale({creadorOriginalNombre:'NO USAR',creadaPor:' A ',creadoPor:'B',usuario:'C',createdBy:'D'}),sale({creadaPor:' ',creadoPor:' B ',usuario:'C'}),sale({creadaPor:'',creadoPor:'',usuario:' C ',createdBy:'D'}),sale({creadaPor:'',createdBy:' D '}),sale({creadaPor:'',empleado:'NO USAR',responsableNombre:'NO USAR',audit:[{accion:'Creado',usuario:'Sistema'},{accion:'Modificado',usuario:'Otro'},{accion:'Venta adicional creada correctamente',usuario:' Audit A '},{accion:'Creado',usuario:'Audit B'}]})];
 for(const s of cases){const before=structuredClone(s),row=M.saleRow('key',s,[]),expected=helper.ventaResponsableComercialReporte(s);assert.equal(row.creatorHash,M.hash(JSON.stringify(expected)));assert.deepEqual(s,before);}
 assert.notEqual(M.saleRow('key',cases[0],[]).author,helper.ventaResponsableComercialReporte(cases[0]));
});
test('count agrees with the real administrative renderer including cancelled sales and exact creator labels',async()=>{
 const records={a:sale({anulada:true,responsableUid:'owner-b'}),b:sale({creadaPor:'',createdBy:'Creador A'}),c:sale({creadaPor:'Creador B'}),d:sale({creadaPor:'',audit:[{accion:'VENTA CREADA',usuario:'Creador A'}],estado:'anulado'}),e:sale({creadaPor:'',empleado:'Creador A',responsableNombre:'Creador A'}),f:sale({creadaPor:' José '}),g:sale({creadaPor:'Jose\u0301'})},before=structuredClone(records),built=await build(records);
 for(const creator of ['Creador A','Creador B','José','Jose\u0301',' Creador A ','creador a',''])assert.equal(count(meta(built),creator),renderCount(records,creator));assert.equal(count(meta(built),'Creador A'),3);assert.deepEqual(records,before);
});
test('raw fecha slice decides the month, independently of normalized date, fechaOrden and ts',async()=>{
 const variants=[{fecha:'2026-11'},{fecha:'2026-11-garbage'},{fecha:'2026-11-35'},{fecha:'04/11/2026'},{fecha:' 2026-11-04'},{fecha:'2026-10-31',fechaOrden:'2026-11-01'},{fecha:'',ts:Date.UTC(2026,10,4)},{fecha:'2026-11-04',fechaOrden:'2026-10-01'},{fecha:null},{fecha:0},{fecha:['2026-11-04']}],records=Object.fromEntries(variants.map((v,i)=>['s'+i,sale(v)])),built=await build(records);assert.equal(count(meta(built),'Creador A'),renderCount(records,'Creador A'));assert.equal(count(meta(built),'Creador A'),4);
});
test('501 personal sales are counted beyond any global top five, separately from owner visibility',async()=>{
 const records=Object.fromEntries(Array.from({length:501},(_,i)=>['s'+i,sale({id:'V-'+i,responsableUid:i%2?'owner-b':'owner-a',anulada:i%3===0})]));for(let i=0;i<10;i++)records['other'+i]=sale({fecha:'2026-11-30',creadaPor:'Otro',responsableUid:'owner-a'});const built=await build(records);assert.equal(count(meta(built),'Creador A'),501);assert.equal(count(meta(built,'u_owner-a'),'Creador A'),251);assert.equal(count(meta(built,'u_owner-b'),'Creador A'),250);assert.equal(count(meta(built),'Otro'),10);
});
test('long and unsafe creator strings remain exact and safe without truncation, normalization or UID substitution',async()=>{
 const labels=['x'.repeat(500),'../A#[]$','A\ud800','A\ud801','__proto__'],records=Object.fromEntries(labels.map((creadaPor,i)=>['k'+i,sale({creadaPor})])),built=await build(records);for(const label of labels)assert.equal(count(meta(built),label),1);assert.equal(count(meta(built),'x'.repeat(160)),0);assert.equal(count(meta(built),'owner-a'),0);assert(!JSON.stringify(meta(built)).includes(labels[0]));
});
test('create/edit creator and raw month/reassign/cancel/delete maintain counters in existing totals only',async()=>{
 const before=sale(),built=await build({p:before}),f=state(built);let row=built.patch[M.ROOT+'/records/sales/p'],revision=1;
 async function update(original){const next=original?M.saleRow('p',original,[],{ownerUid:original.responsableUid}):null,patch=await M.delta([{kind:'sales',key:'p',before:row,after:next}],{read:f.read,generation:'creator-month-fixture',revision:++revision});assert(Object.keys(patch).every(p=>p.startsWith(M.ROOT+'/')));f.apply(patch);row=next;return f.data[M.ROOT+'/totals/all'];}
 let total=await update({...before,creadaPor:'B'});assert.equal(count(total,'Creador A'),0);assert.equal(count(total,'B'),1);
 total=await update({...before,creadaPor:'B',fecha:'2026-10-01'});assert.equal(count(total,'B'),0);assert.equal(count(total,'B','2026-10'),1);
 total=await update({...before,creadaPor:'B',fecha:'2026-10-01',responsableUid:'owner-b',anulada:true});assert.equal(count(total,'B','2026-10'),1);assert.equal(count(f.data[M.ROOT+'/totals/u_owner-a'],'B','2026-10'),0);assert.equal(count(f.data[M.ROOT+'/totals/u_owner-b'],'B','2026-10'),1);assert.equal(total.activeSales,0);
 total=await update(null);assert.equal(count(total,'B','2026-10'),0);assert.equal(total.sales,0);
});
test('metadata audit-only writer fast path refreshes the creator without loading payments or mutating originals',async()=>{
 const before=sale({creadaPor:'',audit:[{accion:'Creado',usuario:'A'}]}),after={...before,audit:[{accion:'Creado',usuario:'B'}]},built=await P.prepare({sales:{p:before},payments:{},owner:s=>s.responsableUid,generation:'creator-month-fixture'}),patch={'sisventas/ventas/p/audit':after.audit},paths=[];const raw=async p=>{paths.push(p);if(p==='sv_commercial_pages_config')return {ready:true,schema:1,generation:'creator-month-fixture'};if(p==='sisventas/ventas/p')return before;return built.patch[p]??null;};
 await P.augment({patch,raw,get:async p=>p==='sisventas/ventas/p'?after:null});const total=patch[M.ROOT+'/totals/all'];assert.equal(count(total,'A'),0);assert.equal(count(total,'B'),1);assert(!paths.some(p=>p.startsWith('sisventas/pagos')));assert.deepEqual(before.audit,[{accion:'Creado',usuario:'A'}]);assert.equal(after.total,before.total);
});
test('legacy metadata is not mistaken for a complete zero and does not block existing Pages maintenance',async()=>{
 const s=sale(),built=await build({p:s}),old=structuredClone(meta(built));delete old.creatorMonthsSchema;delete old.creatorMonthsRecords;delete old.creatorMonths;assert.throws(()=>count(old,'Creador A'),{code:'SV_COMMERCIAL_PAGES_NOT_READY'});const before=built.patch[M.ROOT+'/records/sales/p'],after={...before,installation:'nueva'};const patch=await M.delta([{kind:'sales',key:'p',before,after}],{read:async p=>p===M.ROOT+'/totals/all'||p===M.ROOT+'/totals/u_owner-a'?old:built.patch[p]??null,generation:'creator-month-fixture',revision:2});assert.equal(patch[M.ROOT+'/totals/all'].sales,1);assert.throws(()=>count(patch[M.ROOT+'/totals/all'],'Creador A'));
});
test('incomplete row evidence retires just the optional creator feature, never fabricates a repaired count',async()=>{
 const built=await build({p:sale()}),row=structuredClone(built.patch[M.ROOT+'/records/sales/p']);delete row.creatorHash;delete row.creatorMonth;delete row.creatorDateInvalid;const next=M.saleRow('p',sale({creadaPor:'B'}),[],{ownerUid:'owner-a'}),patch=await M.delta([{kind:'sales',key:'p',before:row,after:next}],{read:async p=>built.patch[p]??null,generation:'creator-month-fixture',revision:2});assert.equal(patch[M.ROOT+'/totals/all'].sales,1);assert.throws(()=>count(patch[M.ROOT+'/totals/all'],'B'),{code:'SV_COMMERCIAL_PAGES_NOT_READY'});
});
test('unsupported raw date reports incompleteness only for that exact creator, like the real filter',async()=>{
 const records={bad:sale({creadaPor:'Bad',fecha:123}),good:sale({creadaPor:'Good'})},built=await build(records);assert.throws(()=>renderCount(records,'Bad'));assert.throws(()=>count(meta(built),'Bad'),{code:'SV_COMMERCIAL_PAGES_NOT_READY'});assert.equal(count(meta(built),'Good'),renderCount(records,'Good'));assert.equal(count(meta(built),'Other'),0);
});
test('complete empty scopes are zero; corrupt counters and invalid queries fail without mutating metadata',async()=>{
 const built=await build({}),m=meta(built),before=structuredClone(m);assert.equal(count(m,'Nobody'),0);assert.deepEqual(m,before);for(const creator of [null,123,{}])assert.throws(()=>M.creatorMonthCount(m,{creator,month:'2026-11'}));for(const month of ['2026-1','bad','2026-13'])assert.throws(()=>count(m,'Nobody',month));
 const bad=structuredClone(m);bad.creatorMonths={[M.hash(JSON.stringify('Nobody'))]:{months:{'2026-11':-1},invalidDates:0}};assert.throws(()=>count(bad,'Nobody'),{code:'SV_COMMERCIAL_PAGES_NOT_READY'});
});
test('creator counts remain solely in sales-scope totals, not the collection totals or financial histories',async()=>{
 const input={sales:{a:sale({anulada:true}),b:sale({creadaPor:'B',total:345.678,iva:12.34}),c:sale({fecha:'2026-11-garbage',pagos:[{monto:11.111}]})},payments:{p:{ventaFbKey:'b',monto:45.678,fecha:'2026-11-05'}},owner:s=>s.responsableUid,generation:'creator-month-fixture'},before=structuredClone(input.sales);for(const value of Object.values(input.sales))value.creadorOriginalNombre='Presentación existente';const baseline=await M.build(input),changed=structuredClone(input.sales);for(const value of Object.values(changed)){value.creadaPor='Otro creador';value.audit=[{accion:'Creado',usuario:'Otro'}];}const built=await M.build({...input,sales:changed});
 function strip(value){if(Array.isArray(value))return value.map(strip);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!k.startsWith(M.ROOT+'/creatorMonths/')&&!['creatorHash','creatorMonth','creatorDateInvalid','creatorMonthsSchema','creatorMonthsRecords','creatorMonths'].includes(k)).map(([k,v])=>[k,strip(v)]));return value;}
 assert.deepEqual(strip(built),strip(baseline));assert(!Object.hasOwn(built.patch[M.ROOT+'/collectionTotals'],'creatorMonths'));assert(!Object.hasOwn(built.patch[M.ROOT+'/collectionTotals'],'creatorMonthsSchema'));for(const value of Object.values(before))value.creadorOriginalNombre='Presentación existente';assert.deepEqual(input.sales,before);
});
test('a missing populated creator map is incomplete, not an apparently certified zero',async()=>{
 const built=await build({p:sale()}),m=structuredClone(meta(built));assert.equal(m.creatorMonthsRecords,1);delete m.creatorMonths;assert.throws(()=>count(m,'Creador A'),{code:'SV_COMMERCIAL_PAGES_NOT_READY'});const empty=meta(await build({}));delete empty.creatorMonths;assert.equal(count(empty,'Nobody'),0);
});
