(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVSaleCosts=api.create(root);})(typeof window==='object'?window:null,function(){
 'use strict';
 const fields=['costoUnitarioCompra','costoTotalCompra','costoUnitario','costoCompra','compra','precioCompra','precio_compra','costoTotal','costo','costoUnitarioPresupuestado','costoUnitarioAntesPreparacion','comisionCostoHistoricoPendiente','costoCapturadoEn','costoOrigen','costoVersion'];
 const numeric=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0||typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v.trim());
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 const quantity=i=>Number(i.qty??i.cantidad??1);
 function unit(item){const q=quantity(item);for(const k of ['costoTotalCompra','costoTotal','costo'])if(numeric(item[k])&&q>0)return Number(item[k])/q;for(const k of ['costoUnitarioCompra','costoUnitario','costoCompra','compra','precioCompra','precio_compra','costoUnitarioAntesPreparacion','costoUnitarioPresupuestado'])if(numeric(item[k]))return Number(item[k]);return null;}
 const same=(a,b)=>{const ak=a.productoFbKey||a.pid,bk=b.productoFbKey||b.pid;if(ak&&bk)return String(ak)===String(bk);const ac=a.cod||a.codigo,bc=b.cod||b.codigo;if(ac&&bc)return String(ac)===String(bc);return !ak&&!bk&&!ac&&!bc&&!!(a.desc||a.descripcion)&&String(a.desc||a.descripcion)===String(b.desc||b.descripcion);};
 function create(r){
  function capture(item){
   const out={...item},q=quantity(item);if(!Number.isFinite(q)||q<=0)throw Error('Revisá la cantidad de '+(item.cod||item.desc||'un ítem')+'.');
   if(item.comisionCostoHistoricoPendiente===true)throw Error('El costo histórico de '+(item.cod||item.desc||'un ítem')+' requiere revisión; no se reemplazó con el catálogo actual.');
   let cost=unit(item),source='guardado';const product=r.obtenerProductoPorCodigoVenta?.(item.cod||item.codigo,item);
   if(cost===null){if(!product)throw Error('Falta definir el costo de '+(item.cod||item.desc||'un ítem')+'. Revisá el producto antes de guardar.');const value=r.obtenerCostoUnitarioVenta?.(item.cod||item.codigo,{...item});if(!numeric(value))throw Error('Falta definir el costo de '+(item.cod||item.desc||'un ítem')+'.');cost=Number(value);source='catalogo_al_confirmar';
    if(cost===0&&!['compraARS','precioGremio','compra','costoRealArs'].some(k=>numeric(product[k])&&Number(product[k])===0))throw Error('Falta definir el costo de '+(item.cod||item.desc||'un ítem')+'. No se tomó como cero.');
   }
   if(cost===0&&(item.cod||item.codigo)&&!item.costoVersion&&!numeric(item.costoUnitarioPresupuestado)&&!numeric(item.costoUnitarioAntesPreparacion)&&(!product||!['compraARS','precioGremio','compra','costoRealArs'].some(k=>numeric(product[k])&&Number(product[k])===0)))throw Error('Falta confirmar el costo de '+(item.cod||item.codigo)+'. No se tomó como cero.');
   if(!numeric(out.costoUnitarioCompra))out.costoUnitarioCompra=round(cost);
   if(!numeric(out.costoTotalCompra))out.costoTotalCompra=round(cost*q);
   if(!numeric(out.costoUnitarioPresupuestado))out.costoUnitarioPresupuestado=round(cost);
   out.costoVersion=1;out.costoOrigen=out.costoOrigen||source;out.costoCapturadoEn=out.costoCapturadoEn||Date.now();
   if(typeof out.esManoDeObra!=='boolean'&&product&&typeof r.esProductoManoDeObra==='function')out.esManoDeObra=!!r.esProductoManoDeObra(product);
   return out;
  }
  function preserve(item,old){
   const out={...item};for(const k of fields)delete out[k];for(const k of fields)if(Object.hasOwn(old,k))out[k]=old[k];
   if(Object.hasOwn(old,'esManoDeObra'))out.esManoDeObra=old.esManoDeObra;else delete out.esManoDeObra;
   const oldUnit=unit(old),q=quantity(item),before=quantity(old);if(!Number.isFinite(q)||q<=0)throw Error('Revisá la cantidad del ítem.');
   if(oldUnit===null||old.comisionCostoHistoricoPendiente===true)return out;
   if(q!==before){for(const k of ['costoTotalCompra','costoTotal','costo'])if(numeric(old[k]))out[k]=round(oldUnit*q);}
   return out;
  }
  function prepare(record,baseline){
   const old=Array.isArray(baseline?.items)?baseline.items:Object.values(baseline?.items||{}),used=new Set(),items=record.items;
   if(!items||typeof items!=='object'){if(baseline&&!baseline.items)return {...record};throw Error('La venta necesita ítems con costo.');}
   const convert=(item,key)=>{let at=old.findIndex((o,i)=>!used.has(i)&&same(o,item));if(at<0&&old[key]&&!used.has(Number(key))&&![item,old[key]].some(i=>i.productoFbKey||i.pid||i.cod||i.codigo||i.desc||i.descripcion)&&Number(item.punit??item.precio)===Number(old[key].punit??old[key].precio))at=Number(key);if(at<0)return capture(item);used.add(at);return preserve(item,old[at]);};
   return {...record,items:Array.isArray(items)?items.map(convert):Object.fromEntries(Object.entries(items).map(([key,item])=>[key,convert(item,key)]))};
  }
  function costCells(html,item){if(unit(item)!==null&&item.comisionCostoHistoricoPendiente!==true)return html;return html.replace('</td>','<small style="display:block;font-size:10px;color:var(--text3)" title="La venta no conserva un costo confirmado; esta referencia no demuestra el costo histórico.">Costo de referencia</small></td>');}
  return Object.freeze({prepare,capture,preserve,unit,costCells});
 }
 return Object.freeze({create,unit,fields});
});
