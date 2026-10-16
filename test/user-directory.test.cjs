'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createUserDirectory}=require('../cotizador/user-directory');
const {createBusinessAuth}=require('../cotizador/user-access');
function fixture(){
 const data={sv_chat_roles:{admin:{rol:'admin',activo:true},worker:{rol:'tecnico',activo:true},seller:{rol:'vendedor',activo:true},portal:{rol:'distribuidora',activo:true}},sv_usuarios:{a:{uid:'admin',rol:'admin',activo:true,nombre:'Administrador ficticio',mail:'admin@example.test',claveAdmin:'FAKE_PRIVATE'},w:{uid:'worker',rol:'tecnico',activo:true,nombre:'Técnico ficticio',empleadoFbKey:'e',mail:'worker@example.test',password:'FAKE_PRIVATE'},s:{uid:'seller',rol:'vendedor',activo:true,nombre:'Vendedor ficticio',login:'seller',token:'FAKE_PRIVATE'},p:{uid:'portal',rol:'distribuidora',activo:true,nombre:'Portal ficticio'}}};
 const calls=[],db={ref:path=>{const chain={orderByChild:f=>{chain.field=f;return chain;},equalTo:v=>{chain.value=v;return chain;},get:async()=>{calls.push({path,field:chain.field,value:chain.value});let value=path.split('/').reduce((a,k)=>a?.[k],data)||null;if(chain.field)value=Object.fromEntries(Object.entries(value||{}).filter(([,p])=>p[chain.field]===chain.value));return {val:()=>structuredClone(value)};}};return chain;}};
 const auth={verifyIdToken:async(uid,revoked)=>{assert.equal(revoked,true);if(uid==='bad')throw Error();return {uid};}};
 return {data,calls,db,auth,service:createUserDirectory({auth,db,enabled:true}),req:uid=>({headers:{authorization:'Bearer '+uid}})};
}
test('perfil consulta UID propio exacto y no entrega campos privados ni acepta UID ajeno',async()=>{
 const f=fixture(),actor=await f.service.authorize(f.req('worker'));const p=await f.service.profile(actor);
 assert.equal(p.profile.uid,'worker');assert.equal(p.profile.empleadoFbKey,'e');assert.equal(p.profile.mail,'worker@example.test');assert.equal(JSON.stringify(p).includes('FAKE_PRIVATE'),false);
 assert.deepEqual(f.calls.find(c=>c.path==='sv_usuarios'),{path:'sv_usuarios',field:'uid',value:'worker'});
});
test('directorio interno contiene solo campos permitidos, sin emails ni portales',async()=>{
 const f=fixture(),p=await f.service.directory(await f.service.authorize(f.req('worker')));
 assert.equal(p.users.length,3);assert.equal(JSON.stringify(p).includes('example.test'),false);assert.equal(JSON.stringify(p).includes('FAKE_PRIVATE'),false);assert.equal(p.users.some(u=>u.uid==='portal'),false);
 await assert.rejects(f.service.directory(await f.service.authorize(f.req('portal'))),e=>e.statusCode===403);
});
test('lista administrativa no expone claves y requiere admin más módulo autorizado',async()=>{
 const f=fixture();await assert.rejects(f.service.directory(await f.service.authorize(f.req('seller')),true),e=>e.statusCode===403);
 const actor=await f.service.authorize(f.req('admin')),all=await f.service.directory(actor,true);assert.equal(all.users.length,4);assert.equal(JSON.stringify(all).includes('FAKE_PRIVATE'),false);
 f.data.sv_permisos={admin:{bloqueados:['usuarios']}};await assert.rejects(f.service.directory(actor,true),e=>e.statusCode===403);
});
test('sesión inválida, identidad revocada, ficha duplicada y rol incoherente fallan cerrados',async()=>{
 const f=fixture();await assert.rejects(f.service.authorize(f.req('bad')),e=>e.statusCode===401);
 const actor=await f.service.authorize(f.req('worker'));f.data.sv_usuarios.dup={...f.data.sv_usuarios.w};await assert.rejects(f.service.profile(actor),e=>e.statusCode===403);
 assert.equal((await f.service.directory(actor)).users.some(u=>u.uid==='worker'),false);delete f.data.sv_usuarios.dup;
 f.data.sv_usuarios.w.rol='admin';await assert.rejects(f.service.profile(actor),e=>e.statusCode===403);
 f.data.sv_chat_roles.worker.activo=false;await assert.rejects(f.service.authorize(f.req('worker')),e=>e.statusCode===403);
 await assert.rejects(createUserDirectory({auth:f.auth,db:f.db}).authorize(f.req('admin')),e=>e.statusCode===503);
});

test('el API conserva el guard de contraseña temporal y versión de acceso anterior',async()=>{
 const f=fixture();f.data.sv_access_resets={worker:{required:true,version:'new'}};
 const service=createUserDirectory({auth:createBusinessAuth(f.auth,f.db),db:f.db,enabled:true});
 await assert.rejects(service.authorize(f.req('worker')));f.data.sv_access_resets.worker.required=false;
 await assert.rejects(service.authorize(f.req('worker')));
 f.auth.verifyIdToken=async uid=>({uid,svAccessVersion:'new'});assert.equal((await service.authorize(f.req('worker'))).uid,'worker');
 f.data.sv_usuarios.w.rol='Técnico';assert.equal((await service.profile({uid:'worker',role:'tecnico'})).profile.rol,'tecnico');
});

test('editar usuario usa la proyección administrativa y conserva intactos los campos privados',async()=>{
 const source=require('./helpers/active-app').readActiveApp().source,start=source.indexOf('function editarUsuario('),end=source.indexOf('\n}',start)+2;
 let shown;const window={fbDB:{},SVUserDirectory:{enabled:true,adminProfile:async key=>({fbKey:key,nombre:'Persona ficticia',rol:'tecnico',mail:'fixture@example.test'})},fbOnValue:()=>assert.fail('No leer ficha cruda')};
 const context={window,document:{getElementById:()=>null},abrirModalNuevo:(kind,data,key)=>{shown={kind,data,key};},notify:m=>assert.fail(m)};vm.runInNewContext(source.slice(start,end),context);
 await context.editarUsuario('w');assert.equal(shown.key,'w');assert.equal(shown.data.nm,'Persona ficticia');assert.equal(shown.data.pass,'');
});
function client(){
 const events=new EventTarget(),calls=[],listeners=[],user={uid:'worker',getIdToken:async()=> 'FAKE_TOKEN'};
 const root={SV_USER_DIRECTORY_V2:true,fbAuth:{currentUser:user},currentUserUid:'worker',currentRole:'tecnico',SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},fbDB:{},fbRef:(_,p)=>p,fbOnValue:(p,fn)=>{listeners.push({p,fn});return()=>{};},permisoModulo:()=>true};
 const ctx={window:root,document:events,AbortSignal,setInterval:()=>1,clearInterval:()=>{},fetch:async url=>{calls.push(url);return {ok:true,json:async()=>({ok:true,...(url.endsWith('/perfil')?{profile:{fbKey:'w',uid:'worker',rol:'tecnico',nombre:'Técnico',mail:'worker@example.test'}}:{users:[{fbKey:'w',uid:'worker',nombre:'Técnico',rol:'tecnico'},{fbKey:'a',uid:'admin',nombre:'Admin',rol:'admin'}]})})};}};
 vm.runInNewContext(fs.readFileSync('js/core/user-directory.js','utf8'),ctx);return {root,ctx,events,calls,listeners,user};
}
test('cliente combina únicamente su perfil con el directorio mínimo y jamás consulta raíz de usuarios',async()=>{
 const f=client();await f.root.SVUserDirectory.profile(f.user);let data;
 f.root.SVUserDirectory.start(s=>{data=s.val();},e=>assert.fail(e));await f.root.SVUserDirectory.refresh();
 assert.equal(data.w.mail,'worker@example.test');assert.equal(data.a.mail,undefined);assert.equal(f.calls.some(p=>p.includes('sv_usuarios')),false);
 assert.deepEqual([...new Set(f.listeners.map(l=>l.p))].sort(),['sv_chat_directorio','sv_chat_roles/worker'].sort());
});
test('respuesta tardía tras logout no repuebla el directorio ni datos administrativos',async()=>{
 const f=client();let resolve;f.ctx.fetch=()=>new Promise(r=>resolve=r);let delivered=0;
 f.root.SVUserDirectory.start(()=>delivered++);while(!resolve)await Promise.resolve();
 f.events.dispatchEvent(new Event('sisventas:session-ended'));f.root.fbAuth.currentUser=null;
 resolve({ok:true,json:async()=>({ok:true,users:[{fbKey:'a',mail:'private@example.test'}]})});await Promise.resolve();await Promise.resolve();await Promise.resolve();assert.equal(delivered,0);
});
test('revocar rol cierra el estado del cliente y conserva errores de conexión como reintentables',async()=>{
 const f=client();await f.root.SVUserDirectory.profile(f.user);let closed=0;f.root._cancelarAutenticacionParcial=()=>closed++;
 f.root.SVUserDirectory.start(()=>{});await f.root.SVUserDirectory.refresh();
 f.listeners.filter(l=>l.p==='sv_chat_roles/worker').at(-1).fn({val:()=>({activo:false,rol:'tecnico'})});assert.equal(closed,1);assert.equal(f.root.usuariosData.length,0);
});
test('preparación nueva pide solo identidad y servicio de perfil, sin colección ni fallback legacy',async()=>{
 let reads=[];const own={fbKey:'w',uid:'worker',rol:'tecnico'};
 const root={SV_SECURITY_STORAGE_V2:true,SVUserDirectory:{enabled:true,profile:async()=>own},fbRef:(_,p)=>p,fbGet:async p=>{reads.push(p);return {val:()=>({rol:'tecnico',activo:true})};}};
 vm.runInNewContext(fs.readFileSync('js/modules/security-storage.js','utf8'),{window:root});const prepared=await root.svPrepararRutasSeguridad({uid:'worker'});
 assert.deepEqual(reads,['sv_chat_roles/worker']);assert.equal(prepared.usuariosSnapshot.val().w.uid,'worker');assert.equal(root.svRutaUsuarios(),'sv_usuarios');
 root.SVUserDirectory.profile=async()=>{throw Error('offline');};await assert.rejects(root.svPrepararRutasSeguridad({uid:'worker'}),/offline/);assert.equal(reads.includes('sv_usuarios'),false);
});
