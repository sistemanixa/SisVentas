'use strict';
// Closed server registry. HTTP input never chooses a model or an executable callback.
const {digest,put,parts,child}=require('./labor-guard'),Docs=require('./purchase-document-model');
const Numbering={get PATH(){return require('./purchase-numbering').PATH;},snapshot(...args){return require('./purchase-numbering').snapshot(...args);}};
const {specs,byOperation}=require('./purchase-route-contract'),fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_PURCHASE_ACTION_SOURCE'});
function specFor(actor){const spec=Object.hasOwn(byOperation,actor?.operation)?byOperation[actor.operation]:null;return spec&&actor?.mode==='user'&&actor.financialAction==='ordenes.editar'&&actor.input?.kind===spec.kind?spec:null;}
function points(plan){const patch={},preconditions={},dependencies=plan.readDependencies||{},roots=new Set();for(const path of Object.keys(plan.patch)){if(path===Numbering.PATH){patch[path]=structuredClone(plan.patch[path]);preconditions[path]=structuredClone(plan.preconditions[path]);continue;}const match=/^(sisventas\/(?:ventas|ordenes|listas_materiales|inventario_operativo|ordenes_compra)\/[^/]+)(?:\/|$)/.exec(path);if(!match)throw fail('El modelo excede sus originales comerciales.');roots.add(match[1]);}
 for(const root of roots){const before=Object.hasOwn(plan.preconditions,root)?plan.preconditions[root]:dependencies[root];if(before===undefined)throw fail('Falta el original completo para su cambio parcial.');let after=structuredClone(before);const paths=Object.keys(plan.patch).filter(path=>path===root||path.startsWith(root+'/'));if(paths.includes(root)&&paths.length>1)throw fail('El modelo superpone una fuente y sus campos.');for(const path of paths){if(path===root)after=structuredClone(plan.patch[path]);else{const suffix=parts(path.slice(root.length+1));if(!Object.hasOwn(plan.preconditions,path)||digest(child(before,suffix))!==digest(plan.preconditions[path]))throw fail('El cambio parcial no corresponde al original leído.');after=put(after,suffix,plan.patch[path]);}}patch[root]=after;preconditions[root]=structuredClone(before);}
 return {...plan,patch,preconditions};
}
function build(actor,input){const spec=specFor(actor);if(!spec||actor.input.id!==actor.opId||input.context?.id!==actor.opId||input.context?.actor?.uid!==actor.uid)throw fail('La acción no corresponde a la operación autenticada.');const b=actor.input,c=input.context;
 if(spec.source==='order'&&(input.orderKey!==b.orderKey||digest(input.order)!==b.expectedHash)||spec.source==='list'&&(input.listKey!==b.listKey||digest(input.list)!==b.expectedHash)||spec.source==='sale'&&(input.saleKey!==b.saleKey||digest(input.sale)!==b.expectedHash)||spec.source==='legacy'&&(input.legacyKey!==b.legacyKey||digest(input.legacy)!==b.expectedHash))throw fail('La acción no coincide con su fuente original.');
 let plan;
 switch(spec.name){
  case 'listCreate':plan=require('./purchase-list-edit-model').planCreate({...input,body:{id:b.id,expectedHash:b.expectedHash}});break;
  case 'listStock':plan=require('./purchase-list-edit-model').planStock(input);break;
  case 'listSave':plan=require('./purchase-list-edit-model').planSave({...input,body:{items:b.items,expectedHash:b.expectedHash}});break;
  case 'listReserve':plan=(input.list.origen==='conjunta'?require('./purchase-joint-reserve-model'):require('./purchase-list-reserve-model')).plan({...input,body:{id:b.id,expectedHash:b.expectedHash}});break;
  case 'listGroup':plan=require('./purchase-list-lifecycle-model').planGroup({...input,body:{sources:b.sources}});break;
  case 'listUngroup':plan=require('./purchase-list-lifecycle-model').planUngroup({...input,joint:input.list,jointKey:input.listKey,lists:input.sourceLists});break;
  case 'listClose':plan=require('./purchase-list-lifecycle-model').planClose(input);break;
  case 'listRename':plan=require('./purchase-order-actions-model').planRename({...input,body:{name:b.name}});break;
  case 'orderState':plan=require('./purchase-order-actions-model').planStatus({...input,body:{state:b.state}});break;
  case 'orderReconcile':plan=(input.list?.origen==='conjunta'?require('./purchase-joint-order-plan').reconcile:require('./purchase-receipt-reconcile-model').plan)({...input,context:{...c,actor:c.actor.name},body:{movements:b.movements,...(b.exchangeRate!==undefined?{exchangeRate:b.exchangeRate}:{})}});break;
  case 'listPreparation':plan=require('./purchase-preparation-availability').validate(require('./purchase-preparation-model').plan({...input,context:{id:c.id,at:c.at,actor:c.actor},decisions:b.preparation,applyCosts:b.applyCosts,documents:Docs.plan(b.documents,{existing:input.list.comprobantesCompra,at:c.at})}),input,actor,input.lease);break;
  case 'listCancelPreparation':plan=require('./purchase-preparation-cancel-model').plan(input);break;
  case 'legacyImport':{const reservation=Numbering.snapshot(input.numberingEvidence,actor,input.lease);if(c.numero!==reservation.numbers.legacy||Object.keys(reservation.numbers).length!==1)throw fail('La importación no tiene una reserva de número propia.');plan=require('./purchase-legacy-import-model').plan({...input,body:{id:b.id,expectedHash:b.expectedHash}});if(plan.result.alreadyImported)throw fail('La importación ya existe: consultá el recibo original.');Object.assign(plan.patch,reservation.patch);Object.assign(plan.preconditions,reservation.preconditions);plan.numbering=reservation;break;}
  default:throw fail('Acción de Compras desconocida.');
 }
 return {plan:points(plan),spec};
}
module.exports={specs,byOperation,specFor,build};
