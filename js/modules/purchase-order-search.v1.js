(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SVPurchaseOrderSearch=api;})(typeof window==='object'?window:null,function(){
'use strict';
const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function quantity(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null;}
function code(i){return String(i.codigo||i.cod||i.sku||'');}
function name(i){return String(i.descripcion||i.desc||i.nombre||i.producto||'');}
function matches(i,query){const tokens=fold(query).split(/\s+/).filter(Boolean),text=fold(code(i)+' '+name(i));if(!tokens.length)return true;const compact=fold(code(i)).replace(/[^a-z0-9]/g,'');return tokens.every(t=>text.includes(t)||compact.includes(t.replace(/[^a-z0-9]/g,''))&&t.replace(/[^a-z0-9]/g,'').length>0);}
function receiptDate(order,item){
 let latest='';
 for(const receipt of (Array.isArray(order.recepciones)?order.recepciones:Object.values(order.recepciones||{}))){
  if(!(Array.isArray(receipt.items)?receipt.items:Object.values(receipt.items||{})).some(r=>fold(code(r))===fold(code(item))))continue;
  const date=receipt.fecha||(receipt.ts!=null&&Number.isFinite(Number(receipt.ts))?new Date(Number(receipt.ts)).toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}):'');
  if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>latest)latest=date;
 }
 return latest;
}
function search(orders,query){const result=[];for(const order of orders||[]){const items=Array.isArray(order.items)?order.items:[];items.forEach((item,index)=>{if(!matches(item,query))return;const ordered=quantity(item.cantidadOrdenada??item.cantidad??item.qty),received=quantity(item.cantidadRecibida??(item.recibido===true?ordered:null));result.push({order,item,index,code:code(item),name:name(item),ordered,received,unit:String(item.unidad||'un.'),orderedDate:String(order.fecha||''),receivedDate:receiptDate(order,item)});});}return result;}
return Object.freeze({fold,matches,search});
});
