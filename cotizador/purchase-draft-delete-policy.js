'use strict';
const Model=require('./purchase-order-delete-model'),{digest}=require('./labor-guard'),Money=require('./commercial-models/commercial-money');
const policies=new WeakSet();
const configPaths=Object.freeze(['sv_labor_config','sv_operational_read_config','sv_commercial_pages_config','sv_client_accounts_config']);
const fail=message=>Object.assign(Error(message),{code:'SV_PURCHASE_DRAFT_DELETE_BLOCKED',statusCode:409});
function plan({order,inventoryByKey,sale,list}){
 if(!order||order.estado!=='borrador'||!Array.isArray(order.items)||order.recepcionPendiente||order.cancelacionPendiente||order.generacionPendiente||order.recepciones!=null&&(!Array.isArray(order.recepciones)||order.recepciones.length))throw fail('Sólo se puede eliminar un borrador sin recepciones.');
 for(const item of order.items)if(item?.cantidadRecibida!=null&&(typeof item.cantidadRecibida!=='number'||!Number.isFinite(item.cantidadRecibida)||item.cantidadRecibida!==0))throw fail('El borrador ya tiene materiales recibidos.');
 const result=Model.prepareOrderDeletion({order,inventoryByKey,sale,list});
 for(const [path,after]of Object.entries(result.patch))if(path.startsWith('sisventas/inventario_operativo/')){const before=result.preconditions[path];if(digest({...after,enCompra:before.enCompra})!==digest(before))throw fail('El borrado cambiaría stock físico o reservas.');}
 return result;
}
function cancellationPlan(args){
 const {order}=args;if(!order||!Array.isArray(order.items)||!['recibida','recepcion_parcial'].includes(order.estado)||order.anulada||order.recepcionPendiente||order.cancelacionPendiente||order.generacionPendiente)throw fail('Sólo se puede anular una recepción terminada, sin operaciones pendientes.');
 const received=new Map();for(const item of order.items||[]){const id=item.productoKey||item.codigo,p=Model.inventoryKey(id),quantity=Number(item.cantidadRecibida??0),row=received.get(p)||{quantity:0,label:item.codigo||id};row.quantity=Money.quantitySum([row.quantity,quantity]);received.set(p,row);}
 for(const [p,row]of received){const stock=args.inventoryByKey?.[p],available=Number(stock?.[order.ventaFbKey?'reservado':'general']);if(Number.isFinite(row.quantity)&&row.quantity>0&&Number.isFinite(available)&&available<row.quantity)throw fail('No se puede anular '+String(row.label)+': hay '+available+' unidades disponibles y se necesitan '+row.quantity+'. Revisá lo ya usado o entregado.');}
 const result=Model.prepareOrderDeletion(args),original=structuredClone(order);delete original.fbKey;
 result.patch['sisventas/ordenes/'+order.fbKey]={...original,estado:'cancelada',anulada:true};
 return result;
}
function create({runtime,operation='delete'}){
 if(!['delete','cancel'].includes(operation))throw Error('Operación de Compras inválida.');
 const configured=()=>{const s=runtime();return s.coordinated===true&&s.readOnly===false&&s.commercialPages===true&&s.clientAccounts===true&&s.operationalSummaries===true&&s.saleDeleteRelations===true;};
 async function assertCurrent(read){if(!configured())throw fail('El guardado de Compras no está disponible.');const rows=await Promise.all(configPaths.map(p=>read(p)));if(rows.some(v=>v?.schema!==1||v.ready!==true)||rows[0].writerSchema!==2||![undefined,false].includes(rows[0].sdkAdmissionPaused)||rows[2].nativeCollectionsReady!==true||rows[2].nativeCollectionsSchema!==1)throw fail('La coordinación de Compras no está lista.');}
 const policy=Object.freeze({operation,configured,assertCurrent,assertTarget(){},async plan(args){await assertCurrent(args.read);return operation==='cancel'?cancellationPlan(args):plan(args);}});policies.add(policy);return policy;
}
module.exports={create,plan,cancellationPlan,isPolicy:p=>policies.has(p)};
