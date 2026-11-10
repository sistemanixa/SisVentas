const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(ot,permission=true){
 ot.fbKey=ot.fbKey||'ficticia';ot.ventaFbKey=ot.ventaFbKey||'sale';
 const buttons={}; for(const id of ['ot-materiales','ot-btn-entregar-materiales','ot-btn-todo-instalado'])buttons[id]={style:{}};
 let saved=0,prompt='',chosenRows=[];
 const c={window:{otData:[ot],otActualId:ot.id,prodData:{},tienePermiso:()=>permission,currentUser:'Admin',currentUserUid:'fiction',fbAuth:{currentUser:{uid:'fiction'}},crypto:{randomUUID:()=> 'receipt-fiction'},fbDB:{},fbRef:(_,p)=>p,svConfirm:async text=>{prompt=text;return true;},fbGuardarOT:async()=>assert.fail('OFF delivery must not use general OT saving'),notify:()=>{},otEstaCerrada:o=>o.estado==='completada',scrollTo:()=>{}},document:{getElementById:id=>buttons[id]||null,body:{},documentElement:{}},requestAnimationFrame:()=>{}};
 // Real atomic delivery planner, with fictional storage and transport only.
 const Model=require('../cotizador/ot-delivery-model'),crypto=require('node:crypto');
 c.window.currentRole='admin';c.window.SVCommercialMoney=require('../js/core/commercial-money.v1');
 const inventory={},catalog={};
 for(const [index,row]of ot.materiales.entries()){
  row.entregada??=0;row.instalada??=0;row.devuelta??=0;row.productoKey='product'+index;
  const consumed=Number(row.instalada||0),receipt=crypto.createHash('sha256').update('fixture-row-'+index).digest('hex');
  if(consumed>0){row.stockRegistro=receipt;row.stockRevision=1;}
  inventory[row.productoKey]={general:10,reservado:Math.max(0,row.entregada-consumed),consumido:consumed,asignaciones:{sale:{reservado:Math.max(0,row.entregada-consumed),consumido:consumed,liberado:0}},rendicionesOT:consumed>0?{[receipt]:{ot:ot.fbKey,venta:'sale',revision:1,instalada:consumed,deReserva:0,deGeneral:consumed,enReserva:0}}:{}};
  catalog[row.productoKey]={nombre:row.desc,unidad:'unidades'};
 }
 let remote=structuredClone(ot),inv=inventory;
 c.window.SVRecordListWrites={transaction:()=>assert.fail('No OT-only transaction')};
 c.window.SVGuardedWrites={restTransaction:()=>assert.fail('No OT-only transaction')};
 c.window.fbRunTransaction=()=>assert.fail('No browser inventory transaction');
 c.window.SVOTLifecycle={prepare:async()=>({atomicStock:true}),save:async(before,draft,options)=>{
  assert.equal(options.kind,'delivery');
  const planned=Model.plan({ot:remote,otKey:ot.fbKey,items:draft.entregas.map(row=>({index:row.index,qty:row.cantidad})),others:{[ot.fbKey]:structuredClone(remote)},inventory:inv,catalog,actor:{uid:'fiction',role:'admin',name:'Admin'},operationId:'fixture-delivery-'+(saved+1),at:1,atomicStock:true});
  chosenRows=planned.receipt.items.map(row=>({index:row.index,pending:row.cantidad,unit:row.unidad}));
  for(const row of chosenRows)assert.equal(row.pending,c.window.SVCommercialMoney.quantitySum([planned.ot.materiales[row.index].entregada,-remote.materiales[row.index].entregada]));
  remote=planned.ot;inv=planned.inventory;saved++;return{confirmed:true,ot:structuredClone(remote)};
 }};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/core/guarded-writes.js','utf8'),c);vm.runInContext(fs.readFileSync('js/modules/ot-material-custody.js','utf8'),c);
 return {w:c.window,buttons,saved:()=>saved,prompt:()=>prompt,selection:()=>chosenRows};
}
for(const closed of [false,true])test('entrega adicionales conserva rendición previa; cerrada='+closed,async()=>{
 const old={cod:'A',desc:'Equipo',vendida:1,entregada:1,instalada:1,custodiaActiva:true,custodiaClasificada:true};
 const ot={id:'OT-137',tecnico:'Osmar',estado:closed?'completada':'pendiente',custodiaIniciada:true,custodiaRendida:true,materiales:[old,{cod:'B',desc:'Llavero',vendida:2,adicionalOT:true}]};
 const x=setup(ot);x.w.otCustodiaRenderMateriales(ot,ot.materiales);assert.equal(x.buttons['ot-btn-entregar-materiales'].style.display,'');await x.w.otCustodiaEntregar();assert.equal(x.saved(),1);assert.deepEqual(ot.materiales[0],old);assert.equal(ot.materiales[1].entregada,2);assert.equal(ot.custodiaRendida,false);assert.deepEqual(x.selection().map(r=>[r.index,r.pending,r.unit]),[[1,2,'unidades']]);await x.w.otCustodiaEntregar();assert.equal(x.saved(),1);
});
test('incremento de cantidad entrega solo diferencia y conserva instalada',async()=>{const ot={id:'1',tecnico:'Osmar',materiales:[{cod:'A',desc:'Equipo',vendida:3,entregada:2,instalada:2,custodiaActiva:true,adicionalOT:true}]};const x=setup(ot);await x.w.otCustodiaEntregar();assert.deepEqual(x.selection().map(r=>[r.index,r.pending]),[[0,1]]);assert.equal(ot.materiales[0].instalada,2);assert.equal(ot.materiales[0].entregada,3);});
test('sin permiso no registra entrega',async()=>{const ot={id:'1',tecnico:'Osmar',materiales:[{cod:'A',desc:'Equipo',vendida:1}]};const x=setup(ot,false);await x.w.otCustodiaEntregar();assert.equal(x.saved(),0);});
