(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVOTActa=api;})(typeof window==='object'?window:null,function(){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
function plan(before,changes,actor,now){
 if(actor?.role!=='admin'||actor.impersonating||!actor.uid)throw Error('Sólo el administrador puede corregir un acta cerrada.');
 if(!before||!['completada','completado','finalizada','finalizado','con_observaciones','cerrada','cerrado','terminada','terminado'].includes(String(before.estado||'').toLowerCase()))throw Error('La OT ya no está cerrada. Volvé a abrirla.');
 if(Object.keys(changes).some(k=>!['nombreConformidad','observacionesCierre'].includes(k)))throw Error('La corrección sólo admite nombre y observaciones del acta.');
 const next=clone(before),modified=[];
 for(const [key,limit]of [['nombreConformidad',160],['observacionesCierre',4000]]){const value=String(changes[key]??before[key]??'').trim();if(value.length>limit)throw Error('El texto excede el espacio permitido.');if(value!==String(before[key]||'')){next[key]=value;modified.push(key);}}
 if(!modified.length)throw Error('No hay cambios para guardar.');
 if(before.audit!=null&&!Array.isArray(before.audit))throw Error('El historial requiere revisión antes de corregir el acta.');
 next.audit=(Array.isArray(before.audit)?clone(before.audit):[]).concat([{fecha:now,usuario:actor.name||'Administrador',uid:actor.uid,accion:'Datos del acta actualizados por administrador',campos:modified,anterior:Object.fromEntries(modified.map(k=>[k,before[k]??''])),nuevo:Object.fromEntries(modified.map(k=>[k,next[k]]))}]);return next;
}
let context=null,editing=false,busy=false,refresh=null;
function actor(){return {role:window.currentRole,uid:window.currentUserUid,name:window.currentUser,impersonating:!!window._impersonacionOriginal};}
function render(ot,afterSave){if(typeof document==='undefined')return;context=clone(ot);refresh=afterSave||null;editing=false;const name=document.getElementById('ot-acta-firma'),obs=document.getElementById('ot-acta-obs'),same=document.getElementById('ot-acta-sameclient'),panel=document.getElementById('ot-acta-correction'),button=document.getElementById('ot-acta-correct');if(!name||!obs||!same||!panel||!button)return;
 const closed=!!window.otEstaCerrada?.(ot);same.checked=false;same.disabled=closed;same.onchange=()=>{if(same.checked){name.value=String(ot.cliente||'');window.actualizarPanelIntegridadOT?.();}else name.focus();};
 button.hidden=!(closed&&actor().role==='admin'&&!actor().impersonating);button.textContent=ot.nombreConformidad&&ot.observacionesCierre?'Editar acta':'Completar acta';panel.hidden=true;
 button.onclick=()=>{if(actor().role!=='admin'||actor().impersonating)return;editing=true;name.readOnly=false;obs.readOnly=false;same.disabled=false;panel.hidden=false;button.hidden=true;name.focus();};
 document.getElementById('ot-acta-cancel').onclick=()=>{if(busy)return;name.value=ot.nombreConformidad||ot.firmaNombreCliente||'';obs.value=ot.observacionesCierre||ot.actaObservaciones||'';name.readOnly=closed;obs.readOnly=closed;render(ot);button.focus();};
 document.getElementById('ot-acta-save').onclick=save;
}
async function save(){if(busy||!editing||!context)return;const ot=context,role=actor(),uid=role.uid,name=document.getElementById('ot-acta-firma'),obs=document.getElementById('ot-acta-obs'),status=document.getElementById('ot-acta-status'),button=document.getElementById('ot-acta-save'),baseRevision=ot._svListRevision||0;
 try{const changes={nombreConformidad:name.value,observacionesCierre:obs.value};plan(ot,changes,role,new Date().toISOString());if(!window.SVRecordListWrites?.records||!ot.fbKey)throw Error('No está disponible el guardado protegido del acta.');busy=true;window._otGuardandoLocalHasta=Date.now()+2500;button.disabled=true;button.textContent='Guardando…';status.textContent='';const path='sisventas/ordenes_trabajo/'+ot.fbKey;
 const result=await window.SVRecordListWrites.records([path],records=>{if(actor().uid!==uid||actor().role!=='admin'||actor().impersonating)throw Error('La sesión cambió.');const before=records[path];if((before?._svListRevision||0)!==baseRevision)throw Error('La OT cambió. Volvé a abrirla antes de guardar.');return {[path]:plan(before,changes,actor(),new Date().toISOString())};});if(!result.committed)throw Error('No se confirmó el guardado.');Object.assign(ot,result.values[path]);name.readOnly=true;obs.readOnly=true;const afterSave=refresh;if(afterSave)await afterSave(ot);render(ot,afterSave);window.actualizarPanelIntegridadOT?.();window.notify?.('Acta corregida. Se conservaron las firmas y el cierre.');
 }catch(e){status.textContent=e.message;}finally{busy=false;button.disabled=false;button.textContent='Guardar acta';}
}
return {plan,render};
});
