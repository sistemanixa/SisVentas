(function(root){
 'use strict';
 root.prepararVinculosDeVentas=async function(button){
  const status=root.document.getElementById('mnt-vinculos-ventas-status');
  if(root.currentRole!=='admin'||root._impersonacionOriginal||root.tienePermiso?.('mantenimiento.migrar')!==true||root.tienePermiso?.('ventas.eliminar')!==true){if(status)status.textContent='Se requiere permiso de mantenimiento y eliminación de ventas.';return;}
  if(button.disabled)return;button.disabled=true;if(status)status.textContent='Preparando vínculos. Esperá a que termine…';
  try{const result=await root.SVFinancialCommands.prepareSaleDeletion();if(!result?.prepared)throw Error('La preparación no está disponible.');if(status)status.textContent='Vínculos preparados. Ya podés eliminar la venta.';}
  catch(error){if(status)status.textContent=error?.message||'No se pudieron preparar los vínculos.';}
  finally{button.disabled=false;}
 };
})(window);
