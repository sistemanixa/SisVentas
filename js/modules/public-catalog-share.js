(function(root){
 'use strict';
 function mercadoLibreReference(p,rate,unitCost=root.costoUnitarioProveedorProducto){
  if(!(Number.isFinite(rate)&&rate>0))return 0;
  const refs=(p.proveedores||[]).filter(pv=>{
   if(!pv||pv.activo===false||pv.disponibilidadProveedor==='sin_stock'||pv.esReferenciaEstimada===true)return false;
   let host='';try{host=new URL(pv.url).hostname.toLowerCase();}catch(_){}
   return /(^|\.)mercadolibre\.com\.ar$/.test(host)||host==='meli.la'||/^mercado\s*libre$/i.test(String(pv.nombre||'').trim());
  }).map(pv=>typeof unitCost==='function'?Number(unitCost(p,pv)):Number(pv.costoRealArs||(Number(pv.precioArsPublicado||pv.precio)*(pv.sinIva?1+Number(pv.iva??p.iva??21)/100:1)))).filter(n=>Number.isFinite(n)&&n>0);
  return refs.length?Math.round(Math.min(...refs)/rate*100)/100:0;
 }
 function project(p, rate=Number(root.obtenerDolarReferenciaProducto?.().valor)){
  if(!p||p.categoria!=='COMPRAS PARAGUAY'||p.catalogoVisible===false||p.activo===false||String(p.estado).toLowerCase()==='inactivo'||p.esManoDeObra)return null;
  const image=String(p.imagenUrl||'');
  const net=typeof root.precioVentaCanonicoProducto==='function'?Number(root.precioVentaCanonicoProducto(p).precioARS):Number(p.ventaARS||p.venta||0);
  const iva=p.iva==null?21:Number(p.iva);const precioARS=Number.isFinite(net)&&net>0?Math.round(net*(1+iva/100)*100)/100:0;
  const precioUSD=Number.isFinite(rate)&&rate>0?Math.round(precioARS/rate*100)/100:0;
  return {precioUSD,referenciaMLUSD:mercadoLibreReference(p,rate),iva:Number.isFinite(iva)&&iva>=0?iva:21,nombre:String(p.nombre||''),marca:String(p.marca||''),descripcion:String(p.catalogoDescripcion||p.descripcion||''),imagenUrl:/^https:\/\//i.test(image)?image:''};
 }
 async function syncProduct(product, previous){
  const data=project(product);
  if(!data&&!project(previous))return;
  if(!product.fbKey)throw Error('Producto sin identificador');
  const updates={};
  updates['sv_catalogo_publico/'+product.fbKey]=data;
  updates['sv_catalogo_publico_index/'+product.fbKey]=data?true:null;
  await root.fbUpdate(root.fbRef(root.fbDB),updates);
 }
 if(typeof module!=='undefined')module.exports={project,mercadoLibreReference};
 if(!root.document)return;
 function shareNotice(button,text,url){
  let notice=button.parentElement.querySelector('[data-share-status]');
  if(!notice){notice=document.createElement('div');notice.dataset.shareStatus='';notice.setAttribute('role','status');notice.style.cssText='position:absolute;right:78px;bottom:20px;max-width:calc(100% - 100px);padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--bg2,#152238);color:var(--text,#fff);font-size:13px;z-index:2;box-shadow:0 3px 12px #0003';button.parentElement.appendChild(notice);}
  notice.replaceChildren();const label=document.createElement('span');label.textContent=text;notice.appendChild(label);
  if(url){const input=document.createElement('input');input.type='text';input.readOnly=true;input.value=url;input.setAttribute('aria-label','Enlace del producto');input.style.cssText='display:block;width:100%;min-width:180px;margin-top:8px';input.onclick=()=>input.select();notice.appendChild(input);input.focus();input.select();}
 }
 async function share(key,products,button){
  if(!project(products[key])){shareNotice(button,'Este producto no está publicado en el catálogo.');return;}
  button.disabled=true;shareNotice(button,'Preparando enlace…');
  const url=new URL('catalogo.html','https://ventas.sistemanixa.com/');url.searchParams.set('producto',key);
  let timer;
  try{
   const updates={};for(const [id,p] of Object.entries(products)){const data=project(p);updates['sv_catalogo_publico/'+id]=data;updates['sv_catalogo_publico_index/'+id]=data?true:null;}
   const publish=Promise.race([root.fbUpdate(root.fbRef(root.fbDB),updates),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),15000);})]);
   // Iniciar el portapapeles dentro del clic conserva el permiso del navegador.
   let copy;
   if(root.ClipboardItem&&navigator.clipboard?.write){
    copy=navigator.clipboard.write([new root.ClipboardItem({'text/plain':publish.then(()=>new Blob([url.href],{type:'text/plain'}))})]).then(()=>true,()=>false);
   }
   await publish;clearTimeout(timer);
   let copied=copy?await copy:false;
   if(!copied&&navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(url.href);copied=true;}catch(_){}}
   shareNotice(button,copied?'✓ Enlace copiado. Ya podés pegarlo y enviarlo.':'El navegador no permitió copiar. Copiá este enlace:',copied?null:url.href);
  }catch(e){shareNotice(button,'No se pudo preparar el enlace. Revisá la conexión y volvé a presionar compartir.');}
  finally{clearTimeout(timer);button.disabled=false;}
 }
 root.SVPublicCatalog={project,share,syncProduct};
})(typeof window==='undefined'?{}:window);
