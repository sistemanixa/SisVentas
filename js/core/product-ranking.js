(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVProductRanking=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 function rank(products,sales,{month,validSale=()=>true,dateOf=v=>String(v.fecha||'')}={}){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))return [];
  const codes=new Map(),names=new Map(),counts=new Map(),seenSales=new Set();
  function add(map,value,p){const k=norm(value);if(!k)return;if(!map.has(k))map.set(k,new Set());map.get(k).add(p);}
  for(const p of products){for(const k of ['fbKey','id','codigo','cod','sku'])add(codes,p[k],p);for(const k of ['nombre','descripcion'])add(names,p[k],p);}
  function identify(item){
   const linked=item.p&&typeof item.p==='object'?item.p:{},ids=[item.pid,item.productoFbKey,item.productoKey,item.fbKeyProducto,item.idProducto,item.productoId,item.cod,item.codigo,item.sku,linked.fbKey,linked.id,linked.codigo,linked.cod];
   const candidates=new Set();for(const id of ids)for(const p of codes.get(norm(id))||[])candidates.add(p);
   if(candidates.size)return candidates.size===1?Array.from(candidates)[0]:null;
   for(const value of [item.nombre,item.desc,item.descripcion,typeof item.producto==='string'?item.producto:'',linked.nombre])for(const p of names.get(norm(value))||[])candidates.add(p);
   return candidates.size===1?Array.from(candidates)[0]:null;
  }
  sales.forEach((sale,index)=>{
   if(!validSale(sale)||dateOf(sale).slice(0,7)!==month)return;
   const key=String(sale.fbKey||sale.id||'row-'+index);if(seenSales.has(key))return;seenSales.add(key);
   const inSale=new Set();for(const item of Array.isArray(sale.items)?sale.items:[]){const qty=item.qty??item.cantidad??1;if(!(Number(String(qty).replace(',','.'))>0))continue;const p=identify(item);if(p)inSale.add(p);}
   for(const p of inSale)counts.set(p,(counts.get(p)||0)+1);
  });
  return Array.from(counts,([product,sales])=>({product,sales})).sort((a,b)=>b.sales-a.sales||String(a.product.nombre||a.product.descripcion||'').localeCompare(String(b.product.nombre||b.product.descripcion||''),'es')||String(a.product.fbKey||a.product.codigo||'').localeCompare(String(b.product.fbKey||b.product.codigo||''))).map((entry,i)=>({...entry,position:i+1}));
 }
 return {rank};
});
