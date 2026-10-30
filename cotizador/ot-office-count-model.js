(function(root,factory){'use strict';const api=factory(typeof module==='object'&&module.exports?require('./ot-stock-consumption-model.js'):root.SVOTStock);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVOTOfficeCountModel=api;})(typeof window==='object'?window:null,function(stock){
'use strict';
// Canonical calculation; authorization and atomic persistence belong to the command.
const clone=v=>JSON.parse(JSON.stringify(v));
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
function qty(v){if(v==null||String(v).trim()==='')throw Error('Ingresá la cantidad física que queda en oficina.');const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e9||Math.abs(n*1e6-Math.round(n*1e6))>1e-6)throw Error('Cantidad física inválida.');return Math.round(n*1e6)/1e6;}
function plan(current,command){
 const c=command||{},count=qty(c.count),rows=c.movements;
 if(!/^[-a-zA-Z0-9_]{1,100}$/.test(c.id||'')||!String(c.uid||'').trim()||!Number.isSafeInteger(c.ts)||c.ts<=0)throw Error('No se identificó el recuento.');
 if(c.unitCount&&!Number.isInteger(count))throw Error('Ingresá unidades enteras.');
 if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error('No se identificaron los materiales usados.');
 const signature={uid:c.uid,count,unitCount:!!c.unitCount,movements:rows};
 const original=current||{},prior=original.ajustesConteo?.[c.id];
 if(prior){if(prior.tipo!=='conteo_oficina_ot'||!same(prior.comando,signature))throw Error('El recuento ya tiene otros datos.');return clone(original);}
 if(!same(current,c.expected))throw Error('El stock cambió durante el conteo. Volvé a revisar.');
 const receipts=new Set();let missing=0;
 for(const m of rows){
  if(m.additional!==true||qty(m.target)<=qty(m.before)||!m.ot||!m.allocation||!/^[a-f0-9]{64}$/.test(m.receipt||'')||receipts.has(m.receipt))throw Error('El material requiere revisar su registro.');
  receipts.add(m.receipt);
  const entry=original.rendicionesOT?.[m.receipt];
  // Only pending additional stock from the office; returned reservations need their own flow.
  if(entry&&qty(entry.enReserva??0)>0)throw Error('El material tiene reserva propia. Revisá su origen.');
  if(entry&&entry.revision===Number(m.revision)+1&&entry.instalada===Number(m.target)){
   if(entry.ot!==m.ot||entry.venta!==m.allocation)throw Error('La identidad del movimiento no coincide.');
  }else missing+=qty(m.target)-qty(m.before);
 }
 // Reconstruct only inside the transaction candidate; never persist an intermediate count.
 let next=clone(original);next.general=qty(count+missing);
 for(const m of rows)next=stock.plan(next,m);
 if(next.general!==count)throw Error('No se pudo conciliar el recuento con la OT.');
 next.ajustesConteo=next.ajustesConteo||{};
 next.ajustesConteo[c.id]={tipo:'conteo_oficina_ot',comando:clone(signature),cantidadAnterior:qty(original.general??0),cantidadContada:count,consumoRegistrado:qty(missing),diferencia:Math.round((count+missing-qty(original.general??0))*1e6)/1e6,usuarioUid:c.uid,usuario:c.user||c.uid,motivo:c.reason||'Conteo de oficina desde OT',fecha:c.ts};
 return next;
}
return Object.freeze({plan});
});
