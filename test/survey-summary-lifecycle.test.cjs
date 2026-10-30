'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const Model=require('../js/core/survey-summaries.v1'),Planner=require('../scripts/plan-survey-summaries.cjs');
const source=fs.readFileSync(require.resolve('../js/modules/surveys.js'),'utf8');
const sample=()=>({id:'REL-ficticio',cliente:'Cliente ficticio',direccion:'Dirección ficticia',autor:'Persona ficticia',owner:'fixture@example.test',savedAt:'2026-10-30T12:00:00.000Z',services:['otro'],items:{otro:{necesidad:{value:'Servicio ficticio',note:'Nota conservada',photo:{data:'data:image/png;base64,AA=='}}}}});
function fixture(options={}){
 const events={},watches=[],updates=[],notices=[],loading={ready:0,error:0,cancel:0};let html='',paints=0;
 const page={isConnected:true,classList:{contains:()=>true},attrs:{},setAttribute(k,v){this.attrs[k]=v;},querySelectorAll:()=>[],querySelector:()=>null,contains:()=>true,get innerHTML(){return html},set innerHTML(v){html=v;paints++}};
 const doc={hidden:false,visibilityState:'visible',getElementById:id=>id==='page-relevamientos'?page:null,addEventListener:(name,fn)=>(events[name]||=[]).push(fn)};
 const database={transaction(){const tx={objectStore(){return {delete(){const request={};queueMicrotask(()=>tx.oncomplete?.());return request;}}}};return tx;}};
 const indexedDB={open(){const req={result:database};queueMicrotask(()=>req.onsuccess?.());return req;}};
 const window={SISVENTAS_SURVEY_SUMMARIES_READY:true,SVSurveySummaries:Model,isAuthenticated:true,currentUserUid:'fixture',currentUser:'Persona ficticia',currentUserEmail:'fixture@example.test',currentRole:'tecnico',fbAuth:{currentUser:{uid:'fixture'}},PERMISOS_ROLES:{tecnico:{indiceRevision:1}},_svOperacionesSesionEpoch:1,_svDataEpoch:1,_impersonacionOriginal:null,location:{hash:'#/relevamientos'},permisoModulo:()=>true,fbDB:{},fbRef:(_,p)=>p,fbSet:()=>assert.fail('No guardado sólo de detalle'),fbUpdate:(path,patch)=>{updates.push({path,patch});return options.update?options.update(path,patch):Promise.resolve();},fbOnValue(path,receive,error){const entry={path,receive,error,stops:0};watches.push(entry);if(options.throwDetail&&path.startsWith(Model.DETAIL+'/'))throw Error('Fallo ficticio al suscribir');return ()=>entry.stops++;},SVDataReadiness:{beginSource:name=>{assert.equal(name,'relevamientos');return {ready:()=>loading.ready++,error:()=>loading.error++,cancel:()=>loading.cancel++};}},notify:message=>notices.push(message),addEventListener(){},scrollTo(){}};
 const context={window,document:doc,console,Date,Promise,crypto:crypto.webcrypto,indexedDB,navigator:{onLine:true},setTimeout,clearTimeout};
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,'window.__surveySummaryTest={list,stopList,openSummaryDetail,getState:()=>listState,getDraft:()=>draft,setDraft(value){draft=value;loadedOwner=owner();loadedContext=draftContext();},save};})();'),context);
 const api=window.__surveySummaryTest,index=Planner.plan({'REL-ficticio':sample()}).index;
 function detailNode(){const body={innerHTML:''};return {body,node:{open:true,isConnected:true,dataset:{surveyKey:'REL-ficticio'},querySelector:()=>body}};}
 return {window,doc,page,watches,updates,notices,loading,api,index,detailNode,get paints(){return paints},deliver(i,data){let decoded=0;watches[i].receive({val:()=>{decoded++;return data}});return decoded;},emit(name){for(const fn of events[name]||[])fn({detail:{page:'dashboard'}});}};
}
test('la lista pide sólo el índice, conserva todas las filas y no decodifica fotos o notas hasta abrir',async()=>{
 const f=fixture();await f.api.list();assert.equal(f.watches.length,1);assert.equal(f.watches[0].path,Model.INDEX);f.deliver(0,f.index);assert.match(f.page.innerHTML,/Cliente ficticio/);assert.doesNotMatch(f.page.innerHTML,/data:image|Nota conservada|Servicio ficticio/);assert.equal(f.loading.ready,1);assert.equal(f.updates.length,0);
 const d=f.detailNode();f.api.openSummaryDetail(d.node,f.api.getState(),false);assert.equal(f.watches[1].path,Model.DETAIL+'/REL-ficticio');assert.match(d.body.innerHTML,/Cargando relevamiento/);f.deliver(1,sample());assert.match(d.body.innerHTML,/Nota conservada/);assert.match(d.body.innerHTML,/data:image/);
});
test('el mismo resumen no reconstruye la vista ni reinicia el detalle abierto',async()=>{
 const f=fixture();await f.api.list();f.deliver(0,f.index);const d=f.detailNode();f.api.openSummaryDetail(d.node,f.api.getState(),false);f.deliver(1,sample());const paints=f.paints;f.deliver(0,structuredClone(f.index));assert.equal(f.paints,paints);assert.equal(f.watches.length,2);assert.equal(f.watches[1].stops,0);
});
test('abrir dos veces comparte escucha y cerrar cancela antes de un resultado tardío',async()=>{
 const f=fixture();await f.api.list();f.deliver(0,f.index);const d=f.detailNode();f.api.openSummaryDetail(d.node,f.api.getState(),false);f.api.openSummaryDetail(d.node,f.api.getState(),false);assert.equal(f.watches.length,2);d.node.open=false;assert.equal(f.deliver(1,sample()),0);assert.equal(f.watches[1].stops,1);assert.equal(d.body.innerHTML,'');
});
test('ocultar, cambiar permisos o cerrar sesión detiene también los detalles y no inicia historial completo',async()=>{
 for(const change of [f=>f.doc.hidden=true,f=>f.window.currentUserUid='otro',f=>f.window.PERMISOS_ROLES.tecnico.indiceRevision++,f=>f.window.SISVENTAS_SURVEY_SUMMARIES_READY=false]){
  const f=fixture();await f.api.list();f.deliver(0,f.index);const d=f.detailNode();f.api.openSummaryDetail(d.node,f.api.getState(),false);change(f);assert.equal(f.deliver(1,sample()),0);f.api.stopList();assert.equal(f.watches[1].stops,1);assert.equal(f.watches.length,2);assert.equal(f.watches[0].stops,1);assert.equal(d.body.innerHTML,'');
 }
});
test('un índice sin preparar o con campos privados falla visible sin fallback a la raíz de fotos',async()=>{
 for(const data of [{}, {...Planner.plan({}).index,records:{a:{...Model.summary(sample(),'a'),photo:'No permitido'}}}]){const f=fixture();await f.api.list();f.deliver(0,data);assert.match(f.page.innerHTML,/No se pudo sincronizar/);assert.doesNotMatch(f.page.innerHTML,/Todavía no hay/);assert.equal(f.watches.length,1);assert.equal(f.watches[0].stops,1);assert.equal(f.loading.error,1);}
});
test('error de detalle deja reintento y un resultado del intento anterior no reemplaza al nuevo',async()=>{
 const f=fixture();await f.api.list();f.deliver(0,f.index);const d=f.detailNode();f.api.openSummaryDetail(d.node,f.api.getState(),false);f.watches[1].error(Error('Fallo ficticio'));assert.match(d.body.innerHTML,/Reintentar/);f.api.openSummaryDetail(d.node,f.api.getState(),true);f.deliver(2,sample());const before=d.body.innerHTML;assert.equal(f.deliver(1,{...sample(),cliente:'No pintar'}),0);assert.equal(d.body.innerHTML,before);assert.equal(f.watches[1].stops,1);
});
test('guardar envía un único update atómico de detalle y resumen y limpia sólo después del ACK',async()=>{
 let resolve;const pending=new Promise(ok=>resolve=ok),f=fixture({update:()=>pending}),row=sample();f.api.setDraft(row);const save=f.api.save();await new Promise(setImmediate);assert.equal(f.updates.length,1);assert.equal(f.api.getDraft(),row);assert.equal(f.updates[0].path,undefined);assert.deepEqual(Object.keys(f.updates[0].patch),[Model.DETAIL+'/'+row.id,Model.INDEX+'/records/'+row.id]);const full=f.updates[0].patch[Model.DETAIL+'/'+row.id];assert.match(full.savedAt,/^\d{4}-\d{2}-\d{2}T/);assert.equal(full.items.otro.necesidad.photo.data,row.items.otro.necesidad.photo.data);await f.api.save();assert.equal(f.updates.length,1);resolve();await save;assert.equal(f.api.getDraft(),null);assert.ok(f.notices.includes('Relevamiento guardado'));assert.equal(f.watches[0].path,Model.INDEX);
});
test('fallo del update conserva borrador y no confirma un resumen separado',async()=>{
 const f=fixture({update:()=>Promise.reject(Error('Fallo ficticio'))}),row=sample();f.api.setDraft(row);await f.api.save();assert.equal(f.updates.length,1);assert.equal(f.api.getDraft(),row);assert.equal(f.watches.length,0);assert.ok(f.notices.some(message=>message.includes('El borrador se conserva')));
});
