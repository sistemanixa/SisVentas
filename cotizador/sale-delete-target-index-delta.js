'use strict';
const M=require('./sale-delete-target-index'),F=require('./sale-financial-dependencies-model'),D=require('./sale-financial-dependencies-delta');
const modulus=1n<<256n;
const accumulate=(before,value,sign)=>((BigInt('0x'+before)+BigInt(sign)*BigInt('0x'+F.digest(value))+modulus)%modulus).toString(16).padStart(64,'0');
async function delta({changes,read}){
 if(!Array.isArray(changes)||typeof read!=='function')throw M.fail('Cambios de vínculos inválidos.');
 const coverage=M.validateCoverage(await read(M.ROOT+'/coverage')),patch={},seen=new Set(),financial=[];
 for(const change of changes){
  if(!change||Object.keys(change).sort().join(',')!=='after,before,path'||seen.has(change.path))throw M.fail('Original repetido o cambio inválido.');seen.add(change.path);const kind=M.classify(change.path),before=M.image(change.path,change.before),after=M.image(change.path,change.after),recordPath=M.recordPath(change.path),old=await read(recordPath);
  if(before){M.validateImage(old);if(F.digest(old)!==F.digest(before))throw M.fail('El índice no corresponde al original anterior.');}else if(old!==null)throw M.fail('Ya existe cobertura para el original nuevo.');
  if(before){coverage.records--;coverage.sourceAccumulator=accumulate(coverage.sourceAccumulator,before,-1);for(const token of before.tokens||[])patch[M.ROOT+'/refs/'+token+'/'+F.digest(change.path)]=null;for(const token of before.aliases||[])patch[M.ROOT+'/saleAliases/'+token+'/'+kind.key]=null;}
  patch[recordPath]=after;
  if(after){coverage.records++;coverage.sourceAccumulator=accumulate(coverage.sourceAccumulator,after,1);for(const token of after.tokens||[])patch[M.ROOT+'/refs/'+token+'/'+F.digest(change.path)]=true;for(const token of after.aliases||[])patch[M.ROOT+'/saleAliases/'+token+'/'+kind.key]=true;}
  if(M.financialRoots.has(kind.root))financial.push(change);
 }
 if(financial.length){
  const derived=await D.delta({changes:financial,read:path=>read(M.financialPath(path))});
  for(const[path,value]of Object.entries(derived)){
   patch[M.financialPath(path)]=value;
   const prefix=F.ROOT+'/records/';if(!path.startsWith(prefix))continue;
   const id=path.slice(prefix.length),before=await read(M.financialPath(path));
   if(value?.domain==='ventas'||before?.domain==='ventas')continue;
   for(const [entry,present]of [[before,null],[value,true]]){
    if(entry===null)continue;
    if(!entry||F.digest(entry.path)!==id||!Array.isArray(entry.targets??[])||(entry.targets||[]).some(target=>!F.key(target)))throw M.fail('Candidatos financieros inválidos.');
    for(const target of entry.targets||[])patch[M.FINANCIAL_ROOT+'/candidatesBySale/'+target+'/'+id]=present;
   }
  }
 }
 coverage.revision++;if(!Number.isSafeInteger(coverage.revision)||!Number.isSafeInteger(coverage.records)||coverage.records<0)throw M.fail('Revisión de vínculos inválida.');patch[M.ROOT+'/coverage']=coverage;return patch;
}
module.exports={delta};
