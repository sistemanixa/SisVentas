(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVPurchaseOrderLinks=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
 const key=v=>typeof v==='string'&&v.length>0&&!/[.#$\[\]\/\x00-\x1f]/.test(v);
 function unlink(current,field,id){if(!current)return undefined;const raw=current[field];if(raw!=null&&!Array.isArray(raw)&&(typeof raw!=='object'||Object.values(raw).some(v=>typeof v!=='string')))throw Error('Los vínculos de compra requieren revisión.');const ids=Array.isArray(raw)?raw:Object.values(raw||{});if(ids.some(v=>!key(v)))throw Error('Los vínculos de compra requieren revisión.');if(!ids.includes(id))return undefined;const next=JSON.parse(JSON.stringify(current)),remaining=ids.filter(v=>v!==id);next[field]=remaining;
  if(field==='ordenesCompraIds'){if(!remaining.length)next.compraEstado='preparacion';}
  else{if(!remaining.length)next.estado='preparacion';next.actualizadoEn=Date.now();}
  return next;
 }
 async function remove(r,order){if(!key(order?.fbKey)||!r.fbRunTransaction)throw Error('No está disponible el guardado seguro de Compras.');const jobs=[];
  for(const [id,domain,field]of [[order.listaMaterialesId,'listas_materiales','ordenesIds'],[order.ventaFbKey,'ventas','ordenesCompraIds']])if(id){if(!key(id))throw Error('La referencia de compra no es válida.');jobs.push(r.fbRunTransaction(r.fbRef(r.fbDB,'sisventas/'+domain+'/'+id),current=>unlink(current,field,order.fbKey)));}
  await Promise.all(jobs);
 }
 return Object.freeze({unlink,remove});
});
