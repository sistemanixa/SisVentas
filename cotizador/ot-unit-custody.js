'use strict';
const {digest}=require('./labor-guard');
const Model=require('./ot-unit-custody-model');
const Rules=require('./ot-unit-custody-rules');
const UnitModel=require('./ot-unit-confirmation-model');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const copy=structuredClone;
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const counterFields=['entregada','instalada','devueltaPendiente','devuelta','enTecnico','danada','faltante','custodiaActiva','custodiaClasificada','custodiaSerialRevision','estadoCustodia'];
const materialFields=['cod','codigo','desc','descripcion','productoKey','productoFbKey','ventaItemKey','garantiaLinea','vendida',...counterFields];
const pick=(row,names)=>Object.fromEntries(names.filter(name=>Object.hasOwn(row||{},name)).map(name=>[name,copy(row[name])]));
const norm=v=>String(v??'').trim().toLocaleUpperCase('es-AR');
const same=(a,b)=>digest(a)===digest(b);
function createOTUnitCustody({db,guard,verify,source,enabled=false,now=Date.now}){
 if(typeof db?.ref!=='function'||typeof db?.getRulesJSON!=='function'||typeof guard?.run!=='function'||typeof verify!=='function'||typeof source!=='function')throw Error('Falta el circuito verificado de custodia por unidad');
 function request(req,body,action){
  if(!enabled)throw fail(503,'La custodia por serie todavía no está habilitada.');
  if(req?.method!=='POST'||req.url!=='/ot/custodia/'+action)throw fail(400,'Solicitud de custodia inválida.');
  const allowed=action==='preparar'?['otKey']:['otKey','revision','accion','units'];
  if(!object(body)||!UnitModel.key(body.otKey)||Object.keys(body).some(k=>!allowed.includes(k))||Buffer.byteLength(JSON.stringify(body))>200000)throw fail(400,'Solicitud de custodia inválida.');
  const bearer=String(req.headers?.authorization||'').match(/^Bearer (\S+)$/i);if(!bearer)throw fail(401,'Volvé a ingresar.');return bearer[1];
 }
 async function read(path){const value=(await db.ref(path).get()).val();if(value===undefined)throw fail(503,'No se pudo comprobar la custodia.');return copy(value);}
 async function context(actor,otKey,intent){
  const c=await source(actor,otKey,intent);
  const repository=await read(Rules.ROOT+'/'+otKey),registry=repository?.units??{},materials=c.ot.materiales??[];
  if(repository!==null&&(!object(repository)||repository.otKey!==otKey||repository.sourceBranch!==c.otPath.split('/')[1]||!Number.isSafeInteger(repository.revision)||repository.revision<1))throw fail(409,'El registro de custodia requiere revisión.');
  if(!object(registry)||!materials||typeof materials!=='object'||Object.entries(materials).some(([key,row])=>!UnitModel.key(key)||!object(row)))throw fail(409,'Los materiales de esta OT requieren revisión.');
  const technicianKey=c.ot.tecnicoFbKey||c.ot.empleadoFbKey||c.ot.tecnicoKey;
  if(!UnitModel.key(technicianKey))throw fail(409,'Asigná el técnico desde su ficha antes de registrar series.','SV_OT_CUSTODY_TECHNICIAN');
  const technician=await read('sisventas/empleados/'+technicianKey);if(!object(technician)||technician.activo===false)throw fail(409,'La ficha del técnico requiere revisión.');
  const units=c.plan.units.filter(u=>u.key&&!u.creationBlocked&&!u.duplicateLine).map(u=>{
   const candidates=Object.entries(materials).filter(([,m])=>object(m)&&String(m.ventaItemKey??'')===u.itemKey);
   const canonical=candidates.length===1?candidates[0][0]:undefined;
   const registered=Object.hasOwn(registry,u.key)?registry[u.key]:null;
   return {key:u.key,itemKey:u.itemKey,n:u.n,productKey:u.item.productoFbKey||'',sourceDigest:digest(pick(u.item,['productoFbKey','garantiaLinea','cod','unidad','garantiaConfig','esManoDeObra'])),...(registered?.materialKey!==undefined?{materialKey:registered.materialKey}:canonical!==undefined?{materialKey:canonical}:{}),code:u.item.cod||'',name:u.item.desc||'',config:copy(u.config)};
  });
  const revision=digest({base:c.revision,repository,technicianKey});
  return {...c,repository:copy(repository),registry:copy(registry),materials:copy(materials),technicianKey,units,revision,otKey};
 }
 async function protectedRules(c){const rules=await db.getRulesJSON();if(!Rules.protects(rules))throw fail(503,'Falta la protección completa de la custodia por serie.','SV_OT_CUSTODY_RULES');}
 async function current(token,actor,previous,intent){const verified=await verify(token);if(verified.uid!==actor.uid||!same(verified.svAccessVersion??null,actor.svAccessVersion??null))throw fail(409,'La sesión cambió. Volvé a abrir la custodia.');const next=await context(verified,previous.otKey,intent);if(next.revision!==previous.revision)throw fail(409,'La OT, su custodia o los permisos cambiaron. Volvé a revisarlos.','SV_OT_CUSTODY_CHANGED');return next;}
 function selected(body,c){
  if(!['entregar','devolver','recibir'].includes(body.accion)||body.revision!==c.revision||!Array.isArray(body.units)||!body.units.length||body.units.length>200)throw fail(409,'La selección de custodia cambió. Volvé a prepararla.');
  const seen=new Set();return body.units.map(value=>{
   if(!object(value)||Object.keys(value).some(k=>!['key','serie','materialKey','confirmLink'].includes(k))||!UnitModel.key(value.key)||seen.has(value.key))throw fail(400,'Hay unidades duplicadas o inválidas.');seen.add(value.key);
   const unit=c.units.find(u=>u.key===value.key);if(!unit)throw fail(409,'La unidad ya no pertenece a la OT.');
   if(value.materialKey!==undefined&&unit.materialKey!==undefined&&value.materialKey!==unit.materialKey)throw fail(409,'El renglón de materiales cambió.');
   const materialKey=unit.materialKey??value.materialKey,material=Object.hasOwn(c.materials,materialKey)?c.materials[materialKey]:null;
   if(!UnitModel.key(materialKey)||!object(material))throw fail(400,'Elegí el renglón de materiales de cada unidad.');
   if(unit.materialKey===undefined&&(c.current.role.rol!=='admin'||value.confirmLink!==true))throw fail(403,'La identificación histórica del renglón requiere confirmación del administrador.');
   if(material.ventaItemKey!==undefined&&String(material.ventaItemKey)!==unit.itemKey||material.productoFbKey&&material.productoFbKey!==unit.productKey||material.productoKey&&unit.productKey&&material.productoKey!==unit.productKey||norm(material.cod||material.codigo)!==norm(unit.code))throw fail(409,'El renglón no corresponde a ese producto de la venta.');
   return {key:value.key,materialKey,...(value.serie!==undefined?{serie:value.serie}:{})};
  });
 }
 async function prepare(req,body){const token=request(req,body,'preparar'),actor=await verify(token),c=await context(actor,body.otKey,'custodia');await protectedRules(c);await current(token,actor,c,'custodia');return {otKey:body.otKey,revision:c.revision,units:c.units.map(u=>pick(u,['key','itemKey','n','materialKey','code','name','config'])),materials:Object.entries(c.materials).map(([key,row])=>({key,...pick(row,materialFields)})),registry:Object.fromEntries(Object.entries(c.registry).map(([key,row])=>[key,{...pick(row,['unitKey','itemKey','n','materialKey','productKey','technicianKey','serie','estado','actualizadoEn','entregadoEn','devolucionSolicitadaEn','recibidoEn','instaladoEn']),historial:Array.isArray(row.historial)?row.historial.map(event=>pick(event,['accion','estado','uid','technicianKey','ts'])):[]}] )),capabilities:copy(c.custodyCapabilities)};}
 async function confirm(req,body){
  const token=request(req,body,'confirmar'),actor=await verify(token);
  if(!['entregar','devolver','recibir'].includes(body.accion))throw fail(400,'Acción de custodia inválida.');
  const c=await context(actor,body.otKey,body.accion);await protectedRules(c);
  let choice=body.revision===c.revision?selected(body,c):null;
  const operationDigest=digest({domain:'ot-unit-custody-v1',uid:actor.uid,body}),opId='ot_units_'+operationDigest;
  const who={uid:actor.uid,claims:{...actor,svOTUnitConfirmation:true,svOTUnitCustody:true,svOTCustodyAction:body.accion},role:c.current.role.rol,permissionRevision:c.current.config.indiceRevision??null,permissionDigest:digest(c.current.config),mode:'user',operation:'ot-unit-confirmation',opId,transportDigest:operationDigest,input:body};
  return guard.run(who,async scope=>{
   if(!choice)choice=selected(body,c);const locked=await current(token,actor,c,body.accion),assets=Object.create(null),inventory=Object.create(null);
   for(const row of choice){const [equipment,warranty]=await Promise.all(['equipos','garantias'].map(domain=>scope.get('sisventas/'+domain+'/'+row.key)));if(equipment!==null||warranty!==null)assets[row.key]=equipment??warranty;}
   if(body.accion==='recibir')for(const productKey of new Set(choice.map(row=>locked.units.find(u=>u.key===row.key).productKey).filter(UnitModel.key)))inventory[productKey]=await scope.get('sisventas/inventario_operativo/'+productKey);
   const custodians=new Set(choice.map(row=>locked.registry[row.key]?.technicianKey).filter(Boolean));
   if(custodians.size>1)throw fail(409,'Seleccioná unidades entregadas al mismo técnico.');
   const custodian=body.accion==='entregar'?locked.technicianKey:[...custodians][0]||locked.technicianKey;
   const plan=Model.plan({action:body.accion,selected:choice,expectedUnits:locked.units,registry:locked.registry,materials:locked.materials,inventory,allocationKey:locked.sale.fbKey,uid:actor.uid,technicianKey:custodian,timestamp:now(),assets});
   const patch=Object.create(null);
   if(plan.changed){
    const revision=Number(locked.repository?.revision||0)+1;
    for(const row of Object.values(plan.registry))row.sourceCounters=pick(locked.materials[row.materialKey],Rules.sourceFields);
    patch[Rules.ROOT+'/'+locked.otKey]={otKey:locked.otKey,sourceBranch:locked.otPath.split('/')[1],expectedTechnicianKey:locked.technicianKey,revision,units:plan.registry,actualizadoEn:now(),actualizadoPor:actor.uid};
    patch[locked.otPath+'/custodiaSerialRevision']=revision;
    patch[locked.otPath+'/custodiaIniciada']=true;
    if(body.accion==='entregar')patch[locked.otPath+'/custodiaRendida']=false;
    for(const [key,row]of Object.entries(plan.materials))for(const field of counterFields)if(!same(locked.materials[key]?.[field]??null,row[field]??null))patch[locked.otPath+'/materiales/'+key+'/'+field]=row[field];
    for(const [key,value]of Object.entries(plan.inventory))patch['sisventas/inventario_operativo/'+key]=value;
   }
   if(typeof scope.beforeCommit!=='function')throw fail(503,'Falta la verificación final del guardado.');
   scope.beforeCommit(async()=>{await protectedRules(locked);await current(token,actor,c,body.accion);for(const row of choice){const [a,b]=await Promise.all(['equipos','garantias'].map(d=>read('sisventas/'+d+'/'+row.key)));if(!same(assets[row.key]??null,a??b))throw fail(409,'Se confirmó un equipo mientras se revisaba su custodia. Volvé a prepararla.');}for(const [key,value]of Object.entries(inventory))if(!same(value,await read('sisventas/inventario_operativo/'+key)))throw fail(409,'Cambió la reserva de inventario. Volvé a preparar la recepción.');});
   await scope.update(patch);return {ok:true,otKey:body.otKey,action:body.accion,changed:plan.changed,units:choice.map(u=>u.key)};
  });
 }
 return Object.freeze({prepare,confirm});
}
module.exports={createOTUnitCustody};
