'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

// Transporte exclusivamente en memoria: estos casos nunca borran presupuestos reales.
function setup(options={}){
 const calls={events:[],confirmations:[],messages:[],removed:[],renders:[],closed:0,loaders:[],reads:0};
 const first={fbKey:'budget-a',id:'PP-0010',cliente:'Cliente ficticio A',total:100},second={fbKey:'budget-b',id:'PP-0010',cliente:'Cliente ficticio B',total:200};
 const persisted={'budget-a':plain(first),'budget-b':plain(second)};
 let allowed=options.allowed!==false;
 const nodes={
  'page-presupuesto':{classList:{contains:name=>name==='active'}},
  'ppto-list-view':{style:{display:options.detail?'none':'block'}},
  'ppto-detalle-view':{style:{display:options.detail?'block':'none'}},
  'ppto-form-view':{style:{display:'none'}},
  'ppto-buscar':{value:'Cliente ficticio'},'filtro-estado-ppto':{value:'aprobado_int'},
  'ppto-mostrar-vencidos':{checked:true}
 };
 const c={window:null,Map,Promise,console:{error(){},warn(){}},setTimeout,requestAnimationFrame:fn=>setImmediate(fn),
  currentUserUid:'owner',currentUser:'Administrador ficticio',currentRole:'admin',fbAuth:{currentUser:{uid:'owner'}},PERMISOS_ROLES:{admin:{indiceRevision:4},administrativo:{indiceRevision:2}},
  fbDB:{},FB_PATHS:{presupuestos:'sisventas/presupuestos'},pptoData:[plain(first),plain(second)],pptoActualId:options.detail?'budget-a':null,_pptoEliminaciones:new Map(),
  document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>[],dispatchEvent(){},activeElement:null},
  tienePermiso:action=>action==='presupuestos.eliminar'&&allowed,
  notify:message=>{calls.events.push('notify');calls.messages.push(message);},
  svConfirm:async(message,settings)=>{calls.events.push('confirm');calls.confirmations.push({message,settings});await options.confirm?.(c);return options.accept!==false;},
  buscarPptoPorRef:ref=>{const exact=c.pptoData.find(p=>p.fbKey===ref);if(exact)return exact;const same=c.pptoData.filter(p=>p.id===ref);return same.length===1?same[0]:null;},
  pptoV3Invocar:(_method,_args,fallback)=>fallback(),
  fbRef:(_db,path)=>path,
  fbGet:async()=>{calls.reads++;throw Error('No debe consultar registros comerciales');},
  fetch:async()=>{calls.reads++;throw Error('No debe consultar la red');},
  fbRemove:async path=>{calls.events.push('write');calls.removed.push(path);await options.write?.(c);if(options.writeError)throw Error('Rechazo ficticio de escritura');delete persisted[path.split('/').pop()];},
  renderPptoTabla:(...args)=>{calls.events.push('render');calls.renders.push({args,uid:c.currentUserUid,rows:plain(c.pptoData),search:nodes['ppto-buscar'].value,filter:nodes['filtro-estado-ppto'].value,expired:nodes['ppto-mostrar-vencidos'].checked});},
  volverListaPpto:()=>{calls.closed++;nodes['ppto-detalle-view'].style.display='none';nodes['ppto-list-view'].style.display='block';c.pptoActualId=null;c.renderPptoTabla();},
  cerrarMenusPpto(){},cerrarMenuPptoGlobal(){},marcarDashboardDatosSucios(){},solicitarRenderDashboard(){},
  SisVentas:{carga:{mostrar:(message,settings)=>{const entry={message,settings,closed:0};calls.loaders.push(entry);calls.events.push('loading');return ()=>{entry.closed++;calls.events.push('loading-ended');};}}}
 };
 c.window=c;
 c.SVCommercialOwnership={
  captureWriteContext:()=>({user:c.fbAuth.currentUser,uid:c.currentUserUid,role:c.currentRole,revision:c.PERMISOS_ROLES[c.currentRole]?.indiceRevision}),
  isWriteContext:context=>!!context&&!!context.user&&context.user.uid===context.uid&&context.user===c.fbAuth.currentUser&&context.uid===c.currentUserUid&&context.role===c.currentRole&&context.revision===c.PERMISOS_ROLES[c.currentRole]?.indiceRevision,
  confirmDelete:(_domain,id,context)=>{if(!c.SVCommercialOwnership.isWriteContext(context))throw Error('La sesión cambió');calls.events.push('ack');c.pptoData=c.pptoData.filter(p=>p.fbKey!==id);},
  refresh:()=>{calls.reads++;throw Error('No debe descargar de nuevo el listado');}
 };
 load(c,['_pptoEliminacionEnCurso','_eliminarPptoConConfirmacion','eliminarPptoDesdeTabla','eliminarPpto','pptoPersistirEliminar']);
 return {c,calls,nodes,persisted,revoke:()=>{allowed=false;}};
}

for(const entry of ['eliminarPptoDesdeTabla','eliminarPpto'])test(entry+' espera confirmación, muestra actividad y quita sólo la clave confirmada antes de avisar éxito',async()=>{
 const f=setup();await f.c[entry]('budget-a');
 assert.deepEqual(f.calls.removed,['sisventas/presupuestos/budget-a']);
 assert.deepEqual(plain(f.c.pptoData).map(p=>p.fbKey),['budget-b']);assert.ok(f.persisted['budget-b']);
 assert.equal(f.calls.confirmations.length,1);assert.equal(f.calls.loaders.length,1);assert.match(f.calls.loaders[0].message,/Eliminando presupuesto/);assert.equal(f.calls.loaders[0].closed,1);
 assert.ok(f.calls.events.indexOf('loading')<f.calls.events.indexOf('write'));assert.ok(f.calls.events.indexOf('ack')<f.calls.events.indexOf('notify'));assert.ok(f.calls.events.slice(f.calls.events.indexOf('ack')+1,f.calls.events.indexOf('notify')).includes('render'));
 assert.deepEqual(f.calls.renders.at(-1).rows.map(p=>p.fbKey),['budget-b']);assert.match(f.calls.messages.at(-1),/Presupuesto eliminado/);assert.equal(f.calls.reads,0);
 assert.equal(f.nodes['ppto-buscar'].value,'Cliente ficticio');assert.equal(f.nodes['filtro-estado-ppto'].value,'aprobado_int');assert.equal(f.nodes['ppto-mostrar-vencidos'].checked,true);
});

test('cancelar no muestra actividad, no escribe y conserva todas las filas',async()=>{
 const f=setup({accept:false});await f.c.eliminarPptoDesdeTabla('budget-a');assert.equal(f.calls.removed.length,0);assert.equal(f.calls.loaders.length,0);assert.equal(f.c.pptoData.length,2);assert.equal(f.calls.messages.length,0);
});

test('permiso denegado, sesión ausente o Ver como impiden confirmar y borrar',async()=>{
 for(const [allowed,change]of [[false,()=>{}],[true,c=>{c.fbAuth.currentUser=null;}],[true,c=>{c.currentUserUid='impersonated';}]]){
  const f=setup({allowed});change(f.c);await f.c.eliminarPptoDesdeTabla('budget-a');assert.equal(f.calls.confirmations.length,0);assert.equal(f.calls.removed.length,0);assert.equal(f.c.pptoData.length,2);
 }
});

for(const [name,change]of [
 ['Auth',c=>{c.fbAuth.currentUser={uid:'owner'};}],['UID',c=>{c.currentUserUid='another';}],['rol',c=>{c.currentRole='administrativo';}],['revisión',c=>{c.PERMISOS_ROLES.admin.indiceRevision++;}],['permiso',c=>{c.tienePermiso=()=>false;}]
])test('cambiar '+name+' durante la confirmación impide iniciar el borrado',async()=>{
 const f=setup({confirm:change});await f.c.eliminarPptoDesdeTabla('budget-a');assert.equal(f.calls.removed.length,0);assert.equal(f.calls.loaders.length,0);assert.equal(f.c.pptoData.length,2);assert.ok(!f.calls.messages.some(m=>/Presupuesto eliminado/.test(m)));
});

test('doble clic durante confirmación y durante escritura comparte un único intento',async()=>{
 const confirming=deferred(),writing=deferred();const f=setup({confirm:()=>confirming.promise,write:()=>writing.promise});
 const first=f.c.eliminarPptoDesdeTabla('budget-a');await turn();const second=f.c.eliminarPpto('budget-a');await turn();assert.equal(f.calls.confirmations.length,1);assert.equal(f.calls.removed.length,0);
 confirming.resolve();await turn();const third=f.c.eliminarPptoDesdeTabla('budget-a');await turn();assert.equal(f.calls.removed.length,1);assert.equal(f.calls.loaders.length,1);assert.equal(f.c.pptoData.length,2);assert.ok(!f.calls.messages.some(m=>/Presupuesto eliminado/.test(m)));
 writing.resolve();await Promise.all([first,second,third]);assert.equal(f.c.pptoData.length,1);assert.equal(f.calls.loaders[0].closed,1);
});

test('rechazo conserva la fila y permite otro intento sin anunciar éxito falso',async()=>{
 const f=setup({writeError:true});await f.c.eliminarPptoDesdeTabla('budget-a');assert.equal(f.c.pptoData.length,2);assert.ok(f.persisted['budget-a']);assert.equal(f.calls.loaders[0].closed,1);assert.ok(!f.calls.messages.some(m=>/Presupuesto eliminado/.test(m)));assert.match(f.calls.messages.at(-1),/Rechazo ficticio/);
 await f.c.eliminarPptoDesdeTabla('budget-a');assert.equal(f.calls.removed.length,2);assert.equal(f.calls.confirmations.length,2);
});

test('sin Internet no encola el borrado ni anuncia éxito; recuperar conexión exige un reintento explícito',async()=>{
 const f=setup();f.c.navigator={onLine:false};await f.c.eliminarPptoDesdeTabla('budget-a');
 assert.equal(f.calls.removed.length,0);assert.ok(f.persisted['budget-a']);assert.equal(f.c.pptoData.length,2);assert.equal(f.calls.loaders[0].closed,1);assert.match(f.calls.messages.at(-1),/Sin conexión/);assert.ok(!f.calls.messages.some(m=>/Presupuesto eliminado/.test(m)));
 f.c.navigator.onLine=true;await turn();await turn();assert.equal(f.calls.removed.length,0);assert.equal(f.calls.confirmations.length,1);
 await f.c.eliminarPptoDesdeTabla('budget-a');assert.deepEqual(f.calls.removed,['sisventas/presupuestos/budget-a']);assert.equal(f.calls.confirmations.length,2);assert.equal(f.c.pptoData.length,1);assert.match(f.calls.messages.at(-1),/Presupuesto eliminado/);assert.equal(f.calls.reads,0);
});

test('eliminar desde el detalle vuelve a la lista y conserva sus filtros',async()=>{
 const f=setup({detail:true});await f.c.eliminarPpto('budget-a');assert.equal(f.calls.closed,1);assert.equal(f.c.pptoActualId,null);assert.equal(f.nodes['ppto-detalle-view'].style.display,'none');assert.equal(f.nodes['ppto-list-view'].style.display,'block');assert.equal(f.nodes['ppto-buscar'].value,'Cliente ficticio');
});

test('si se abrió otro detalle mientras confirma, no lo cierra al terminar',async()=>{
 const f=setup({detail:true,write:c=>{c.pptoActualId='budget-b';}});await f.c.eliminarPpto('budget-a');assert.equal(f.calls.closed,0);assert.equal(f.c.pptoActualId,'budget-b');assert.equal(f.nodes['ppto-detalle-view'].style.display,'block');assert.ok(f.c.pptoData.some(p=>p.fbKey==='budget-b'));
});

test('si se navegó a otro módulo durante el borrado, el acuse no vuelve a abrir ni renderizar Presupuestos',async()=>{
 const f=setup({detail:true,write:()=>{f.nodes['page-presupuesto'].classList.contains=()=>false;}});
 await f.c.eliminarPpto('budget-a');assert.equal(f.calls.closed,0);assert.deepEqual(plain(f.c.pptoData).map(p=>p.fbKey),['budget-b']);assert.equal(f.calls.renders.length,0);assert.equal(f.calls.loaders[0].closed,1);assert.match(f.calls.messages.at(-1),/Presupuesto eliminado/);
});

test('abrir un formulario nuevo durante la eliminación conserva su identidad, campos y vista sin renderizar la lista oculta',async()=>{
 const f=setup({detail:true,write:c=>{
  f.nodes['ppto-detalle-view'].style.display='none';f.nodes['ppto-list-view'].style.display='none';f.nodes['ppto-form-view'].style.display='block';
  c._pptoEditandoFbKey=null;c._pptoEditandoId=null;c._pptoEditorBase=null;
  f.nodes['pp-numero']={value:'PP-NUEVO'};f.nodes['pp-cli']={value:'Otro cliente ficticio'};f.nodes['pp-descuento']={value:'7.5'};
 }});
 await f.c.eliminarPpto('budget-a');assert.equal(f.calls.closed,0);assert.equal(f.calls.renders.length,0);assert.equal(f.nodes['ppto-form-view'].style.display,'block');assert.equal(f.nodes['ppto-list-view'].style.display,'none');assert.equal(f.nodes['ppto-detalle-view'].style.display,'none');
 assert.equal(f.c._pptoEditandoFbKey,null);assert.equal(f.c._pptoEditandoId,null);assert.equal(f.c._pptoEditorBase,null);assert.equal(f.nodes['pp-numero'].value,'PP-NUEVO');assert.equal(f.nodes['pp-cli'].value,'Otro cliente ficticio');assert.equal(f.nodes['pp-descuento'].value,'7.5');
 assert.deepEqual(plain(f.c.pptoData).map(p=>p.fbKey),['budget-b']);assert.equal(f.calls.loaders[0].closed,1);assert.match(f.calls.messages.at(-1),/Presupuesto eliminado/);
});

for(const failure of [false,true])test('respuesta '+(failure?'fallida':'exitosa')+' de otra sesión no toca sus filas, detalle ni avisos',async()=>{
 const f=setup({detail:true,writeError:failure,write:c=>{c.currentUserUid='new-owner';c.fbAuth.currentUser={uid:'new-owner'};c.pptoData=[{fbKey:'new-budget',id:'PP-NUEVO'}];c.pptoActualId='new-budget';}});
 await f.c.eliminarPpto('budget-a');assert.deepEqual(plain(f.c.pptoData),[{fbKey:'new-budget',id:'PP-NUEVO'}]);assert.equal(f.c.pptoActualId,'new-budget');assert.equal(f.calls.closed,0);assert.equal(f.calls.messages.length,0);assert.ok(f.calls.renders.every(render=>render.uid==='owner'));assert.equal(f.calls.loaders[0].closed,1);
});

test('número duplicado o referencia ausente nunca eligen otro presupuesto para eliminar',async()=>{
 for(const ref of ['PP-0010','missing','']){const f=setup();await f.c.eliminarPptoDesdeTabla(ref);assert.equal(f.calls.removed.length,0);assert.equal(f.calls.confirmations.length,0);assert.equal(f.c.pptoData.length,2);}
});
