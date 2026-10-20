'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {load}=require('./app-functions.cjs');
const approval=require('../../js/modules/commercial-approval.js'),budgets=require('../../js/v3/budget-integration.js');
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const settle=()=>new Promise(resolve=>setImmediate(resolve));

async function createBudgetSaveFixture(options={}){
 const items=[{cod:'DEMO-1',desc:'Producto ficticio',qty:2,punit:1000,disc:0}],config={descuentoLimite:5,montoLimite:600000};
 const original={id:'PP-FICTICIO',numero:'PP-FICTICIO',cliente:'Cliente ficticio',clienteFbKey:'cliente-ficticio',fecha:'2026-10-01',vence:'2026-11-01',ts:10,
  estado:'borrador',usuario:'Autor ficticio',creadoPor:'Autor ficticio',empleado:'Autor ficticio',empleadoUid:'autor-ficticio',
  aprobadoPor:'Aprobación anterior para eliminar',motivo:'Motivo anterior',
  audit:[{usuario:'Autor ficticio',fecha:'2026-10-01',accion:'Presupuesto creado como borrador'}],
  ...budgets.fields({items:[{...items[0],punit:900}],descuentoGeneral:0,conIva:true})};
 const records={'budget-ficticio':clone(original),otro:{...clone(original),cliente:'Otro cliente ficticio',total:99}};
 const calls={reads:[],prepare:[],commits:[],notices:[],rendered:[],complete:0,closed:0,progressFinished:0,draftFlush:0};
 const pending=[],hooks={};let readMode='normal',created=0;
 const nodes={
  'pp-cli':{value:'Cliente ficticio'},'pp-descuento':{value:'15'},'pp-total':{textContent:'2057'},'pp-sub':{textContent:'2000'},'pp-iva':{textContent:'357'},
  'pp-venc':{value:'2026-11-01'},'pp-fecha':{value:'2026-10-01'},'pp-titulo-solucion':{value:'Propuesta ficticia'},
  'ppto-form-view':{dataset:{},style:{display:'block'}},'ppto-list-view':{style:{display:'none'}},'ppto-detalle-view':{style:{display:'none'}},
  'btn-guardar-principal-ppto':{tagName:'BUTTON',isConnected:true},'tab-todos':{style:{}},'tab-borradores':{style:{background:'var(--text)'}},
  'filtro-estado-ppto':{value:options.fromDraft?'revision':''},'ppto-buscar':{value:'Cliente ficticio'}
 };
 const listeners={},user={uid:'admin-ficticio',getIdToken:async()=>'token-ficticio'};
 const addListener=(name,fn)=>{(listeners[name]||=(new Set())).add(fn);};
 const removeListener=(name,fn)=>listeners[name]?.delete(fn);
 const dispatch=name=>{for(const fn of Array.from(listeners[name]||[]))fn({type:name});};
 const c={window:null,console:{warn(){}},URL,TextEncoder,AbortController,AbortSignal,queueMicrotask,
  currentUserUid:user.uid,currentRole:'admin',currentUser:'Admin ficticio',currentUserEmail:'admin@example.invalid',fbAuth:{currentUser:user},fbDB:{},
  navigator:{onLine:true},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://service.fixture.invalid'},FB_PATHS:{presupuestos:'sisventas/presupuestos'},
  _pptoConIva:true,_svDraftGrid:!!options.fromDraft,prodData:[],pptoData:[],APROBACION_CONFIG:config,SVCommercialApproval:approval,
  document:{hidden:false,addEventListener:addListener,removeEventListener:removeListener,getElementById:id=>nodes[id]||null,querySelector:()=>null,
   querySelectorAll:selector=>selector.includes('[id^=tab-]')?[nodes['tab-todos'],nodes['tab-borradores']]:[],dispatchEvent(){},activeElement:null},
  addEventListener(){},CustomEvent:function(type,init){this.type=type;this.detail=init?.detail;},
  normalizarNumeroExcel:value=>String(value),_redondearPrecioActual:value=>Math.round(Number(value)*100)/100,
  clienteSeleccionadoPpto:()=>({fbKey:'cliente-ficticio',id:'C-FICTICIO'}),
  clienteVinculoOperacion:()=>({clientePrincipalKey:'cliente-ficticio',domicilioFbKey:'domicilio-ficticio',domicilioCategoria:'principal',direccion:'Domicilio ficticio'}),
  validarProductosActivosDocumento:()=>true,referenciasProductoDesdeFilas:()=>[],getPpItems:()=>clone(items),
  pptoV3Invocar:(method,args,fallback)=>method==='fields'?budgets.fields(...args):typeof fallback==='function'?fallback():fallback,
  tienePermiso:permission=>['presupuestos.aprobar','presupuestos.aprobarDentroLimite'].includes(permission),
  buscarPptoPorRef:reference=>c.pptoData.find(r=>r.fbKey===reference)||null,
  notify:message=>calls.notices.push({message,state:c.pptoData.find(r=>r.fbKey==='budget-ficticio')?.estado}),
  svConfirm:async()=>true,
  svDrafts:{complete:()=>calls.complete++,flush:()=>calls.draftFlush++},
  svCrearProgresoBoton:()=>{const button=nodes['btn-guardar-principal-ppto'];button.disabled=true;button['aria-busy']='true';let closed=false;const close=()=>{if(!closed){closed=true;calls.progressFinished++;}};return {actualizar(){},liberar:close,finalizar(){close();button.disabled=false;delete button['aria-busy'];}};},
  reservarSiguientePptoId:async()=> 'PP-FICTICIO-NUEVO',
  _block:id=>{nodes[id].style.display='block';},_hide:id=>{nodes[id].style.display='none';},
  renderPptoTabla:()=>{calls.rendered.push(clone(c.pptoData));if(nodes['ppto-list-view'].style.display==='block')calls.closed++;},
  fbRef:(_db,dbPath)=>({path:dbPath,toString:()=> 'https://db.fixture.invalid/'+dbPath}),
  fbGet:async ref=>({val:()=>clone(records[ref.path.split('/').at(-1)])}),
  fbPush:async(ref,value)=>{assert.equal(ref.path,'sisventas/presupuestos');const key='nuevo-'+(++created);records[key]=clone(value);return {key};},
  fbRunTransaction:async(ref,transform,transactionOptions)=>{
   assert.equal(transactionOptions.applyLocally,false);const id=ref.path.split('/').at(-1),next=transform(clone(records[id]));
   if(next===undefined)return {committed:false};
   records[id]=clone(next);const receipt=clone(next);calls.commits.push({id,record:receipt});
   if(hooks.afterCommit)await hooks.afterCommit();
   return {committed:true,snapshot:{val:()=>clone(receipt)}};
  }};
 function response(data,status=200,etag='"fixture"'){return {ok:status>=200&&status<300,status,headers:{get:()=>etag},json:async()=>clone(data)};}
 c.fetch=async(input,request={})=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://service.fixture.invalid','La fixture bloquea toda red externa');
  if(url.pathname.endsWith('/preparar')){const body=JSON.parse(request.body);calls.prepare.push(body.id);return response({ok:true,record:clone(records[body.id])});}
  assert.equal(url.pathname,'/comerciales/presupuestos');assert.equal(request.method,'GET');
  const snapshot=clone(records);calls.reads.push({snapshot,headers:clone(request.headers)});
  if(readMode==='fail')throw new Error('Lectura ficticia interrumpida');
  if(readMode==='denied')return response({ok:false,mensaje:'Acceso revocado en fixture'},403);
  if(readMode==='hold')return new Promise((resolve,reject)=>pending.push({snapshot,resolve:(value=snapshot)=>resolve(response({ok:true,records:value})),reject}));
  return response({ok:true,records:snapshot});
 };
 c.window=c;vm.createContext(c);
 for(const file of ['js/core/commercial-ownership.js','js/modules/commercial-document-controls.js','js/core/guarded-writes.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8'),c);
 load(c,['pptoPersistirGuardar','fbGuardarPresupuesto','guardarPresupuesto','volverListaPpto']);
 c.SVCommercialOwnership.onValue('presupuestos',snapshot=>{c.pptoData=Object.entries(snapshot.val()||{}).map(([fbKey,value])=>({...clone(value),fbKey}));c.renderPptoTabla();});
 await settle();
 c._pptoEditandoFbKey='budget-ficticio';c._pptoEditandoId=original.id;c._pptoEditorBase={...clone(records['budget-ficticio']),fbKey:'budget-ficticio'};
 nodes['btn-guardar-principal-ppto'].removeAttribute=function(name){delete this[name];};
 return {c,nodes,calls,records,pending,hooks,clone,settle,dispatch,list:()=>clone(c.pptoData),mode:value=>{readMode=value;},
  save:()=>c.guardarPresupuesto('aprobado_int'),renderedState:()=>calls.rendered.at(-1)?.find(r=>r.fbKey==='budget-ficticio')?.estado};
}
module.exports={createBudgetSaveFixture,settle};
