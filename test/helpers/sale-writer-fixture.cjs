// Adaptador exclusivamente ficticio para probar el contrato y sus escrituras.
// La producción usa SVLaborWrites.atomic, con permisos y CAS del servidor.
module.exports=function(root){
 root.SVBudgetConversionCosts=require('../../js/core/budget-conversion-costs.v1.js')(root);
 root.SVLaborWrites||={intersects:()=>false,atomic:async({paths,build})=>{
  const values={};for(const p of paths){const snap=await root.fbGet(root.fbRef(root.fbDB,p));values[p]=snap?.val?.()??null;}
  const patch=build(values);if(patch===undefined)return {committed:false};
  await root.fbUpdate(root.fbRef(root.fbDB,''),patch);return {committed:true};
 }};
 root.SVSaleWriter=require('../../js/core/sale-writer.v1.js').create(root);
 return root.SVSaleWriter;
};
