'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('fs');
function fixture(fetch,options={}){
 const handlers=new Map(),menu={hidden:true,style:{display:'none'}},background={inert:false,tagName:'MAIN'},focus={isConnected:true,focus(){this.restored=true;}},body={children:[background],style:{overflow:'auto'},appendChild(x){this.children.push(x);}},nodes=[];
 const listeners=new Map(),add=(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);handlers.set(name,event=>{for(const callback of [...listeners.get(name)])callback(event);});},remove=(name,fn)=>listeners.get(name)?.delete(fn);
 const createElement=tag=>{const node={tagName:tag.toUpperCase(),style:{},attributes:{},contentWindow:{SVPrivateFinanceUI:{destroy(){node.destroyed=true;}}},appendChild(x){this.child=x;},setAttribute(k,v){this.attributes[k]=v;},addEventListener(){},focus(){},remove(){this.removed=true;body.children=body.children.filter(x=>x!==this);}};nodes.push(node);return node;};
 const user={uid:'owner-fixture',getIdToken:options.token||(async()=>'fake-token')},ctx={isAuthenticated:true,currentUserUid:user.uid,fbAuth:{currentUser:user},_impersonacionOriginal:null,scrollY:40,scrollTo(x,y){this.scrollY=y;},document:{body,hidden:options.hidden===true,visibilityState:options.hidden?'hidden':'visible',activeElement:focus,getElementById:id=>id==='nav-personal-finance'?menu:null,createElement,addEventListener:add,removeEventListener:remove,dispatchEvent:e=>handlers.get(e.type)?.(e)},location:{hash:'#/gastos',pathname:'/',search:''},history:{replaceState(_a,_b,url){ctx.location.hash=url.slice(url.indexOf('#'));}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'http://fixture.invalid'},fetch,CustomEvent:class{constructor(type){this.type=type;}},AbortController,setTimeout,clearTimeout,URL,console,addEventListener:(name,fn)=>add('window:'+name,fn)};ctx.window=ctx;if(options.foreground)ctx.SVForegroundSession=options.foreground(ctx);vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/modules/private-finance-portal.js','utf8'),ctx);return {ctx,menu,body,background,focus,nodes,handlers,setHidden(value){ctx.document.hidden=value;ctx.document.visibilityState=value?'hidden':'visible';ctx.document.dispatchEvent({type:'visibilitychange'});}};
}
const response=(status=200)=>({ok:status===200,status,json:async()=>({ok:status===200,allowed:status===200,mensaje:'Denegado'})});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('aviso visible conserva su interacción: el espacio privado espera a Entendido',async()=>{const f=fixture(async()=>response());let popup={id:'popup-actualizado',inert:false};const original=f.ctx.document.getElementById;f.ctx.document.getElementById=id=>id==='popup-actualizado'?popup:original(id);f.ctx.location.hash='#/gastospersonales';await settle();await f.ctx.SVPrivateFinancePortal.open();assert.equal(f.nodes.length,0);assert.equal(f.background.inert,false);assert.equal(popup.inert,false);popup=null;f.handlers.get('sisventas:release-notice-closed')();await settle();assert.equal(f.nodes.filter(n=>n.tagName==='IFRAME').length,1);assert.equal(f.background.inert,true);});

test('al salir del espacio privado se notifica después de restaurar la interacción del fondo',async()=>{const f=fixture(async()=>response());await settle();await f.ctx.SVPrivateFinancePortal.open();let closed=0;f.handlers.set('sisventas:private-finance-closed',()=>{closed++;assert.equal(f.background.inert,false);assert.equal(f.body.style.overflow,'auto');});f.ctx.SVPrivateFinancePortal.close();assert.equal(closed,1);f.ctx.SVPrivateFinancePortal.close();assert.equal(closed,1);});
test('sesión recuperada antes de cargar el módulo comprueba acceso sin esperar otro login',async()=>{let count=0;const f=fixture(async()=>{count++;return response();});await settle();assert.equal(f.menu.hidden,false);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);assert.equal(count,1);});
test('respuesta de acceso tardía tras logout no revela menú ni datos',async()=>{let resolve;const f=fixture(()=>new Promise(r=>resolve=r));await settle();f.ctx.fbAuth.currentUser=null;f.ctx.isAuthenticated=false;f.handlers.get('sisventas:session-ended')();resolve(response());await settle();assert.equal(f.menu.hidden,true);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),false);});
test('otro administrador rechazado no obtiene menú ni puede abrir el espacio',async()=>{const f=fixture(async()=>response(403));await settle();await f.ctx.SVPrivateFinancePortal.open();assert.equal(f.menu.hidden,true);assert.equal(f.nodes.length,0);});
test('retorno restaura ruta, foco, scroll y bloqueo del fondo; destruye el contenido privado',async()=>{const f=fixture(async()=>response());await settle();await f.ctx.SVPrivateFinancePortal.open();assert.equal(f.background.inert,true);assert.equal(f.body.style.overflow,'hidden');const frame=f.nodes.find(n=>n.tagName==='IFRAME');assert.equal(f.ctx.location.hash,'#/gastospersonales');f.ctx.SVPrivateFinancePortal.close();assert.equal(frame.destroyed,true);assert.equal(f.background.inert,false);assert.equal(f.body.style.overflow,'auto');assert.equal(f.ctx.location.hash,'#/gastos');assert.equal(f.ctx.scrollY,40);assert.equal(f.focus.restored,true);});
test('Ver como cierra y borra inmediatamente; respuestas previas se descartan',async()=>{let mode='normal',resolve;const f=fixture(()=>mode==='pending'?new Promise(r=>resolve=r):Promise.resolve(response()));await settle();await f.ctx.SVPrivateFinancePortal.open();mode='pending';const request=f.ctx.SVPrivateFinancePortal.request('/guardar',{id:'fake'});await settle();f.ctx._impersonacionOriginal={user:'Otro'};f.ctx.SVPrivateFinancePortal.contextChanged();resolve(response());await assert.rejects(request,/sesión cambió/);assert.equal(f.menu.hidden,true);assert.equal(f.nodes.find(n=>n.tagName==='IFRAME').destroyed,true);await assert.rejects(f.ctx.SVPrivateFinancePortal.request(),/sesión propia/);});
test('revocar acceso en servidor limpia un espacio previamente abierto',async()=>{let denied=false;const f=fixture(async()=>response(denied?403:200));await settle();await f.ctx.SVPrivateFinancePortal.open();denied=true;await assert.rejects(f.ctx.SVPrivateFinancePortal.request(),/Denegado/);assert.equal(f.menu.hidden,true);assert.equal(f.nodes.find(n=>n.tagName==='IFRAME').destroyed,true);assert.equal(f.background.inert,false);});

test('abrir con acceso ya comprobado muestra el marco sin repetir /acceso y el estado sigue autorizado por servidor',async()=>{const paths=[];const f=fixture(async url=>{paths.push(new URL(url).pathname);return response();});await settle();assert.equal(paths.length,1);await f.ctx.SVPrivateFinancePortal.open();await f.ctx.SVPrivateFinancePortal.open();assert.equal(paths.length,1);assert.equal(f.nodes.filter(n=>n.tagName==='IFRAME').length,1);await f.ctx.SVPrivateFinancePortal.request();assert.deepEqual(paths,['/privado/finanzas/acceso','/privado/finanzas']);});

test('repintar el mismo rol no repite acceso, pero cambiar UID de vista borra el espacio aunque falte la marca de impersonación',async()=>{let count=0;const f=fixture(async()=>{count++;return response();});await settle();for(let n=0;n<3;n++)f.ctx.SVPrivateFinancePortal.contextChanged();await settle();assert.equal(count,1);await f.ctx.SVPrivateFinancePortal.open();f.ctx.currentUserUid='otro';f.ctx.SVPrivateFinancePortal.contextChanged();await settle();assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),false);assert.equal(f.nodes.find(n=>n.tagName==='IFRAME').destroyed,true);assert.equal(f.menu.hidden,true);});

test('dos aperturas esperando la misma autorización crean un solo espacio',async()=>{let resolve;const f=fixture(()=>new Promise(r=>resolve=r));const one=f.ctx.SVPrivateFinancePortal.open(),two=f.ctx.SVPrivateFinancePortal.open();await settle();resolve(response());await Promise.all([one,two]);assert.equal(f.nodes.filter(n=>n.tagName==='IFRAME').length,1);f.ctx.SVPrivateFinancePortal.close();assert.equal(f.background.inert,false);});

test('IA privada envía solo el PDF al endpoint fijo y descarta la respuesta tras cambiar de cuenta',async()=>{let hold=false,resolve,last;const f=fixture(async(url,options)=>{last={url,options};return hold?new Promise(r=>resolve=r):response();});await settle();hold=true;const task=f.ctx.SVPrivateFinancePortal.analyzePDF('ficticio');await settle();assert.match(last.url,/\/statement-import$/);assert.deepEqual(JSON.parse(last.options.body),{data:'ficticio'});assert.equal(last.options.headers.Authorization,'Bearer fake-token');f.ctx.currentUserUid='other';resolve(response());await assert.rejects(task,/sesión cambiada/);});

test('IA privada rechaza Ver como, revocación y cancelación sin guardar documentos',async()=>{let denied=false;const urls=[];const f=fixture(async url=>{urls.push(url);return response(denied?403:200);});await settle();f.ctx._impersonacionOriginal={user:'Otro'};await assert.rejects(f.ctx.SVPrivateFinancePortal.analyzePDF('ficticio'),/sesión propia/);assert.equal(urls.length,1);f.ctx._impersonacionOriginal=null;const controller=new AbortController();controller.abort();await assert.rejects(f.ctx.SVPrivateFinancePortal.analyzePDF('ficticio',controller.signal),/cancelado/);assert.equal(urls.length,1);denied=true;await assert.rejects(f.ctx.SVPrivateFinancePortal.analyzePDF('ficticio'),/Denegado/);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),false);assert.ok(urls.every(u=>!u.endsWith('/documentos')&&!u.endsWith('/guardar')));});

test('cancelar lectura termina incluso si el SDK no entrega token',async()=>{let calls=0;const f=fixture(async()=>{calls++;return response();});await settle();f.ctx.fbAuth.currentUser.getIdToken=()=>new Promise(()=>{});const controller=new AbortController(),task=f.ctx.SVPrivateFinancePortal.analyzePDF('ficticio',controller.signal);await settle();controller.abort();await assert.rejects(task,/cancelado/);assert.equal(calls,1);});
test('nombre visible corresponde sólo a la sesión propia autorizada y no expone credenciales',async()=>{const f=fixture(async()=>response());f.ctx.currentUser='Titular de ejemplo';await settle();assert.deepEqual(JSON.parse(JSON.stringify(f.ctx.SVPrivateFinancePortal.identity())),{name:'Titular de ejemplo'});f.ctx._impersonacionOriginal={user:'Otra persona'};assert.equal(f.ctx.SVPrivateFinancePortal.identity(),null);f.ctx._impersonacionOriginal=null;f.ctx.isAuthenticated=false;assert.equal(f.ctx.SVPrivateFinancePortal.identity(),null);});

test('un403 de acceso no se repite al aplicar el mismo rol y no abre ni consulta datos privados',async()=>{
 const paths=[],f=fixture(async url=>{paths.push(new URL(url).pathname);return response(403);});await settle();
 for(let n=0;n<3;n++){f.ctx.SVPrivateFinancePortal.contextChanged();await settle();}
 assert.deepEqual(paths,['/privado/finanzas/acceso']);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),false);assert.equal(f.menu.hidden,true);assert.equal(f.nodes.length,0);
});

test('la comprobación pendiente del mismo arranque se comparte con session-ready sin abortarla',async()=>{
 const calls=[];let resolve;
 const f=fixture((url,options)=>{calls.push({path:new URL(url).pathname,signal:options.signal});return new Promise(done=>resolve=done);});
 f.ctx.SVPrivateFinancePortal.contextChanged();f.handlers.get('sisventas:session-ready')();await settle();
 assert.equal(calls.length,1);assert.equal(calls[0].path,'/privado/finanzas/acceso');assert.equal(calls[0].signal.aborted,false);
 resolve(response());await settle();assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);assert.equal(f.menu.hidden,false);assert.equal(calls.length,1);
});

test('reintentar explícitamente revalida un403 y una lectura posterior conserva la autoridad del servidor',async()=>{
 let denied=true;const paths=[],f=fixture(async url=>{paths.push(new URL(url).pathname);return response(denied?403:200);});await settle();
 denied=false;assert.equal(await f.ctx.SVPrivateFinancePortal.check(),true);assert.deepEqual(paths,['/privado/finanzas/acceso','/privado/finanzas/acceso']);
 await f.ctx.SVPrivateFinancePortal.open();assert.equal(f.nodes.filter(node=>node.tagName==='IFRAME').length,1);assert.equal(paths.length,2);
 denied=true;await assert.rejects(f.ctx.SVPrivateFinancePortal.request(),error=>error.status===403);assert.equal(paths.at(-1),'/privado/finanzas');
 assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),false);assert.equal(f.menu.hidden,true);assert.equal(f.nodes.find(node=>node.tagName==='IFRAME').destroyed,true);
});

test('un error de red no fija un rechazo y una apertura explícita puede recuperar el acceso',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;if([1,3].includes(calls))throw TypeError('Red ficticia');return response();});await settle();
 assert.equal(f.menu.hidden,true);await f.ctx.SVPrivateFinancePortal.open();assert.equal(calls,2);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);assert.equal(f.nodes.filter(node=>node.tagName==='IFRAME').length,1);
 assert.equal(await f.ctx.SVPrivateFinancePortal.check(),false);assert.equal(calls,3);f.ctx.SVPrivateFinancePortal.contextChanged();await settle();assert.equal(calls,4);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);
});

test('el rechazo memorizado se invalida al cambiar rol, Auth, Ver como o sesión',async()=>{
 for(const change of ['rol','auth','vista','sesión']){
  let calls=0;const f=fixture(async()=>{calls++;return response(403);});await settle();assert.equal(calls,1);
  if(change==='rol')f.ctx.currentRole='tecnico';
  if(change==='auth')f.ctx.fbAuth.currentUser={...f.ctx.fbAuth.currentUser};
  if(change==='vista'){f.ctx._impersonacionOriginal={user:'Otra persona'};f.ctx.SVPrivateFinancePortal.contextChanged();await settle();assert.equal(calls,1);f.ctx._impersonacionOriginal=null;}
  if(change==='sesión'){f.handlers.get('sisventas:session-ended')();f.handlers.get('sisventas:session-ready')();}else f.ctx.SVPrivateFinancePortal.contextChanged();
  await settle();assert.equal(calls,2,change);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),false);assert.equal(f.nodes.length,0);
 }
});

test('un403 tardío de otro contexto no revoca ni memoriza el rechazo en la sesión actual',async()=>{
 let resolve;const calls=[],f=fixture(async(url,options)=>{calls.push(options.signal);if(calls.length===1)return new Promise(done=>resolve=done);return response();});await settle();
 f.ctx.currentRole='tecnico';f.ctx.SVPrivateFinancePortal.contextChanged();await settle();assert.equal(calls.length,2);assert.equal(calls[0].aborted,true);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);
 resolve(response(403));await settle();f.ctx.SVPrivateFinancePortal.contextChanged();await settle();assert.equal(calls.length,2);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);assert.equal(f.menu.hidden,false);
});

test('arrancar oculto no pide token ni acceso; aplicar rol, session-ready y abrir se reúnen al volver',async()=>{
 let calls=0,tokens=0;const f=fixture(async()=>{calls++;return response();},{hidden:true,token:async()=>{tokens++;return 'ficticio';}});
 f.ctx.SVPrivateFinancePortal.contextChanged();f.handlers.get('sisventas:session-ready')();const opening=f.ctx.SVPrivateFinancePortal.open();await settle();
 assert.equal(calls,0);assert.equal(tokens,0);assert.equal(f.nodes.length,0);assert.equal(f.body.style.overflow,'auto');
 f.setHidden(false);await opening;await settle();assert.equal(calls,1);assert.equal(tokens,1);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);assert.equal(f.nodes.filter(node=>node.tagName==='IFRAME').length,1);
});

test('si el token termina después de ocultarse, acceso espera otra vez y no inicia el fetch en fondo',async()=>{
 let releaseToken,calls=0;const f=fixture(async()=>{calls++;return response();},{token:()=>new Promise(resolve=>releaseToken=resolve)});await settle();
 f.setHidden(true);releaseToken('ficticio');await settle();assert.equal(calls,0);assert.equal(f.nodes.length,0);
 f.setHidden(false);await settle();assert.equal(calls,1);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);
});

test('una comprobación iniciada visible puede terminar oculta sin crear iframe hasta regresar',async()=>{
 let resolve,calls=0;const f=fixture(()=>{calls++;return new Promise(done=>resolve=done);});await settle();
 const opening=f.ctx.SVPrivateFinancePortal.open();await settle();f.setHidden(true);resolve(response());await settle();
 assert.equal(calls,1);assert.equal(f.nodes.length,0);assert.equal(f.body.style.overflow,'auto');
 f.setHidden(false);await opening;assert.equal(calls,1);assert.equal(f.nodes.filter(node=>node.tagName==='IFRAME').length,1);
});

test('guardar, subir documentos y analizar un PDF ya iniciados continúan al ocultarse sin nuevas comprobaciones',async()=>{
 const operations=[];const f=fixture((url,options)=>{if(new URL(url).pathname.endsWith('/acceso'))return Promise.resolve(response());return new Promise(resolve=>operations.push({url,options,resolve}));});await settle();await f.ctx.SVPrivateFinancePortal.open();
 const saving=f.ctx.SVPrivateFinancePortal.request('/guardar',{id:'operación-ficticia'}),upload=f.ctx.SVPrivateFinancePortal.request('/documentos',{data:'ficticio'}),analysis=f.ctx.SVPrivateFinancePortal.analyzePDF('ficticio');await settle();
 assert.equal(operations.length,3);f.setHidden(true);await settle();assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);assert.equal(f.nodes.find(node=>node.tagName==='IFRAME').destroyed,undefined);
 for(const operation of operations){assert.equal(operation.options.method,'POST');assert.equal(operation.options.signal.aborted,false);operation.resolve(response());}
 await Promise.all([saving,upload,analysis]);assert.equal(operations.length,3);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);
});

test('logout y cambio de rol aún cancelan operaciones y esperas ocultas; lo tardío no restaura la vista',async()=>{
 for(const change of ['logout','rol']){
  let release;const calls=[];const f=fixture((url,options)=>{calls.push({url,options});return new URL(url).pathname.endsWith('/acceso')?Promise.resolve(response()):new Promise(resolve=>release=resolve);});await settle();await f.ctx.SVPrivateFinancePortal.open();
  const saving=f.ctx.SVPrivateFinancePortal.request('/guardar',{id:'ficticio'});await settle();f.setHidden(true);
  if(change==='logout'){f.ctx.isAuthenticated=false;f.ctx.fbAuth.currentUser=null;f.handlers.get('sisventas:session-ended')();}else{f.ctx.currentRole='tecnico';f.ctx.SVPrivateFinancePortal.contextChanged();}
  assert.equal(calls.length,2);assert.equal(calls[1].options.signal.aborted,true);assert.equal(f.nodes.find(node=>node.tagName==='IFRAME').destroyed,true);
  release(response());await assert.rejects(saving,/sesión cambió/);f.ctx.isAuthenticated=false;f.handlers.get('sisventas:session-ended')();f.setHidden(false);await settle();assert.equal(calls.length,2);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),false);
 }
 const f=fixture(()=>assert.fail('No consultar después de cerrar una espera oculta'),{hidden:true});const opening=f.ctx.SVPrivateFinancePortal.open();await settle();f.ctx.isAuthenticated=false;f.handlers.get('sisventas:session-ended')();await opening;f.setHidden(false);await settle();assert.equal(f.nodes.length,0);
});

test('con el helper compartido usa waitVisible cancelable y no agrega una recuperación paralela',async()=>{
 const waits=[];let calls=0;
 const foreground=ctx=>({isVisible:()=>!ctx.document.hidden,waitVisible:({signal})=>new Promise((resolve,reject)=>{waits.push({signal,resolve});signal.addEventListener('abort',()=>reject(Error('Cancelada')),{once:true});})});
 const f=fixture(async()=>{calls++;return response();},{hidden:true,foreground});await settle();assert.equal(waits.length,1);assert.equal(calls,0);assert.equal(f.handlers.has('visibilitychange'),false);
 f.ctx.SVPrivateFinancePortal.contextChanged();f.handlers.get('sisventas:session-ready')();await settle();assert.equal(waits.length,1);
 f.setHidden(false);await settle();assert.equal(calls,0);waits[0].resolve();await settle();assert.equal(calls,1);assert.equal(f.ctx.SVPrivateFinancePortal.allowed(),true);
 f.setHidden(true);const opening=f.ctx.SVPrivateFinancePortal.open();await settle();assert.equal(waits.length,2);f.ctx.isAuthenticated=false;f.handlers.get('sisventas:session-ended')();await opening;assert.equal(waits[1].signal.aborted,true);assert.equal(f.nodes.length,0);
});
