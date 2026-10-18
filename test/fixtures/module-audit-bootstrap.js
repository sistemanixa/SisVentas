'use strict';
window.__moduleAudit={errors:[],writes:[],blocked:[],pages:[],reads:[],subscriptions:[]};
addEventListener('error',e=>__moduleAudit.errors.push(e.message));
addEventListener('unhandledrejection',e=>__moduleAudit.errors.push(String(e.reason?.message||e.reason)));
const realFetch=window.fetch.bind(window);
window.fetch=function(input,options){const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin!==location.origin){__moduleAudit.blocked.push({origin:url.origin,path:url.pathname,page:document.querySelector('.page.active')?.id});return Promise.reject(Error('Servicio externo bloqueado por fixture'));}
 const method=options?.method||'GET',commercial=url.pathname.match(/^\/comerciales\/(ventas|presupuestos)$/),directory=url.pathname.match(/^\/usuarios\/(perfil|directorio|administracion)$/);
 if(commercial||directory){__moduleAudit.reads.push({type:'api',path:url.pathname,at:Date.now(),page:document.querySelector('.page.active')?.id});if(method!=='GET')return Promise.resolve(new Response(JSON.stringify({ok:false,mensaje:'Escritura API bloqueada en fixture'}),{status:405}));const profile={...fixtureRoot.sv_usuarios.fixture,fbKey:'fixture'};const data=commercial?{ok:true,records:fixtureRoot.sisventas[commercial[1]]||{}}:directory[1]==='perfil'?{ok:true,profile}:{ok:true,users:[profile]};return Promise.resolve(new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}}));}
 return realFetch(input,options);};
const fixtureRoot={sisventas:{config:{empresa:{nombre:'Empresa ficticia',dir:'Domicilio ficticio'},version:'v3.12.9-firebase'},clientes:{c:{nombre:'Cliente ficticio',dir:'Dirección ficticia',activo:true}},productos:{p:{codigo:'DEMO-1',nombre:'Producto ficticio',categoria:'Ejemplo',gremio:100,pventa:200,activo:true}},empleados:{e:{nombre:'Integrante ficticio',activo:true}},ventas:{},presupuestos:{},pagos:{}},sv_usuarios:{fixture:{uid:'fixture',nombre:'Administrador ficticio',rol:'admin',activo:true}},sv_chat_roles:{fixture:{rol:'admin',activo:true}},sv_chat_directorio:{fixture:{nombre:'Administrador ficticio',activo:true}}};
const clone=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
const read=ref=>clone(String(ref?.path??ref??'').split('/').filter(Boolean).reduce((v,k)=>v?.[k],fixtureRoot));
const snapshot=value=>({val:()=>clone(value),exists:()=>value!=null,forEach:fn=>Object.entries(value||{}).forEach(([key,v])=>fn({...snapshot(v),key}))});
window.fbDB={fixture:true};window.fbRef=(_,path='')=>({path,key:path.split('/').at(-1)});
function recordRead(type,ref){__moduleAudit.reads.push({type,path:String(ref?.path??ref??''),at:Date.now(),page:document.querySelector('.page.active')?.id});}
window.fbGet=async ref=>{recordRead('get',ref);return snapshot(read(ref));};
const fixtureStops=new Set();
window.fbOnValue=(ref,fn)=>{recordRead('subscribe',ref);let active=true;const row={path:String(ref?.path??ref??''),active:true};__moduleAudit.subscriptions.push(row);queueMicrotask(()=>{if(active)fn(snapshot(read(ref)));});const stop=()=>{active=false;row.active=false;fixtureStops.delete(stop);};fixtureStops.add(stop);return stop;};
window.fbStopAllValueListeners=()=>{for(const stop of [...fixtureStops])stop();};
window.fbOff=()=>{};window.fbOnAuth=()=>()=>{};
window.fbAuth={currentUser:{uid:'fixture',email:'fixture@example.invalid',getIdToken:async()=>'FICTICIO-SIN-VALIDEZ'}};
window.fbSignOut=async()=>{};window.fbQuery=ref=>ref;window.fbOrderByChild=()=>null;window.fbEqualTo=()=>null;window.fbLimitToLast=()=>null;
function write(ref,value){__moduleAudit.writes.push({path:ref?.path??ref,value:clone(value)});return Promise.resolve();}
window.fbUpdate=write;window.fbSet=write;window.fbRemove=ref=>write(ref,null);window.fbPush=(ref,value)=>{const key='ficticio-'+(__moduleAudit.writes.length+1);if(value!==undefined)write(ref,value);return {key,path:ref.path+'/'+key};};
window.fbOnDisconnect=()=>({remove:async()=>{},set:async()=>{},cancel:async()=>{}});window.fbServerTimestamp=()=>Date.now();
window.fbRunTransaction=async(ref,fn)=>{const value=fn(read(ref));if(value!==undefined)await write(ref,value);return {committed:value!==undefined,snapshot:snapshot(value)};};
window.SISVENTAS_FUNCTIONS={cotizadorProveedor:location.origin,asistente:location.origin};
window.SV_IA_ENDPOINT=location.origin;window.SV_PROJECTS_ENABLED=false;
