'use strict';
const Model=require('./expense-clothing-model'),Clothing=require('./employee-clothing-model'),Resources=require('./employee-resources'),Policy=require('./employee-resources-policy'),{digest}=require('./labor-guard');
const fail=(message,statusCode=409)=>Object.assign(Error(message),{statusCode,code:'SV_EXPENSE_CLOTHING_LINK'});
async function prepare({scope,identity,runner,expense,original,key,enabled,at}){
 const previous=original?.indumentaria;if(!expense.indumentaria&&!previous)return null;
 if(previous){if(expense.indumentaria&&digest(Model.normalize(expense.indumentaria))!==digest(Model.normalize(previous)))throw fail('Las prendas ya ingresadas no se cambian al editar el gasto.');return null;}
 if(!enabled)throw fail('El ingreso de indumentaria desde Gastos todavía no está habilitado.',503);
 const read=p=>scope.get(p),profile=await read('sv_chat_roles/'+identity.uid),cfg=await read('sv_permisos/'+profile?.rol),reset=await read('sv_access_resets/'+identity.uid);
 const access=Resources.context(identity,profile,cfg,reset,'clothing');
 const categories=await read('sv_expense_categories');if(!Model.category(expense.categoria,categories))throw fail('Elegí la categoría Indumentaria para ingresar estas prendas.',400);
 if(expense.tipo==='Fijo'||expense.esFijoBase===true)throw fail('Ingresá esta compra como gasto variable.',400);
 const path='sv_employee_clothing',before=await read(path),state=before?{...before,garments:before.garments||{},events:Array.isArray(before.events)?before.events:Object.values(before.events||{}),operations:before.operations||{}}:Clothing.create();
 const next=Model.plan(state,expense,{key,operationId:runner.opId,actorId:identity.uid,at});Clothing.inventory(next);if(Buffer.byteLength(JSON.stringify(next))>2*1024*1024)throw fail('El historial de indumentaria necesita archivarse antes de agregar compras.');
 scope.beforeCommit(async({readFresh})=>{const p=await readFresh('sv_chat_roles/'+identity.uid),c=await readFresh('sv_permisos/'+p?.rol),r=await readFresh('sv_access_resets/'+identity.uid);if(digest(Resources.context(identity,p,c,r,'clothing'))!==digest(access)||digest(await readFresh(path))!==digest(before)||digest(await readFresh('sv_expense_categories'))!==digest(categories))throw fail('La indumentaria o los permisos cambiaron. Volvé a revisar el gasto.');});
 return {path,next,issue(patch){Policy.issueExpense(runner,scope.lease,key,patch,next);}};
}
module.exports={prepare};
