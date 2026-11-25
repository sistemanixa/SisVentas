'use strict';
const {digest}=require('./labor-guard'),Policy=require('./ot-inventory-policy');
const issued=new WeakMap(),port=Symbol('ot-standalone-destinations');
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
const fail=()=>Object.assign(Error('La venta adicional requiere su origen y vínculo canónicos vigentes.'),{statusCode:409,code:'SV_OT_ADDITIONAL_DESTINATION_REVIEW'});
function live(actor,lease,ot,otKey){Policy.standalone(ot);const token=Policy.token(actor,lease);if(token.svOTInventoryVersion!==1||token.svOTInventoryOTKey!==otKey||actor.otInventory.originalHash!==digest(ot)||actor.transportDigest!==lease.digest||actor.opId!==actor.input?.id||digest(actor.input)!==lease.digest||lease.expiresAt<=Date.now())throw fail();}
function bind({actor,lease,ot,otKey,sales}){
 live(actor,lease,ot,otKey);if(!(sales instanceof Map))throw fail();const expected=new Set();
 for(const row of ot.materiales||[]){if(row?.destinoVenta!=='nueva')continue;const id=row.ventaDestinoFbKey,sale=sales.get(id),entry=ot.ventasAdicionales?.[id];
  if(!key(id)||!sale||sale._svListSummary||sale._svPagedSummary||sale.otId!==otKey||sale.otNumero!==ot.id||!key(ot.clienteFbKey)||sale.clienteFbKey!==ot.clienteFbKey||!entry||entry.ventaFbKey!==id||typeof sale.id!=='string'||!sale.id||entry.ventaId!==sale.id||row.ventaDestinoId!==sale.id)throw fail();expected.add(id);
 }
 if(sales.size!==expected.size||[...sales.keys()].some(id=>!expected.has(id)))throw fail();
 const handle=Object.freeze({});issued.set(handle,{cap:actor.otInventory,otKey,originalHash:digest(ot),leaseHash:digest(lease),sales:structuredClone(sales)});actor[port]=handle;
}
function proof(context,ot,otKey){const actor=context?.actor,lease=context?.lease;live(actor,lease,ot,otKey);const value=issued.get(actor[port]);if(!value||value.cap!==actor.otInventory||value.otKey!==otKey||value.originalHash!==digest(ot)||value.leaseHash!==digest(lease))throw fail();return value;}
function resolve(context,ot,otKey,row){const original=context?.originalOT??ot,p=proof(context,original,otKey),id=row?.ventaDestinoFbKey,sale=p.sales.get(id),identity=value=>Object.fromEntries(['destinoVenta','ventaDestinoFbKey','ventaDestinoId','productoKey','productKey','cod','codigo','vendida','qty','cantidad'].map(field=>[field,value?.[field]??null]));Policy.standalone(ot);if(ot.id!==original.id||row?.destinoVenta!=='nueva'||!sale||row.ventaDestinoId!==sale.id||!original.materiales.some(stored=>digest(identity(stored))===digest(identity(row))))throw fail();return id;}
function sources({actor,lease,ot,otKey}){const p=proof({actor,lease},ot,otKey);return Object.fromEntries([...p.sales].map(([id,sale])=>['sisventas/ventas/'+id,structuredClone(sale)]));}
module.exports={bind,resolve,sources};
