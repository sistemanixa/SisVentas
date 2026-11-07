'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture({ot,role='admin',custodySource}={}){
 ot=ot||{fbKey:'ot-fiction',id:'OT-FICTION',estado:'pendiente',tecnico:'Técnico ficticio',progreso:100,materiales:[{cod:'CAM-F',desc:'Cámara ficticia',vendida:2,entregada:2,instalada:0,custodiaActiva:false}]};
 const nodes={},notes=[],writes=[],drafts=[],targets=[];for(const id of ['ot-materiales','ot-custodia-estado','ot-custodia-resumen','ot-btn-entregar-materiales','ot-btn-todo-instalado','ot-btn-excepciones'])nodes[id]={id,style:{},innerHTML:'',textContent:'',remove(){delete nodes[id];}};
 const w={otData:[ot],otActualId:ot.fbKey,currentRole:role,currentUserUid:'fiction',fbAuth:{currentUser:{uid:'fiction'}},fbDB:{},prodData:{},SVCommercialMoney:require('../../js/core/commercial-money.v1'),SVOTMaterialRows:require('../../js/modules/ot-material-rows.v1'),tienePermiso:()=>true,notify:m=>notes.push(m),svConfirm:async()=>true,SVOTLifecycle:{prepare:async()=>writes.push('prepare'),save:async()=>writes.push('save')},SisVentasCompras:{syncOTConsumption:async()=>writes.push('stock')}};
 w.SisVentasCompras.syncOTConsumption=async(_ot,_before,after)=>{writes.push('stock');targets.push(after.instalada);};w.fbGuardarOT=async draft=>{writes.push('save');drafts.push(JSON.parse(JSON.stringify(draft)));};w.scrollTo=()=>{};
 const c={window:w,document:{getElementById:id=>nodes[id]||null,createElement:()=>({style:{},remove(){}}),body:{},documentElement:{}},requestAnimationFrame:()=>{},console};vm.createContext(c);vm.runInContext(custodySource??fs.readFileSync(path.resolve(__dirname,'../../js/modules/ot-material-custody.js'),'utf8'),c);
 return {w,ot,nodes,notes,writes,drafts,targets,render:()=>w.otCustodiaRenderMateriales(ot)};
}
module.exports={fixture};
