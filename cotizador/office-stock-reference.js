'use strict';
const crypto=require('node:crypto'),isService=require('./ot-lifecycle-model').service;
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
const own=(value,name)=>value!=null&&Object.hasOwn(value,name);
const fail=(code,message)=>Object.assign(Error(message),{code,statusCode:409});
const alias=value=>String(value??'').replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(name=>[name,stable(value[name])])):value;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value??null))).digest('hex');
function validate(snapshot){
 if(!snapshot||!key(snapshot.productKey)||!snapshot.product||typeof snapshot.product!=='object'||Array.isArray(snapshot.product))throw fail('SV_STOCK_REFERENCE_PRODUCT','No se identificó el producto.');
 if(['catalog','inventory','links','owners','receiptIdentity'].some(name=>snapshot.coverage?.[name]!==true)||!key(snapshot.receiptIdentityKey))throw fail('SV_STOCK_REFERENCE_INCOMPLETE','Falta verificar la cobertura y la identidad histórica del vínculo.');
 for(const map of [snapshot.inventory,snapshot.links?.byProduct,snapshot.links?.byInventory,snapshot.ownersByInventory])if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).some(name=>!key(name)))throw fail('SV_STOCK_REFERENCE_INPUT','Referencias de stock inválidas.');
 if(snapshot.product.eliminado===true||isService({},snapshot.product))throw fail('SV_STOCK_REFERENCE_PRODUCT','El producto no admite stock físico.');
 const competitors=snapshot.aliasOwners;if(!Array.isArray(competitors)||competitors.some(owner=>!key(owner)))throw fail('SV_STOCK_REFERENCE_INCOMPLETE','Falta verificar los alias del producto.');
 if(competitors.some(owner=>owner!==snapshot.productKey))throw fail('SV_STOCK_REFERENCE_AMBIGUOUS','Hay alias compartidos con otro producto.');
 for(const [productKey,record]of Object.entries(snapshot.links.byProduct)){const reverse=snapshot.links.byInventory[record?.inventoryKey];if(!key(record?.inventoryKey)||!key(record.receiptIdentityKey)||record.productKey!==productKey||!Number.isSafeInteger(record.revision)||record.revision<1||digest(reverse)!==digest(record))throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación y su inversa no coinciden.');}
 for(const [inventoryKey,record]of Object.entries(snapshot.links.byInventory)){if(!key(record?.productKey)||record.inventoryKey!==inventoryKey||digest(snapshot.links.byProduct[record.productKey])!==digest(record))throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación inversa requiere revisión.');}
}
function resolve(snapshot,selectedInventoryKey){
 validate(snapshot);const {productKey,product,inventory,links}=snapshot,mapped=links.byProduct[productKey],aliases=[...new Set([productKey,product.id,product.codigo,product.cod].filter(value=>value!==null&&value!==undefined&&String(value)!=='').map(alias).filter(key))];
 const candidates=new Set(aliases.filter(name=>own(inventory,name)&&inventory[name]!==null));for(const [name,original]of Object.entries(inventory))if(original?.productoKey===productKey||original?.productKey===productKey||snapshot.ownersByInventory[name]?.includes(productKey))candidates.add(name);if(mapped)candidates.add(mapped.inventoryKey);if(selectedInventoryKey!==undefined){if(!key(selectedInventoryKey))throw fail('SV_STOCK_REFERENCE_INPUT','Registro de stock inválido.');candidates.add(selectedInventoryKey);}
 if(candidates.size!==1)throw fail(candidates.size?'SV_STOCK_REFERENCE_AMBIGUOUS':'SV_STOCK_REFERENCE_MISSING',candidates.size?'Hay varios inventarios para el producto.':'No se encontró el inventario del producto.');
 const inventoryKey=[...candidates][0],original=inventory[inventoryKey];if(!own(inventory,inventoryKey)||!original||typeof original!=='object'||Array.isArray(original))throw fail('SV_STOCK_REFERENCE_MISSING','El registro de stock ya no está disponible.');
 const owners=snapshot.ownersByInventory[inventoryKey];if(!Array.isArray(owners)||owners.some(owner=>!key(owner)))throw fail('SV_STOCK_REFERENCE_INCOMPLETE','Falta verificar el propietario del registro.');
 const referenced=[original.productoKey,original.productKey,links.byInventory[inventoryKey]?.productKey,...owners].filter(value=>value!==undefined&&value!==null&&value!=='');if(referenced.some(owner=>owner!==productKey))throw fail('SV_STOCK_REFERENCE_OWNED','El inventario corresponde a otro producto.');
 const inactive=product.activo===false||product.estado==='inactivo';if(inactive&&inventoryKey!==productKey)throw fail('SV_STOCK_REFERENCE_INACTIVE','El producto inactivo requiere un vínculo exacto existente.');
 if(mapped&&mapped.receiptIdentityKey!==snapshot.receiptIdentityKey)throw fail('SV_STOCK_REFERENCE_IDENTITY','La identidad histórica del recibo cambió.');
 return Object.freeze({productKey,inventoryKey,receiptIdentityKey:mapped?.receiptIdentityKey??snapshot.receiptIdentityKey,mappingRevision:mapped?.revision??0,status:inactive?'inactive':'active',mapped:!!mapped});
}
function referenceHash(snapshot){validate(snapshot);return digest(snapshot);}
module.exports={key,digest,resolve,referenceHash};
