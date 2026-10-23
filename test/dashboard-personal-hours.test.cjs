'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const Model=require('../js/core/dashboard-personal-hours.v1.js');
const Recovery=require('../js/core/session-recovery.js');
const input={employeeId:'own',monthCurrent:'2026-10',monthPrev:'2026-09'};
const makeScope=()=>({auth:{uid:'u'},uid:'u',role:'tecnico',revision:1,epoch:0,view:null,viewProfile:'',...input});
const row=(key='a',patch={})=>({key,value:{empFbKey:'own',estado:'pendiente',horas:1,fecha:'2020-01-01',mes:'2020-01',...patch}});
const body=records=>({ok:true,employeeId:'own',records});
const reply=(value,status=200)=>({ok:status===200,status,json:async()=>value});
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function data(){
 const result={};for(const [i,estado]of ['pendiente','aprobado','rechazado','anulado','pagado_parcial','pagado'].entries())result['key_'+i]={empFbKey:'own',estado,horas:i+0.1,fecha:i%2?'2026-10-01':'2020-01-01'};
 for(const [key,horas]of [['float-a',0.1],['float-m',0.2],['float-z',0.4]])result[key]={empFbKey:'own',estado:'pendiente',horas,fecha:'2020-01-01'};
 result.foreign={empFbKey:'other',estado:'pendiente',horas:99999};result.alias={empleadoFbKey:'own',estado:'pendiente',horas:99999};
 result.case={empFbKey:'own',estado:'Pendiente',horas:99999};result.future={empFbKey:'own',estado:'aprobado',horas:7,fecha:'2030-01-01'};return result;
}
function transport(overrides={}){
 const calls=[],headers=[],deadlines=[],controller=new AbortController();let current=true;
 const options={base:'https://service.example.invalid/Cotizador/',scope:makeScope(),signal:controller.signal,isCurrent:()=>current,
  headersServiceAuth:async()=>{headers.push('headers');return {Authorization:'Bearer fictitious-test-only'};},
  fetch:async(url,init)=>{calls.push({url,init});return reply(body([row()]));},deadline:(task,ms)=>{deadlines.push(ms);return task;},...overrides};
 return {options,calls,headers,deadlines,controller,current:value=>current=value};
}
function fixture(){
 let scope=makeScope(),visible=true,allowed=true;const reads=[],states=[],pending=[];
 const api=Model.create({capture:()=>allowed?scope:null,isVisible:()=>visible,present:state=>states.push(state),read:(captured,{signal})=>{
  reads.push({scope:captured,signal});return new Promise((resolve,reject)=>pending.push({resolve,reject,signal}));}});
 return {api,reads,states,pending,scope:()=>scope,change:patch=>scope={...scope,...patch},visible:value=>visible=value,allowed:value=>allowed=value};
}

test('API pura instalada sin I/O y sin transporte RTDB heredado',()=>{
 const forbidden=()=>assert.fail('No side effect');const window={};for(const key of ['fetch','WebSocket','XMLHttpRequest','fbGet','fbOnValue','document','localStorage','sessionStorage','setTimeout','setInterval'])Object.defineProperty(window,key,{get:forbidden});
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/core/dashboard-personal-hours.v1.js'),'utf8'),{window,Intl,Date,Number,Object,Array,String,Promise,Set,AbortController,URL,TextEncoder});
 assert.equal(typeof window.SVPersonalHours.readOwn,'function');assert.equal(Object.hasOwn(window.SVPersonalHours,'queryOwn'),false);assert.equal(fixture().reads.length,0);
});
test('query raw de referencia y selección propia conservan estados/históricos/IDs/valores',()=>{
 const value=data(),before=structuredClone(value),selected=Object.fromEntries(Object.entries(value).filter(([,record])=>record.empFbKey==='own'));
 assert.deepEqual(Model.project(value,input),Model.project(selected,input));assert.deepEqual(Model.project(selected,input).ids,Object.keys(selected));
 assert.deepEqual(new Set(Model.project(selected,input).records.map(record=>record.value.estado)),new Set(['pendiente','aprobado','rechazado','anulado','pagado_parcial','pagado','Pendiente']));assert.deepEqual(value,before);
});
test('horas conservan IEEE y predicados exactos sin redondear',()=>{
 const value=Object.fromEntries([['a',0.1],['m',0.2],['z',0.4]].map(([key,horas])=>[key,{empFbKey:'own',estado:'pendiente',horas,fecha:'2001-01-01'}]));
 assert.equal(Model.project(value,input).pendingHours,0.7000000000000001);assert.deepEqual(Model.project(value,input).ids,['a','m','z']);
 assert.equal(Model.project({case:{empFbKey:'own',estado:'Pendiente',horas:999}},input).pendingHours,0);
});
test('umbral local canónico y futuro legacy son separados del dataset',()=>{
 assert.equal(Model.previousMonth('2026-03'),'2026-02');assert.equal(Model.previousMonth('2026-10'),'2026-09');assert.equal(Model.previousMonth('2026-01'),'2025-12');
 const result=Model.project({future:{empFbKey:'own',estado:'aprobado',horas:7,fecha:'2030-01-01'}},input);assert.equal(result.approvedHours,7);assert.match(result.text,/desde septiembre de 2026/);assert.doesNotMatch(result.text,/este mes/);
});
test('regresión intencional de mes9:31/03,31/10 y madrugadaUTC no cambian el helper global',()=>{
 const source=fs.readFileSync(require.resolve('../js/app.v3.14.9.js'),'utf8'),start=source.indexOf('function _mesSistema(offset) {'),end=source.indexOf('\n}',start)+2,helper=source.slice(start,end);assert.ok(helper.includes('setMonth'));
 const script='const vm=require("node:vm");const output=[];for(const clock of ["2026-03-31T15:00:00Z","2026-10-31T15:00:00Z","2026-11-01T01:00:00Z"]){class FixedDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}}const c={Date:FixedDate,parseInt};vm.runInNewContext('+JSON.stringify(helper)+',c);output.push([c._mesSistema(0),c._mesSistema(-1)]);}console.log(JSON.stringify(output));';
 const run=spawnSync(process.execPath,['-e',script],{encoding:'utf8',env:{...process.env,TZ:'America/Argentina/Buenos_Aires'},timeout:5000});assert.equal(run.status,0,run.stderr);
 assert.deepEqual(JSON.parse(run.stdout),[['2026-03','2026-03'],['2026-10','2026-10'],['2026-10','2026-10']]);
 for(const [current,previous]of [['2026-03','2026-02'],['2026-10','2026-09']]){const records={a:{empFbKey:'own',estado:'aprobado',horas:1,fecha:previous+'-05'},b:{empFbKey:'own',estado:'aprobado',horas:1,fecha:current+'-05'}};const result=Model.project(records,{...input,monthCurrent:current,monthPrev:previous});assert.equal(result.approvedHours,2);assert.deepEqual(result.ids,['a','b']);}
});
test('período incoherente o colección inválida no se convierte en cero',()=>{
 for(const patch of [{monthPrev:'2026-13'},{monthCurrent:'2026-13'},{monthCurrent:'2026-03',monthPrev:'2026-01'}])assert.throws(()=>Model.project({}, {...input,...patch}),/período/);
 for(const value of [false,0,'',[],17])assert.throws(()=>Model.project(value,input),/detalle/);
});
test('GET own usa sólo el endpoint acordado, headers provistos y no-store',async()=>{
 const f=transport(),dict=await Model.readOwn(f.options);assert.equal(f.calls.length,1);assert.equal(f.headers.length,1);assert.deepEqual(f.deadlines,[20000]);
 const request=f.calls[0];assert.equal(request.url,'https://service.example.invalid/Cotizador/laboral/horas-propias');assert.equal(request.init.method,'GET');assert.equal(request.init.cache,'no-store');assert.equal(request.init.credentials,'omit');assert.equal(request.init.redirect,'error');assert.equal(request.init.headers.Authorization,'Bearer fictitious-test-only');assert.ok(request.init.signal instanceof AbortSignal);assert.equal(Object.getPrototypeOf(dict),null);assert.equal(dict.a.empFbKey,'own');
});
test('único parámetro permitido es viewProfile; nunca se manda employeeId por URL',async()=>{
 const f=transport();f.options.scope.viewProfile='profile_A';await Model.readOwn(f.options);const url=new URL(f.calls[0].url);assert.deepEqual([...url.searchParams],[['viewProfile','profile_A']]);assert.equal(url.searchParams.has('employeeId'),false);
});
test('claves RTDB usan el límite de768 bytes UTF-8, no128 caracteres ni768 unidades Unicode',async()=>{
 for(const key of ['a'.repeat(129),'a'.repeat(768),'é'.repeat(384)]){
  const f=transport();f.options.scope.employeeId=key;f.options.scope.viewProfile=key;f.options.fetch=async()=>reply({ok:true,employeeId:key,records:[{key,value:{empFbKey:key,estado:'pendiente',horas:1}}]});
  const dict=await Model.readOwn(f.options);assert.deepEqual(Object.keys(dict),[key]);
 }
 for(const key of ['a'.repeat(769),'é'.repeat(385),'😀'.repeat(193)]){
  for(const field of ['employeeId','viewProfile']){const f=transport();f.options.scope[field]=key;await assert.rejects(Model.readOwn(f.options),{code:'SV_PERSONAL_HOURS_CONFIG'});assert.equal(f.headers.length,0);assert.equal(f.calls.length,0);}
  const f=transport();f.options.fetch=async()=>reply(body([row(key)]));await assert.rejects(Model.readOwn(f.options),{code:'SV_PERSONAL_HOURS_RESPONSE'});
 }
});
test('UID Auth conserva su límite128 y sus caracteres válidos antes de solicitar headers',async()=>{
 const accepted=transport();accepted.options.scope.auth={uid:'u'.repeat(128)};accepted.options.scope.uid='u'.repeat(128);await Model.readOwn(accepted.options);assert.equal(accepted.calls.length,1);
 for(const uid of ['u'.repeat(129),'uid/forged','uid.child','']){const f=transport();f.options.scope.auth={uid};f.options.scope.uid=uid;await assert.rejects(Model.readOwn(f.options),{code:'SV_PERSONAL_HOURS_CONFIG'});assert.equal(f.headers.length,0);assert.equal(f.calls.length,0);}
});
for(const base of ['https://service.example.invalid/?employeeId=other','https://user:password@service.example.invalid/','https://service.example.invalid/#fragment','file:///C:/data'])test('base inválida se rechaza sin headers ni GET: '+base.split(':')[0],async()=>{
 const f=transport({base});await assert.rejects(Model.readOwn(f.options),{code:'SV_PERSONAL_HOURS_CONFIG'});assert.equal(f.calls.length,0);assert.equal(f.headers.length,0);
});
test('contexto revocado antes de headers no inicia la autenticación ni la solicitud',async()=>{
 const f=transport();f.current(false);await assert.rejects(Model.readOwn(f.options),{name:'AbortError'});assert.equal(f.headers.length,0);assert.equal(f.calls.length,0);
});
test('contexto cambia durante headers: no inicia GET',async()=>{
 let release;const f=transport({headersServiceAuth:()=>new Promise(resolve=>release=resolve)}),task=Model.readOwn(f.options);await flush();f.current(false);release({});await assert.rejects(task,{name:'AbortError'});assert.equal(f.calls.length,0);
});
test('contexto cambia durante fetch o JSON: no entrega diccionario',async()=>{
 for(const stage of ['fetch','json']){let release,started,jsonCalls=0;const entered=new Promise(resolve=>started=resolve),f=transport();f.options.fetch=(url,init)=>{f.calls.push({url,init});return stage==='fetch'?new Promise(resolve=>{release=resolve;started();}):Promise.resolve({ok:true,status:200,json:()=>{jsonCalls++;return new Promise(resolve=>{release=resolve;started();});}});};
  const task=Model.readOwn(f.options),rejected=assert.rejects(task,{name:'AbortError'});await entered;f.current(false);release(stage==='fetch'?{ok:true,status:200,json:async()=>{jsonCalls++;return body([]);}}:body([]));await rejected;assert.equal(f.calls.length,1);assert.equal(jsonCalls,stage==='fetch'?0:1);}
});
test('contexto se vuelve a comprobar después de que deadline devuelve el resultado',async()=>{
 const f=transport();f.options.deadline=async task=>{const result=await task;f.current(false);return result;};await assert.rejects(Model.readOwn(f.options),{name:'AbortError'});assert.equal(f.calls.length,1);assert.equal(f.calls[0].init.signal.aborted,true);
});
test('abort durante headers y fetch es real y no reintenta',async()=>{
 for(const stage of ['headers','fetch']){let release;const f=transport();if(stage==='headers')f.options.headersServiceAuth=()=>new Promise(resolve=>release=resolve);else f.options.fetch=(url,init)=>{f.calls.push({url,init});return new Promise(resolve=>release=resolve);};
  const task=Model.readOwn(f.options);await flush();f.controller.abort();await assert.rejects(task,{name:'AbortError'});if(stage==='fetch')assert.equal(f.calls[0].init.signal.aborted,true);release(stage==='headers'?{}:reply(body([])));await flush();assert.equal(f.calls.length,stage==='headers'?0:1);}
});
for(const status of [401,403,409,500])test('HTTP'+status+' no se disfraza de vacío y no reintenta',async()=>{
 const f=transport();f.options.fetch=async(url,init)=>{f.calls.push({url,init});return reply({ok:false,mensaje:'detalle privado'},status);};await assert.rejects(Model.readOwn(f.options),error=>error.status===status&&!error.message.includes('privado'));assert.equal(f.calls.length,1);
});
test('deadline20s existente aborta la solicitud y una respuesta tardía no la rehabilita',async()=>{
 let release,timer;const clock={setTimeout(fn,ms){assert.equal(ms,20000);timer=fn;return 1;},clearTimeout(){}};
 const f=transport({deadline:(task,ms)=>Recovery.deadline(task,ms,clock)});f.options.fetch=(url,init)=>{f.calls.push({url,init});return new Promise(resolve=>release=resolve);};
 const task=Model.readOwn(f.options);await flush();timer();await assert.rejects(task,{name:'TimeoutError'});assert.equal(f.calls[0].init.signal.aborted,true);release(reply(body([])));await flush();assert.equal(f.calls.length,1);
});
const malformed=[null,{}, {ok:false,employeeId:'own',records:[]},{ok:true,employeeId:'other',records:[]},body(null),body(Array(1)),
 {...body([]),incomplete:true},body([row('same'),row('same')]),body([row('',{})]),body([row('path/child')]),body([row('foreign',{empFbKey:'other'})]),
 body([{key:'a',value:{estado:'pendiente'}}]),body([{...row(),extra:true}]),body([row('a',{secret:'not in DTO'})]),body([row('a',{horas:{value:1}})]),
 body([row('a',{estado:[]})]),body([row('a',{fecha:5})]),body([row('a',{mes:[]})]),body([row('a',{horas:Infinity})]),body([row('a',{estado:true})])];
for(const [index,value]of malformed.entries())test('DTO inválido'+index+' se rechaza como incompleto, no como0',async()=>{
 const f=transport();f.options.fetch=async()=>reply(value);await assert.rejects(Model.readOwn(f.options),{code:'SV_PERSONAL_HOURS_RESPONSE'});
});
test('JSON malformado y status200 no-JSON son error explícito',async()=>{
 const f=transport();f.options.fetch=async()=>({ok:true,status:200,json:async()=>{throw Error('not JSON');}});await assert.rejects(Model.readOwn(f.options),{code:'SV_PERSONAL_HOURS_RESPONSE'});
});
test('DTO vacío confirmado y campos legacy escalares/null se conservan sin coerción',async()=>{
 for(const records of [[],[{key:'legacy',value:{empFbKey:'own'}},row('scalar',{estado:0,horas:'0.4',fecha:null,mes:null}),row('null',{estado:null,horas:null})]]){
  const f=transport();f.options.fetch=async()=>reply(body(records));const dict=await Model.readOwn(f.options);assert.deepEqual(Object.keys(dict),records.map(record=>record.key));for(const record of records)assert.equal(JSON.stringify(dict[record.key]),JSON.stringify(record.value));}
});
test('claves __proto__/constructor usan nullproto y mantienen el orden integer de SDK Object.keys',async()=>{
 const records=[row('2',{horas:0.1}),row('10',{horas:0.2}),row('__proto__',{horas:0.4}),row('constructor',{horas:0})],f=transport();f.options.fetch=async()=>reply(body(records));
 const dict=await Model.readOwn(f.options);assert.equal(Object.getPrototypeOf(dict),null);assert.equal(Object.hasOwn(dict,'__proto__'),true);assert.equal(Object.hasOwn(dict,'constructor'),true);assert.deepEqual(Object.keys(dict),records.map(record=>record.key));assert.equal(Model.project(dict,input).pendingHours,0.7000000000000001);assert.equal(Object.prototype.empFbKey,undefined);
});
test('orden integer incompatible se rechaza en lugar de cambiar la suma silenciosamente',async()=>{
 const f=transport();f.options.fetch=async()=>reply(body([row('10'),row('2')]));await assert.rejects(Model.readOwn(f.options),{code:'SV_PERSONAL_HOURS_ORDER'});
});
test('cargar recibe scope y señal, con loading antes de vacío confirmado',async()=>{
 const f=fixture(),promise=f.api.load();assert.equal(f.api.state().status,'loading');await flush();assert.equal(f.reads.length,1);assert.equal(f.reads[0].scope.employeeId,'own');assert.ok(f.reads[0].signal instanceof AbortSignal);
 f.pending[0].resolve(Object.create(null));await promise;assert.equal(f.api.state().status,'ready');assert.equal(f.api.state().text,'Sin solicitudes');
});
test('montar/repintar, Gastos y volver visible no agregan lecturas',()=>{
 const f=fixture();for(let i=0;i<5;i++)f.api.renderCached();f.visible(false);f.api.pause();f.visible(true);f.api.renderCached();assert.equal(f.reads.length,0);
});
test('singleflight comparte un GET y no reconsulta al pintar memoria',async()=>{
 const f=fixture(),first=f.api.load(),second=f.api.load();assert.equal(first,second);await flush();assert.equal(f.reads.length,1);f.pending[0].resolve(data());await first;
 for(let i=0;i<5;i++)f.api.renderCached();assert.equal(f.reads.length,1);assert.equal(f.api.state().status,'ready');
});
test('hidden antes de iniciar o entre microtasks no consulta',async()=>{
 const f=fixture();f.visible(false);await f.api.load();assert.equal(f.reads.length,0);f.visible(true);const task=f.api.load();f.visible(false);await task;assert.equal(f.reads.length,0);assert.equal(f.api.state().status,'none');
});
test('pause aborta pendiente y volver visible no hace GET; ready conserva memoria',async()=>{
 const f=fixture(),first=f.api.load();await flush();f.visible(false);f.api.pause();assert.equal(f.pending[0].signal.aborted,true);f.pending[0].resolve(data());await first;f.visible(true);f.api.renderCached();assert.equal(f.api.state().status,'none');assert.equal(f.reads.length,1);
 const next=f.api.load();await flush();f.pending[1].resolve(data());await next;f.visible(false);f.api.pause();f.visible(true);f.api.renderCached();assert.equal(f.api.state().status,'ready');assert.equal(f.reads.length,2);
});
for(const change of ['uid','auth','role','revision','epoch','view','viewProfile','employeeId','monthCurrent'])test('stop aborta y descarta respuesta tardía tras cambiar '+change,async()=>{
 const f=fixture(),promise=f.api.load();await flush();const patch={uid:{uid:'other'},auth:{auth:{uid:'u'}},role:{role:'vendedor'},revision:{revision:2},epoch:{epoch:1},view:{view:{}},viewProfile:{viewProfile:'otherProfile'},employeeId:{employeeId:'other'},monthCurrent:{monthCurrent:'2026-11',monthPrev:'2026-10'}}[change];
 f.change(patch);f.api.stop();assert.equal(f.pending[0].signal.aborted,true);f.pending[0].resolve(new Proxy({}, {ownKeys(){assert.fail('No interpretar dato viejo');}}));await promise;assert.equal(f.api.state().status,'none');assert.equal(f.reads.length,1);
});
test('supersede aborta el intento anterior y sólo muestra el segundo empleado',async()=>{
 const f=fixture(),first=f.api.load();await flush();f.change({employeeId:'other'});const second=f.api.load();assert.equal(f.pending[0].signal.aborted,true);await flush();f.pending[1].resolve({fresh:{empFbKey:'other',estado:'pendiente',horas:2}});await second;
 f.pending[0].resolve(data());await first;assert.equal(f.api.state().employeeId,'other');assert.equal(f.api.state().pendingHours,2);assert.equal(f.reads.length,2);
});
test('logout/login del mismo UID y revocación no rehabilitan pendientes',async()=>{
 const f=fixture(),old=f.api.load();await flush();f.allowed(false);f.api.stop();f.allowed(true);f.change({epoch:1});const fresh=f.api.load();await flush();f.pending[1].resolve({});await fresh;f.pending[0].resolve(data());await old;assert.equal(f.api.state().records.length,0);assert.equal(f.pending[0].signal.aborted,true);
});
test('error conserva estado desconocido y no reintenta al volver visible',async()=>{
 const f=fixture(),task=f.api.load();await flush();f.pending[0].reject(Object.assign(Error('Forbidden'),{status:403}));await task;assert.equal(f.api.state().status,'error');assert.equal(f.api.state().pendingCount,undefined);
 f.visible(false);f.api.pause();f.visible(true);f.api.renderCached();assert.equal(f.api.state().status,'error');assert.equal(f.reads.length,1);
});
test('paint distingue error/loading/none de vacío y siempre usa texto',()=>{
 const attrs={},element={style:{},textContent:'',setAttribute:(key,value)=>attrs[key]=value};Object.defineProperty(element,'innerHTML',{set(){assert.fail('No HTML');}});
 for(const status of ['none','loading','error']){Model.paint(element,{status});assert.doesNotMatch(element.textContent,/Sin solicitudes|\b0\b/);assert.equal(attrs['aria-busy'],String(status==='loading'));}
 Model.paint(element,Model.project({},input));assert.equal(element.textContent,'Sin solicitudes');assert.equal(attrs['aria-busy'],'false');
});
