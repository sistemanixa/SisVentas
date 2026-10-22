'use strict';
const {isDeepStrictEqual}=require('node:util');
const Policy=require('./expense-removal-policy');
const {normalizeRtdb}=require('./payment-membership-index');
const fail=()=>Object.assign(Error('La baja de un gasto pagado o retirado requiere la confirmación protegida del administrador'),{statusCode:403,code:'SV_EXPENSE_REMOVAL_REQUIRED'});
// This check protects every coordinated writer, including the generic legacy
// gateway. Archival metadata is controlled; legitimate historical corrections
// and advance compensation may keep updating their original economic fields.
async function validateExpenseRemovals({actor,raw,changes=[],patch={}}){
 let approved=null;
 if(actor?.input?.purpose==='expense-removal'){
  const description=Policy.describe(actor.input),values=Object.create(null);
  for(const path of description.paths)values[path]=await raw(path);
  approved=Policy.validateRemoval({actor,body:actor.input,patch,values});
 }
 for(const change of changes){
  if(change.domain!=='gastos')continue;
  const before=change.before,after=normalizeRtdb(change.after),oldMarker=before?.[Policy.markerField]??null,newMarker=after?.[Policy.markerField]??null;
  if(!isDeepStrictEqual(oldMarker,newMarker)&&approved?.key!==change.key)throw fail();
  if(before&&after===null&&approved?.key!==change.key){
   if(oldMarker!==null||Policy.hasEconomicHistory(before))throw fail();
   const accounts=Policy.employeeKeys(before),values=Object.create(null);
   for(const account of accounts){const path='sisventas/ctaemp/'+account;values[path]=await raw(path);}
   const refs=Policy.linkedMovements(values,accounts,before,change.key);
   if(refs.some(ref=>Policy.hasEconomicHistory(ref.mov)))throw fail();
  }
 }
 return approved;
}
module.exports={validateExpenseRemovals};
