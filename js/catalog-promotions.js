(function(root){
'use strict';
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function quote(items,offers,code,now=Date.now()){
 const key=String(code||'').trim().toUpperCase();
 const offer=Object.values(offers||{}).find(o=>o.activa&&String(o.codigo).toUpperCase()===key);
 if(key&&(!offer||now<offer.inicio||now>=offer.fin))throw Error('La palabra de oferta no está vigente.');
 return items.map(p=>{const applies=offer&&(offer.alcance==='pedido'||(offer.productos||[]).includes(p.id));const base=Number(p.precioUSD)||0;return {...p,precioUSD:applies?round(base*(1-offer.porcentaje/100)):base,...(applies?{precioOriginalUSD:base,oferta:offer.codigo,descuentoPorcentaje:offer.porcentaje}:{})};});
}
function countdown(offers,now=Date.now()){
 const active=Object.values(offers||{}).filter(o=>o.activa&&o.inicio<=now&&o.fin>now).sort((a,b)=>a.fin-b.fin);
 if(!active.length)return Object.values(offers||{}).some(o=>o.activa&&o.fin<=now)?'La recepción de pedidos de la oferta finalizó.':'';
 const seconds=Math.max(0,Math.ceil((active[0].fin-now)/1000));
 return 'Cierre de pedidos · '+Math.floor(seconds/86400)+' días '+String(Math.floor(seconds/3600)%24).padStart(2,'0')+':'+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
const api={quote,countdown};if(typeof module==='object')module.exports=api;else root.SVCatalogPromotions=api;
})(typeof window==='object'?window:globalThis);
