(function(root,factory){'use strict';const api=factory(typeof module==='object'&&module.exports?require('./commercial-money.v1'):root.SVCommercialMoney);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVOfficeStockAdjustment=api;})(typeof window==='object'?window:globalThis,function(Money){
'use strict';
const clone=v=>structuredClone(v),key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
function quantity(value){if(value==null||String(value).trim()===''||typeof value!=='number'&&!/^\d+(?:\.\d+)?$/.test(String(value)))throw Error('Ingresá una cantidad válida.');const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e9)throw Error('Cantidad fuera de rango.');const a=Money.decimal(value),b=Money.decimal(n);if(a.n*b.d!==b.n*a.d)throw Error('La cantidad tiene más precisión de la que se puede conservar.');return n;}
function authorize(actor){if(!actor?.uid||actor.active!==true||actor.viewAs||!['admin','administrativo'].includes(actor.role)||actor.allowed!==true)throw Error('No tenés permiso para modificar stock de oficina.');}
function plan(current,command,actor,now,product){
 authorize(actor);const c=command||{};
 if(!key(c.id)||!key(c.productKey)||!Number.isSafeInteger(now)||now<=0)throw Error('No se identificó el ajuste.');
 const count=quantity(c.quantity),reason=String(c.reason||'').trim();if(!reason||reason.length>240)throw Error('Ingresá una observación de hasta 240 caracteres.');
 const unit=String(product?.unidad||'').toLowerCase().trim();if(!Number.isInteger(count)&&!/^(m|metro|metros|kg|kilogramo|kilogramos|l|litro|litros)$/.test(unit))throw Error('Revisá la unidad del producto antes de ingresar una cantidad fraccionada.');
 if(!current||!Object.hasOwn(current,'general'))throw Error('Este producto requiere revisar su registro de stock.');
 const signature={productKey:c.productKey,quantity:count,reason,uid:actor.uid},prior=current.ajustesOficina?.[c.id];
 if(prior){if(!same(prior.command,signature))throw Error('El ajuste ya tiene otros datos.');return{inventory:clone(current),replayed:true};}
 if(!same(current,c.expected))throw Error('El stock cambió. Actualizá la cantidad antes de guardar.');
 const before=quantity(current.general);if(count===before)throw Error('La cantidad no cambió.');
 const inventory=clone(current);inventory.general=count;inventory.ajustesOficina={...(inventory.ajustesOficina||{}),[c.id]:{command:signature,anterior:before,nueva:count,observacion:reason,usuarioUid:actor.uid,usuario:actor.name||actor.uid,fecha:new Date(now).toISOString(),ts:now}};
 return{inventory,replayed:false};
}
return Object.freeze({plan,authorize,quantity});
});
