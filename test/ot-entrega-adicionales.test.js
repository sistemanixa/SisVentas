const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(ot,permission=true){
 const buttons={}; for(const id of ['ot-materiales','ot-btn-entregar-materiales','ot-btn-todo-instalado'])buttons[id]={style:{}};
 let saved=0,prompt='';
 const c={window:{otData:[ot],otActualId:ot.id,prodData:{},tienePermiso:()=>permission,currentUser:'Admin',svConfirm:async text=>{prompt=text;return true;},fbGuardarOT:async()=>{saved++;},notify:()=>{},otEstaCerrada:o=>o.estado==='completada',scrollTo:()=>{}},document:{getElementById:id=>buttons[id]||null,body:{},documentElement:{}},requestAnimationFrame:()=>{}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/ot-material-custody.js','utf8'),c);
 return {w:c.window,buttons,saved:()=>saved,prompt:()=>prompt};
}
for(const closed of [false,true])test('entrega adicionales conserva rendición previa; cerrada='+closed,async()=>{
 const old={cod:'A',desc:'Equipo',vendida:1,entregada:1,instalada:1,custodiaActiva:true,custodiaClasificada:true};
 const ot={id:'OT-137',tecnico:'Osmar',estado:closed?'completada':'pendiente',custodiaIniciada:true,custodiaRendida:true,materiales:[old,{cod:'B',desc:'Llavero',vendida:2,adicionalOT:true}]};
 const x=setup(ot);x.w.otCustodiaRenderMateriales(ot,ot.materiales);assert.equal(x.buttons['ot-btn-entregar-materiales'].style.display,'');await x.w.otCustodiaEntregar();assert.equal(x.saved(),1);assert.deepEqual(ot.materiales[0],old);assert.equal(ot.materiales[1].entregada,2);assert.equal(ot.custodiaRendida,false);assert.match(x.prompt(),/2 unidades en 1 renglón/);await x.w.otCustodiaEntregar();assert.equal(x.saved(),1);
});
test('incremento de cantidad entrega solo diferencia y conserva instalada',async()=>{const ot={id:'1',tecnico:'Osmar',materiales:[{cod:'A',desc:'Equipo',vendida:3,entregada:2,instalada:2,custodiaActiva:true,adicionalOT:true}]};const x=setup(ot);await x.w.otCustodiaEntregar();assert.match(x.prompt(),/1 unidades/);assert.equal(ot.materiales[0].instalada,2);assert.equal(ot.materiales[0].entregada,3);});
test('sin permiso no registra entrega',async()=>{const ot={id:'1',tecnico:'Osmar',materiales:[{cod:'A',desc:'Equipo',vendida:1}]};const x=setup(ot,false);await x.w.otCustodiaEntregar();assert.equal(x.saved(),0);});
