'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../cotizador/tecnoprices-presentation-overlay'),Patch=require(path.join(dir,'attach.cjs')),helper=require(path.join(dir,'tecnoprices-login.js'));
const reference=process.env.SV_PRESENTATION_ENTRYPOINT_FILE,baseline=process.env.SV_PRESENTATION_BASELINE_FILE,presentationRoot=process.env.SV_PRESENTATION_SOURCE_ROOT;
const hasReference=!!reference&&!!baseline&&!!presentationRoot;
test('CLI apply/verify/revert are exact and refused writes leave their input intact',{skip:!hasReference},()=>{
 const os=require('node:os'),cp=require('node:child_process'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'tecnoprices-overlay-'));
 try{const file=path.join(temp,'index.js'),cli=path.join(dir,'attach.cjs'),run=mode=>cp.execFileSync(process.execPath,[cli,mode,file],{stdio:'pipe'});
  fs.writeFileSync(file,readReference());run('apply');const patched=fs.readFileSync(file,'utf8');run('verify');assert.equal(fs.readFileSync(file,'utf8'),patched);run('revert');assert.equal(fs.readFileSync(file,'utf8'),readReference());
  fs.writeFileSync(file,'synthetic wrong source');assert.throws(()=>run('apply'));assert.equal(fs.readFileSync(file,'utf8'),'synthetic wrong source');
 }finally{assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep+'tecnoprices-overlay-'));fs.rmSync(temp,{recursive:true});}
});
test('overlay helper is byte pinned and unknown helpers/baselines reject',()=>{
 Patch.verifyHelper(fs.readFileSync(path.join(dir,'tecnoprices-login.js')));
 assert.throws(()=>Patch.verifyHelper(Buffer.from('unreviewed helper')),/Unreviewed/);
 for(const source of ['',"console.log('synthetic');",'\r\n'])assert.throws(()=>Patch.apply(source),/entrypoint changed/);
});
test('Docker overlay inherits only the exact presentation image and changes no runtime settings',()=>{
 const docker=fs.readFileSync(path.join(dir,'Dockerfile'),'utf8');
 assert.match(docker,/^FROM .*cotizador@sha256:813a22a1b2614280109ddecd2320c5ac9a768963c8cc2cf80bc6e00f52ef813b\n/);
 assert.deepEqual(docker.split('\n').filter(line=>line.startsWith('COPY ')),['COPY tecnoprices-login.js ./','COPY attach.cjs ./tecnoprices-overlay-attach.cjs']);
 assert(!/^(ENV|CMD|ENTRYPOINT|USER|EXPOSE|ARG) /m.test(docker));
});
function readReference(){return fs.readFileSync(reference,'utf8');}
function scraper(source){return source.slice(source.indexOf('function firmaCredencialesProveedor('),source.indexOf('\nasync function cotizarBiosegur('));}
test('private reference is exactly deterministic Presentation overlay of the pinned old entrypoint',{skip:!hasReference},()=>{
 const original=fs.readFileSync(baseline,'utf8');assert.equal(Patch.sha(original),'50e9a049d412515ad4062af0acb793b9a268d3919da97376e4f4dbd66c7bee85');
 let generated;vm.runInNewContext(fs.readFileSync(path.join(presentationRoot,'cotizador/presentation-overlay/attach.cjs'),'utf8'),{require:id=>id==='node:fs'?{readFileSync:()=>original,writeFileSync:(_,text)=>{generated=text;}}:require(id),process:{argv:[]},Buffer});
 assert.equal(generated,readReference());assert.equal(Patch.sha(generated),Patch.BASE_SHA256);
});
test('apply and reversal preserve every byte outside the login scraper, including Presentation/auth/deletion behavior',{skip:!hasReference},()=>{
 const source=readReference(),patched=Patch.apply(source);new vm.Script(patched);
 assert.equal(Patch.revert(patched),source);assert.throws(()=>Patch.apply(patched),/entrypoint changed/);
 const replaceBody=text=>text.replace(scraper(text),'SCRAPER_BODY');assert.equal(replaceBody(patched),replaceBody(source));
 assert(source.includes("pathname==='/presupuestos/presentacion-proyecto'"));
 assert.equal(patched.includes('COMMERCIAL_DELETE_ENABLED'),source.includes('COMMERCIAL_DELETE_ENABLED'));
 assert.throws(()=>Patch.apply(source+'\n'),/entrypoint changed/);assert.throws(()=>Patch.revert(patched+'\n'),/Modified overlay/);
});
test('Presentation model authorization still requires genuine active admin context; no data IO',{skip:!hasReference},async()=>{
 const API=require(path.join(presentationRoot,'cotizador/budget-presentation-trial.js'));
 const state={'sv_chat_roles/u':{activo:true,rol:'admin'},'sv_permisos/admin':{indiceVersion:2,indiceRevision:1,indiceModulos:{presupuesto:true}}};
 const api=API.create({auth:{verifyIdToken:async token=>{if(token!=='fixture-only')throw Error('invalid');return{uid:'u'};}},db:{ref:key=>({get:async()=>({val:()=>state[key]||null})})},model:{}});
 await assert.rejects(api.authorize({headers:{}}),{statusCode:401});await assert.rejects(api.authorize({headers:{authorization:'Bearer invalid'}}),{statusCode:401});
 assert.equal((await api.authorize({headers:{authorization:'Bearer fixture-only'}})).uid,'u');
 await assert.rejects(api.authorize({headers:{authorization:'Bearer fixture-only','x-sv-view-as':'other'}}),{statusCode:403});
 state['sv_chat_roles/u'].activo=false;await assert.rejects(api.authorize({headers:{authorization:'Bearer fixture-only'}}),{statusCode:403});
});
for(const scenario of ['authenticated','HTTP401','login-with-price'])test('patched exact scraper with real helper and synthetic API: '+scenario,{skip:!hasReference},async()=>{
 const source=Patch.apply(readReference()),sessions=new Map(),calls=[];let current='https://www.tecnoprices.com/ingresar',extracted=0,closed=0;
 const page={url:()=>current,route:async(_,handler)=>{calls.push(['guard',typeof handler]);},locator:selector=>selector==='form'?{evaluateAll:async()=>[{csrf:'fixture-only'}]}:{innerText:async()=> 'Producto ficticio $ 1234'},context:()=>context,goto:async url=>{current=url;calls.push(['GET',url]);},evaluate:async()=>({login:scenario==='login-with-price',logout:scenario==='authenticated'}),waitForLoadState:async()=>{},waitForTimeout:async()=>{}};
 const context={newPage:async()=>page,storageState:async()=>({cookies:[],origins:[]}),close:async()=>{closed++;},request:{post:async(url,options)=>{calls.push(['POST',url]);assert.equal(url,'https://www.tecnoprices.com/control.php');assert.equal(options.maxRedirects,0);return{status:()=>scenario==='HTTP401'?401:200,headers:()=>({}),dispose:async()=>{}};}}};
 const scope={require:id=>{assert.equal(id,'./tecnoprices-login');return helper;},crypto,sesionesProveedorManual:sessions,SESION_PROVEEDOR_TTL_MS:900000,claveSesionProveedorManual:()=> 'fixture-only',normalizarUrl:v=>v,adquirirNavegador:async()=>({newContext:async()=>context,close:async()=>{}}),extraerPrecioPaginaProveedor:async()=>{extracted++;return{precioArs:1234};},extraerDisponibilidadPaginaProveedor:async()=> 'disponible',extraerCondicionIva:()=>({}),tituloVisibleProducto:async()=> 'Ficticio',identidadAlta:()=>({ok:true}),validarIdentidadProducto:()=>({ok:true}),Date,Map,URL};vm.runInNewContext(scraper(source),scope);
 const pending=scope.cotizarProveedorConLogin({proveedor:{usuario:'fixture-only',password:'not-a-secret'},proveedorKey:'fixture-only',producto:'Ficticio',url:'https://www.tecnoprices.com/producto-exacto',tipo:'tecnoprices'});
 if(scenario==='authenticated'){assert.equal((await pending).precioArs,1234);assert.equal(extracted,1);assert.equal(sessions.size,1);}else{await assert.rejects(pending,error=>{assert.equal(error.code,'TECNOPRICES_LOOKUP_FAILED');assert(!/not-a-secret|Call log|Timeout/.test(error.message));return true;});assert.equal(extracted,0);assert.equal(sessions.size,0);}
 assert.equal(calls.filter(call=>call[0]==='POST').length,1);assert.equal(closed,1);
});
