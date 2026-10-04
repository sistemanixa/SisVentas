(function(root){
 'use strict';
 function project(p){
  if(!p||p.categoria!=='COMPRAS PARAGUAY'||p.catalogoVisible===false||p.activo===false||String(p.estado).toLowerCase()==='inactivo'||p.esManoDeObra)return null;
  const image=String(p.imagenUrl||'');
  return {nombre:String(p.nombre||''),marca:String(p.marca||''),descripcion:String(p.catalogoDescripcion||p.descripcion||''),imagenUrl:/^https:\/\//i.test(image)?image:''};
 }
 if(typeof module!=='undefined')module.exports={project};
 if(!root.document)return;
 async function share(key,products,button){
  if(!project(products[key])){root.notify?.('Este producto no está publicado en el catálogo.');return;}
  button.disabled=true;
  try{
   const updates={};for(const [id,p] of Object.entries(products)){const data=project(p);updates['sv_catalogo_publico/'+id]=data;updates['sv_catalogo_publico_index/'+id]=data?true:null;}
   await root.fbUpdate(root.fbRef(root.fbDB),updates);
   const url=new URL('catalogo.html','https://ventas.sistemanixa.com/');url.searchParams.set('producto',key);
   try{await navigator.clipboard.writeText(url.href);root.notify?.('Enlace del producto copiado');}
   catch(_){root.prompt('Copiá el enlace del producto:',url.href);}
  }catch(e){root.notify?.('No se pudo preparar el enlace. Revisá la conexión e intentá nuevamente.');}
  finally{button.disabled=false;}
 }
 root.SVPublicCatalog={project,share};
})(typeof window==='undefined'?{}:window);
