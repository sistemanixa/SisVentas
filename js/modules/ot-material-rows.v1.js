(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SVOTMaterialRows=api;})(typeof window==='object'?window:null,function(){
'use strict';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
function quantity(m){for(const k of ['vendida','qty','cantidad','cant'])if(m&&m[k]!=null&&m[k]!==''){const n=Number(m[k]);return Number.isFinite(n)&&n>=0?n:0;}return 0;}
function extra(m){return m?.adicionalOT===true||m?.origen==='adicional_ot';}
function group(m){return JSON.stringify([String(m.cod||m.codigo||m.sku||'').trim().toUpperCase(),extra(m),String(m.destinoVenta||'original'),String(m.destinoVenta==='nueva'?(m.ventaDestinoFbKey||m.ventaDestinoId||''):'')]);}
function normalize(m,index,recovered){const row=Object.assign({},m,{cod:m.cod||m.codigo||m.sku||'',desc:m.desc||m.nombre||m.descripcion||m.producto||'',vendida:quantity(m),adicionalOT:extra(m),_indice:index});if(m.instalada!=null||m.cantidadInstalada!=null)row.instalada=m.instalada??m.cantidadInstalada;if(recovered)row._recuperado=true;return row;}
function view(ot){
 const originals=Array.isArray(ot?.materiales)?ot.materiales:[],items=Array.isArray(ot?.items)?ot.items:[];
 const result=originals.map((m,i)=>{
  const row=normalize(m,i,false),matches=items.filter(item=>group(item)===group(m));
  if(matches.length===1){const evidence=matches[0];if(m.instalada==null&&m.cantidadInstalada==null&&(evidence.instalada!=null||evidence.cantidadInstalada!=null))row.instalada=evidence.instalada??evidence.cantidadInstalada;
   if(['vendida','qty','cantidad','cant'].every(k=>m[k]==null||m[k]===''))row.vendida=quantity(evidence);
  }
  return row;
 });
 const known=new Set(result.map(group));
 items.forEach((m,index)=>{
  if(!m||!quantity(m)||!String(m.cod||m.codigo||m.sku||'').trim())return;
  const existing=result.find(r=>r.origenMaterialHistorico==='items:'+index);
  if(existing||known.has(group(m)))return;
  if(extra(m)&&!m.destinoVenta&&result.some(r=>extra(r)&&String(r.cod||r.codigo||'').trim().toUpperCase()===String(m.cod||m.codigo||m.sku||'').trim().toUpperCase()))return;
  // These are existing source rows, never copies inferred from a code or sale total.
  const r=normalize(m,result.length,true);r.origenMaterialHistorico='items:'+index;result.push(r);
 });
 return result;
}
function persisted(rows){return rows.map(row=>{const copy=Object.assign({},row);delete copy._indice;delete copy._recuperado;return copy;});}
function progress(item,source){
 const matches=(source||[]).filter(m=>group(m)===group(item));
 if(matches.length!==1)return null;
 return matches[0];
}
return Object.freeze({quantity,extra,view,persisted,progress});
});
