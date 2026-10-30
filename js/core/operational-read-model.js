(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVOperationalReadModel=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const domains=Object.freeze(['ordenes','listas_materiales','inventario_operativo']);
 const revision='_svReadRevision',operation='_svReadOperation',index='sisventas/compras_resumen';
 const excluded=Object.freeze(['audit','auditoria','comprobantesCompra','recepciones','operaciones','asignaciones','rendicionesOT','foto','imagen','imagenUrl','productoImagenUrl','imageUrl','fotoUrl','audioUrl','archivoUrl','archivoData','data','base64','pdf','snapshot','ventaOriginal','saleFingerprint']);
 const fields=Object.freeze({
  ordenes:['numero','proveedor','proveedorKey','proveedorFinalResumen','proveedoresFinales','ventaId','ventaFbKey','cliente','listaMaterialesId','fecha','ts','estado','total','monto','totalRealRecibido','totalPresupuestadoRecibido','diferenciaCompra','generacionPendiente','cancelacionPendiente','recibidoEn','actualizadoEn','usuario','items','recepcionPendiente'],
  listas_materiales:['numero','nombreLista','origen','cliente','estado','ventaId','ventaFbKey','fecha','ts','ordenadaEn','usuario','compraConjuntaId','desagrupada','stockExistenteReservado','exteriorCanceladoEn','aplicacionExteriorId','aplicacionExteriorPendiente','cancelacionExteriorPendiente','cancelacionExteriorBloqueo','compraConfirmacion','ordenesIds','items','sources','simuladorParaguay'],
  inventario_operativo:['codigo','descripcion','unidad','general','reservado','enCompra']
 });
 const booleanOnly=Object.freeze(['recepcionPendiente','aplicacionExteriorPendiente','cancelacionExteriorPendiente']);
 const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
 function key(v){return typeof v==='string'&&v.length>0&&v.length<=768&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype','_svCoverage'].includes(v);}
 function path(value){let p=String(value?.toString?value.toString():value||'');if(/^https?:\/\//.test(p))p=decodeURIComponent(new URL(p).pathname);p=p.replace(/^\/+|\/+$/g,'');return p;}
 function recordPath(value){const parts=path(value).split('/');return parts[0]==='sisventas'&&domains.includes(parts[1])&&key(parts[2])?parts.slice(0,3).join('/'):null;}
 function strip(value,depth=0){
  if(depth>8)throw Error('Preparación demasiado profunda para su resumen.');
  if(value==null)return null;if(typeof value==='number'&&!Number.isFinite(value))throw Error('Importe de resumen inválido.');
  if(Array.isArray(value))return value.map(v=>strip(v,depth+1));
  if(typeof value==='object'){const out={};for(const [k,v]of Object.entries(value))if(!excluded.includes(k)){if(!key(k))throw Error('Campo de preparación inválido.');out[k]=strip(v,depth+1);}return out;}
  if(!['string','number','boolean'].includes(typeof value))throw Error('Dato de preparación inválido.');return value;
 }
 function summary(domain,record){
  if(!domains.includes(domain)||!record||typeof record!=='object'||Array.isArray(record))throw Error('Registro operativo inválido.');
  const out={[revision]:Number(record[revision])||0};if(record[operation]!=null)out[operation]=record[operation];for(const field of fields[domain])if(record[field]!=null){if(booleanOnly.includes(field)){if(record[field])out[field]=true;}else if(field==='compraConfirmacion'&&typeof record[field]==='object'){const compact={};for(const key of ['estado','fecha'])if(record[field][key]!=null)compact[key]=record[field][key];out[field]=compact;}else out[field]=strip(record[field]);}return out;
 }
 function plan(source,before,after,operationId){
  const p=recordPath(source);if(!p||p!==path(source))throw Error('El guardado debe identificar un registro operativo.');
  const domain=p.split('/')[1],id=p.split('/')[2],target=index+'/'+domain+'/'+id;
  if(after===null)return {[p]:null,[target]:null};
  if(!after||typeof after!=='object'||Array.isArray(after))throw Error('Registro operativo inválido.');
  const old=before?.[revision]??0;if(!Number.isSafeInteger(old)||old<0||old>=Number.MAX_SAFE_INTEGER)throw Error('Revisión operativa inválida.');
  const value=clone(after);if(!Object.hasOwn(before||{},'fbKey'))delete value.fbKey;delete value._svSummary;value[revision]=old+1;value[operation]=operationId||'fixture-revision-'+(old+1);
  return {[p]:value,[target]:summary(domain,value)};
 }
 function parseIndex(domain,value){
  const meta=value?._svCoverage;if(!meta||meta.ready!==true||meta.schema!==1||!Number.isSafeInteger(meta.baselineCount)||meta.baselineCount<0||!/^[a-f0-9]{64}$/.test(meta.sourceHash||''))throw Error('El listado de Compras no está preparado.');
  const out={};for(const [id,row]of Object.entries(value))if(id!=='_svCoverage'){
   if(!key(id)||!row||!Number.isSafeInteger(row[revision])||row[revision]<0)throw Error('Resumen operativo inválido.');
   out[id]={...summary(domain,row),_svSummary:true};
  }return out;
 }
 return Object.freeze({domains,revision,operation,index,fields,excluded,booleanOnly,key,path,recordPath,summary,plan,clone,parseIndex});
});
