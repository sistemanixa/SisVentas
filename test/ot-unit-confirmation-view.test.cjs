'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const controller=require('../js/modules/ot-unit-confirmation');
const model=require('../js/core/ot-unit-confirmation.v1');
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const tick=async()=>{for(let index=0;index<14;index++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

// DOM deliberadamente pequeño: se usan nodos, propiedades y eventos reales del
// contrato del controlador; no se lee ni analiza HTML generado para seleccionar.
function dom(){
  const handlers=new Map();
  const document={activeElement:null,addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},removeEventListener(name,fn){handlers.get(name)?.delete(fn);},emit(name){for(const fn of [...handlers.get(name)||[]])fn({type:name});},listenerCount(){return [...handlers.values()].reduce((sum,set)=>sum+set.size,0);}};
  class Node{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.className='';this.attributes={};this.handlers=new Map();this.value='';this.disabled=false;this.hidden=false;this._text='';}
    get isConnected(){let node=this;while(node){if(node===document.body)return true;node=node.parentNode;}return false;}
    get firstChild(){return this.children[0]||null;}
    get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    set textContent(value){this._text=String(value);for(const child of this.children)child.parentNode=null;this.children=[];}
    get classList(){const node=this;return {contains:name=>node.className.split(/\s+/).includes(name),add(...names){node.className=[...new Set(node.className.split(/\s+/).filter(Boolean).concat(names))].join(' ');},toggle(name,enabled){const values=new Set(node.className.split(/\s+/).filter(Boolean));const on=enabled===undefined?!values.has(name):enabled;if(on)values.add(name);else values.delete(name);node.className=[...values].join(' ');return on;}};}
    append(...nodes){for(const node of nodes){if(!(node instanceof Node))throw Error('La prueba exige nodos, no innerHTML');node.remove();node.parentNode=this;this.children.push(node);}}
    replaceChildren(...nodes){for(const node of [...this.children])node.remove();this._text='';this.append(...nodes);}
    remove(){if(this.parentNode){const siblings=this.parentNode.children,index=siblings.indexOf(this);if(index>=0)siblings.splice(index,1);this.parentNode=null;}}
    setAttribute(name,value){this.attributes[name]=String(value);}
    getAttribute(name){return this.attributes[name]??null;}
    addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,new Set());this.handlers.get(name).add(fn);}
    emit(name){const event={type:name,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};for(const fn of [...this.handlers.get(name)||[]])fn(event);return event;}
    click(){if(!this.disabled)this.emit('click');}
    focus(){document.activeElement=this;}
    showModal(){this.open=true;}
    close(){this.open=false;}
  }
  document.createElement=tag=>new Node(tag);document.body=new Node('body');
  const trigger=new Node('button');trigger.textContent='Finalizar OT';document.body.append(trigger);trigger.focus();
  return {document,trigger};
}
function all(node,predicate){const result=[];for(const child of node.children){if(predicate(child))result.push(child);result.push(...all(child,predicate));}return result;}
const withTag=(document,tag)=>all(document.body,node=>node.tagName===tag.toUpperCase());
const withClass=(document,name)=>all(document.body,node=>node.classList.contains(name));
const buttons=document=>withTag(document,'button');
const saveButton=document=>buttons(document).find(node=>/Confirmar y continuar|Guardar confirmación|Guardando confirmación/.test(node.textContent));
const status=document=>withClass(document,'ot-unit-status')[0];
const inputs=document=>withTag(document,'input');
const selects=document=>withTag(document,'select');
const decisionSelects=document=>selects(document).filter(node=>node.parentNode.classList.contains('ot-unit-decision'));
const config=change=>({estado:'si',meses:12,inicio:'instalacion',serie:true,equipo:false,...change});
const sale=items=>({fbKey:'venta-demo',id:'V-DEMO',items:items||{renglon:{desc:'Equipo ficticio',qty:1,unidad:'Unidad',garantiaLinea:'linea-demo',garantiaConfig:config()}}});
const prepared=change=>({sale:sale(),revision:'revision-demo',existing:{},capabilities:{equipos:true,garantias:true,reviewOT:true},...change});
const ot={fbKey:'ot-demo',id:'OT-DEMO',ventaFbKey:'venta-demo'};

function fixture(options={}){
  const {document,trigger}=dom(),calls=[],pendingPrepare=deferred(),pendingConfirm=deferred();let valid=options.valid!==false;
  const request=(action,body,signal)=>{calls.push({action,body:clone(body),signal});return action==='preparar'?pendingPrepare.promise:pendingConfirm.promise;};
  const api=controller.create({document,model,today:()=> '2026-10-23',context:()=>()=>valid,request,scan:options.scan,closeScanner:options.closeScanner});
  return {document,trigger,calls,api,pendingPrepare,pendingConfirm,invalidate(){valid=false;},open:row=>api.open(row||ot,{closing:true}),async ready(data){this.pendingPrepare.resolve(data||prepared());await tick();}};
}
function fill(document,index,decision='instalado',serie='SERIE-DEMO',location='Acceso ficticio'){
  const select=decisionSelects(document)[index];assert.ok(select,'Existe la unidad requerida');select.value=decision;select.emit('change');
  const card=select.parentNode.parentNode,text=all(card,node=>node.tagName==='INPUT'&&node.type==='text');
  text[0].value=serie;text[1].value=location;return {select,serie:text[0],location:text[1],card};
}

for (const reverse of [false,true]) test('Tab conserva el foco dentro del diálogo en el borde '+(reverse?'inicial':'final'),async()=>{
  const f=fixture(),task=f.open();await f.ready();
  const dialog=withTag(f.document,'dialog')[0],dateInput=inputs(f.document)[0],save=saveButton(f.document);
  (reverse?dateInput:save).focus();
  const event={key:'Tab',shiftKey:reverse,prevented:false,preventDefault(){this.prevented=true;}};
  for(const listener of dialog.handlers.get('keydown')||[])listener(event);
  assert.equal(event.prevented,true);assert.equal(f.document.activeElement,reverse?save:dateInput);
  f.api.cancel();assert.equal(await task,false);assert.equal(f.document.activeElement,f.trigger);
});

test('crear el controlador no consulta ni abre el diálogo hasta una acción explícita',()=>{
  const f=fixture();assert.equal(f.calls.length,0);assert.equal(withTag(f.document,'dialog').length,0);assert.equal(f.document.listenerCount(),0);
});

test('abrir prepara una sola vez, muestra resultados sin elección automática y conserva foco',async()=>{
  const f=fixture(),task=f.open();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].body,{otKey:'ot-demo'});
  assert.equal(f.calls[0].action,'preparar');assert.equal(withTag(f.document,'dialog')[0].open,true);
  await f.ready();assert.equal(selects(f.document).length,1);assert.equal(selects(f.document)[0].value,'');
  assert.equal(f.document.activeElement,selects(f.document)[0]);assert.equal(f.calls.length,1);
  f.api.cancel();assert.equal(await task,false);assert.equal(f.document.activeElement,f.trigger);assert.equal(f.document.listenerCount(),0);
});

test('abrir dos veces la misma OT reutiliza la promesa y su preparación',async()=>{
  const f=fixture(),one=f.open(),two=f.open();assert.equal(one,two);assert.equal(f.calls.length,1);f.api.cancel();assert.equal(await one,false);
});

test('no elegir un resultado impide confirmar y explica qué falta sin escrituras',async()=>{
  const f=fixture(),task=f.open();await f.ready();saveButton(f.document).click();await tick();
  assert.equal(f.calls.length,1);assert.match(status(f.document).textContent,/Elegí/);assert.equal(status(f.document).getAttribute('role'),'alert');f.api.cancel();await task;
});

for(const [name,serial,location,message] of [['serie','', 'Acceso ficticio',/serie obligatoria/],['ubicación','SERIE-DEMO','',/ubicación instalada/]])test('instalar valida '+name+' antes de enviar la confirmación',async()=>{
  const f=fixture(),task=f.open();await f.ready();fill(f.document,0,'instalado',serial,location);saveButton(f.document).click();await tick();
  assert.equal(f.calls.length,1);assert.match(status(f.document).textContent,message);f.api.cancel();await task;
});

test('instalación envía decisión, serie y ubicación por unidad sin modificar condiciones',async()=>{
  const f=fixture(),data=prepared(),before=clone(data),task=f.open();await f.ready(data);fill(f.document,0,'instalado',' SERIE-DEMO ',' Acceso ficticio ');
  saveButton(f.document).click();await tick();assert.equal(f.calls.length,2);
  assert.deepEqual(f.calls[1].body,{otKey:'ot-demo',revision:'revision-demo',fecha:'2026-10-23',units:[{itemKey:'renglon',n:0,decision:'instalado',serie:'SERIE-DEMO',ubicacion:'Acceso ficticio'}]});
  assert.equal(f.calls[1].action,'confirmar');assert.deepEqual(data,before);
  const result={registered:1,preserved:0,reviewed:0,estadoInst:'instalado'};f.pendingConfirm.resolve(result);await tick();assert.deepEqual(await task,result);assert.equal(withTag(f.document,'dialog').length,0);
});

test('entregado sin instalar no exige ubicación y avisa que la cobertura espera instalación',async()=>{
  const f=fixture(),task=f.open();await f.ready();fill(f.document,0,'entregado','SERIE-DEMO','');
  assert.match(f.document.body.textContent,/cobertura espera la confirmación de la instalación/);
  saveButton(f.document).click();await tick();assert.equal(f.calls[1].body.units[0].decision,'entregado');assert.equal(f.calls[1].body.units[0].ubicacion,'');
  f.pendingConfirm.resolve({registered:0,reviewed:1});await task;
});

test('pendiente oculta serie y ubicación y conserva la decisión sin inventar instalación',async()=>{
  const f=fixture(),task=f.open();await f.ready();const row=fill(f.document,0,'pendiente','','');
  assert.equal(row.serie.disabled,true);assert.equal(row.location.disabled,true);assert.match(row.card.textContent,/No se crea un equipo ni comienza la cobertura/);
  saveButton(f.document).click();await tick();assert.deepEqual(f.calls[1].body.units,[{itemKey:'renglon',n:0,decision:'pendiente',serie:'',ubicacion:''}]);
  f.pendingConfirm.resolve({registered:0,reviewed:1});assert.equal(Object.hasOwn(await task,'warrantyReviewPendingCount'),false);
});

for(const value of ['2026-02-30','2026-10-24'])test('fecha estricta '+value+' se rechaza incluso para una revisión pendiente',async()=>{
  const f=fixture(),task=f.open();await f.ready();fill(f.document,0,'pendiente','','');inputs(f.document).find(node=>node.type==='date').value=value;
  saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);assert.match(status(f.document).textContent,/fecha efectiva válida/);f.api.cancel();await task;
});

test('una unidad existente muestra sus originales sin selector ni campos editables',async()=>{
  const record={serie:'SERIE-ORIGINAL',dir:'Ubicación anterior',fechaVenc:'2027-01-31'},before=clone(record);
  // Se utiliza exactamente la identidad del modelo, no una coincidencia por nombre.
  const next=fixture(),key=model.build(sale()).units[0].key,nextTask=next.open();await next.ready(prepared({existing:{[key]:{path:'equipos',record}}}));
  assert.equal(selects(next.document).length,0);assert.equal(inputs(next.document).filter(node=>node.type==='text').length,0);
  assert.match(next.document.body.textContent,/SERIE-ORIGINAL/);assert.match(next.document.body.textContent,/2027-01-31/);
  saveButton(next.document).click();await tick();assert.deepEqual(next.calls[1].body.units,[]);assert.deepEqual(record,before);
  next.pendingConfirm.resolve({registered:0,preserved:1});await nextTask;
});

test('el legado incompleto permite revisión técnica sin inventar términos o identidad',async()=>{
  const f=fixture(),data=prepared({sale:sale({legacy:{desc:'Equipo legado',qty:1,unidad:'Unidad'}})}),before=clone(data),task=f.open();await f.ready(data);
  let settled=false;task.then(()=>{settled=true;});
  assert.match(f.document.body.textContent,/histórica pendientes de revisión/);fill(f.document,0,'instalado','','Acceso ficticio');saveButton(f.document).click();await tick();
  assert.deepEqual(f.calls[1].body.units,[{itemKey:'legacy',n:0,decision:'instalado',serie:'',ubicacion:'Acceso ficticio'}]);assert.deepEqual(data,before);
  assert.equal(settled,false);assert.equal(Object.hasOwn(f.calls[1].body,'warrantyReviewPendingCount'),false);
  const ack=Object.freeze({registered:0,reviewed:1});f.pendingConfirm.resolve(ack);
  assert.deepEqual(await task,{registered:0,reviewed:1,warrantyReviewPendingCount:1});assert.equal(Object.hasOwn(ack,'warrantyReviewPendingCount'),false);assert.deepEqual(data,before);
});

test('un material por metro es una revisión resumida n:null, no cien equipos',async()=>{
  const f=fixture(),data=prepared({sale:sale({cable:{desc:'Cable ficticio',qty:100,unidad:'metro',garantiaConfig:config({serie:false})}})}),task=f.open();await f.ready(data);
  assert.equal(selects(f.document).length,1);assert.match(f.document.body.textContent,/100 metro/);fill(f.document,0,'instalado','','Canalización ficticia');saveButton(f.document).click();await tick();
  assert.deepEqual(f.calls[1].body.units,[{itemKey:'cable',n:null,decision:'instalado',serie:'',ubicacion:'Canalización ficticia'}]);f.pendingConfirm.resolve({registered:0,reviewed:1});assert.equal(Object.hasOwn(await task,'warrantyReviewPendingCount'),false);
});

test('el contador local cuenta unidades históricas y excluye pendientes normales y materiales',async()=>{
  const f=fixture(),data=prepared({sale:sale({legacy:{desc:'Equipo legado',qty:2,unidad:'Unidad'},normal:{desc:'Equipo normal',qty:1,unidad:'Unidad',garantiaLinea:'linea-normal',garantiaConfig:config()},cable:{desc:'Cable',qty:20,unidad:'metro'}})}),before=clone(data),task=f.open();await f.ready(data);
  fill(f.document,0,'instalado','','Acceso uno');fill(f.document,1,'instalado','','Acceso dos');fill(f.document,2,'pendiente','','');fill(f.document,3,'instalado','','Canalización');saveButton(f.document).click();await tick();
  const ack=Object.freeze({registered:[],preserved:[],reviewed:['revision-uno','revision-dos','unidad-pendiente','material'],estadoInst:'en_instalacion'});f.pendingConfirm.resolve(ack);
  assert.deepEqual(await task,{...ack,warrantyReviewPendingCount:2});assert.deepEqual(data,before);assert.equal(Object.hasOwn(ack,'warrantyReviewPendingCount'),false);assert.equal(Object.hasOwn(f.calls[1].body,'warrantyReviewPendingCount'),false);
  assert.deepEqual(Object.keys(f.calls[1].body).sort(),['fecha','otKey','revision','units']);assert.ok(f.calls[1].body.units.every(row=>Object.keys(row).sort().join(',')==='decision,itemKey,n,serie,ubicacion'));
});

test('legado con acuse fallido no resuelve éxito ni devuelve un contador anticipado',async()=>{
  const f=fixture(),task=f.open();await f.ready(prepared({sale:sale({legacy:{desc:'Equipo legado',qty:1,unidad:'Unidad'}})}));let settled=false;task.then(()=>{settled=true;});
  fill(f.document,0,'instalado','','Acceso ficticio');saveButton(f.document).click();await tick();f.pendingConfirm.reject(Error('Acuse ficticio perdido'));await tick();
  assert.equal(settled,false);assert.equal(withTag(f.document,'dialog').length,1);assert.match(status(f.document).textContent,/Acuse ficticio perdido.*OT todavía no se cerró/);assert.equal(saveButton(f.document).disabled,false);assert.equal(Object.hasOwn(f.calls[1].body,'warrantyReviewPendingCount'),false);
  f.api.cancel();assert.equal(await task,false);
});

test('legado con acuse tardío tras cambio de contexto no devuelve el contador',async()=>{
  const f=fixture(),task=f.open();await f.ready(prepared({sale:sale({legacy:{desc:'Equipo legado',qty:1,unidad:'Unidad'}})}));fill(f.document,0,'instalado','','Acceso ficticio');saveButton(f.document).click();await tick();
  f.invalidate();f.pendingConfirm.resolve({registered:[],reviewed:['revision-ficticia']});assert.equal(await task,false);assert.equal(withTag(f.document,'dialog').length,0);
});

test('cantidad parcial mantiene por separado la unidad instalada y la pendiente',async()=>{
  const f=fixture(),data=prepared(),task=f.open();data.sale.items.renglon.qty=2;await f.ready(data);
  fill(f.document,0,'instalado','SERIE-UNO','Acceso ficticio');fill(f.document,1,'pendiente','','');saveButton(f.document).click();await tick();
  assert.deepEqual(f.calls[1].body.units.map(row=>[row.n,row.decision]),[[0,'instalado'],[1,'pendiente']]);f.pendingConfirm.resolve({registered:1,reviewed:1,estadoInst:'en_instalacion'});await task;
});

test('doble clic no repite la confirmación y cancelar no convierte un guardado pendiente en éxito',async()=>{
  const f=fixture(),task=f.open();await f.ready();fill(f.document,0);const save=saveButton(f.document);save.click();save.click();f.api.cancel();await tick();
  assert.equal(f.calls.length,2);assert.equal(save.disabled,true);assert.equal(withTag(f.document,'dialog').length,1);
  f.pendingConfirm.resolve({registered:1});assert.deepEqual(await task,{registered:1});
});

test('un error de confirmación conserva decisiones y permite reintentar explícitamente',async()=>{
  const f=fixture(),task=f.open();await f.ready();fill(f.document,0);saveButton(f.document).click();await tick();
  f.pendingConfirm.reject(new Error('Acuse ficticio perdido'));await tick();assert.match(status(f.document).textContent,/OT todavía no se cerró/);
  assert.equal(selects(f.document)[0].value,'instalado');assert.equal(saveButton(f.document).disabled,false);assert.equal(f.calls.length,2);
  saveButton(f.document).click();await tick();assert.equal(f.calls.length,3);assert.deepEqual(f.calls[2].body,f.calls[1].body,'El reintento conserva exactamente la intención anterior');
  f.api.cancel();assert.equal(await task,false);
});

test('cancelar mientras prepara aborta y descarta la respuesta tardía sin reconstruir la vista',async()=>{
  const f=fixture(),task=f.open(),signal=f.calls[0].signal;f.api.cancel();assert.equal(await task,false);assert.equal(signal.aborted,true);
  await f.ready();assert.equal(withTag(f.document,'dialog').length,0);assert.equal(selects(f.document).length,0);assert.equal(f.calls.length,1);assert.equal(f.document.listenerCount(),0);
});

for(const event of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed'])test(event+' retira revisión, aborta y no acepta el acuse tardío',async()=>{
  const f=fixture(),task=f.open();await f.ready();fill(f.document,0);saveButton(f.document).click();await tick();f.document.emit(event);
  assert.equal(await task,false);assert.equal(f.calls[1].signal.aborted,true);f.pendingConfirm.resolve({registered:1});await tick();
  assert.equal(withTag(f.document,'dialog').length,0);assert.equal(f.document.listenerCount(),0);
});

test('cambiar el contexto sin evento antes de confirmar evita una solicitud obsoleta',async()=>{
  const f=fixture(),task=f.open();await f.ready();fill(f.document,0);f.invalidate();saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);f.api.cancel();assert.equal(await task,false);
});

test('un contexto inválido al abrir no solicita datos ni mantiene un diálogo activo',async()=>{
  const f=fixture({valid:false});assert.equal(await f.open(),false);assert.equal(f.calls.length,0);assert.equal(withTag(f.document,'dialog').length,0);
});

test('abrir otra OT retira la anterior y no mezcla respuestas o series de dos preparaciones',async()=>{
  const {document}=dom(),calls=[],requests=[],api=controller.create({document,model,today:()=> '2026-10-23',context:()=>()=>true,request:(action,body,signal)=>{const pending=deferred();calls.push({action,body,signal});requests.push(pending);return pending.promise;}});
  const one=api.open(ot,{closing:true}),two=api.open({...ot,fbKey:'ot-segunda'},{closing:true});assert.equal(await one,false);assert.equal(calls[0].signal.aborted,true);
  requests[0].resolve(prepared({sale:sale({old:{desc:'No mostrar',qty:1}})}));await tick();assert.doesNotMatch(document.body.textContent,/No mostrar/);
  requests[1].resolve(prepared());await tick();fill(document,0);saveButton(document).click();await tick();assert.equal(calls[2].body.otKey,'ot-segunda');requests[2].resolve({registered:1});await two;
});

test('una preparación fallida no confirma nada y sólo reintenta por acción expresa',async()=>{
  const f=fixture(),task=f.open();f.pendingPrepare.reject(new Error('Preparación ficticia rechazada'));await tick();
  assert.equal(f.calls.length,1);assert.equal(saveButton(f.document).disabled,true);assert.match(status(f.document).textContent,/Preparación ficticia rechazada/);
  assert.ok(buttons(f.document).some(node=>node.textContent==='Volver a cargar'));f.api.cancel();await task;
});

function wrapperFixture(){
  const {document}=dom(),headers=deferred(),fetches=[];const user={uid:'uid-demo'};
  const c={document,AbortController,AbortSignal,URL,Promise,SVOTUnitConfirmation:model,fbAuth:{currentUser:user},currentUserUid:user.uid,currentRole:'tecnico',otActualId:ot.fbKey,
    location:{hash:'#/ordentrabajo'},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://example.invalid/cotizador'},svFechaLocalISO:()=> '2026-10-23',
    svCapturarContextoOperacion:()=>{const role=c.currentRole;return ()=>c.currentRole===role;},tienePermiso:()=>true,
    SVServiceAuth:{headers:()=>headers.promise},fetch:async(...args)=>{fetches.push(args);return {ok:true,json:async()=>prepared()};},notify(){}};
  c.window=c;vm.runInNewContext(fs.readFileSync('js/modules/ot-unit-confirmation.js','utf8'),c);
  return {c,document,headers,fetches};
}

test('retirar la sesión durante la obtención de Auth evita el fetch posterior y no reabre la revisión',async()=>{
  const f=wrapperFixture(),task=f.c.garantiaRevisarCierreOT(ot);f.document.emit('sisventas:session-ended');assert.equal(await task,false);
  f.headers.resolve({'Authorization':'valor-ficticio-no-credencial'});await tick();assert.equal(f.fetches.length,0);assert.equal(withTag(f.document,'dialog').length,0);
});

test('cambiar Auth sin evento mientras llegan las cabeceras evita enviar el fetch de la sesión anterior',async()=>{
  const f=wrapperFixture(),task=f.c.garantiaRevisarCierreOT(ot);f.c.fbAuth.currentUser={uid:'otro-uid-demo'};
  f.headers.resolve({'Authorization':'valor-ficticio-no-credencial'});await tick();
  assert.equal(f.fetches.length,0);assert.equal(await task,false);assert.equal(withTag(f.document,'dialog').length,0);
});

test('una capacidad denegada impide registrar una garantía de entrega desde esa revisión',async()=>{
  const f=fixture(),data=prepared({capabilities:{equipos:true,garantias:false,reviewOT:true}}),task=f.open();
  data.sale.items.renglon.garantiaConfig.inicio='entrega';await f.ready(data);fill(f.document,0,'entregado','SERIE-DEMO','');
  saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);assert.match(status(f.document).textContent,/rol no permite registrar garantías de entrega/);f.api.cancel();await task;
});

test('el wrapper de cierre omite reclamos y usuarios sin permiso sin solicitar Auth ni datos',async()=>{
  const f=wrapperFixture();f.c.SVServiceAuth.headers=()=>assert.fail('La exclusión no consulta Auth');
  for(const claim of [{...ot,origen:'reclamo'},{...ot,reclamoFbKey:'reclamo-demo'},{...ot,tipoVisita:'Post-venta'}])assert.equal((await f.c.garantiaRevisarCierreOT(claim)).skip,true);
  f.c.tienePermiso=()=>false;assert.equal((await f.c.garantiaRevisarCierreOT(ot)).skip,true);assert.equal(f.fetches.length,0);
});

test('el wrapper de cierre reconoce una OT vinculada sólo por ventaKey y prepara esa misma OT',async()=>{
  const f=wrapperFixture(),linked={fbKey:'ot-demo',id:'OT-DEMO',ventaKey:'venta-demo'},before=clone(linked),task=f.c.garantiaRevisarCierreOT(linked);
  await tick();assert.equal(withTag(f.document,'dialog').length,1,'La referencia técnica ventaKey no autoriza saltear la revisión');
  f.headers.resolve({'Authorization':'valor-ficticio-no-credencial'});await tick();assert.equal(f.fetches.length,1);
  assert.deepEqual(JSON.parse(f.fetches[0][1].body),{otKey:'ot-demo'},'El servidor resuelve el vínculo; el navegador no envía una venta elegida');
  assert.deepEqual(linked,before);f.c.SVOTUnitReview.cancel();assert.equal(await task,false);
});

function manualPrepared(change={}){
  return prepared({sale:sale({legacy:{desc:'Cerradura histórica ficticia',qty:1,unidad:'Unidad'}}),
    manualUnits:[{itemKey:'legacy',n:0,key:'unidad_otmanual_ficticia'}],capabilities:{equipos:true,garantias:true,reviewOT:true,manualReview:true},...change});
}
function manualFields(document,index=0){
  const select=decisionSelects(document)[index],card=select.parentNode.parentNode;
  const find=label=>all(card,node=>node.getAttribute('aria-label')?.endsWith(': '+label))[0];
  return {card,toggle:all(card,node=>node.classList.contains('ot-unit-manual-toggle'))[0],form:all(card,node=>node.classList.contains('ot-unit-manual-form'))[0],
    estado:find('Garantía'),meses:find('Meses de garantía'),inicio:find('Inicio de la garantía'),serie:find('¿Requiere número de serie?'),fecha:find('Fecha de instalación o entrega'),confirmado:find('Confirmo las condiciones de esta unidad')};
}
function fillManual(document,index=0,change={}){
  const fields=manualFields(document,index);assert.ok(fields.toggle,'La unidad tiene una revisión manual autorizada');
  fields.toggle.click();assert.equal(fields.form.hidden,false);
  const values={estado:'si',meses:'12',inicio:'instalacion',serie:'si',fecha:'2026-10-21',confirmado:true,...change};
  for(const [key,value] of Object.entries(values)){if(key==='confirmado')fields[key].checked=value;else fields[key].value=value;fields[key].emit('change');}
  return fields;
}

test('la revisión histórica está apagada y sus condiciones no heredan términos ni fecha',async()=>{
  const f=fixture(),data=manualPrepared(),before=clone(data),task=f.open();await f.ready(data);
  const fields=manualFields(f.document);
  assert.ok(fields.toggle);assert.equal(fields.toggle.disabled,true);assert.equal(fields.toggle.getAttribute('aria-expanded'),'false');assert.equal(fields.form.hidden,true);
  for(const key of ['estado','meses','inicio','serie','fecha']){assert.equal(fields[key].value,'',key+' sin valor automático');assert.equal(fields[key].disabled,true);assert.ok(fields[key].getAttribute('aria-label'));}
  assert.equal(fields.confirmado.checked,false);assert.equal(f.calls.length,1);assert.equal(selects(f.document)[0].value,'');
  fill(f.document,0,'instalado','','Acceso histórico');fields.toggle.click();assert.equal(fields.form.hidden,false);assert.equal(f.document.activeElement,fields.estado);
  assert.deepEqual(data,before);f.api.cancel();assert.equal(await task,false);
});

for(const [label,change] of [
  ['sin capacidad',{capabilities:{equipos:true,garantias:true,reviewOT:true}}],
  ['capacidad no booleana',{capabilities:{equipos:true,garantias:true,reviewOT:true,manualReview:'true'}}],
  ['sin descriptor',{manualUnits:[]}],
  ['descriptor de otro renglón',{manualUnits:[{itemKey:'otro',n:0,key:'unidad_otmanual_otro'}]}],
  ['descriptor de otra unidad',{manualUnits:[{itemKey:'legacy',n:1,key:'unidad_otmanual_otro'}]}],
  ['descriptor duplicado',{manualUnits:[{itemKey:'legacy',n:0,key:'uno'},{itemKey:'legacy',n:0,key:'dos'}]}],
  ['descriptor inválido',{manualUnits:[{itemKey:'legacy',n:0,key:'no/es/clave'}]}]
])test('no se expone formulario manual '+label,async()=>{
  const f=fixture(),task=f.open();await f.ready(manualPrepared(change));assert.equal(withClass(f.document,'ot-unit-manual-form').length,0);assert.equal(withClass(f.document,'ot-unit-manual-toggle').length,0);
  fill(f.document,0,'instalado','','Acceso histórico');saveButton(f.document).click();await tick();assert.equal(f.calls.length,2);assert.equal(Object.hasOwn(f.calls[1].body.units[0],'manual'),false);
  f.pendingConfirm.resolve({reviewed:1});assert.equal((await task).warrantyReviewPendingCount,1);
});

test('las unidades con términos completos y los materiales nunca reciben revisión manual',async()=>{
  const data=prepared({sale:sale({normal:{desc:'Equipo normal',qty:1,unidad:'Unidad',garantiaLinea:'linea-normal',garantiaConfig:config()},cable:{desc:'Cable medido',qty:20,unidad:'metro'}}),
    manualUnits:[{itemKey:'normal',n:0,key:'manual_normal'},{itemKey:'cable',n:null,key:'manual_cable'}],capabilities:{equipos:true,garantias:true,reviewOT:true,manualReview:true}});
  const f=fixture(),task=f.open();await f.ready(data);assert.equal(withClass(f.document,'ot-unit-manual-form').length,0);assert.equal(decisionSelects(f.document).length,2);f.api.cancel();await task;
});

test('la revisión manual envía sólo las condiciones explícitas y usa su fecha individual',async()=>{
  const f=fixture(),data=manualPrepared(),before=clone(data),task=f.open();await f.ready(data);fill(f.document,0,'instalado',' SERIE-HISTÓRICA ',' Acceso histórico ');fillManual(f.document,0,{meses:'24'});
  saveButton(f.document).click();await tick();assert.equal(f.calls.length,2);
  assert.deepEqual(f.calls[1].body,{otKey:'ot-demo',revision:'revision-demo',fecha:'2026-10-23',units:[{itemKey:'legacy',n:0,decision:'instalado',serie:'SERIE-HISTÓRICA',ubicacion:'Acceso histórico',manual:{confirmado:true,estado:'si',meses:24,inicio:'instalacion',serie:true,fecha:'2026-10-21'}}]});
  const ack=Object.freeze({registered:1,preserved:0,reviewed:0,estadoInst:'instalado'});f.pendingConfirm.resolve(ack);assert.deepEqual(await task,ack);assert.equal(Object.hasOwn(ack,'warrantyReviewPendingCount'),false);assert.deepEqual(data,before);
});

test('sin garantía y sin serie se eligen explícitamente y no conservan términos ocultos',async()=>{
  const f=fixture(),task=f.open();await f.ready(manualPrepared());fill(f.document,0,'entregado','','');const fields=fillManual(f.document,0,{estado:'no',meses:'99',inicio:'instalacion',serie:'no'});
  assert.equal(fields.meses.disabled,true);assert.equal(fields.inicio.disabled,true);saveButton(f.document).click();await tick();assert.equal(f.calls.length,2);
  assert.deepEqual(f.calls[1].body.units[0].manual,{confirmado:true,estado:'no',meses:0,inicio:'',serie:false,fecha:'2026-10-21'});assert.equal(f.calls[1].body.units[0].serie,'');
  f.pendingConfirm.resolve({registered:0,reviewed:1});assert.equal(Object.hasOwn(await task,'warrantyReviewPendingCount'),false);
});

for(const [name,change,focus,message] of [
  ['garantía sin elegir',{estado:''},'estado',/si esta unidad tiene garantía/],
  ['meses vacíos',{meses:''},'meses',/1 a 120 meses/],
  ['cero meses',{meses:'0'},'meses',/1 a 120 meses/],
  ['más de120 meses',{meses:'121'},'meses',/1 a 120 meses/],
  ['meses fraccionarios',{meses:'1.5'},'meses',/1 a 120 meses/],
  ['inicio sin elegir',{inicio:''},'inicio',/cuándo comienza/],
  ['serie sin elegir',{serie:''},'serie',/requiere número de serie/],
  ['fecha sin elegir',{fecha:''},'fecha',/fecha real/],
  ['fecha inexistente',{fecha:'2026-02-30'},'fecha',/fecha real/],
  ['fecha futura',{fecha:'2026-10-24'},'fecha',/fecha real/],
  ['sin confirmación',{confirmado:false},'confirmado',/Confirmá las condiciones/]
])test('el formulario manual rechaza '+name+' con foco y sin confirmar',async()=>{
  const f=fixture(),task=f.open();await f.ready(manualPrepared());fill(f.document,0,'instalado','SERIE-HISTÓRICA','Acceso histórico');const fields=fillManual(f.document,0,change);
  saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);assert.match(status(f.document).textContent,message);assert.equal(f.document.activeElement,fields[focus]);assert.equal(status(f.document).getAttribute('role'),'alert');f.api.cancel();assert.equal(await task,false);
});

for(const [name,serial,location,focus,message] of [['serie','', 'Acceso histórico','serie',/serie obligatoria/],['ubicación','SERIE-HISTÓRICA','','location',/ubicación instalada/]])test('condiciones manuales validan también '+name+' del equipo',async()=>{
  const f=fixture(),task=f.open();await f.ready(manualPrepared());const row=fill(f.document,0,'instalado',serial,location);fillManual(f.document);
  saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);assert.match(status(f.document).textContent,message);assert.equal(f.document.activeElement,row[focus]);f.api.cancel();await task;
});

test('desactivar la revisión manual conserva el diario técnico sin enviar condiciones',async()=>{
  const f=fixture(),task=f.open();await f.ready(manualPrepared());fill(f.document,0,'instalado','','Acceso histórico');const fields=fillManual(f.document,0,{serie:'no'});fields.toggle.click();
  assert.equal(fields.form.hidden,true);saveButton(f.document).click();await tick();assert.deepEqual(f.calls[1].body.units,[{itemKey:'legacy',n:0,decision:'instalado',serie:'',ubicacion:'Acceso histórico'}]);f.pendingConfirm.resolve({reviewed:1});assert.equal((await task).warrantyReviewPendingCount,1);
});

test('cambiar a pendiente retira las condiciones manuales sin activar una cobertura',async()=>{
  const f=fixture(),task=f.open();await f.ready(manualPrepared());fill(f.document,0,'instalado','','Acceso histórico');const fields=fillManual(f.document,0,{serie:'no'});fill(f.document,0,'pendiente','','');
  assert.equal(fields.form.hidden,true);assert.equal(fields.toggle.disabled,true);saveButton(f.document).click();await tick();assert.deepEqual(f.calls[1].body.units,[{itemKey:'legacy',n:0,decision:'pendiente',serie:'',ubicacion:''}]);f.pendingConfirm.resolve({reviewed:1});await task;
});

test('el descriptor de una unidad manual ya registrada conserva los originales sin formulario',async()=>{
  const record=Object.freeze({manualConfirmado:true,garantiaEstado:'si',garantiaMeses:18,garantiaInicio:'entrega',fechaManual:'2025-03-10',serie:'SERIE-ORIGINAL',dir:'Ubicación original',fechaVenc:'2026-09-10'}),before=clone(record);
  const f=fixture(),task=f.open();await f.ready(manualPrepared({existing:{unidad_otmanual_ficticia:{path:'equipos',record}}}));assert.equal(decisionSelects(f.document).length,0);assert.equal(withClass(f.document,'ot-unit-manual-form').length,0);assert.equal(inputs(f.document).filter(node=>node.type==='text').length,0);
  assert.match(f.document.body.textContent,/SERIE-ORIGINAL/);assert.match(f.document.body.textContent,/18 meses de garantía/);assert.match(f.document.body.textContent,/2025-03-10/);saveButton(f.document).click();await tick();assert.deepEqual(f.calls[1].body.units,[]);assert.deepEqual(record,before);f.pendingConfirm.resolve({preserved:1});assert.equal(Object.hasOwn(await task,'warrantyReviewPendingCount'),false);
});

test('una confirmación manual fallida conserva el formulario y reintenta la misma intención',async()=>{
  const f=fixture(),task=f.open();await f.ready(manualPrepared());fill(f.document,0,'instalado','SERIE-HISTÓRICA','Acceso histórico');const fields=fillManual(f.document);const save=saveButton(f.document);
  save.click();save.click();await tick();assert.equal(f.calls.length,2);assert.equal(fields.confirmado.disabled,true);f.pendingConfirm.reject(Error('Acuse manual ficticio perdido'));await tick();
  assert.equal(fields.form.hidden,false);assert.equal(fields.confirmado.checked,true);assert.equal(fields.confirmado.disabled,false);assert.match(status(f.document).textContent,/OT todavía no se cerró/);
  save.click();await tick();assert.equal(f.calls.length,3);assert.deepEqual(f.calls[2].body,f.calls[1].body);f.api.cancel();assert.equal(await task,false);
});

test('un acuse manual posterior a un cambio de contexto no cierra la OT ni devuelve contadores',async()=>{
  const f=fixture(),task=f.open();await f.ready(manualPrepared());fill(f.document,0,'instalado','SERIE-HISTÓRICA','Acceso histórico');fillManual(f.document);saveButton(f.document).click();await tick();f.invalidate();f.pendingConfirm.resolve({registered:1});assert.equal(await task,false);assert.equal(withTag(f.document,'dialog').length,0);
});

test('el contador distingue una unidad revisada manualmente de otra que sigue sin condiciones',async()=>{
  const data=manualPrepared();data.sale.items.legacy.qty=2;data.manualUnits.push({itemKey:'legacy',n:1,key:'unidad_otmanual_segunda'});
  const f=fixture(),task=f.open();await f.ready(data);fill(f.document,0,'instalado','SERIE-UNO','Acceso uno');fillManual(f.document);fill(f.document,1,'instalado','','Acceso dos');saveButton(f.document).click();await tick();assert.equal(f.calls.length,2);
  assert.ok(f.calls[1].body.units[0].manual);assert.equal(Object.hasOwn(f.calls[1].body.units[1],'manual'),false);f.pendingConfirm.resolve({registered:1,reviewed:1});assert.equal((await task).warrantyReviewPendingCount,1);
});

test('la revisión manual conserva los permisos del destino de la garantía de entrega',async()=>{
  const data=manualPrepared({capabilities:{equipos:true,garantias:false,reviewOT:true,manualReview:true}}),f=fixture(),task=f.open();await f.ready(data);fill(f.document,0,'entregado','SERIE-HISTÓRICA','');fillManual(f.document,0,{inicio:'entrega'});saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);assert.match(status(f.document).textContent,/rol no permite registrar garantías de entrega/);f.api.cancel();await task;
});

test('cinco series se leen mediante el lector existente sin guardar automáticamente',async()=>{
 const scans=[],f=fixture({scan:options=>scans.push(options)}),data=prepared({sale:sale({renglon:{desc:'Cerradura',qty:5,unidad:'Unidad',garantiaLinea:'linea-demo',garantiaConfig:config()}})}),task=f.open();await f.ready(data);
 for(let n=0;n<5;n++){fill(f.document,n,'instalado','','Acceso '+n);const b=withClass(f.document,'ot-unit-scan')[n];assert.equal(b.disabled,false);b.click();assert.equal(scans[n].kind,'serial');scans[n].onRead('SERIE-'+n);}
 assert.equal(f.calls.length,1);saveButton(f.document).click();await tick();assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].body.units.map(u=>u.serie),['SERIE-0','SERIE-1','SERIE-2','SERIE-3','SERIE-4']);f.pendingConfirm.resolve({ok:true,registered:[]});await task;
});
test('lector conserva ceros iniciales y no sustituye otra unidad con una serie repetida',async()=>{const scans=[],f=fixture({scan:o=>scans.push(o)}),task=f.open();await f.ready(prepared({sale:sale({renglon:{desc:'Equipo',qty:2,unidad:'Unidad',garantiaLinea:'linea-demo',garantiaConfig:config()}})}));const a=fill(f.document,0,'instalado','000123'),b=fill(f.document,1,'instalado','');withClass(f.document,'ot-unit-scan')[1].click();scans[0].onRead('000123');assert.equal(b.serie.value,'');assert.equal(a.serie.value,'000123');assert.match(status(f.document).textContent,/otra unidad/);assert.equal(f.calls.length,1);f.api.cancel();await task;});
test('series duplicadas ingresadas a mano se rechazan antes de enviar',async()=>{const f=fixture(),task=f.open();await f.ready(prepared({sale:sale({renglon:{desc:'Equipo',qty:2,unidad:'Unidad',garantiaLinea:'linea-demo',garantiaConfig:config()}})}));fill(f.document,0,'instalado','SN-A');fill(f.document,1,'instalado','sn-a');saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);assert.match(status(f.document).textContent,/misma serie/);f.api.cancel();await task;});
test('cerrar la revisión libera su lector e ignora una lectura tardía',async()=>{let callback,closed=0;const f=fixture({scan:o=>callback=o.onRead,closeScanner:()=>closed++}),task=f.open();await f.ready();const row=fill(f.document,0,'instalado','');withClass(f.document,'ot-unit-scan')[0].click();f.api.cancel();callback('SERIE-TARDIA');assert.equal(row.serie.value,'');assert.equal(closed,1);assert.equal(await task,false);});
test('un fallo del lector conserva la carga manual y no envía una confirmación',async()=>{const f=fixture({scan:()=>{throw Error('Lector no disponible');}}),task=f.open();await f.ready();const row=fill(f.document,0,'instalado','SERIE-MANUAL');withClass(f.document,'ot-unit-scan')[0].click();assert.equal(row.serie.value,'SERIE-MANUAL');assert.match(status(f.document).textContent,/Lector no disponible/);assert.equal(f.calls.length,1);f.api.cancel();await task;});
test('una lectura no pisa el texto que cambió mientras la cámara estaba abierta',async()=>{let read;const f=fixture({scan:o=>read=o.onRead}),task=f.open();await f.ready();const row=fill(f.document,0,'instalado','');withClass(f.document,'ot-unit-scan')[0].click();row.serie.value='MANUAL';read('CAMERA');assert.equal(row.serie.value,'MANUAL');assert.match(status(f.document).textContent,/cambió mientras/);f.api.cancel();await task;});
