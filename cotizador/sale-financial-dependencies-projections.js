'use strict';
const M=require('./sale-financial-dependencies-model'),D=require('./sale-financial-dependencies-delta');
function originalPath(path){
 const parts=path.split('/');
 if(parts[0]==='sv_commission_generation'){if(parts.length<2)throw M.fail('La generación requiere originales individuales.');const result=parts.slice(0,2).join('/');M.classify(result);return result;}
 if(parts[0]!=='sisventas')return null;
 if(parts.length===1)throw M.fail('No se permite sustituir la base comercial con el índice financiero instalado.');
 if(!['ventas','gastos','ctaemp','comisiones_generacion'].includes(parts[1]))return null;
 const length=parts[1]==='ctaemp'?4:3;
 if(parts.length<length)throw M.fail('El índice financiero requiere movimientos individuales; no se expandió la colección ni la cuenta del empleado.');
 const result=parts.slice(0,length).join('/');M.classify(result);return result;
}
async function augment({patch,raw,get,exists}){
 const stored=await raw(M.ROOT+'/coverage');
 if(stored==null){
  if(typeof exists!=='function')throw M.fail('No se pudo verificar la ausencia del índice financiero.');
  const installed=await exists(M.ROOT);if(installed!==false)throw M.fail('Existe el índice financiero sin cobertura completa.');
  return {maintained:false};
 }
 const coverage=M.validateCoverage(stored),paths=new Set();
 for(const path of Object.keys(patch)){
  if(path===M.ROOT||path.startsWith(M.ROOT+'/')||M.ROOT.startsWith(path+'/'))throw M.fail('El índice financiero sólo se mantiene desde originales verificados.');
  const record=originalPath(path);if(record)paths.add(record);
 }
 const changes=[];
 for(const path of paths){const [before,after]=await Promise.all([raw(path),get(path)]);if(M.digest(before)!==M.digest(after))changes.push({path,before,after});}
 if(!changes.length)return {maintained:true,generation:coverage.generation,revision:coverage.revision};
 const derived=await D.delta({changes,read:raw});Object.assign(patch,derived);
 return {maintained:true,generation:coverage.generation,revision:derived[M.ROOT+'/coverage'].revision};
}
module.exports={augment,originalPath};
