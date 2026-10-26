'use strict';
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const INTERNAL=new Set(['admin','administrativo','vendedor','tecnico','tecnico_vendedor']);
const OWN_DEFAULTS=new Set(['administrativo','vendedor','tecnico','tecnico_vendedor']);
const EXTERNAL=new Set(['distribuidor','distribuidora','compras_paraguay','cliente','externo','external']);
const HR_ADMIN_DEFAULTS=new Set(['admin']),HR_EDIT_DEFAULTS=new Set(['admin','administrativo']);
const PUBLIC=['nombre','usuario','activo','tipoEmpleado','legajo','cargo','cargoId'];
const OWN=['nombreCompleto','apellido','nombres','fechaIngreso','telefono','tel','mail','email','dni'];
const CARGO_TEXT=['id','nombre','cargo','categoria','categoriaBase','modalidadRemuneracion'];
const CARGO_NUMBERS=['valorHora','valorHoraExtra','diasMes'];
const SALARY_NUMBERS=['anterior','nuevo','porcentaje','variacionPct'];
const BANK=['banco','titular','tipo','moneda','numero','numeroCuenta','cbu','cvu','alias'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const key=v=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v,'utf8')<=768&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(v);
const uidKey=v=>key(v)&&v.length<=128;
function own(record,name){if(record===null||typeof record!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(record,name);return d&&Object.hasOwn(d,'value')?d.value:undefined;}
const text=v=>typeof v==='string'&&v.length<=4096;
const scalar=v=>text(v)||typeof v==='number'&&Number.isFinite(v);
const number=v=>typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.length<=80&&/^[+-]?\d[\d.,]*$/.test(v);
function set(record,name,value){Object.defineProperty(record,name,{value,writable:true,enumerable:true,configurable:true});}
function copyFields(source,fields,valid){const result={};for(const name of fields){const value=own(source,name);if(valid(value,name))result[name]=value;}return result;}
function history(source,projectRow){
 if(Array.isArray(source))return source.map(row=>{const value=projectRow(row);return Object.keys(value).length?value:null;});
 const result={};if(object(source))for(const name of Object.keys(source)){const value=own(source,name),row=projectRow(value);if(Object.keys(row).length)set(result,name,row);}return result;
}
function salaryChange(row){const result=copyFields(row,SALARY_NUMBERS,v=>v===null||number(v));const fecha=own(row,'fecha'),tipo=own(row,'tipo');if(typeof fecha==='string'&&/^(?:\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})$/.test(fecha))result.fecha=fecha;if(['inicial','aumento','reduccion','ajuste'].includes(tipo))result.tipo=tipo;const ts=own(row,'ts');if(number(ts))result.ts=ts;for(const field of ['usuario','version']){const value=own(row,field);if(text(value))result[field]=value;}return result;}
function employmentChange(row){const result={},fecha=own(row,'fecha'),tipo=own(row,'tipo');if(typeof fecha==='string'&&/^(?:\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})$/.test(fecha))result.fecha=fecha;if(['alta','baja','licencia'].includes(tipo))result.tipo=tipo;return result;}
function hrAttachment(record){const id=own(record,'key');if(!key(id))return {};const result={key:id};for(const field of ['nombre','tipo']){const value=own(record,field);if(text(value))result[field]=value;}return result;}
function hrChange(record){const result=copyFields(record,['tipo','fecha','usuario','motivo','obs'],text),ts=own(record,'ts');if(number(ts))result.ts=ts;const refs=own(record,'adjuntos');if(object(refs)||Array.isArray(refs))result.adjuntos=history(refs,hrAttachment);const single=own(record,'adjunto');if(object(single)){const ref=hrAttachment(single);if(Object.keys(ref).length)result.adjunto=ref;}return result;}
function employee(record,isOwn,staffDetails){
 const result=copyFields(record,PUBLIC,(v,name)=>name==='activo'?typeof v==='boolean':['legajo','cargoId'].includes(name)?scalar(v):text(v));
 if(!isOwn)return result;
 for(const name of OWN){const value=own(record,name);if(name==='dni'?scalar(value):text(value))result[name]=value;}
 const bank=own(record,'cuentaBanco');if(scalar(bank))result.cuentaBanco=bank;else if(object(bank))result.cuentaBanco=copyFields(bank,BANK,scalar);
 // The vacation reader uses only the dates when a legacy profile lacks fechaIngreso.
 const changes=own(record,'historial');if(object(changes)||Array.isArray(changes)){if(staffDetails)result.historial=history(changes,hrChange);else if(!result.fechaIngreso)result.historial=history(changes,employmentChange);}
 return result;
}
function cargo(record,isOwn){
 if(!isOwn){const nombre=own(record,'nombre');return {nombre:text(nombre)?nombre:''};}
 const result=copyFields(record,CARGO_TEXT,(v,name)=>name==='id'?scalar(v):text(v));for(const name of CARGO_NUMBERS){const value=own(record,name);if(number(value))result[name]=value;}
 const solo=own(record,'soloComision');if(typeof solo==='boolean')result.soloComision=solo;
 const changes=own(record,'historialValorHora');if(object(changes)||Array.isArray(changes))result.historialValorHora=history(changes,salaryChange);
 return result;
}
function project(employees,cargos,ownId,options){
 const staff={},rates={},person=key(ownId)?own(employees,ownId):undefined,cargoId=own(person,'cargoId');
 if(object(employees)||Array.isArray(employees))for(const name of Object.keys(employees)){const value=own(employees,name);if(object(value))set(staff,name,employee(value,own(options,'staffDetails')===true||key(ownId)&&name===ownId,own(options,'staffDetails')===true));}
 if(object(cargos)||Array.isArray(cargos))for(const name of Object.keys(cargos)){const value=own(cargos,name);if(object(value))set(rates,name,cargo(value,own(options,'rates')===true||scalar(cargoId)&&name===String(cargoId)));}
 return {empleados:staff,cargos:rates};
}
function moduleAllowed(config,name,role){
 if(config===null)return INTERNAL.has(role)&&(['ctaemp','dashboard'].includes(name)||['configuracion','comisiones'].includes(name)&&role==='admin'||name==='empleados'&&HR_EDIT_DEFAULTS.has(role));
 if(!object(config)||own(config,'indiceVersion')!==2||!object(own(config,'indiceModulos'))||own(own(config,'indiceModulos'),name)!==true)return false;
 const blocked=own(config,'bloqueados');return (!Object.hasOwn(config,'bloqueados')||object(blocked)||Array.isArray(blocked))&&!Object.values(blocked||{}).includes(name);
}
function actionAllowed(config,group,name,defaults,role){
 if(config===null)return defaults.has(role);
 if(!object(config))return false;const actions=own(config,'acciones');if(Object.hasOwn(config,'acciones')&&!object(actions))return false;
 const section=own(actions,group);if(object(actions)&&Object.hasOwn(actions,group)&&!object(section))return false;
 return object(section)&&Object.hasOwn(section,name)?own(section,name)===true:defaults.has(role);
}
function ownAccess(config,role){return moduleAllowed(config,'ctaemp',role)||moduleAllowed(config,'dashboard',role)&&actionAllowed(config,'dashboard','miCuenta',OWN_DEFAULTS,role);}
function viewSelection(req){if(!req?.url)return false;try{const query=new URL(req.url,'http://localhost').searchParams;return query.has('verComo')||query.has('viewProfile');}catch(_){throw fail(400,'Solicitud de directorio inválida');}}
function financialConfigAccess(identity){return !!identity&&uidKey(identity.uid)&&Object.hasOwn(identity,'permissions')&&identity.permissions!==undefined&&identity.role==='admin'&&!identity.viewAs&&(moduleAllowed(identity.permissions,'configuracion','admin')||moduleAllowed(identity.permissions,'comisiones','admin'));}
function directoryAccess(identity){
 const denied={staffDetails:false,rates:false};if(!identity||!uidKey(identity.uid)||!key(identity.role)||EXTERNAL.has(identity.role)||identity.viewAs||!Object.hasOwn(identity,'permissions')||identity.permissions===undefined)return denied;
 const cfg=identity.permissions,role=identity.role;if(!INTERNAL.has(role)&&(!object(cfg)||own(cfg,'indiceVersion')!==2||!object(own(cfg,'indiceModulos'))))return denied;
 const staffDetails=moduleAllowed(cfg,'ctaemp',role)&&actionAllowed(cfg,'empleados','verCuentas',HR_ADMIN_DEFAULTS,role)||moduleAllowed(cfg,'empleados',role)&&actionAllowed(cfg,'empleados','editar',HR_EDIT_DEFAULTS,role);
 return {staffDetails,rates:staffDetails||moduleAllowed(cfg,'configuracion',role)};
}
function createEmployeeDirectory({auth,db}){
 async function authorize(req){
  const match=String(req?.headers?.authorization||req?.headers?.Authorization||'').match(/^Bearer\s+(\S+)$/i);if(!match)throw fail(401,'Sesión requerida');
  let user;try{user=await auth.verifyIdToken(match[1],true);}catch(error){throw fail(error?.statusCode===403?403:401,error?.statusCode===403?'Actualizá tu acceso y volvé a ingresar':'Sesión inválida');}if(!uidKey(user?.uid))throw fail(401,'Sesión inválida');
  const role=(await db.ref('sv_chat_roles/'+user.uid).get()).val();if(!object(role)||role.activo!==true||!key(role.rol)||EXTERNAL.has(role.rol))throw fail(403,'Usuario sin acceso');
  const cfg=(await db.ref('sv_permisos/'+role.rol).get()).val();if(!INTERNAL.has(role.rol)&&(!object(cfg)||cfg.indiceVersion!==2||!object(cfg.indiceModulos)))throw fail(403,'Usuario sin acceso');
  return {uid:user.uid,ownAccess:ownAccess(cfg,role.rol),role:role.rol,permissions:cfg,viewAs:viewSelection(req)};
 }
 async function read(identity){
  if(!uidKey(identity?.uid))throw fail(403,'Perfil no verificado');
  const profiles=(await db.ref('sv_usuarios').orderByChild('uid').equalTo(identity.uid).get()).val()||{},matches=Object.entries(profiles).filter(([,p])=>object(p)&&p.uid===identity.uid&&p.activo!==false);
  if(matches.length!==1)throw fail(403,'Perfil no verificado');const [profileKey,profile]=matches[0];if(identity.role&&profile.rol!==undefined&&profile.rol!==identity.role)throw fail(403,'Perfil no verificado');
  const [employees,cargos]=await Promise.all(['sisventas/empleados','sisventas/config/cargos'].map(async path=>(await db.ref(path).get()).val()||{}));
  const candidate=key(profile.empleadoFbKey)&&own(employees,profile.empleadoFbKey),ownId=object(candidate)&&candidate.activo!==false?profile.empleadoFbKey:'';
  const binding={perfilFbKey:profileKey},ref=db.ref('sv_empleado_uid/'+identity.uid),before=(await ref.get()).val();if(before?.perfilFbKey!==profileKey)await ref.set(binding);
  return project(employees,cargos,identity.ownAccess===true?ownId:'',directoryAccess(identity));
 }
 return {authorize,read};
}
module.exports={createEmployeeDirectory,project,moduleAllowed,ownAccess,financialConfigAccess,directoryAccess};
