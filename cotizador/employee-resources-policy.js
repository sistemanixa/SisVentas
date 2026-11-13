'use strict';
const {digest}=require('./labor-guard');
const issued=new WeakMap(),ROOTS=Object.freeze({clothing:'sv_employee_clothing',categories:'sv_expense_categories'});
const fail=()=>{throw Error('Falta el plan interno de indumentaria y categorías.');};
function issue(actor,lease,domain,value){
 if(!ROOTS[domain]||actor.mode!=='user'||actor.operation!=='employee-resources-'+domain||actor.uid!==lease.actorUid||actor.opId!==lease.opId)fail();
 const op=value.operations?.[actor.opId],cap=Object.freeze({uid:actor.uid,opId:actor.opId,fence:lease.fence,domain,role:actor.role,permissionRevision:actor.permissionRevision,employeeId:op?.employeeId||'',expenseId:op?.gastoRef||''});
 issued.set(cap,structuredClone(value));actor.employeeResources=cap;
}
function token(actor,lease){
 const c=actor?.employeeResources;
 if(!c||!issued.has(c)||actor.mode!=='user'||actor.operation!=='employee-resources-'+c.domain||c.uid!==actor.uid||c.uid!==lease.actorUid||c.opId!==actor.opId||c.opId!==lease.opId||c.fence!==lease.fence)return{svEmployeeResourcesVersion:0,svEmployeeResourcesDomain:'',svEmployeeResourcesRole:'',svEmployeeResourcesPermissionRevision:null};
 return {svEmployeeResourcesVersion:1,svEmployeeResourcesDomain:c.domain,svEmployeeResourcesRole:c.role,svEmployeeResourcesPermissionRevision:c.permissionRevision,svEmployeeResourcesEmployee:c.employeeId,svEmployeeResourcesExpense:c.expenseId};
}
function validate(actor,lease,patch){
 const claims=token(actor,lease);if(claims.svEmployeeResourcesVersion!==1)fail();
 const path=ROOTS[claims.svEmployeeResourcesDomain],allowed=new Set([path,'sv_labor_guard','sv_labor_receipts/'+actor.opId]);
 if(Object.keys(patch).some(p=>!allowed.has(p))||!Object.hasOwn(patch,path)||digest(patch[path])!==digest(issued.get(actor.employeeResources)))throw Error('La operación salió de su registro autorizado.');
 return claims;
}
const reserved=claims=>Object.fromEntries(Object.keys(claims||{}).filter(k=>k.startsWith('svEmployeeResources')).map(k=>[k,k.endsWith('Version')?0:k.endsWith('Revision')?null:'']));
module.exports={ROOTS,issue,token,validate,reserved};
