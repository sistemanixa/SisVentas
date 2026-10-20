'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const M=require('../js/core/private-finance-model'),{seed,run}=require('./helpers/private-finance-fixtures.cjs');
const source=fs.readFileSync('js/modules/private-finance-ui.js','utf8');
function section(start,end){const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert.ok(from>=0&&to>from,'Se conserva el bloque real: '+start);return source.slice(from,to);}
const helper=section('const buttonActivities=', 'const paths=');
const handlers=section("document.addEventListener('submit',", "document.addEventListener('input',");
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
function button({disabled=false,busy=null,action,id,page}={}){
 const attributes=new Map(busy===null?[]:[['aria-busy',busy]]),changes=[];
 return {disabled,textContent:'Acción original',dataset:{...(action?{action}:{}),...(id?{id}:{}),...(page?{page}:{})},changes,
  getAttribute:key=>attributes.get(key)??null,
  setAttribute(key,value){attributes.set(key,String(value));changes.push([key,String(value)]);},
  removeAttribute(key){attributes.delete(key);changes.push([key,null]);},
  closest(selector){return selector==='[data-action]'&&this.dataset.action?this:null;}};
}
function helperFixture(){const context=vm.createContext({});vm.runInContext(helper,context);return context;}
function event(target,submitter){return {target,submitter,prevented:0,preventDefault(){this.prevented++;}};}
function fixture(){
 const requests=[],errors=[],notices=[],listeners=new Map(),effects={closed:0,rendered:0,scrolls:0,views:0},pending=[];
 const context={M,state:seed(),page:'overview',dead:false,saving:false,aiController:null,pendingCommand:null,baseUpdated:false,pdfRequestGeneration:0,
  dialogContext:{entity:'payment-fixture',payment:'payment-fixture'},crypto:webcrypto,structuredClone,amount:M.amount,
  FormData:class {constructor(form){this.values=form.values;}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}},
  document:{addEventListener:(name,callback)=>listeners.set(name,callback),getElementById:()=>({classList:{remove(){}}}),querySelector:()=>({value:'Motivo ficticio'})},
  bridge:{request(path,command,raw){const wait=deferred();requests.push({path,command:command&&structuredClone(command),raw});pending.push(wait);return wait.promise;}},
  closeModal(){effects.closed++;},render(){effects.rendered++;},toast:message=>notices.push(message),showError:error=>errors.push(error),
  viewPDF:async()=>{effects.views++;},window:{scrollTo(){effects.scrolls++;}}};
 vm.createContext(context);vm.runInContext(helper+
  section('function go(', 'async function refresh(')+
  section('async function original(', 'async function viewPDF(')+
  section('async function mutate(', 'function overviewPage(')+
  section('async function submit(f){', 'function showError(')+handlers,context);
 function form(buttons=[button()]){return {id:'modalForm',dataset:{kind:'payment'},values:{statement:'statement-a',type:'Parcial',date:'2026-10-03',currency:'ARS',amount:'10.00',declared:'no',note:'Ficticio'},querySelectorAll:()=>buttons,querySelector:()=>buttons[0],buttons};}
 return {context,requests,pending,errors,notices,effects,form,submit:e=>listeners.get('submit')(e),click:b=>listeners.get('click')(event(b)),
  confirm(index=0){const request=requests[index];const state=run(context.state,request.command.type,request.command.data,request.command.id);pending[index].resolve({state});}};
}

test('actividad permanece hasta terminar y conserva texto, disabled y aria-busy originales',async()=>{
 for(const originalBusy of [null,'false']){
  const c=helperFixture(),b=button({busy:originalBusy}),wait=deferred();let calls=0;
  const task=c.buttonActivity(b,()=>{calls++;return wait.promise;});
  assert.equal(b.disabled,true);assert.equal(b.getAttribute('aria-busy'),'true');assert.equal(b.textContent,'Acción original');
  await c.buttonActivity(b,()=>{calls++;});assert.equal(calls,1);
  wait.resolve('confirmado');assert.equal(await task,'confirmado');
  assert.equal(b.disabled,false);assert.equal(b.getAttribute('aria-busy'),originalBusy);assert.equal(b.textContent,'Acción original');
 }
});

test('error síncrono o asíncrono retira actividad y permite una nueva acción',async()=>{
 for(const asynchronous of [false,true]){
  const c=helperFixture(),b=button({busy:'false'}),wait=deferred(),failure=Error('Fallo ficticio');
  const task=c.buttonActivity(b,()=>{if(!asynchronous)throw failure;return wait.promise;});
  if(asynchronous)wait.reject(failure);await assert.rejects(task,error=>error===failure);
  assert.equal(b.disabled,false);assert.equal(b.getAttribute('aria-busy'),'false');
  assert.equal(await c.buttonActivity(b,()=>17),17);assert.equal(b.getAttribute('aria-busy'),'false');
 }
});

test('botón deshabilitado o ya ocupado no ejecuta ni altera la actividad ajena',async()=>{
 for(const options of [{disabled:true,busy:'false'},{disabled:false,busy:'true'}]){
  const c=helperFixture(),b=button(options);let called=0;
  await c.buttonActivity(b,()=>called++);
  assert.equal(called,0);assert.equal(b.disabled,options.disabled);assert.equal(b.getAttribute('aria-busy'),options.busy);assert.deepEqual(b.changes,[]);
 }
});

test('managedDisabled retira sólo actividad y respeta el estado que dejaron los controles',async()=>{
 const c=helperFixture(),b=button({busy:'false'}),wait=deferred();
 const task=c.buttonActivity(b,()=>wait.promise,{managedDisabled:true});
 assert.equal(b.disabled,false);assert.equal(b.getAttribute('aria-busy'),'true');
 b.disabled=true;wait.resolve();await task;
 assert.equal(b.disabled,true);assert.equal(b.getAttribute('aria-busy'),'false');
});

for(const enter of [false,true])test('submit real '+(enter?'por Enter sin submitter':'desde botón')+' bloquea envíos repetidos hasta confirmar un único pago',async()=>{
 const f=fixture(),submitter=button(),other=button({disabled:true,busy:'false'}),form=f.form([submitter,other]),first=event(form,enter?undefined:submitter);
 const task=f.submit(first);
 assert.equal(first.prevented,1);assert.equal(f.requests.length,1);assert.equal(f.context.saving,true);
 assert.equal(submitter.disabled,true);assert.equal(submitter.getAttribute('aria-busy'),'true');assert.equal(other.disabled,true);
 await f.submit(event(form,submitter));await f.submit(event(form));assert.equal(f.requests.length,1);assert.equal(f.effects.closed,0);
 assert.equal(f.requests[0].command.type,'payment-save');assert.equal(f.requests[0].command.data.amount,1000);
 f.confirm();await task;
 assert.equal(f.context.state.payments.length,1);assert.equal(f.effects.closed,1);assert.equal(f.errors.length,0);
 assert.equal(f.context.saving,false);assert.equal(submitter.disabled,false);assert.equal(submitter.getAttribute('aria-busy'),null);
 assert.equal(other.disabled,true);assert.equal(other.getAttribute('aria-busy'),'false');
});

test('error de guardado real libera controles, conserva formulario e intenta el mismo comando',async()=>{
 const f=fixture(),b=button({busy:'false'}),form=f.form([b]),originalValues=structuredClone(form.values);
 const first=f.submit(event(form,b)),command=structuredClone(f.requests[0].command);
 f.pending[0].reject(Error('Conexión ficticia interrumpida'));await first;
 assert.equal(f.errors.length,1);assert.equal(f.effects.closed,0);assert.deepEqual(form.values,originalValues);
 assert.equal(b.disabled,false);assert.equal(b.getAttribute('aria-busy'),'false');assert.equal(f.context.saving,false);
 const retry=f.submit(event(form));assert.equal(f.requests.length,2);assert.deepEqual(f.requests[1].command,command);
 f.confirm(1);await retry;assert.equal(f.context.state.payments.length,1);assert.equal(f.context.pendingCommand,null);assert.equal(b.getAttribute('aria-busy'),'false');
});

test('validación fallida del submit no deja actividad ni envía una operación',async()=>{
 const f=fixture(),b=button(),form=f.form([b]);form.values.amount='importe inválido';
 await f.submit(event(form,b));
 assert.equal(f.requests.length,0);assert.equal(f.errors.length,1);assert.equal(f.context.saving,false);
 assert.equal(b.disabled,false);assert.equal(b.getAttribute('aria-busy'),null);assert.equal(f.effects.closed,0);
});

for(const fail of [false,true])test('clic real en PDF '+(fail?'fallido':'confirmado')+' muestra actividad y evita descargas repetidas',async()=>{
 const f=fixture(),b=button({action:'original',id:'pdf-fixture',busy:'false'}),task=f.click(b);
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/documentos/pdf-fixture');assert.equal(f.requests[0].raw,true);
 assert.equal(b.disabled,true);assert.equal(b.getAttribute('aria-busy'),'true');await f.click(b);assert.equal(f.requests.length,1);
 if(fail)f.pending[0].reject(Error('Documento ficticio no disponible'));
 else f.pending[0].resolve({arrayBuffer:async()=>new Uint8Array([37,80,68,70]).buffer});
 await task;
 assert.equal(b.disabled,false);assert.equal(b.getAttribute('aria-busy'),'false');assert.equal(b.textContent,'Acción original');
 assert.equal(f.effects.views,fail?0:1);assert.equal(f.errors.length,fail?1:0);
});

test('confirmar anulación real usa una operación y libera actividad si el servicio rechaza',async()=>{
 const f=fixture(),b=button({action:'confirmvoid'}),task=f.click(b);
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].command.type,'payment-void');assert.equal(f.context.saving,true);
 assert.equal(b.disabled,true);assert.equal(b.getAttribute('aria-busy'),'true');await f.click(b);assert.equal(f.requests.length,1);
 f.pending[0].reject(Object.assign(Error('Rechazo ficticio'),{status:400}));await task;
 assert.equal(f.context.saving,false);assert.equal(b.disabled,false);assert.equal(b.getAttribute('aria-busy'),null);
 assert.equal(f.effects.closed,0);assert.equal(f.errors.length,1);
});

test('navegación local real cambia de página sin marcar actividad ni pedir datos',async()=>{
 const f=fixture(),b=button({action:'go',page:'insurance'});await f.click(b);
 assert.equal(f.context.page,'insurance');assert.equal(f.effects.rendered,1);assert.equal(f.effects.scrolls,1);assert.equal(f.requests.length,0);
 assert.equal(b.disabled,false);assert.equal(b.getAttribute('aria-busy'),null);assert.deepEqual(b.changes,[]);
});
