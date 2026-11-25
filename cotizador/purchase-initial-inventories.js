'use strict';
// Materialize structural ledgers only from the prospective port's private proof.
// Originals remain null in every final CAS precondition, never fabricated zero.
const Port=require('./purchase-create-reference-port'),{digest}=require('./labor-guard');
const fail=()=>Object.assign(Error('Falta la prueba privada de ausencia para el inventario inicial.'),{statusCode:409,code:'SV_PURCHASE_INITIAL_INVENTORY'});
function materialize(input,{actor,lease}={}){
 const inventories=structuredClone(input.inventories||{}),initials=[];
 for(const [inventoryKey,original]of Object.entries(inventories)){
  if(original!==null)continue;
  const matches=Object.entries(input.references||{}).filter(([,reference])=>reference.inventoryKey===inventoryKey);if(matches.length!==1||!Port.isAuthority(input.referencePort))throw fail();
  const [productKey,reference]=matches[0],proof=input.referencePort.inspect(input.initialInventoryEvidence?.[productKey],{actor,lease}),initial=proof.initial;
  if(proof.productKey!==productKey||digest(proof.reference)!==digest(reference)||digest(proof.product)!==digest(input.products?.[productKey])||initial?.path!=='sisventas/inventario_operativo/'+inventoryKey||initial.precondition!==null)throw fail();
  inventories[inventoryKey]=structuredClone(initial.inventory);initials.push(initial.path);
 }
 return{input:{...input,inventories},restore(plan){for(const path of initials){if(!Object.hasOwn(plan.patch,path)||plan.patch[path]===null||!Object.hasOwn(plan.preconditions,path))throw fail();plan.preconditions[path]=null;}return plan;}};
}
module.exports={materialize};
