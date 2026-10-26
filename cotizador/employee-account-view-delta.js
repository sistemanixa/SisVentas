'use strict';
const crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util');
const Model=require('./employee-account-view-model');
const ROOT='sv_employee_account_views',BASE=ROOT+'/v1',EMPLOYEES=BASE+'/employees',GLOBAL=BASE+'/globalExpenses';
const BATCHES=BASE+'/globalPaymentBatches',AUDIT=BASE+'/globalPaymentAudit';
const DIRECTORY=BASE+'/globalEmployeeDirectory',CARGOS=BASE+'/globalCargoDirectory';
const companions={pagos_realizados:{kind:'batch',base:BATCHES,project:Model.projectPaymentBatch},auditoria_pagos:{kind:'audit',base:AUDIT,project:Model.projectPaymentAudit},empleados:{kind:'employee',base:DIRECTORY,project:Model.projectEmployee},'config/cargos':{kind:'cargo',base:CARGOS,project:Model.projectCargo}};
const fail=(message,code='SV_EMPLOYEE_ACCOUNT_VIEW_SCOPE')=>Object.assign(Error(message),{statusCode:409,code});
const key=value=>typeof value==='string'&&!!value&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function enabled(config){const value=config?.employeeAccountViews;if(value==null||value.enabled!==true)return false;if(value.schema!==Model.VERSION)throw fail('La versión de la vista de cuenta requiere revisión.','SV_EMPLOYEE_ACCOUNT_VIEW_VERSION');return true;}
function employeePath(id){if(!key(id))throw fail('La referencia de cuenta requiere revisión.');return EMPLOYEES+'/'+id;}
function validateMeta(value){return object(value)&&value.schema===Model.VERSION&&value.ready===true&&typeof value.revision==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(value.revision);}
function changed(change){return !isDeepStrictEqual(change.before??null,change.after??null);}
function planDelta({movements=[],expenses=[],companionChanges=[],employeeInitializations=[],metas={},nonce=crypto.randomUUID}={}){
 const patch={},employees=new Set(employeeInitializations.map(value=>value.employeeId)),preparedEmpty=new Set(employeeInitializations.filter(value=>value.preparedEmpty===true).map(value=>value.employeeId)),incomplete=new Set();let global=false,globalIncomplete=false;const paths=new Set();
 const write=(path,value)=>{if(paths.has(path)&&!isDeepStrictEqual(patch[path],value))throw fail('Las referencias de la cuenta requieren revisión.');paths.add(path);Object.defineProperty(patch,path,{value,writable:true,enumerable:true,configurable:true});};
 for(const change of movements){if(!changed(change))continue;const base=employeePath(change.employeeId);if(!key(change.key))throw fail('La referencia de movimiento requiere revisión.');employees.add(change.employeeId);const view=Model.projectMovement(change.after,{employeeId:change.employeeId,key:change.key});if(!view.complete)incomplete.add(change.employeeId);write(base+'/ctaemp/'+change.key,view.value);}
 for(const change of expenses){if(!changed(change))continue;if(!key(change.key))throw fail('La referencia de gasto requiere revisión.');global=true;const previous=Model.ownerOfExpense(change.before),next=Model.ownerOfExpense(change.after),view=Model.projectExpense(change.after,{key:change.key});
  if(!view.complete||!previous.complete||!next.complete)globalIncomplete=true;
  const owners=new Set([...previous.owners,...next.owners]);for(const id of owners){employees.add(id);if(!view.complete||!previous.complete||!next.complete)incomplete.add(id);const value=next.complete&&next.owner===id?view.value:null;write(employeePath(id)+'/gastos/'+change.key,value);}
  if(change.after==null)write(GLOBAL+'/rows/'+change.key,null);
  else{const revision=nonce();if(typeof revision!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(revision))throw fail('No se pudo fijar la revisión de gasto.');write(GLOBAL+'/rows/'+change.key,{meta:{schema:Model.VERSION,ready:view.complete,revision},value:view.value});}
 }
 for(const id of employees){const base=employeePath(id),revision=nonce();if(typeof revision!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(revision))throw fail('No se pudo fijar la revisión de cuenta.');write(base+'/meta',{schema:Model.VERSION,ready:(validateMeta(metas[base])||preparedEmpty.has(id))&&!incomplete.has(id),revision});}
 if(global){const revision=nonce();if(typeof revision!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(revision))throw fail('No se pudo fijar la revisión de gastos.');write(GLOBAL+'/meta',{schema:Model.VERSION,ready:validateMeta(metas[GLOBAL])&&!globalIncomplete,revision});}
 const scopes=new Map();for(const change of companionChanges){if(!changed(change))continue;const descriptor=companions[change.domain];if(!descriptor||!key(change.key))throw fail('La referencia de pago requiere revisión.');const view=descriptor.project(change.after,{key:change.key,expenseForKey:id=>change.expenses?.[id]??null});scopes.set(descriptor.base,(scopes.get(descriptor.base)??true)&&view.complete);
  if(change.after==null)write(descriptor.base+'/rows/'+change.key,null);else{const revision=nonce();if(typeof revision!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(revision))throw fail('No se pudo fijar la revisión de pago.');write(descriptor.base+'/rows/'+change.key,{meta:{schema:Model.VERSION,ready:view.complete,revision},value:view.value});}}
 for(const [base,complete]of scopes){const revision=nonce();if(typeof revision!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(revision))throw fail('No se pudo fijar la revisión de pagos.');write(base+'/meta',{schema:Model.VERSION,ready:validateMeta(metas[base])&&complete,revision});}
 return patch;
}
async function prepareDelta({config,patch,changes=[],raw,get,nonce=crypto.randomUUID}){
 if(!enabled(config))return{};const movements=[],targets=new Map(),accounts=new Set(),companionTargets=new Map(),employeeTargets=new Set();
 for(const path of Object.keys(patch)){
  const parts=path.split('/');if(path==='sisventas'||path==='sisventas/ctaemp'||path==='sisventas/config')throw fail('Actualizá la aplicación para guardar cuentas con alcance por registro.');
  if(parts[0]==='sisventas'&&Object.hasOwn(companions,parts[1])){if(parts.length<3)throw fail('Los registros requieren un alcance puntual.');if(!key(parts[2]))throw fail('La referencia requiere revisión.');companionTargets.set(parts.slice(0,3).join('/'),{domain:parts[1],key:parts[2]});if(parts[1]==='empleados')employeeTargets.add(parts[2]);continue;}
  if(parts[0]==='sisventas'&&parts[1]==='config'&&parts[2]==='cargos'){if(parts.length<4)throw fail('Los cargos requieren un alcance por registro.');if(!key(parts[3]))throw fail('La referencia de cargo requiere revisión.');companionTargets.set(parts.slice(0,4).join('/'),{domain:'config/cargos',key:parts[3]});continue;}
  if(parts[0]!=='sisventas'||parts[1]!=='ctaemp')continue;if(!key(parts[2]))throw fail('La referencia de cuenta requiere revisión.');
  if(parts.length===3)accounts.add(parts[2]);else if(parts.length>=4){if(!key(parts[3]))throw fail('La referencia de movimiento requiere revisión.');targets.set(parts.slice(0,4).join('/'),{employeeId:parts[2],key:parts[3]});}
 }
 for(const id of accounts){const path='sisventas/ctaemp/'+id,before=await raw(path),after=await get(path);if(before!==null&&typeof before!=='object'||after!==null&&typeof after!=='object')throw fail('La estructura de cuenta requiere revisión.');for(const k of new Set([...Object.keys(before||{}),...Object.keys(after||{})])){if(!key(k))throw fail('La referencia de movimiento requiere revisión.');movements.push({employeeId:id,key:k,before:before?.[k]??null,after:after?.[k]??null});}for(const [p,move]of targets)if(move.employeeId===id)targets.delete(p);}
 for(const [path,move]of targets)movements.push({...move,before:await raw(path),after:await get(path)});
 const expenses=changes.filter(change=>change.domain==='gastos'&&changed(change)),ids=new Set();for(const move of movements)if(changed(move))ids.add(move.employeeId);for(const expense of expenses)for(const value of [expense.before,expense.after])for(const id of Model.ownerOfExpense(value).owners)ids.add(id);
 const metas={},employeeInitializations=[],companionSnapshots=new Map();for(const id of employeeTargets){const path='sisventas/empleados/'+id,before=await raw(path),after=await get(path);companionSnapshots.set(path,{before,after});if(before!==null||after===null)continue;const base=employeePath(id),existing=await raw(base),account=await raw('sisventas/ctaemp/'+id);metas[base]=existing?.meta??null;let preparedEmpty=false;if(existing===null&&account===null){if(!Object.hasOwn(metas,GLOBAL))metas[GLOBAL]=await raw(GLOBAL+'/meta');preparedEmpty=validateMeta(metas[GLOBAL]);}employeeInitializations.push({employeeId:id,preparedEmpty});ids.add(id);}
 for(const id of ids){const path=employeePath(id);if(!Object.hasOwn(metas,path))metas[path]=await raw(path+'/meta');}if(expenses.length&&!Object.hasOwn(metas,GLOBAL))metas[GLOBAL]=await raw(GLOBAL+'/meta');
 const companionChanges=[],expenseCache=new Map(expenses.map(change=>[change.key,change.after]));
 for(const [path,descriptor]of companionTargets){const cached=companionSnapshots.get(path),before=cached?cached.before:await raw(path),after=cached?cached.after:await get(path);if(!changed({before,after}))continue;const resolved={};for(const id of Model.companionExpenseKeys(companions[descriptor.domain].kind,after)){if(!expenseCache.has(id))expenseCache.set(id,await get('sisventas/gastos/'+id));Object.defineProperty(resolved,id,{value:expenseCache.get(id),enumerable:true});}companionChanges.push({...descriptor,before,after,expenses:resolved});const base=companions[descriptor.domain].base;if(!Object.hasOwn(metas,base))metas[base]=await raw(base+'/meta');}
 return planDelta({movements,expenses,companionChanges,employeeInitializations,metas,nonce});
}
module.exports={ROOT,BASE,EMPLOYEES,GLOBAL,BATCHES,AUDIT,DIRECTORY,CARGOS,employeePath,validateMeta,enabled,planDelta,prepareDelta};
