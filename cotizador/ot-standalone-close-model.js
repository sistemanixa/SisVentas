'use strict';
// Pure close plan. The command must supply and freshly verify its own snapshots.
const Life=require('./ot-lifecycle-model'),Policy=require('./ot-inventory-policy'),Rows=require('./ot-material-rows-model');
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
const fail=()=>Object.assign(Error('El cierre requiere materiales e historial verificados.'),{statusCode:409,code:'SV_OT_STANDALONE_CLOSE_REVIEW'});
function plan({ot,otKey,changes,products={},references,inventories,actor,at}){
 Policy.standalone(ot);
 if(!key(otKey)||!key(actor?.uid)||typeof actor.name!=='string'||!Number.isSafeInteger(at)||at<=0||!Array.isArray(ot.materiales)||ot.items&&Object.keys(ot.items).length||!(references instanceof Map)||!(inventories instanceof Map))throw fail();
 const seen=new Set();
 for(let index=0;index<ot.materiales.length;index++){
  const row=ot.materiales[index];if(!row||typeof row!=='object')throw fail();
  const reference=references.get(index),product=products[row.productoKey||row.cod||row.codigo]||products[reference?.productKey]||{};
  if(Life.service(row,product))continue;
  const physical=Rows.quantity(row)>0||row.stockRegistro||Number(row.entregada)>0||Number(row.instalada)>0;
  if(!physical)continue;
  if(!reference||![reference.productKey,reference.inventoryKey,reference.receiptIdentityKey].every(key)||seen.has(row.stockRegistro))throw fail();
  seen.add(row.stockRegistro);const inventory=inventories.get(reference.inventoryKey);if(!inventory)throw fail();
  // Lazy import avoids a module-initialization cycle when Inventory delegates close.
  const Inventory=require('./ot-inventory-model');
  Inventory.receipt({otKey,index,row,productKey:reference.receiptIdentityKey,inventory,allocation:Inventory.allocation(ot,otKey,row)});
 }
 const result=Life.plan({before:ot,kind:'close',changes,sale:null,products,actor:{...actor,otKey},at:new Date(at).toISOString(),action:'OT finalizada'});
 if(result.saleStatus!==null||Object.keys(result.saleChanges).length)throw fail();
 return{ot:result.ot,inventories:new Map()};
}
module.exports={plan};
