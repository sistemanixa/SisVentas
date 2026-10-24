'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(require.resolve('../js/modules/surveys.js'),'utf8').replace(/\r\n/g,'\n');
function fixture(options={}){
 const watches=[],events={},windowEvents={},closes=[],writes=[];
 let active=true,moduleAllowed=true,foreground=true;
 const page={isConnected:true,innerHTML:'',attrs:{},classList:{contains:()=>active},setAttribute(k,v){this.attrs[k]=v;},querySelectorAll:()=>[],querySelector:()=>null};
 const user={uid:'actor-A'},window={isAuthenticated:true,currentUserUid:'actor-A',currentUser:'Persona ficticia',currentUserEmail:'fixture@example.test',currentRole:'tecnico',fbAuth:{currentUser:user},PERMISOS_ROLES:{tecnico:{indiceRevision:1}},_svOperacionesSesionEpoch:1,_svDataEpoch:1,_impersonacionOriginal:null,
  fbDB:{},fbRef:(db,path)=>({db,path}),permisoModulo:()=>moduleAllowed,svPuedeLeerDominio:()=>false,SVDomainReads:{domains:{}},location:{hash:'#/relevamientos'},SVForegroundSession:{isVisible:()=>foreground},
  SVScreenLoading:{start:()=>{const entry={calls:0};closes.push(entry);return ()=>entry.calls++;}},
  addEventListener:(type,fn)=>(windowEvents[type]||=[]).push(fn),fbSet:(...args)=>{writes.push(args);throw Error('No guardar datos en la prueba del listado');},notify:()=>{},
  fbOnValue(ref,receive,error){const entry={ref,receive,error,stops:0};watches.push(entry);options.onSubscribe?.(entry);return ()=>entry.stops++;}
 };
 const document={hidden:false,visibilityState:'visible',getElementById:id=>id==='page-relevamientos'?page:null,addEventListener:(type,fn)=>(events[type]||=[]).push(fn)};
 const context={window,document,console,Date,Promise,crypto:crypto.webcrypto};
 vm.createContext(context);
 vm.runInContext(source.replace(/\}\)\(\);\s*$/,'window.__surveyTest={list,stopList};})();'),context);
 function emit(type,detail={}){for(const fn of events[type]||[])fn({detail});}
 function emitWindow(type){for(const fn of windowEvents[type]||[])fn({});}
 function deliver(index=0,data={},sideEffect){const stats={decoded:0};watches[index].receive({val(){stats.decoded++;sideEffect?.();return data;}});return stats;}
 return {window,document,page,watches,closes,writes,context,list:()=>window.__surveyTest.list(),stop:clear=>window.__surveyTest.stopList(clear),emit,emitWindow,deliver,
  active:value=>active=value,module:value=>moduleAllowed=value,foreground:value=>foreground=value};
}
const sample={x:{id:'REL-ficticio',cliente:'Cliente ficticio',direccion:'Ubicación de prueba',autor:'Persona ficticia',savedAt:'2026-10-24T12:00:00.000Z',services:['otro'],items:{otro:{necesidad:{value:'Trabajo de prueba',note:'Nota conservada',photo:{data:'data:image/png;base64,AA=='}}}}}};
test('una fuente pendiente o lista comparte el transporte del mismo contexto y conserva el historial',async()=>{
 const f=fixture();await Promise.all([f.list(),f.list(),f.list()]);assert.equal(f.watches.length,1);assert.equal(f.watches[0].ref.path,'sisventas/relevamientos');assert.equal(f.page.attrs['aria-busy'],'true');
 assert.equal(f.deliver(0,sample).decoded,1);assert.match(f.page.innerHTML,/Cliente ficticio/);assert.match(f.page.innerHTML,/Nota conservada/);assert.match(f.page.innerHTML,/data:image\/png;base64,AA==/);assert.equal(f.page.attrs['aria-busy'],'false');
 await f.list();assert.equal(f.watches.length,1);assert.equal(f.closes[0].calls,1);assert.deepEqual(f.writes,[]);
});
test('el dominio no configurado conserva el permiso de Relevamientos y no inventa una denegación',async()=>{
 const f=fixture();assert.equal(f.window.svPuedeLeerDominio('relevamientos'),false);await f.list();assert.equal(f.watches.length,1);f.deliver(0,sample);assert.match(f.page.innerHTML,/Cliente ficticio/);
});
test('un dominio realmente configurado se comprueba sin sustituir el permiso del módulo',async()=>{
 const f=fixture();f.window.SVDomainReads.domains.relevamientos={};await f.list();assert.equal(f.watches.length,0);
 f.window.svPuedeLeerDominio=()=>true;await f.list();assert.equal(f.watches.length,1);f.window.svPuedeLeerDominio=()=>false;assert.equal(f.deliver(0,sample).decoded,0);assert.equal(f.watches[0].stops,1);
});
const changes={
 UID:f=>f.window.currentUserUid='actor-B',Auth:f=>f.window.fbAuth.currentUser={uid:'actor-A'},AuthUID:f=>f.window.fbAuth.currentUser.uid='actor-B',rol:f=>f.window.currentRole='admin',
 revisión:f=>f.window.PERMISOS_ROLES.tecnico.indiceRevision++,época:f=>f.window._svOperacionesSesionEpoch++,épocaDatos:f=>f.window._svDataEpoch++,vista:f=>f.window._impersonacionOriginal={usuarioFbKey:'otra'},
 identidadVisible:f=>f.window.currentUserEmail='otro@example.test',base:f=>f.window.fbDB={},referencia:f=>f.window.fbRef=()=>{},SDK:f=>f.window.fbOnValue=()=>{},
 permiso:f=>f.module(false),funciónPermiso:f=>f.window.permisoModulo=()=>true,dominioAgregado:f=>f.window.SVDomainReads.domains.relevamientos={},página:f=>f.active(false),
 desconectada:f=>f.page.isConnected=false,hash:f=>f.window.location.hash='#/dashboard',oculta:f=>{f.document.hidden=true;f.document.visibilityState='hidden';},primerPlano:f=>f.foreground(false),autenticada:f=>f.window.isAuthenticated=false
};
for(const [name,change]of Object.entries(changes))test('retira antes de val al cambiar '+name,async()=>{
 const f=fixture();await f.list();change(f);assert.equal(f.deliver(0,sample).decoded,0);assert.equal(f.watches[0].stops,1);assert.doesNotMatch(f.page.innerHTML,/Cliente ficticio/);assert.equal(f.closes[0].calls,1);assert.equal(f.watches.length,1);assert.deepEqual(f.writes,[]);
});
test('un cambio de perfil dentro de la misma vista tampoco decodifica',async()=>{
 const f=fixture();f.window._impersonacionOriginal={usuarioFbKey:'perfil-1'};await f.list();f.window._impersonacionOriginal.usuarioFbKey='perfil-2';assert.equal(f.deliver(0,sample).decoded,0);assert.equal(f.watches[0].stops,1);
});
test('el UID visible distinto de Auth impide iniciar la lectura aun con módulo permitido',async()=>{
 const f=fixture();f.window.currentUserUid='otro-UID';await f.list();assert.equal(f.watches.length,0);assert.equal(f.closes.length,0);assert.equal(f.page.innerHTML,'');assert.deepEqual(f.writes,[]);
});
for(const name of ['UID','Auth','rol','revisión','época','permiso','página','hash','oculta','autenticada'])test((['rol','revisión','época','hash'].includes(name)?'el valor inicial no es un veto, pero su cambio invalida ':'no inicia una fuente cuando el contexto inicial carece de ')+name,async()=>{
 const f=fixture();if(name==='UID')f.window.currentUserUid='';else if(name==='Auth')f.window.fbAuth.currentUser=null;else if(['rol','revisión','época','hash'].includes(name)){
  // Estos valores no están prohibidos: lo que invalida es cambiar durante la lectura.
  await f.list();changes[name](f);f.deliver();assert.equal(f.watches[0].stops,1);return;
 }else changes[name](f);await f.list();assert.equal(f.watches.length,0);assert.equal(f.closes.length,0);
});
test('ocultar retira la fuente lista y volver visible no la reactiva',async()=>{
 const f=fixture();await f.list();f.deliver(0,sample);f.document.hidden=true;f.document.visibilityState='hidden';f.emit('visibilitychange');assert.equal(f.watches[0].stops,1);assert.doesNotMatch(f.page.innerHTML,/Cliente ficticio/);assert.match(f.page.innerHTML,/pausada/);
 f.document.hidden=false;f.document.visibilityState='visible';f.emit('visibilitychange');assert.equal(f.watches.length,1);assert.equal(f.deliver(0,sample).decoded,0);
 await f.list();assert.equal(f.watches.length,2);f.deliver(1,{});assert.match(f.page.innerHTML,/Todavía no hay relevamientos/);assert.doesNotMatch(f.page.innerHTML,/pausada|No se pudo/);
});
for(const event of ['sisventas:foreground-paused','sisventas:role-changed','sisventas:page-changed','pagehide','hashchange'])test('el evento '+event+' retira una sola vez y no abre otro transporte',async()=>{
 const f=fixture();await f.list();f.deliver(0,sample);
 if(event==='sisventas:foreground-paused')f.foreground(false);
 if(event==='hashchange')f.window.location.hash='#/dashboard';
 const emit=event==='pagehide'||event==='hashchange'?()=>f.emitWindow(event):()=>f.emit(event,{page:'dashboard'});emit();emit();assert.equal(f.watches[0].stops,1);assert.equal(f.watches.length,1);assert.equal(f.closes[0].calls,1);assert.equal(f.deliver(0,sample).decoded,0);assert.doesNotMatch(f.page.innerHTML,/Cliente ficticio/);
});
test('cerrar sesión vacía el listado y los callbacks antiguos no lo restauran',async()=>{
 const f=fixture();await f.list();f.deliver(0,sample);f.window.isAuthenticated=false;f.emit('sisventas:session-ended');assert.equal(f.page.innerHTML,'');assert.equal(f.watches[0].stops,1);assert.equal(f.deliver(0,sample).decoded,0);assert.equal(f.page.innerHTML,'');
});
test('error terminal se distingue de vacío y sólo el reintento humano abre una fuente',async()=>{
 const f=fixture();await f.list();f.deliver(0,sample);f.watches[0].error(Error('Fallo ficticio'));assert.equal(f.watches[0].stops,1);assert.match(f.page.innerHTML,/No se pudo sincronizar/);assert.match(f.page.innerHTML,/Reintentar/);assert.doesNotMatch(f.page.innerHTML,/Cliente ficticio|Todavía no hay/);
 f.emit('visibilitychange');assert.equal(f.watches.length,1);await f.list();assert.equal(f.watches.length,2);f.deliver(1,{});assert.match(f.page.innerHTML,/Todavía no hay relevamientos/);assert.equal(f.closes[1].calls,1);
});
test('un error tardío de la fuente retirada no limpia la fuente nueva',async()=>{
 const f=fixture();await f.list();f.stop(true);await f.list();f.deliver(1,sample);const ready=f.page.innerHTML;f.watches[0].error(Error('Viejo'));assert.equal(f.page.innerHTML,ready);assert.equal(f.watches[1].stops,0);assert.equal(f.watches.length,2);
});
test('cambio durante val retira los datos antes de construir el resultado',async()=>{
 const f=fixture();await f.list();assert.equal(f.deliver(0,sample,()=>f.window.currentUserUid='actor-B').decoded,1);assert.doesNotMatch(f.page.innerHTML,/Cliente ficticio/);assert.equal(f.watches[0].stops,1);
});
test('error o retiro síncrono al suscribir libera también la baja que llega después',async()=>{
 for(const mode of ['error','hidden']){let f;f=fixture({onSubscribe:entry=>{if(mode==='error')entry.error(Error('Fallo síncrono'));else{f.document.hidden=true;entry.receive({val:()=>assert.fail('No decodificar después de ocultar')});}}});await f.list();assert.equal(f.watches.length,1);assert.equal(f.watches[0].stops,1);assert.equal(f.closes[0].calls,1);}
});
test('una excepción de construcción del SDK se presenta como error sin fingir vacío',async()=>{
 const f=fixture();f.window.fbOnValue=()=>{throw Error('Fallo ficticio');};await f.list();assert.match(f.page.innerHTML,/No se pudo sincronizar/);assert.equal(f.closes[0].calls,1);assert.doesNotMatch(f.page.innerHTML,/Todavía no hay/);
});
test('validación, formato de almacenamiento, campos y detalle anterior quedan byteidénticos',()=>{
 const hashes={validation:'01f44f1e6a06d2b19f31d3a00eaec166b9eda50e99b9e3637f9bc587989aa75c',surveyForStorage:'9ab34e47f465c1b6f0d842d5b4003728e312c2109fd5bd03afb5f8c99512109b',surveyFromStorage:'19a42ff7de437591a5e8030a6c9a796a3a7ba38f075a4f26b11a62ee3555175a',summary:'af9292d1810a2b62f7c9ab8c4d9c6dfb5b16f875d0b45647eab3f1c12b6159a9',field:'3077309448fe243398f7ea286315fb05d493d050ba189e32185297b749bab36f'};
 for(const [name,hash]of Object.entries(hashes)){const start=source.search(new RegExp('^  (?:async )?function '+name+'\\(','m')),eol=source.indexOf('\n',start),body=source.slice(start,eol).trim().endsWith('}')?source.slice(start,eol):source.slice(start,source.indexOf('\n  }',start)+4);assert.equal(crypto.createHash('sha256').update(body).digest('hex'),hash,name);}
});
