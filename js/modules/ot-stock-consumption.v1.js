(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SVOTStock=api;})(typeof window==='object'?window:null,function(){
'use strict';
const copy=v=>JSON.parse(JSON.stringify(v));
function quantity(v){const n=Number(v??0);if(!Number.isFinite(n)||n<0)throw Error('Cantidad de stock inválida');return Math.round(n*1000000)/1000000;}
function plan(input,command){
 const inv=copy(input||{general:0,reservado:0,consumido:0,asignaciones:{}}),c=command;
 const before=quantity(c.before),target=quantity(c.target),revision=quantity(c.revision),next=revision+1;
 if(!Number.isSafeInteger(revision)||!c.receipt||!c.allocation)throw Error('No se pudo identificar el movimiento de stock');
 const records=inv.rendicionesOT||{},found=records[c.receipt];
 if(found&&(found.ot!==c.ot||found.venta!==c.allocation))throw Error('La identidad del movimiento de stock no coincide');
 if(found&&found.revision===next&&found.instalada===target)return inv;
 if(found&&(found.revision!==revision||found.instalada!==before))throw Error('El stock de este material cambió. Volvé a abrir la OT.');
 inv.asignaciones=inv.asignaciones||{};const a=inv.asignaciones[c.allocation]||{reservado:0,consumido:0,liberado:0};
 if(!found&&before>0&&(quantity(a.consumido)<quantity(c.legacyTotal??before)||quantity(inv.consumido)<quantity(c.legacyTotal??before)))throw Error('La instalación anterior no tiene consumo verificable. Revisá el stock antes de corregir.');
 const entry=found?copy(found):{revision,instalada:before,deReserva:before,deGeneral:0};
 let delta=quantity(target)-quantity(before);
 if(delta>0){
  const reserved=Math.min(delta,quantity(a.reservado),c.additional?quantity(entry.enReserva):delta);
  if(quantity(inv.reservado)<reserved)throw Error('La reserva del producto requiere revisión');
  const general=quantity(delta-reserved);
  if(quantity(inv.general)<general)throw Error('Stock disponible insuficiente. Resolvé el origen del material antes de registrar su instalación.');
  inv.reservado=quantity(inv.reservado)-reserved;a.reservado=quantity(a.reservado)-reserved;
  inv.general=quantity(inv.general)-general;inv.consumido=quantity(inv.consumido)+delta;a.consumido=quantity(a.consumido)+delta;
  entry.deReserva=quantity(entry.deReserva)+reserved;entry.deGeneral=quantity(entry.deGeneral)+general;entry.enReserva=Math.max(0,quantity(entry.enReserva)-reserved);
 }else if(delta<0){
  const amount=-delta;if(quantity(a.consumido)<amount||quantity(inv.consumido)<amount)throw Error('El consumo registrado requiere revisión');
  const general=Math.min(amount,quantity(entry.deGeneral)),reserved=quantity(amount-general);
  if(quantity(entry.deReserva)<reserved)throw Error('No se puede reconstruir el origen del material');
  inv.consumido=quantity(inv.consumido)-amount;a.consumido=quantity(a.consumido)-amount;
  inv.reservado=quantity(inv.reservado)+amount;a.reservado=quantity(a.reservado)+amount;
  entry.deGeneral=quantity(entry.deGeneral)-general;entry.deReserva=quantity(entry.deReserva)-reserved;entry.enReserva=quantity(entry.enReserva)+amount;
 }
 for(const name of ['general','reservado','consumido'])inv[name]=quantity(inv[name]);
 for(const name of ['reservado','consumido'])a[name]=quantity(a[name]);
 entry.revision=next;entry.instalada=target;entry.ot=c.ot;entry.venta=c.allocation;
 inv.rendicionesOT=records;records[c.receipt]=entry;inv.asignaciones[c.allocation]=a;return inv;
}
async function sync(root,ot,before,after){
 if(!ot||!after)throw Error('No se identificó el material');
 const oldQty=quantity(before?.instalada),newQty=quantity(after.instalada);if(oldQty===newQty)return;
 const captured=root.svCapturarContextoOperacion?.(),user=root.fbAuth?.currentUser,uid=root.currentUserUid;
 const live=()=>!root._impersonacionOriginal&&(!captured||captured())&&user===root.fbAuth?.currentUser&&uid===root.currentUserUid;
 if(!live())throw Error('La sesión cambió. Volvé a abrir la OT.');
 if(!root.fbDB||!root.fbRunTransaction||!root.fbRef||!root.crypto?.subtle)throw Error('No está disponible el registro de stock');
 const product=typeof root.obtenerProductoPorCodigoVenta==='function'?root.obtenerProductoPorCodigoVenta(after.cod||after.codigo,after):Object.values(root.prodData||{}).find(p=>String(p.codigo||p.cod)===String(after.cod||after.codigo));
 const productKey=product?.fbKey||after.productoKey;if(!productKey||/[.#$\[\]\/]/.test(productKey))throw Error('No se encontró el producto para descontar stock');
 const otKey=String(ot.fbKey||ot.id||'');if(!otKey)throw Error('No se identificó la OT');
 const index=(ot.materiales||[]).findIndex(m=>m===after||m===before);if(index<0&&!after.stockRegistro)throw Error('No se identificó el renglón de material');
 const identity=JSON.stringify([otKey,index,productKey,after.destinoVenta||'original',after.ventaDestinoFbKey||'',after.agregadoEn||'']);
 const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const receipt=after.stockRegistro||before?.stockRegistro||hash;
 const allocationSource=after.destinoVenta==='nueva'?after.ventaDestinoFbKey:ot.ventaFbKey||ot.ventaId||ot.id||ot.fbKey;
 if(!allocationSource)throw Error('No se identificó la venta destino del material');
 const allocation=String(allocationSource).replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
 if(!allocation||!/^[a-f0-9]{64}$/.test(receipt))throw Error('Referencia de stock inválida');
 const legacyTotal=(ot.materiales||[]).filter(m=>String(m.cod||m.codigo)===String(after.cod||after.codigo)&&String(m.destinoVenta||'original')===String(after.destinoVenta||'original')&&String(m.ventaDestinoFbKey||'')===String(after.ventaDestinoFbKey||'')).reduce((sum,m)=>sum+quantity(m===after?oldQty:m.instalada),0);
 const cmd={before:oldQty,target:newQty,revision:quantity(before?.stockRevision),receipt,allocation,ot:otKey,additional:after.adicionalOT===true,legacyTotal:before?._stockLegacyTotal??legacyTotal};
 if(!live())throw Error('La sesión cambió. Volvé a abrir la OT.');
 let applied=false;
 const result=await root.fbRunTransaction(root.fbRef(root.fbDB,'sisventas/inventario_operativo/'+productKey),current=>{if(!live())throw Error('La sesión cambió. Volvé a abrir la OT.');applied=false;if(current==null)return null;const next=plan(current,cmd);applied=true;return next;},{applyLocally:false});
 if(!result?.committed||!applied)throw Error('No se confirmó el movimiento de stock. Verificá el stock disponible y volvé a intentarlo.');
 after.stockRegistro=receipt;after.stockRevision=cmd.revision+1;
}
return Object.freeze({plan,sync});
});
