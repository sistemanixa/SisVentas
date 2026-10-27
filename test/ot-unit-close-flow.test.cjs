'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,functionSource}=require('./helpers/app-functions.cjs');

const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
const settle=async()=>{for(let index=0;index<12;index++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

// Sólo la coordinación del cierre real: los límites externos quedan en memoria.
// El controlador de unidades tiene su propia suite; ninguna prueba usa Firebase.
function fixture(options={}){
  const events=[],notices=[],writes=[],salesWrites=[],review=deferred(),save=deferred(),sync=deferred();
  const financial={pagos:{pago:{monto:125,fecha:'2026-10-01'}},comisiones:{comision:{monto:25,estado:'pendiente'}},garantias:{existente:{fechaVenc:'2027-01-31',serie:'SERIE-PREVIA'}}};
  const financialBefore=copy(financial);
  const ot={fbKey:'ot-demo',id:'OT-DEMO',estado:'en_curso',ventaFbKey:'venta-demo',tecnico:'Técnico ficticio',checks:{preparacion:[true],instalacion:[true],verificacion:[true]},audit:[{accion:'Historia anterior'}]};
  const sale={fbKey:'venta-demo',id:'V-DEMO',estadoInst:'en_instalacion',items:[{cod:'EQ-DEMO',qty:1}],total:125};
  const nodes={
    'ot-acta-conf':{value:'Conforme'},'ot-acta-firma':{value:'Persona ficticia'},'ot-acta-obs':{value:''},
    'ot-foto-input':{dataset:{}},'btn-completar-ot':{disabled:false},'ot-det-estado-badge':{innerHTML:''}
  };
  const c={Date,Promise,console:{error(){},warn(){}},currentUser:'Técnico ficticio',currentUserUid:'uid-demo',currentRole:'tecnico',
    fbAuth:{currentUser:{uid:'uid-demo'}},fbDB:{},otActualId:ot.fbKey,otData:[ot],ventasList:[sale],_firmaGuardando:false,
    document:{getElementById:id=>nodes[id]||null},
    notify:message=>notices.push(message),
    otEstaCerrada:row=>['completada','con_observaciones'].includes(row.estado),
    normalizarChecklistOT(){events.push('normalizar');},
    auditarIntegridadOT(){events.push('integridad');return {bloqueos:[]};},
    actualizarPanelIntegridadOT(){events.push('panel-integridad');},
    otCustodiaValidarCierre(){events.push('custodia');return {ok:true,conObservaciones:false};},
    otNotasNormalizadas(){events.push('fotos');return options.noPhoto?[]:[{fotoUrl:'https://example.invalid/foto-ficticia.jpg'}];},
    svConfirm:async()=>{events.push('confirmar-sin-foto');return options.confirmNoPhoto!==false;},
    otWizardIr:step=>events.push('paso:'+step),
    otCustodiaAbrirExcepciones:()=>events.push('excepciones'),
    tienePermiso:()=>options.permission!==false,
    garantiaRevisarCierreOT:row=>{assert.equal(row,ot);events.push('revisar-unidades');return review.promise;},
    garantiaAbrirUnidades(){assert.fail('El cierre no debe abrir otra confirmación después de guardarse');},
    fbGuardarOT:row=>{events.push('guardar-ot');writes.push(copy(row));return save.promise;},
    _svResolverVentaRegistro:row=>row===ot?sale:null,
    ventaDetalleRepararVinculoOT:(row,settings)=>{assert.equal(row,sale);assert.equal(settings.persistir,true);assert.equal(settings.otForzada.fbKey,ot.fbKey);events.push('sincronizar-vinculo');return sync.promise;},
    ventasPagosPersistirActualizarVenta:(key,changes)=>{events.push('sincronizar-estado');salesWrites.push({key,changes:copy(changes)});return Promise.resolve();},
    svCrearProgresoBoton:()=>({actualizar:()=>{},finalizar:()=>events.push('fin-progreso')}),
    otBadge:state=>state,
    volverListaOT:()=>events.push('volver-lista'),
    fbGet(){assert.fail('El coordinador no debe descargar registros adicionales');},
    fbUpdate(){assert.fail('El coordinador debe conservar los caminos de persistencia existentes');},
    fbRunTransaction(){assert.fail('El coordinador no debe generar equipos o comisiones por su cuenta');}
  };
  c.window=c;
  load(c,['completarOT']);
  return {c,ot,sale,nodes,events,notices,writes,salesWrites,review,save,sync,financial,financialBefore};
}

test('el cierre valida la OT y espera la decisión por unidad antes de guardar o sincronizar',async()=>{
  const f=fixture({noPhoto:true}),task=f.c.completarOT();
  let completed=false;task.then(()=>{completed=true;});
  await settle();
  assert.deepEqual(f.events,['normalizar','integridad','custodia','fotos','confirmar-sin-foto','revisar-unidades']);
  assert.equal(f.writes.length,0);assert.equal(f.salesWrites.length,0);assert.equal(f.ot.estado,'en_curso');
  f.review.resolve({registered:1,preserved:0,reviewed:0});await settle();
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].estado,'completada');
  assert.equal(completed,false,'La promesa conserva el cierre en curso hasta su acuse');
  assert.equal(f.events.includes('sincronizar-vinculo'),false,'La revisión no sustituye el acuse del cierre');
  f.save.resolve();await settle();
  assert.ok(f.events.indexOf('guardar-ot')<f.events.indexOf('sincronizar-vinculo'));
  assert.ok(f.events.indexOf('guardar-ot')<f.events.indexOf('sincronizar-estado'));
  assert.equal(f.events.includes('volver-lista'),false,'El listado espera la sincronización existente');
  assert.equal(completed,false,'La promesa espera también la sincronización posterior');
  f.sync.resolve();await task;await settle();
  assert.equal(completed,true);
  assert.equal(f.ot.estado,'completada');assert.equal(f.events.filter(event=>event==='volver-lista').length,1);
  assert.deepEqual(f.salesWrites,[{key:'venta-demo',changes:{estadoInst:'instalado'}}]);
  assert.deepEqual(f.financial,f.financialBefore,'Pagos, comisiones y garantías anteriores quedan intactos');
  assert.equal(f.sale.total,125);
});

for(const result of [null,false])test('cancelar la revisión con '+String(result)+' no cierra ni sincroniza la OT',async()=>{
  const f=fixture(),before=copy(f.ot),task=f.c.completarOT();await settle();
  f.review.resolve(result);await task;await settle();
  assert.equal(f.writes.length,0);assert.equal(f.salesWrites.length,0);assert.deepEqual(f.ot,before);
  assert.equal(f.events.includes('volver-lista'),false);assert.deepEqual(f.financial,f.financialBefore);
});

test('un error preparando unidades informa el problema sin cerrar ni guardar la OT',async()=>{
  const f=fixture(),before=copy(f.ot),task=f.c.completarOT();await settle();
  f.review.reject(new Error('Revisión ficticia no disponible'));
  await task;await settle();
  assert.equal(f.writes.length,0);assert.equal(f.salesWrites.length,0);assert.deepEqual(f.ot,before);
  assert.equal(f.events.includes('volver-lista'),false);
  assert.ok(f.notices.some(message=>/Revisión ficticia no disponible/.test(message)));
});

const blockingCases=[
  ['integridad',f=>{f.c.auditarIntegridadOT=()=>({bloqueos:[{area:'Datos',texto:'Falta información ficticia'}]});}],
  ['checklist',f=>{f.ot.checks.instalacion[0]=false;}],
  ['foto subiendo',f=>{f.nodes['ot-foto-input'].dataset.subiendo='1';}],
  ['firma guardándose',f=>{f.c._firmaGuardando=true;}],
  ['custodia',f=>{f.c.otCustodiaValidarCierre=()=>({ok:false,requiereEntrega:false,message:'Materiales pendientes'});}],
  ['conformidad',f=>{f.nodes['ot-acta-conf'].value='';}],
  ['foto rechazada',()=>{}, {noPhoto:true,confirmNoPhoto:false}],
  ['ya cerrada',f=>{f.ot.estado='completada';}]
];
for(const [name,change,options] of blockingCases)test('el bloqueo previo de '+name+' no abre ni confirma unidades',async()=>{
  const f=fixture(options);change(f);await f.c.completarOT();await settle();
  assert.equal(f.events.includes('revisar-unidades'),false);assert.equal(f.writes.length,0);assert.equal(f.salesWrites.length,0);
  assert.deepEqual(f.financial,f.financialBefore);
});

test('el resultado skip explícito permite el cierre autorizado sin generar unidades ni exigir permiso nuevo',async()=>{
  const f=fixture({permission:false}),task=f.c.completarOT();await settle();
  f.review.resolve({skip:true});await settle();assert.equal(f.writes.length,1);
  f.save.resolve();await settle();f.sync.resolve();await task;await settle();
  assert.equal(f.ot.estado,'completada');assert.deepEqual(f.financial,f.financialBefore);
});

test('la revisión parcial conserva la venta en instalación aunque termine el cierre técnico',async()=>{
  const f=fixture(),task=f.c.completarOT();await settle();
  f.review.resolve({registered:1,preserved:0,reviewed:1,estadoInst:'en_instalacion'});await settle();
  f.save.resolve();await settle();f.sync.resolve();await task;await settle();
  assert.equal(f.ot.estado,'completada');assert.equal(f.sale.estadoInst,'en_instalacion');
  assert.deepEqual(f.salesWrites,[],'No se marca instalada una venta con unidades pendientes');
  assert.deepEqual(f.financial,f.financialBefore);
});

test('las unidades existentes completas permiten sincronizar instalada sin reabrir su cobertura',async()=>{
  const f=fixture(),task=f.c.completarOT();await settle();
  f.review.resolve({registered:0,preserved:1,reviewed:0,estadoInst:'instalado'});await settle();
  f.save.resolve();await settle();f.sync.resolve();await task;await settle();
  assert.equal(f.ot.estado,'completada');assert.deepEqual(f.salesWrites,[{key:'venta-demo',changes:{estadoInst:'instalado'}}]);
  assert.deepEqual(f.financial,f.financialBefore);
});

test('un fallo al guardar el cierre conserva la OT abierta y no sincroniza la venta',async()=>{
  const f=fixture(),task=f.c.completarOT();await settle();f.review.resolve({registered:0,preserved:1,reviewed:0});await settle();
  f.save.reject(new Error('Guardado ficticio rechazado'));await task;await settle();
  assert.equal(f.ot.estado,'en_curso');assert.equal(f.salesWrites.length,0);assert.equal(f.events.includes('volver-lista'),false);
  assert.ok(f.notices.some(message=>/Guardado ficticio rechazado/.test(message)));assert.deepEqual(f.financial,f.financialBefore);
});

test('si falla la sincronización posterior se conserva el cierre y se informa el pendiente',async()=>{
  const f=fixture(),task=f.c.completarOT();await settle();f.review.resolve({registered:0,preserved:1,reviewed:0});await settle();
  f.save.resolve();await settle();f.sync.reject(new Error('Sincronización ficticia rechazada'));await task;await settle();
  assert.equal(f.ot.estado,'completada');assert.ok(f.notices.some(message=>/pendiente de sincronización/i.test(message)));
  assert.equal(f.events.filter(event=>event==='volver-lista').length,1);assert.deepEqual(f.financial,f.financialBefore);
});

test('el cierre informa la revisión de garantía pendiente sólo después del acuse y conserva los históricos',async()=>{
  const f=fixture(),task=f.c.completarOT();await settle();
  f.review.resolve({registered:[],preserved:[],reviewed:['revision-demo'],estadoInst:'instalado',warrantyReviewPendingCount:1});await settle();
  assert.equal(f.notices.some(message=>/revisión pendiente/.test(message)),false,'Una revisión no confirma todavía el guardado de la OT');
  f.save.resolve();await settle();assert.equal(f.notices.some(message=>/revisión pendiente/.test(message)),false);
  f.sync.resolve();await task;await settle();
  assert.equal(f.ot.estado,'completada');
  assert.ok(f.notices.some(message=>/1 unidad quedó con revisión pendiente; no se creó equipo ni cobertura para ella/.test(message)));
  assert.equal(Object.hasOwn(f.writes[0],'warrantyReviewPendingCount'),false,'El aviso es transitorio, no un cambio de la OT');
  assert.deepEqual(f.financial,f.financialBefore);
});

test('la revisión técnica normal no inventa condiciones de garantía pendientes',async()=>{
  const f=fixture(),task=f.c.completarOT();await settle();
  f.review.resolve({registered:[],preserved:[],reviewed:['material-demo'],estadoInst:'en_instalacion'});await settle();
  f.save.resolve();await settle();f.sync.resolve();await task;await settle();
  assert.ok(f.notices.some(message=>/OT completada/.test(message)));
  assert.equal(f.notices.some(message=>/revisión pendiente/.test(message)),false);
  assert.deepEqual(f.financial,f.financialBefore);
});

test('el aviso conserva tanto el pendiente comercial como las condiciones de garantía por revisar',async()=>{
  const f=fixture(),task=f.c.completarOT();await settle();
  f.review.resolve({registered:[],preserved:[],reviewed:['revision-a','revision-b'],estadoInst:'en_instalacion',warrantyReviewPendingCount:2});await settle();
  f.save.resolve();await settle();f.sync.reject(new Error('Sincronización ficticia rechazada'));await task;await settle();
  assert.equal(f.ot.estado,'completada');
  assert.ok(f.notices.some(message=>/pendiente de sincronización/.test(message)&&/2 unidades quedaron con revisión pendiente/.test(message)));
  assert.deepEqual(f.financial,f.financialBefore);
});

test('el guardado general real de OT excluye unidadesConfirmacion y no repone una revisión vieja',async()=>{
  const saved=[],record={fbKey:'ot-demo',estado:'en_curso',unidadesConfirmacion:{previa:{serie:'Serie antigua'}},unidadesEstadoInstalacion:'en_instalacion'};
  const before=copy(record),c={Promise,Date,document:{getElementById:()=>null},fbDB:{},fbRef(){},fbUpdate(){},fbPush(){},
    otActualId:null,otPersistirGuardar:async value=>{saved.push(copy(value));return value;}};
  c.window=c;load(c,['fbGuardarOT']);await c.fbGuardarOT(record);
  assert.equal(saved.length,1);assert.equal(saved[0].fbKey,'ot-demo');assert.equal(saved[0].estado,'en_curso');
  assert.equal(Object.hasOwn(saved[0],'unidadesConfirmacion'),false);assert.equal(Object.hasOwn(saved[0],'unidadesEstadoInstalacion'),false);assert.deepEqual(record,before);
});

test('el cierre activo no vuelve a abrir automáticamente el modal luego de guardar',()=>{
  assert.doesNotMatch(functionSource('completarOT'),/garantiaAbrirUnidades\s*\(/);
});

test('dos intentos de cierre mientras se revisan unidades no duplican el guardado ni la sincronización',async()=>{
  const f=fixture(),one=f.c.completarOT(),two=f.c.completarOT();await settle();
  f.review.resolve({registered:1,preserved:0,reviewed:0,estadoInst:'instalado'});await settle();
  assert.equal(f.writes.length,1,'Una misma decisión no debe iniciar dos guardados del cierre');
  f.save.resolve();await settle();f.sync.resolve();await Promise.all([one,two]);await settle();
  assert.equal(f.events.filter(event=>event==='sincronizar-vinculo').length,1);
  assert.equal(f.salesWrites.length,1);assert.equal(f.events.filter(event=>event==='volver-lista').length,1);
  assert.deepEqual(f.financial,f.financialBefore);
});

for(const reason of ['cancelar','error'])test('el bloqueo de reentrada se libera tras '+reason+' y permite una nueva revisión explícita',async()=>{
  const f=fixture(),first=f.c.completarOT();await settle();
  if(reason==='cancelar')f.review.resolve(false);else f.review.reject(new Error('Revisión ficticia rechazada'));
  await first;await settle();assert.equal(f.writes.length,0);assert.equal(f.c._svOTCierresEnCurso.size,0);
  const secondReview=deferred();f.c.garantiaRevisarCierreOT=row=>{assert.equal(row,f.ot);f.events.push('revisar-unidades');return secondReview.promise;};
  const next=f.c.completarOT();await settle();assert.equal(f.events.filter(event=>event==='revisar-unidades').length,2);
  secondReview.resolve(false);await next;assert.equal(f.c._svOTCierresEnCurso.size,0);assert.equal(f.writes.length,0);assert.deepEqual(f.financial,f.financialBefore);
});

function withRealLinkRepair(f){
  const patches=[];
  f.c.FB_PATHS={ordenesTrabajo:'sisventas/ordenes_trabajo',ventas:'sisventas/ventas'};
  f.c.fbRef=(_db,path)=>path;
  f.c.fbUpdate=(_reference,patch)=>{patches.push(copy(patch));f.events.push('guardar-vinculo-real');return f.sync.promise;};
  f.c.ventaDetalleResolverOT=()=>f.ot;
  load(f.c,['_svTxtNombre','ventaDetalleOTFinalizada','ventaDetalleOTEnCurso','ventaDetalleRepararVinculoOT']);
  return patches;
}

test('cerrar parcialmente con el reparador real nunca persiste instalada la venta por otro PATCH',async()=>{
  const f=fixture(),patches=withRealLinkRepair(f),task=f.c.completarOT();await settle();
  f.review.resolve({registered:1,reviewed:1,estadoInst:'en_instalacion'});await settle();assert.equal(patches.length,0);
  f.save.resolve();await settle();
  assert.equal(patches.length,1);assert.equal(patches[0]['sisventas/ventas/venta-demo/estadoInst'],'en_instalacion');
  assert.equal(f.sale.estadoInst,'en_instalacion');assert.equal(f.ot.unidadesEstadoInstalacion,'en_instalacion');
  assert.equal(f.salesWrites.length,0,'El vínculo conserva el estado confirmado sin otra escritura contradictoria');
  assert.equal(Object.values(patches[0]).includes('instalado'),false);
  assert.equal(Object.keys(patches[0]).some(key=>/\/(?:pagos|gastos|comisiones_generacion)(?:\/|$)|\/(?:total|totalPagado|estadoPago)$/.test(key)),false);
  f.sync.resolve();await task;assert.deepEqual(f.financial,f.financialBefore);
});

test('una reparación posterior sin override usa la proyección persistida de unidades parciales',async()=>{
  const f=fixture(),patches=withRealLinkRepair(f);f.ot.estado='completada';f.ot.unidadesEstadoInstalacion='en_instalacion';f.sale.estadoInst='instalado';
  const task=f.c.ventaDetalleRepararVinculoOT(f.sale,{persistir:true,devolverPromesa:true});
  assert.equal(f.sale.estadoInst,'en_instalacion');assert.equal(patches[0]['sisventas/ventas/venta-demo/estadoInst'],'en_instalacion');
  assert.equal(Object.values(patches[0]).includes('instalado'),false);f.sync.resolve();await task;assert.deepEqual(f.financial,f.financialBefore);
});

test('el reparador real conserva el cálculo legacy si no hay proyección ni override confirmado',async()=>{
  const f=fixture(),patches=withRealLinkRepair(f);f.ot.estado='completada';
  const task=f.c.ventaDetalleRepararVinculoOT(f.sale,{persistir:true,devolverPromesa:true});
  assert.equal(f.sale.estadoInst,'instalado');assert.equal(patches[0]['sisventas/ventas/venta-demo/estadoInst'],'instalado');
  assert.equal(f.ot.unidadesEstadoInstalacion,undefined);f.sync.resolve();await task;assert.deepEqual(f.financial,f.financialBefore);
});

test('una OT vinculada sólo por ventaKey conserva la sincronización parcial con su venta original',async()=>{
  const f=fixture(),patches=withRealLinkRepair(f);delete f.ot.ventaFbKey;f.ot.ventaKey='venta-demo';
  const task=f.c.completarOT();await settle();f.review.resolve({registered:1,reviewed:1,estadoInst:'en_instalacion'});await settle();
  f.save.resolve();await settle();
  assert.equal(patches.length,1,'El alias técnico no debe omitir la sincronización de la venta');
  assert.equal(patches[0]['sisventas/ventas/venta-demo/estadoInst'],'en_instalacion');
  assert.equal(patches[0]['sisventas/ordenes_trabajo/ot-demo/ventaFbKey'],'venta-demo');
  assert.equal(f.sale.estadoInst,'en_instalacion');f.sync.resolve();await task;assert.deepEqual(f.financial,f.financialBefore);
});
