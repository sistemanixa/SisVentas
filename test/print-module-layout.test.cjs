'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const employee=require('../js/modules/employee-cash-receipt');
const distributor=require('../js/modules/distributor-documents');
const checkout=path.join(__dirname,'..');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let n=0;n<10;n++)await Promise.resolve();};
const longText=Array.from({length:70},(_,n)=>'Párrafo ficticio '+n+' con concepto y condiciones originales.').join('\n');
function cashPage(concept=longText){return employee.html(employee.model({empleadoId:'e',empleadoNombre:'Empleado ficticio',descripcion:concept,mes:'2026-10'},'g',{medio:'Efectivo',monto:1234.56,fecha:'2026-10-23'},'p',{},{}));}

test('recibo de empleado deja fluir texto largo y conserva importe, identidad y las cuatro firmas',()=>{
 const html=cashPage();
 assert.ok(html.includes(longText));assert.ok(html.includes('1.234,56'));assert.ok(html.includes('RE-g-p'));
 assert.match(html,/\.receipt\{break-inside:auto\}/);assert.doesNotMatch(html,/\.receipt\{break-inside:avoid\}/);
 assert.match(html,/header,\.data,\.amount,\.signatures,footer\{break-inside:avoid/);
 assert.match(html,/header>div:first-child\{flex:1 1 0\}/);assert.match(html,/header>div:last-child\{flex:0 0 118px\}/);
 for(const text of ['Firma de quien recibe','Aclaración','DNI','Fecha de recepción'])assert.ok(html.includes(text));
});

function employeeUI(){
 const pending=deferred(),events=[],buttons={},frame={contentDocument:{label:'fictitious-frame'},contentWindow:{focus(){},print(){events.push('print');}},set srcdoc(value){this.html=value;queueMicrotask(()=>this.onload?.());}};
 const handlers={},dialog={style:{},isConnected:true,querySelector:s=>s==='iframe'?frame:buttons[s]||(buttons[s]={}),addEventListener:(type,fn)=>handlers[type]=fn,showModal(){},close(){events.push('close');},remove(){this.isConnected=false;}};
 let allowed=true,reads=0;
 const root={currentUserUid:'u',fbAuth:{currentUser:{uid:'u'}},empData:{e:{fbKey:'e',nombre:'Empleado ficticio'}},fbDB:{},fbRef:(_,p)=>p,fbGet:async()=>{reads++;return {val:()=>({empleadoId:'e',descripcion:'Concepto ficticio',pagos:{p:{medio:'Efectivo',monto:1,fecha:'2026-10-23'}}})};},puedeAdministrarGastos:()=>allowed,SVPrintLayout:{ready:async doc=>{assert.equal(doc,frame.contentDocument);events.push('ready');await pending.promise;events.push('ready-done');}}};
 const document={activeElement:{isConnected:true,focus:options=>{assert.equal(options.preventScroll,true);events.push('focus');}},addEventListener(){},getElementById(){return null;},body:{appendChild(){}},createElement:()=>dialog};root.document=document;
 vm.runInNewContext(fs.readFileSync(path.join(checkout,'js/modules/employee-cash-receipt.js'),'utf8'),{window:root,document,queueMicrotask,console});
 return {root,dialog,frame,buttons,pending,events,handlers,deny(){allowed=false;},reads:()=>reads};
}
test('recibo espera fuentes/imágenes después de releer pago sin agregar consultas',async()=>{
 const f=employeeUI();await f.root.SVEmployeeCashReceipt.preview('g','p');const task=f.buttons['[data-print]'].onclick({currentTarget:f.buttons['[data-print]']});await flush();
 assert.deepEqual(f.events,['ready']);assert.equal(f.reads(),2);f.pending.resolve();await task;
 assert.deepEqual(f.events,['ready','ready-done','print']);assert.equal(f.reads(),2);
});
test('recibo no imprime si cambia la sesión o el permiso durante la espera visual',async()=>{
 for(const kind of ['uid','auth','permission','closed']){
  const f=employeeUI();await f.root.SVEmployeeCashReceipt.preview('g','p');const task=f.buttons['[data-print]'].onclick({currentTarget:f.buttons['[data-print]']});await flush();
  if(kind==='uid')f.root.currentUserUid='otro';if(kind==='auth')f.root.fbAuth.currentUser={uid:'u'};if(kind==='permission')f.deny();if(kind==='closed')f.dialog.isConnected=false;
  f.pending.resolve();await task;assert.equal(f.events.includes('print'),false);assert.equal(f.buttons['[data-print]'].disabled,false);
 }
});

test('recibo informa recurso faltante, no imprime incompleto y permite reintentar',async()=>{
 const f=employeeUI();await f.root.SVEmployeeCashReceipt.preview('g','p');const button=f.buttons['[data-print]'],task=button.onclick({currentTarget:button});await flush();
 f.pending.reject(Error('No se pudo cargar una imagen del recibo'));await task;
 assert.equal(f.events.includes('print'),false);assert.equal(button.disabled,false);assert.match(f.buttons['[data-status]'].textContent,/No se pudo cargar una imagen/);assert.equal(f.reads(),2);
});
for(const action of ['button','escape'])test('cerrar recibo por '+action+' restaura foco sin mover el fondo',async()=>{
 const f=employeeUI();await f.root.SVEmployeeCashReceipt.preview('g','p');
 if(action==='button')f.buttons['[data-close]'].onclick();else f.handlers.cancel({preventDefault:()=>f.events.push('prevent-default')});
 assert.equal(f.dialog.isConnected,false);assert.deepEqual(f.events.slice(-2),['close','focus']);assert.equal(f.reads(),1);
});

const documentFixture=()=>({type:'remito',currency:'ARS',number:'R-FICTICIO',createdAt:1792753200000,company:{nombre:'Empresa ficticia'},client:{name:'Cliente ficticio'},items:[{name:longText,qty:2,unitPrice:10.25,total:20.50,code:'P-FICTICIO',warranty:{state:'si',months:12,start:'instalacion'},serials:['SERIE-FICTICIA']}],total:20.50,notes:'Nota ficticia',warrantyReport:true});
test('comprobante distribuidor conserva renglones, condiciones y salto explícito de garantía',()=>{
 const html=distributor.printable(documentFixture());
 for(const text of [longText,'ARS $ 20,50','SERIE-FICTICIA','12 meses','instalación confirmada','break-before:page'])assert.ok(html.includes(text),text);
 assert.match(html,/thead\{display:table-header-group\}/);assert.match(html,/tfoot\{display:table-row-group\}/);assert.match(html,/tr,\.total,\.sign\{break-inside:avoid/);
 assert.match(html,/@page\{size:A4;margin:12mm\}/);assert.match(html,/overflow-wrap:anywhere/);
 assert.match(html,/table\{[^}]*table-layout:fixed/);assert.match(html,/<colgroup><col style="width:49%"><col style="width:11%"><col style="width:20%"><col style="width:20%"><\/colgroup>/);
 assert.match(html,/\.dd-warranty-sheet>p:last-of-type\{break-after:avoid-page;page-break-after:avoid\}/);
 assert.match(html,/<p><small>Condiciones guardadas[^]*?<\/small><\/p><div class="sign">Recibí el informe/);
});
test('script interno de distribuidor espera recursos y restaura botón aun si fallan',async()=>{
 const html=distributor.printable(documentFixture()),script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
 for(const fail of [false,true]){
  const wait=deferred(),events=[],button={disabled:false},context={document:{},alert:message=>events.push(String(message)),SVPrintLayout:{ready:async()=>{events.push('ready');await wait.promise;}},focus(){},print(){events.push('print');}};context.window=context;
  vm.runInNewContext(script,context);const pending=context.imprimirComprobante(button);assert.equal(button.disabled,true);assert.deepEqual(events,['ready']);if(fail)wait.reject(Error('Carga ficticia fallida'));else wait.resolve();await pending;
  assert.equal(events.includes('print'),!fail);assert.equal(button.disabled,false);
 }
});

function distributorUI(){
 const wait=deferred(),events=[],requests=[];
 function node(){return {value:'',dataset:{},textContent:'',addEventListener(){},set innerHTML(value){this.markup=value;},get innerHTML(){return this.markup||'';}};}
 const nodes=new Map(),frame={isConnected:true,contentDocument:{},contentWindow:{focus(){},print(){events.push('print');}},set srcdoc(value){this.html=value;}};
 const open=node();open.dataset.open='saved';
 const host={closest(){return null;},set innerHTML(value){this.markup=value;nodes.clear();for(const match of value.matchAll(/data-([a-z-]+)/g))nodes.set(match[1],node());},get innerHTML(){return this.markup;},querySelector:s=>s==='iframe'?frame:nodes.get(s.match(/data-([a-z-]+)/)?.[1])||null,querySelectorAll:s=>s==='[data-open]'?[open]:[]};
 const root={currentUserUid:'u',currentRole:'admin',SVPrintLayout:{css:()=>'',source:()=>'',ready:async()=>{events.push('ready');await wait.promise;}},addEventListener(){},removeEventListener(){}},document={addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(checkout,'js/modules/distributor-documents.js'),'utf8'),{window:root,document,console});
 const api=root.SVDistributorDocumentsFactory.createUI(async p=>{requests.push(p);return p==='/opciones'?{products:[],company:{}}:{documents:[{...documentFixture(),id:'saved'}]};});
 return {api,root,host,open,frame,wait,events,requests};
}
test('imprimir distribuidor espera srcdoc y recursos sin volver a emitir el comprobante',async()=>{
 const f=distributorUI();await f.api.mount(f.host);f.open.onclick();const button=f.host.querySelector('[data-final]'),pending=button.onclick();await flush();assert.deepEqual(f.events,[]);
 f.frame.onload();await flush();assert.deepEqual(f.events,['ready']);f.wait.resolve();await pending;
 assert.deepEqual(f.events,['ready','print']);assert.deepEqual(f.requests,['/opciones','']);assert.equal(button.disabled,false);
});
test('salir de distribuidor durante la espera cancela la impresión anterior',async()=>{
 const f=distributorUI();await f.api.mount(f.host);f.open.onclick();const button=f.host.querySelector('[data-final]'),pending=button.onclick();f.frame.onload();await flush();f.api.reset();f.wait.resolve();await pending;
 assert.equal(f.events.includes('print'),false);assert.equal(button.disabled,false);
});

function orderHTML(){
 let html='';const layout={css:()=>'',source:()=>''};
 const document={addEventListener(){}};const window={SVPrintLayout:layout,document,open:()=>({document:{open(){},write(value){html=value;},close(){}}})};
 vm.runInNewContext(fs.readFileSync(path.join(checkout,'js/modules/purchase-orders.js'),'utf8'),{window,document,console});
 window.SisVentasCompras.state.activeOrder={numero:'OC-FICTICIA',fecha:'2026-10-23',items:[{codigo:'P-FICTICIO',descripcion:longText,proveedorFinal:'Proveedor ficticio',cantidadCostoReal:2,costoUnitarioPresupuestado:10.25,costoUnitarioReal:11.50}],totalPresupuestadoRecibido:20.50,totalRealRecibido:23};window.ocImprimirOrdenActual();return html;
}
test('conciliación conserva filas, números y totales con cabecera repetible y resumen indivisible',()=>{
 const html=orderHTML();for(const text of [longText,'$20,5','$23','P-FICTICIO'])assert.ok(html.includes(text));
 assert.match(html,/thead\{display:table-header-group\}/);assert.match(html,/tfoot\{display:table-row-group\}/);assert.match(html,/header,\.meta,\.total,\.foot\{break-inside:avoid/);assert.match(html,/tr\{break-inside:avoid/);
 assert.match(html,/overflow-wrap:break-word;word-break:break-word/);assert.equal((html.match(/<col style=/g)||[]).length,8);assert.match(html,/table-layout:auto/);assert.match(html,/\.num\{[^}]*white-space:nowrap[^}]*word-break:normal/);assert.match(html,/\.amount,\.total strong\{[^}]*white-space:nowrap/);
});
test('conciliación exporta clon natural y comparte exactamente el mismo PDF que descarga',async()=>{
 const html=orderHTML(),script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
 for(const share of [false,true]){
  const blob=new Blob(['pdf ficticio'],{type:'application/pdf'}),calls=[],clone={style:{}},original={style:{minHeight:'1123px',margin:'24px auto'},cloneNode(deep){assert.equal(deep,true);return clone;}},button={disabled:false,textContent:'PDF'};
  const document={getElementById:id=>{assert.equal(id,'oc-comprobante');return original;},createElement:()=>({click(){calls.push('download');}})};
  const context={document,html2pdf(){},SVPrintLayout:{pdf:async(node,options)=>{calls.push({node,options});return blob;},ready:async()=>{}},File:class{constructor(parts){assert.equal(parts[0],blob);}},navigator:{canShare:()=>true,share:async()=>calls.push('share')},URL:{createObjectURL(value){assert.equal(value,blob);return 'blob:ficticio';},revokeObjectURL(){}},setTimeout(){},alert:message=>{throw Error(message);},focus(){},print(){}};context.window=context;
  vm.runInNewContext(script,context);await context.crearPdf(share,button);
  assert.equal(calls[0].node,clone);assert.deepEqual(clone.style,{minHeight:'0',height:'auto',margin:'0',boxShadow:'none'});assert.deepEqual(original.style,{minHeight:'1123px',margin:'24px auto'});assert.equal(calls[0].options.widthPx,794);assert.equal(calls[0].options.atomicSelectors,'tr,thead,img,svg,canvas,header,.meta,.total,.foot');assert.equal(JSON.stringify(calls[0].options.margin),'[6,6,6,6]');assert.equal(calls.at(-1),share?'share':'download');assert.equal(button.disabled,false);assert.equal(button.textContent,'PDF');
 }
});
test('conciliación imprime después de esperar los recursos del documento',async()=>{
 const html=orderHTML(),script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1],wait=deferred(),events=[],button={disabled:false};
 const context={document:{},SVPrintLayout:{ready:async()=>{events.push('ready');await wait.promise;}},focus(){},print(){events.push('print');},alert(){}};context.window=context;vm.runInNewContext(script,context);
 const pending=context.imprimirOrden(button);assert.deepEqual(events,['ready']);assert.equal(button.disabled,true);wait.resolve();await pending;assert.deepEqual(events,['ready','print']);assert.equal(button.disabled,false);
});

test('conciliación informa recursos faltantes sin imprimir y restaura el botón',async()=>{
 const html=orderHTML(),script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1],events=[],button={disabled:false};
 const context={document:{},SVPrintLayout:{ready:async()=>{throw Error('No se pudo cargar el logo');}},focus(){},print(){events.push('print');},alert:message=>events.push(message)};context.window=context;vm.runInNewContext(script,context);
 await context.imprimirOrden(button);assert.deepEqual(events,['No se pudo cargar el logo']);assert.equal(button.disabled,false);
});
