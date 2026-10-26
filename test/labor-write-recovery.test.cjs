'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const recoverySource=fs.readFileSync('js/core/labor-write-recovery.js','utf8'),writesSource=fs.readFileSync('js/core/labor-writes.js','utf8');
const clone=value=>value==null?null:structuredClone(value),response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>clone(data)});
class Element{constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.style={};this.listeners=new Map();this.isConnected=true;}setAttribute(k,v){this.attributes[k]=v;}append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.isConnected=false;}addEventListener(k,fn){this.listeners.set(k,fn);}contains(node){return node===this||this.children.some(child=>child.contains(node));}focus(options){this.focusOptions=options;this.focusCalls=(this.focusCalls||0)+1;}}
function fixture({storage=new Map(),mode='loss',status='confirmed',rejectionCode='SV_BONUS_BATCH_CONFLICT',rejectionStatus=409}={}){
 const state={sisventas:{gastos:{g:{monto:100,montoPagado:0}},ctaemp:{emp:{m:{monto:100}}}}},commands=[],queries=[],receipts=new Map(),listeners=new Map(),nodes=[];
 const waiters=new Set();
 const wake=()=>{for(const waiter of waiters){try{if(waiter.condition()){waiters.delete(waiter);waiter.resolve();}}catch(error){waiters.delete(waiter);waiter.reject(error);}}};
 const when=condition=>condition()?Promise.resolve():new Promise((resolve,reject)=>{waiters.add({condition,resolve,reject});});
 let sequence=0,holds=0,transportGate=null;
 const get=path=>path.split('/').reduce((node,key)=>node?.[key]??null,state),put=(path,value)=>{const parts=path.split('/'),key=parts.pop();let node=state;for(const part of parts)node=node[part]||={};if(value===null)delete node[key];else node[key]=clone(value);};
 const ref=(_,path='')=>({key:path.split('/').at(-1),toString:()=> 'https://fixture.invalid/'+path});
 const sdk={ref,async get(r){return {val:()=>clone(get(new URL(r.toString()).pathname.slice(1)))};},set(){throw Error('No SDK write');},update(){throw Error('No SDK write');},remove(){throw Error('No SDK write');},runTransaction(){throw Error('No SDK transaction');},push(r){return ref(null,new URL(r.toString()).pathname.slice(1)+'/key-'+(++sequence));}};
 const document={body:new Element('body'),documentElement:new Element('html'),createElement(tag){const el=new Element(tag);nodes.push(el);return el;},addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},dispatchEvent(event){listeners.get(event.type)?.(event);wake();return true;}};
 const root={document,currentUserUid:'u',currentRole:'admin',fbDB:{},fbAuth:{currentUser:{uid:'u'}},PERMISOS_ROLES:{admin:{indiceRevision:1}},crypto:{subtle:crypto.webcrypto.subtle,randomUUID:()=> '00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0')},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://gateway.invalid'},
  CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},
  sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},SVServiceAuth:{headers:async base=>({...base,Authorization:'Bearer ficticio'})},SVForegroundSession:{holdDatabase(){holds++;return ()=>holds--;},waitVisible:async()=>{}},
  async fetch(url,options){const body=JSON.parse(options.body);if(url.endsWith('/operacion')){queries.push(body);wake();return response({ok:true,status});}
   commands.push(body);wake();const stored=JSON.parse(storage.get(root.SVLaborWriteRecovery.STORAGE_KEY));assert.ok(stored.some(item=>item.id===body.id));if(transportGate)await transportGate;
   if(mode==='forbidden')return response({ok:false,code:'DENIED'},403);
   if(mode==='bonus-rejected')return response({ok:false,code:rejectionCode},rejectionStatus);
   if(mode==='cancelled')return response({ok:false,committed:false,code:'SV_LABOR_CANCELLED'});
   if(mode!=='unapplied'){if(body.kind==='set'||body.kind==='compare')put(body.path,body.value);else for(const [path,value]of Object.entries(body.value))put(path,value);receipts.set(body.id,true);}
   if(mode==='ok')return response({ok:true,committed:true});if(mode==='uncertain409')return response({ok:false,code:'SV_LABOR_COMMIT_UNCONFIRMED'},409);throw Error('Failed to fetch');
  }
 };
 const context={window:root,URL,TextEncoder,Uint8Array,AbortSignal,Promise};vm.createContext(context);vm.runInContext(recoverySource,context);vm.runInContext(writesSource,context);root.SVLaborWrites.install({sdk});
 return {root,state,commands,queries,receipts,storage,listeners,nodes,get,when,ref:path=>ref(null,path),get holds(){return holds;},setStatus(value){status=value;},setTransportGate(gate){transportGate=gate;}};
}

test('respuesta perdida conserva Promise, ID/body y sólo metadata hasta consulta explícita; no duplica pago parcial',async()=>{
 const f=fixture();let finished=false;
 const pending=f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),g=>({...g,montoPagado:20})).then(result=>{finished=true;return result;});
 await f.when(()=>f.root.SVLaborWriteRecovery.state());assert.equal(finished,false);assert.equal(f.holds,0);assert.equal(f.get('sisventas/gastos/g').montoPagado,20);
 const command=clone(f.commands[0]),metadata=JSON.parse(f.storage.get(f.root.SVLaborWriteRecovery.STORAGE_KEY));assert.deepEqual(Object.keys(metadata[0]).sort(),['digest','id','uid']);
 assert.equal(metadata[0].digest,crypto.createHash('sha256').update(f.root.SVLaborWrites.canonical(command)).digest('hex'));
 await assert.rejects(f.root.fbRunTransaction(f.ref('sisventas/gastos/g'),g=>({...g,montoPagado:40})),{code:'SV_LABOR_PENDING_OPERATION'});assert.equal(f.commands.length,1);
 await f.root.SVLaborWriteRecovery.check();const result=await pending;assert.equal(result.snapshot.val().montoPagado,20);assert.equal(f.commands.length,1);assert.deepEqual(f.commands[0],command);assert.equal(f.storage.size,0);assert.equal(f.root.document.body.children.length,0);
});

test('la confirmación explícita permite continuar la cadena original sin volver a enviar el primer paso',async()=>{
 const f=fixture(),first=f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20),pending=first.then(()=>f.root.fbUpdate(f.ref('sisventas/ctaemp/emp/m'),{montoPagado:20}));
 await f.when(()=>f.root.SVLaborWriteRecovery.state());const firstCommand=clone(f.commands[0]);await f.root.SVLaborWriteRecovery.check();await first;
 await f.when(()=>f.commands.length===2&&f.root.SVLaborWriteRecovery.state());
 await f.root.SVLaborWriteRecovery.check();await pending;assert.equal(f.commands.length,2);assert.deepEqual(f.commands[0],firstCommand);assert.equal(f.commands[1].kind,'patch');assert.deepEqual(f.commands[1].value,{'sisventas/ctaemp/emp/m/montoPagado':20});assert.equal(f.get('sisventas/ctaemp/emp/m').montoPagado,20);
});

test('pending nunca libera el intento y rejected definitivo permite volver a guardar',async()=>{
 const f=fixture({mode:'unapplied',status:'pending'}),pending=f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20),rejected=assert.rejects(pending,{code:'SV_LABOR_REJECTED'});
 await f.when(()=>f.root.SVLaborWriteRecovery.state());await f.root.SVLaborWriteRecovery.check();assert.equal(f.commands.length,1);assert.ok(f.root.SVLaborWriteRecovery.state());
 f.setStatus('rejected');await f.root.SVLaborWriteRecovery.check();await rejected;assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.equal(f.get('sisventas/gastos/g').montoPagado,0);assert.equal(f.storage.size,0);
});

test('recarga restaura sólo UID/id/digest, bloquea nuevo UUID y confirma sin reenviar datos perdidos',async()=>{
 const f=fixture(),pending=f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20);await f.when(()=>f.root.SVLaborWriteRecovery.state());
 const storage=new Map(f.storage),reload=fixture({storage});reload.root.SVLaborWriteRecovery.restore();await assert.rejects(reload.root.fbSet(reload.ref('sisventas/gastos/g'),{monto:200}),{code:'SV_LABOR_PENDING_OPERATION'});
 assert.equal(reload.commands.length,0);await reload.root.SVLaborWriteRecovery.check();assert.equal(reload.queries.length,1);assert.equal(reload.storage.size,0);assert.equal(reload.commands.length,0);
 const stopped=assert.rejects(pending,{code:'SV_LABOR_SESSION'});f.root.SVLaborWriteRecovery.clear();await stopped;
});

test('409 de commit incierto no se confunde con rechazo y controles muestran consulta manual sin reloj',async()=>{
 const f=fixture({mode:'uncertain409'}),pending=f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20);await f.when(()=>f.root.SVLaborWriteRecovery.state());
 assert.equal(f.root.document.body.children.length,1);const layer=f.root.document.body.children[0],card=layer.children[0],message=card.children[0],button=card.children[1];
 assert.match(message.textContent,/No se pudo confirmar/);assert.equal(button.textContent,'Consultar operación');assert.equal(button.disabled,false);assert.equal(f.queries.length,0);
 await button.onclick();await pending;assert.equal(f.commands.length,1);assert.equal(f.queries.length,1);assert.equal(f.root.document.body.children.length,0);
});

test('logout limpia memoria/UI y conserva sólo metadata para consultar al reingresar',async()=>{
 const f=fixture(),pending=f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20);await f.when(()=>f.root.SVLaborWriteRecovery.state());
 const stopped=assert.rejects(pending,{code:'SV_LABOR_SESSION'});f.root.fbAuth.currentUser=null;f.listeners.get('sisventas:session-ended')();await stopped;
 assert.equal(f.storage.size,1);assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.equal(f.root.document.body.children.length,0);
 const saved=JSON.parse(f.storage.get(f.root.SVLaborWriteRecovery.STORAGE_KEY));assert.deepEqual(Object.keys(saved[0]).sort(),['digest','id','uid']);
 f.root.currentUserUid='other';f.root.fbAuth.currentUser={uid:'other'};f.root.SVLaborWriteRecovery.restore();assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.deepEqual(JSON.parse(f.storage.get(f.root.SVLaborWriteRecovery.STORAGE_KEY)),saved);assert.equal(f.queries.length,0);
 f.root.SVLaborWriteRecovery.clear();f.root.currentUserUid='u';f.root.fbAuth.currentUser={uid:'u'};f.root.SVLaborWriteRecovery.restore();assert.ok(f.root.SVLaborWriteRecovery.state());
 await assert.rejects(f.root.fbSet(f.ref('sisventas/gastos/g'),{monto:200}),{code:'SV_LABOR_PENDING_OPERATION'});assert.equal(f.commands.length,1);assert.equal(f.queries.length,0);
 await f.root.SVLaborWriteRecovery.check();assert.equal(f.queries.length,1);assert.equal(f.storage.size,0);assert.equal(f.commands.length,1);
});

test('rechazo HTTP403 y fallo local previo a POST no quedan como intento incierto',async()=>{
 const f=fixture({mode:'forbidden'});await assert.rejects(f.root.fbSet(f.ref('sisventas/gastos/g'),{monto:20}),{statusCode:403});assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.equal(f.storage.size,0);
 await assert.rejects(f.root.fbSet(f.ref('sisventas/gastos/g'),{foto:'x'.repeat(17*1024*1024)}),{code:'SV_LABOR_SIZE'});assert.equal(f.commands.length,1);assert.equal(f.storage.size,0);
});

for(const code of ['SV_BONUS_BATCH_CONFLICT','SV_BONUS_EMPLOYEE_UNAVAILABLE'])test('rechazo previo al commit del grupo '+code+' no pide otra consulta ni duplica el envío',async()=>{
 const f=fixture({mode:'bonus-rejected',rejectionCode:code}),before=clone(f.state);
 await assert.rejects(f.root.SVLaborWrites.atomic({purpose:'employee-bonus-batch',paths:['sisventas/gastos/g','sisventas/ctaemp/emp/m'],build:values=>Object.fromEntries(Object.entries(values).map(([path,value])=>[path,{...value,bonificacionCantidad:5}]))}),{code,statusCode:409});
 assert.deepEqual(f.state,before);assert.equal(f.commands.length,1);assert.equal(f.commands[0].purpose,'employee-bonus-batch');assert.equal(f.queries.length,0);assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.equal(f.storage.size,0);assert.equal(f.root.document.body.children.length,0);
});
test('un código de bonificación en HTTP500 sigue siendo ambiguo hasta consultar expresamente',async()=>{
 const f=fixture({mode:'bonus-rejected',rejectionStatus:500,status:'rejected'}),pending=f.root.fbSet(f.ref('sisventas/gastos/g'),{monto:20}),rejected=assert.rejects(pending,{code:'SV_LABOR_REJECTED'});
 await f.when(()=>f.root.SVLaborWriteRecovery.state());assert.equal(f.commands.length,1);assert.equal(f.queries.length,0);assert.ok(f.storage.size);await f.root.SVLaborWriteRecovery.check();await rejected;assert.equal(f.queries.length,1);assert.equal(f.storage.size,0);assert.equal(f.get('sisventas/gastos/g').monto,100);
});

for(const code of ['SV_MONTHLY_PAYROLL_INVALID','SV_MONTHLY_PAYROLL_REVIEW','SV_MONTHLY_PAYROLL_SOURCE','SV_MONTHLY_PAYROLL_EXISTS','SV_MONTHLY_PAYROLL_PREVIEW_CHANGED','SV_MONTHLY_PAYROLL_PAID','SV_MONTHLY_PAYROLL_EMPTY'])test('monthly precommit rejection retires the attempt without querying '+code,async()=>{
 const f=fixture({mode:'bonus-rejected',rejectionCode:code,rejectionStatus:code==='SV_MONTHLY_PAYROLL_INVALID'?503:409});await assert.rejects(f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20),{code});assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.equal(f.queries.length,0);assert.equal(f.storage.size,0);assert.equal(f.get('sisventas/gastos/g').montoPagado,0);
});

test('atomic confirmado tras pérdida de respuesta vuelve con el mismo conjunto sin duplicarlo',async()=>{
 const f=fixture(),a='sisventas/gastos/g',b='sisventas/ctaemp/emp/m';let builds=0;
 const pending=f.root.SVLaborWrites.atomic({paths:[a,b],build(values){builds++;return {[a]:{...values[a],montoPagado:20},[b]:{...values[b],montoPagado:20}};}});
 await f.when(()=>f.root.SVLaborWriteRecovery.state());assert.equal(f.get(a).montoPagado,20);assert.equal(f.get(b).montoPagado,20);await f.root.SVLaborWriteRecovery.check();
 const result=await pending;assert.equal(result.value[a].montoPagado,20);assert.equal(builds,1);assert.equal(f.commands.length,1);assert.equal(f.commands[0].kind,'atomic');
});

test('varios intentos iniciados conservan metadata separada y requieren consultar cada confirmación',async()=>{
 const f=fixture();let release;f.setTransportGate(new Promise(resolve=>{release=resolve;}));
 const first=f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20),second=f.root.fbSet(f.ref('sisventas/ctaemp/emp/m/montoPagado'),20);
 await f.when(()=>f.commands.length===2);assert.equal(JSON.parse(f.storage.get(f.root.SVLaborWriteRecovery.STORAGE_KEY)).length,2);release();
 await f.when(()=>f.root.SVLaborWriteRecovery.state()?.count===2);await f.root.SVLaborWriteRecovery.check();assert.equal(f.root.SVLaborWriteRecovery.state().count,1);
 await f.root.SVLaborWriteRecovery.check();await Promise.all([first,second]);assert.equal(f.queries.length,2);assert.equal(f.commands.length,2);assert.equal(f.storage.size,0);assert.equal(f.holds,0);
});

test('recuperación confirmada con rol cambiado no continúa la UI de la operación anterior',async()=>{
 const f=fixture(),pending=f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20);await f.when(()=>f.root.SVLaborWriteRecovery.state());
 const rejected=assert.rejects(pending,{code:'SV_LABOR_SESSION'});f.root.currentRole='vendedor';await f.root.SVLaborWriteRecovery.check();await rejected;
 assert.equal(f.storage.size,0);assert.equal(f.commands.length,1);
});

test('un tombstone recibido como respuesta del POST es rechazo definitivo sin consulta ni cobro',async()=>{
 const f=fixture({mode:'cancelled'});await assert.rejects(f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20),{code:'SV_LABOR_CANCELLED'});
 assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.equal(f.get('sisventas/gastos/g').montoPagado,0);assert.equal(f.storage.size,0);assert.equal(f.queries.length,0);
});

test('modal de recuperación bloquea fondo, scroll y Escape, atrapa Tab y restaura foco/overflow al confirmar',async()=>{
 const f=fixture(),previous=new Element('button');f.root.document.activeElement=previous;f.root.document.body.style.overflow='auto';f.root.document.documentElement.style.overflow='scroll';
 let stacks=0;f.root.svSincronizarPilaModales=()=>{stacks++;};const pending=f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20);await f.when(()=>f.root.SVLaborWriteRecovery.state());
 const layer=f.root.document.body.children[0],button=layer.children[0].children[1];assert.equal(layer.attributes.role,'alertdialog');assert.equal(layer.attributes['aria-modal'],'true');
 assert.match(layer.className,/modal-overlay/);assert.equal(f.root.document.body.style.overflow,'hidden');assert.equal(f.root.document.documentElement.style.overflow,'hidden');assert.ok(button.focusCalls>0);assert.match(button.style.cssText,/background:#f0f2f5/);
 for(const key of ['Tab','Escape']){let prevented=false,stopped=false;f.listeners.get('keydown')({key,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});assert.equal(prevented,true);assert.equal(stopped,true);assert.ok(f.root.SVLaborWriteRecovery.state());}
 let clicked=false;layer.listeners.get('click')({target:layer,preventDefault(){clicked=true;},stopPropagation(){}});assert.equal(clicked,true);
 await f.root.SVLaborWriteRecovery.check();await pending;assert.equal(f.root.document.body.style.overflow,'auto');assert.equal(f.root.document.documentElement.style.overflow,'scroll');assert.equal(f.listeners.has('keydown'),false);assert.equal(f.listeners.has('focusin'),false);assert.equal(previous.focusCalls,1);assert.equal(previous.focusOptions.preventScroll,true);assert.ok(stacks>=2);
});

for(const code of ["SV_ACCOUNT_COMMAND_REVIEW","SV_ACCOUNT_VIEW_UNREADY","SV_ACCOUNT_VIEW_WRITER_UNREADY","SV_ACCOUNT_VIEW_REVIEW","SV_ACCOUNT_FINANCIAL_COMMAND_REQUIRED","SV_ACCOUNT_SOURCE_COMMAND_REQUIRED","SV_ACCOUNT_RECORD_COMMAND_REQUIRED","SV_ACCOUNT_PAYMENT_REVIEW","SV_ACCOUNT_PAYMENT_COMMAND_REQUIRED","SV_ACCOUNT_MIRROR_REQUIRED","SV_ACCOUNT_MIRROR_REVIEW","SV_ACCOUNT_COMPANION_INVALID","SV_ACCOUNT_COMPANION_IMMUTABLE","SV_ACCOUNT_WRITER_VERSION","SV_EXPENSE_LINK_REVIEW","SV_EXPENSE_RETIRED","SV_EXPENSE_STATE_REVIEW","SV_EXPENSE_PAYMENT_REVIEW","SV_ADVANCE_OWNER_CHANGE_DENIED","SV_PAYROLL_PREVIEW_CHANGED","SV_PAYROLL_EMPLOYEE_REVIEW","SV_BONUS_CONCEPT_CHANGED","SV_BONUS_BATCH_CONFLICT","SV_BONUS_EMPLOYEE_UNAVAILABLE","SV_SAC_BATCH_CONFLICT","SV_EMPLOYEE_MOVEMENT_REVIEW","SV_EMPLOYEE_MOVEMENT_LINKED_ADVANCE","SV_EMPLOYEE_HISTORY_REVIEW","SV_EMPLOYEE_DOCUMENT_EXISTS","SV_EMPLOYEE_DIRECTORY_UNREADY","SV_EMPLOYEE_DIRECTORY_REVIEW","SV_EMPLOYEE_DOCUMENT_REVIEW"])test('precommit domain rejection is terminal without a status query '+code,async()=>{const f=fixture({mode:'bonus-rejected',rejectionCode:code,rejectionStatus:code.endsWith('UNREADY')?503:409});await assert.rejects(f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20),{code});assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.equal(f.queries.length,0);assert.equal(f.storage.size,0);assert.equal(f.get('sisventas/gastos/g').montoPagado,0);});

for(const code of ["SV_PURCHASE_AMBIGUOUS","SV_PURCHASE_BASE","SV_PURCHASE_INVENTORY","SV_PURCHASE_LEDGER","SV_PURCHASE_LEGACY","SV_PURCHASE_LINE","SV_PURCHASE_OPERATION","SV_PURCHASE_ORDER","SV_PURCHASE_PENDING","SV_PURCHASE_PROVIDER","SV_PURCHASE_QUANTITY","SV_PURCHASE_RECEIPT","SV_PURCHASE_RECONCILIATION","SV_PURCHASE_UNREADY"])test('purchase precommit rejection clears the attempt without an extra query '+code,async()=>{const f=fixture({mode:'bonus-rejected',rejectionCode:code,rejectionStatus:code.endsWith('UNREADY')?503:409});await assert.rejects(f.root.fbSet(f.ref('sisventas/gastos/g/montoPagado'),20),{code});assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.equal(f.queries.length,0);assert.equal(f.storage.size,0);assert.equal(f.get('sisventas/gastos/g').montoPagado,0);});
