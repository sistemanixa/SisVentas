(function(root){
'use strict';
let generation=0;
function render(ot){
 const token=++generation;document.getElementById('ot-sale-completion')?.remove();
 if(root.currentRole!=='admin'||root._impersonacionOriginal||!root.otEstaCerrada?.(ot)||!ot.ventaFbKey)return;
 const anchor=document.getElementById('ot-acta-correct');if(!anchor)return;
 const section=document.createElement('div');section.id='ot-sale-completion';section.style.cssText='margin-top:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
 const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Actualizar venta a instalado';
 const status=document.createElement('span');status.setAttribute('role','status');section.append(button,status);anchor.parentElement.append(section);
 let busy=false;button.onclick=async()=>{
  if(busy)return;busy=true;button.disabled=true;status.textContent='Comprobando cierre y materiales…';
  const uid=root.currentUserUid;
  try{
   if(!root.SVOTSaleCompletion?.save)throw Error('No está lista la corrección.');
   const [snap,otSnap]=await Promise.all([
    root.fbGet(root.fbRef(root.fbDB,'sisventas/ventas/'+ot.ventaFbKey)),
    root.fbGet(root.fbRef(root.fbDB,'sisventas/ordenes_trabajo/'+ot.fbKey))
   ]);
   if(token!==generation||uid!==root.currentUserUid||root.currentRole!=='admin'||root._impersonacionOriginal)throw Error('La pantalla o la sesión cambió.');
   const raw=snap.val();if(!raw)throw Error('La venta vinculada ya no existe.');
   const rawOT=otSnap.val();if(!rawOT||(rawOT._svListRevision||0)!==(ot._svListRevision||0))throw Error('La OT cambió. Volvé a abrirla antes de corregir.');
   const sale=Object.assign({},raw,{fbKey:ot.ventaFbKey}),completeOT=Object.assign({},rawOT,{fbKey:ot.fbKey});
   root._otGuardandoLocalHasta=Date.now()+15000;
   const result=await root.SVOTSaleCompletion.save(root,{ot:completeOT,sale});
   if(result.changed&&result.committed){
    const cached=root.obtenerVentasSisVentas?.().find(v=>v.fbKey===sale.fbKey);
    if(cached){cached.estadoInst=result.sale.estadoInst;cached.audit=result.sale.audit;}
   }
   status.textContent=result.changed?'Venta actualizada a Instalado.':'La venta ya está instalada.';
   button.hidden=true;root.notify?.(status.textContent);
  }catch(error){status.textContent=error.message;button.disabled=false;}finally{busy=false;root._otGuardandoLocalHasta=Date.now()+500;}
 };
}
root.SVOTSaleCompletionUI=Object.freeze({render});
})(window);
