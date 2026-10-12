(function(root){
'use strict';
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function quote(items,offers,code,now=Date.now()){
 const key=String(code||'').trim().toUpperCase();
 const offer=Object.values(offers||{}).find(o=>o.activa&&String(o.codigo).toUpperCase()===key);
 if(key&&(!offer||now<offer.inicio||now>=offer.fin))throw Error('La palabra de oferta no está vigente.');
 return items.map(p=>{const applies=offer&&(offer.alcance==='pedido'||(offer.productos||[]).includes(p.id));const base=Number(p.precioUSD)||0;return {...p,precioUSD:applies?round(base*(1-offer.porcentaje/100)):base,...(applies?{precioOriginalUSD:base,oferta:offer.codigo,descuentoPorcentaje:offer.porcentaje}:{})};});
}
const defaultPeriods=[{nombre:'Primera lista del mes',inicio:1,fin:10},{nombre:'Segunda lista del mes',inicio:21,fin:28}];
function validatePeriods(periods){
 if(!Array.isArray(periods)||!periods.length||periods.length>12)throw Error('Configurá entre uno y doce períodos.');
 const rows=periods.map(p=>({nombre:String(p.nombre||'').trim(),inicio:Number(p.inicio),fin:Number(p.fin)})).sort((a,b)=>a.inicio-b.inicio);
 rows.forEach((p,i)=>{if(!p.nombre||p.nombre.length>80||!Number.isInteger(p.inicio)||!Number.isInteger(p.fin)||p.inicio<1||p.fin>31||p.fin<p.inicio)throw Error('Revisá los nombres y los días de apertura y cierre.');if(i&&p.inicio<=rows[i-1].fin)throw Error('Los períodos no pueden superponerse.');});return rows;
}
function monthlyWindow(now=Date.now(),configured=defaultPeriods){
 const rows=validatePeriods(configured);
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date(now));
 const date=Object.fromEntries(parts.map(p=>[p.type,Number(p.value)])),year=date.year,month=date.month-1;
 let next=Infinity;
 for(let offset=0;offset<2;offset++){const days=new Date(Date.UTC(year,month+offset+1,0)).getUTCDate();for(const p of rows){if(p.inicio>days)continue;const inicio=Date.UTC(year,month+offset,p.inicio,3),fin=Date.UTC(year,month+offset,Math.min(p.fin,days)+1,3);if(now>=inicio&&now<fin)return {abierto:true,inicio,fin,nombre:p.nombre};if(inicio>now)next=Math.min(next,inicio);}}
 return {abierto:false,proximaApertura:next};
}
function monthlyCountdown(now=Date.now()){
 const period=monthlyWindow(now),seconds=Math.max(0,Math.ceil(((period.abierto?period.fin:period.proximaApertura)-now)/1000));
 return (period.abierto?'Cierre de pedidos':'Próxima apertura')+' · '+Math.floor(seconds/86400)+' días '+String(Math.floor(seconds/3600)%24).padStart(2,'0')+':'+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
function countdown(offers,now=Date.now()){
 const active=Object.values(offers||{}).filter(o=>o.activa&&o.inicio<=now&&o.fin>now).sort((a,b)=>a.fin-b.fin);
 if(!active.length)return Object.values(offers||{}).some(o=>o.activa&&o.fin<=now)?'La recepción de pedidos de la oferta finalizó.':'';
 const seconds=Math.max(0,Math.ceil((active[0].fin-now)/1000));
 return 'Cierre de pedidos · '+Math.floor(seconds/86400)+' días '+String(Math.floor(seconds/3600)%24).padStart(2,'0')+':'+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
const api={quote,countdown,monthlyWindow,monthlyCountdown,validatePeriods,defaultPeriods};if(typeof module==='object')module.exports=api;else root.SVCatalogPromotions=api;
})(typeof window==='object'?window:globalThis);
