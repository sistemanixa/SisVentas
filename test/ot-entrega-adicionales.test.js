const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(ot,permission=true){
 ot.fbKey=ot.fbKey||'ficticia';
 const buttons={}; for(const id of ['ot-materiales','ot-btn-entregar-materiales','ot-btn-todo-instalado'])buttons[id]={style:{}};
 let saved=0,prompt='',chosenRows=[];
 const c={window:{otData:[ot],otActualId:ot.id,prodData:{},tienePermiso:()=>permission,currentUser:'Admin',currentUserUid:'fiction',fbAuth:{currentUser:{uid:'fiction'}},crypto:{randomUUID:()=> 'receipt-fiction'},fbDB:{},fbRef:(_,p)=>p,SVGuardedWrites:{restTransaction:async(_,transform)=>{const value=transform(JSON.parse(JSON.stringify(ot)));saved++;return {committed:true,value};}},svConfirm:async text=>{prompt=text;return true;},fbGuardarOT:async()=>{saved++;},notify:()=>{},otEstaCerrada:o=>o.estado==='completada',scrollTo:()=>{}},document:{getElementById:id=>buttons[id]||null,body:{},documentElement:{}},requestAnimationFrame:()=>{}};
 // Unit boundary only: server authority and availability have their own real
 // command/guard chain. This fixture must not exercise the retired SDK path.
 c.window.currentRole='admin';c.window.SVCommercialMoney=require('../js/core/commercial-money.v1');
 c.window.SVOTDeliverySelection={choose:async({rows,valid})=>{assert.equal(valid(),true);chosenRows=JSON.parse(JSON.stringify(rows));return rows.map(r=>({index:r.index,cantidad:r.pending}));}};
 c.window.SVOTLifecycle={prepare:async()=>true,save:async(baseline,draft,{kind})=>{assert.equal(kind,'delivery');assert.ok(Array.isArray(draft.entregas));const next=c.window.SVOTDeliveryReceipt.prepare(JSON.parse(JSON.stringify(ot)),baseline,{id:'receipt-fiction',ts:1,usuario:'Admin',uid:'fiction',onlyAdditional:ot.estado==='completada'});saved++;return{confirmed:true,ot:next};}};
 c.window.SVGuardedWrites.restTransaction=()=>assert.fail('Delivery must not use SDK');
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/ot-material-custody.js','utf8'),c);
 return {w:c.window,buttons,saved:()=>saved,prompt:()=>prompt,selection:()=>chosenRows};
}
for(const closed of [false,true])test('entrega adicionales conserva rendición previa; cerrada='+closed,async()=>{
 const old={cod:'A',desc:'Equipo',vendida:1,entregada:1,instalada:1,custodiaActiva:true,custodiaClasificada:true};
 const ot={id:'OT-137',tecnico:'Osmar',estado:closed?'completada':'pendiente',custodiaIniciada:true,custodiaRendida:true,materiales:[old,{cod:'B',desc:'Llavero',vendida:2,adicionalOT:true}]};
 const x=setup(ot);x.w.otCustodiaRenderMateriales(ot,ot.materiales);assert.equal(x.buttons['ot-btn-entregar-materiales'].style.display,'');await x.w.otCustodiaEntregar();assert.equal(x.saved(),1);assert.deepEqual(ot.materiales[0],old);assert.equal(ot.materiales[1].entregada,2);assert.equal(ot.custodiaRendida,false);assert.deepEqual(x.selection().map(r=>[r.index,r.pending,r.unit]),[[1,2,'unidades']]);await x.w.otCustodiaEntregar();assert.equal(x.saved(),1);
});
test('incremento de cantidad entrega solo diferencia y conserva instalada',async()=>{const ot={id:'1',tecnico:'Osmar',materiales:[{cod:'A',desc:'Equipo',vendida:3,entregada:2,instalada:2,custodiaActiva:true,adicionalOT:true}]};const x=setup(ot);await x.w.otCustodiaEntregar();assert.deepEqual(x.selection().map(r=>[r.index,r.pending]),[[0,1]]);assert.equal(ot.materiales[0].instalada,2);assert.equal(ot.materiales[0].entregada,3);});
test('sin permiso no registra entrega',async()=>{const ot={id:'1',tecnico:'Osmar',materiales:[{cod:'A',desc:'Equipo',vendida:1}]};const x=setup(ot,false);await x.w.otCustodiaEntregar();assert.equal(x.saved(),0);});
