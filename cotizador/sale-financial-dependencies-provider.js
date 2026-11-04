'use strict';
const M=require('./sale-financial-dependencies-model');
function create(){return async function evidence({saleKey,read}){
 if(!M.key(saleKey))throw M.fail('Venta inválida.');const coverage=M.validateCoverage(await read(M.ROOT+'/coverage'));
 if(coverage.unresolved)throw M.fail('Existen dependencias financieras sin resolver; no se certificó ausencia.');
 const sale=await read('sisventas/ventas/'+saleKey),certificate=await read(M.ROOT+'/sales/'+saleKey);
 if(!sale||certificate?.generation!==coverage.generation||certificate.sourceHash!==M.sourceDigest(sale))throw M.fail('La venta no coincide con su cobertura financiera.');
 const members=await read(M.ROOT+'/bySale/'+saleKey)||{},dependencies=[];
 for(const [id,present]of Object.entries(members)){if(!/^[a-f0-9]{64}$/.test(id)||present!==true)throw M.fail('Membresía financiera inválida.');const entry=await read(M.ROOT+'/records/'+id);if(!entry||entry.unresolved||!entry.targets?.includes(saleKey)||M.digest(entry.path)!==id||entry.sourceHash!==M.sourceDigest(await read(entry.path)))throw M.fail('Dependencia financiera desactualizada.');dependencies.push({path:entry.path,sourceHash:entry.sourceHash});}
 if(M.digest(await read(M.ROOT+'/coverage'))!==M.digest(coverage))throw M.fail('La cobertura financiera cambió durante la lectura.');
 return {schema:1,scope:'complete-financial-dependencies',saleKey,generation:coverage.generation,revision:coverage.revision,sources:coverage.sources,dependencies};
};}
module.exports={create};
