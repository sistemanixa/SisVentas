const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(ot,permission=true){
 ot.fbKey=ot.fbKey||'ficticia';
 const buttons={}; for(const id of ['ot-materiales','ot-btn-entregar-materiales','ot-btn-todo-instalado'])buttons[id]={style:{}};
 let saved=0,prompt='',chosenRows=[];
 const c={window:{otData:[ot],otActualId:ot.id,prodData:{},tienePermiso:()=>permission,currentUser:'Admin',currentUserUid:'fiction',fbAuth:{currentUser:{uid:'fiction'}},crypto:{randomUUID:()=> 'receipt-fiction'},fbDB:{},fbRef:(_,p)=>p,svConfirm:async text=>{prompt=text;return true;},fbGuardarOT:async()=>assert.fail('OFF delivery must not use general OT saving'),notify:()=>{},otEstaCerrada:o=>o.estado==='completada',scrollTo:()=>{}},document:{getElementById:id=>buttons[id]||null,body:{},documentElement:{}},requestAnimationFrame:()=>{}};
 // OFF fixture: selection() observes quantities actually committed in the
 // material delta and receipt, not the unpublished partial-selector UI.
 const Model=require('../js/core/record-list-model');
 c.window.currentRole='admin';c.window.SVCommercialMoney=require('../js/core/commercial-money.v1');
 let remote=JSON.parse(JSON.stringify(ot));
 const sdk={
  ref:(_,path='')=>path,
  get:async path=>{assert.equal(path,'sisventas/ordenes_trabajo/'+ot.fbKey);const value=JSON.parse(JSON.stringify(remote));return{val:()=>value};},
  update:async(_,patch)=>{
   const path='sisventas/ordenes_trabajo/'+ot.fbKey,summary='sisventas/listados_resumen/ordenes_trabajo/'+ot.fbKey,value=patch[path];
   assert.deepEqual(Object.keys(patch).sort(),[path,summary].sort());
   assert.deepEqual(patch[summary],Model.summary('ordenes_trabajo',value));
   assert.equal(value._svListRevision,(remote._svListRevision||0)+1);
   assert.equal(value._svListOperation,patch[summary]._svListOperation);
   const added=Object.entries(value.remitosEntrega||{}).filter(([id])=>!remote.remitosEntrega?.[id]);
   assert.equal(added.length,1);
   chosenRows=value.materiales.flatMap((m,index)=>{
    const delta=c.window.SVCommercialMoney.quantitySum([Number(m.entregada)||0,-(Number(remote.materiales[index]?.entregada)||0)]);
    if(delta<=0)return [];
    const receipt=added[0][1].items.find(row=>row.codigo===(m.cod||m.codigo));
    assert(receipt);assert.equal(receipt.cantidad,delta);
    return [{index,pending:delta,unit:receipt.unidad}];
   });
   remote=JSON.parse(JSON.stringify(value));saved++;
  }
 };
 c.window.SVRecordListWrites=require('../js/core/operational-writes').create(c.window,Model);
 c.window.SVRecordListWrites.install({sdk});
 c.window.fetch=()=>assert.fail('OFF must use the atomic OT/summary adapter');
 c.window.SVOTLifecycle={prepare:()=>assert.fail('OFF must not request future delivery capability'),save:()=>assert.fail('OFF must not send future delivery command')};
 c.window.SVOTDeliverySelection={choose:()=>assert.fail('OFF must not open the future partial selector')};
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
