(function(root){
 'use strict';
 if(location.origin!=='http://127.0.0.1:8766'||root.__tecnopricesLocalNormalBridge)return;
 var original=root.solicitarLoteCotizadorConReintentos;if(typeof original!=='function')return;
 root.__tecnopricesLocalNormalBridge=true;
 function isTecnoprices(url){try{var u=new URL(url);return u.protocol==='https:'&&/^(www\.)?tecnoprices\.com$/.test(u.hostname)&&!u.username&&!u.password;}catch{return false;}}
 root.solicitarLoteCotizadorConReintentos=async function(payload,signal,alReintentar){
  var modal=document.getElementById('modal-actualizador-precios'),items=payload&&payload.items;
  if(!modal||!Array.isArray(items)||!items.some(function(x){return isTecnoprices(x.url);}))return original.apply(this,arguments);
  if(!items.length||items.length>4||!items.every(function(x){return isTecnoprices(x.url);}))throw Error('El bloque de Tecnoprices no es válido.');
  var pending=modal._productosPendientes||[];
  var selected=items.map(function(item){
   var matches=pending.filter(function(p){return p&&p.producto&&String(p.proveedorKey)===String(payload.proveedorKey)&&String(p.producto.codigo||'')===String(item.codigo||'')&&p.url===item.url;});
   if(matches.length!==1||!matches[0].producto.fbKey)throw Error('El producto no coincide con los pendientes seleccionados.');
   return Object.assign({},item,{sourceProductKey:String(matches[0].producto.fbKey),sourceSupplierIdx:matches[0].proveedorIdx});
  });
  var serviceHeaders=new Headers(await root.headersCotizadorProtegido());
  var response=await fetch('/tecnoprices/lote',{method:'POST',headers:{'Content-Type':'application/json',Authorization:serviceHeaders.get('Authorization')||''},signal:signal,body:JSON.stringify({proveedorKey:payload.proveedorKey,items:selected})});
  var data=await response.json();if(!response.ok||data.ok!==true)throw Error(data.mensaje||'No se pudo completar el bloque local de Tecnoprices.');
  return{respuesta:response,datos:data};
 };
 function removeProbe(){var p=document.getElementById('tecnoprices-local-readonly');if(p)p.remove();}
 removeProbe();new MutationObserver(removeProbe).observe(document.documentElement,{childList:true,subtree:true});
})(window);
