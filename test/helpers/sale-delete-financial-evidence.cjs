'use strict';
const {digest}=require('../../cotizador/labor-guard'),Matcher=require('../../cotizador/payment-membership-matcher');
function install(backend){
 backend.store.saleDeleteFinancialEvidence=async({saleKey})=>{
  const sale={...backend.get('sisventas/ventas/'+saleKey),fbKey:saleKey},roots={gastos:backend.get('sisventas/gastos')||{},ctaemp:backend.get('sisventas/ctaemp')||{},comisiones_generacion:backend.get('sisventas/comisiones_generacion')||{},sv_commission_generation:backend.get('sv_commission_generation')||{}},dependencies=[];
  for(const [domain,rows]of Object.entries(roots)){
   if(domain==='ctaemp'){for(const [employee,movements]of Object.entries(rows))for(const [id,row]of Object.entries(movements||{}))if(Matcher.belongsToSale(row,sale))dependencies.push({domain,id:employee+'/'+id});}
   else for(const [id,row]of Object.entries(rows))if(domain==='sv_commission_generation'?id===saleKey:Matcher.belongsToSale(row,sale))dependencies.push({domain,id});
  }
  return {schema:1,scope:'complete-financial-dependencies',saleKey,generation:'ram-fixture-complete-sources',revision:1,sources:Object.fromEntries(Object.entries(roots).map(([domain,rows])=>[domain,digest(rows)])),dependencies};
 };
 return backend;
}
module.exports={install};
