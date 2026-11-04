'use strict';
const Directory=require('./client-account-directory'),Account=require('./client-account-projection'),Domains=require('./domain-read-policy');
const {isDeepStrictEqual:same}=require('node:util');
const fail=message=>Object.assign(Error(message),{code:'SV_CLIENT_HISTORY_CLIENT_INCOMPLETE',statusCode:409});
const {key}=require('./commercial-pages-model');
function create({access,read,readClientAsUser,queryClientMembers}){
 async function resolve(req,clientKey){
  if(!key(clientKey))throw fail('Cliente inválido.');
  const context=await access.authorize(req);
  if(typeof context.revision!=='string'||!context.revision)throw fail('Falta la revisión confiable de autorización.');
  if(!Domains.allows('clientes',context.role,context.moduleAllowed,context.actionAllowed))throw fail('Cliente no autorizado.');
  if(typeof readClientAsUser!=='function')throw fail('Falta la lectura autorizada del cliente.');
  const original=await readClientAsUser(clientKey,context);if(!original||typeof original!=='object'||Array.isArray(original))throw fail('Falta el cliente original autorizado.');
  const paths=['sv_client_history_config','sv_client_history/v1/state','sv_client_accounts_config','sv_client_accounts/v1/coverage/all','sv_commercial_pages_config','sv_commercial_pages/v1/coverage'];
  const snapshot=async()=>structuredClone(await Promise.all(paths.map(read))),before=await snapshot();
  for(let index=0;index<before.length;index+=2){const config=before[index],coverage=before[index+1];if(config?.ready!==true||config.schema!==1||!config.generation||coverage?.ready!==true||coverage.schema!==1||coverage.generation!==config.generation||!Number.isSafeInteger(coverage.revision)||coverage.revision<1)throw fail('Falta la cobertura actual de identidad del cliente.');}
  if(before[1].dependencyManifest!==1)throw fail('Falta el manifiesto de Historial.');
  const dependencies=new Map();
  const point=async path=>{if(!path.startsWith(Directory.ROOT+'/')||dependencies.size>=512)throw fail('La identidad requiere demasiadas referencias.');const value=structuredClone(await read(path));if(dependencies.has(path)&&!same(value,dependencies.get(path)))throw fail('La identidad cambió durante la consulta.');dependencies.set(path,value);return value;};
  const resolved=await Directory.resolve({clienteFbKey:clientKey,...(original.id!=null?{clienteId:original.id}:{})},{read:point});
  if(resolved.identity.status!=='linked'||!key(resolved.identity.recordKey))throw fail('La identidad del cliente es ambigua o incompleta.');
  const selected=dependencies.get(Directory.ROOT+'/clients/'+clientKey);
  if(!selected)throw fail('El cliente seleccionado no tiene identidad preparada.');
  for(const field of Object.keys(selected))if(!same(selected[field],original[field]))throw fail('El cliente original no coincide con su identidad preparada.');
  if(typeof queryClientMembers!=='function')throw fail('Falta la consulta indexada de domicilios.');
  const group=resolved.identity.sourceKey;
  if(!key(group))throw fail('El grupo de domicilios requiere revisión.');
  const memberships=await queryClientMembers(group,101);
  if(!memberships||typeof memberships!=='object'||Array.isArray(memberships)||Object.keys(memberships).length>100)throw fail('El grupo supera el límite de 100 domicilios o está incompleto.');
  for(const [member,binding]of Object.entries(memberships))if(!key(member)||binding?.clienteKey!==group)throw fail('La membresía de domicilios requiere revisión.');
  const memberKeys=[...new Set([clientKey,resolved.identity.recordKey,...Object.keys(memberships)])];if(memberKeys.length>100)throw fail('El grupo supera el límite de 100 domicilios.');
  const originals=new Map([[clientKey,original]]),addresses=[];
  for(const member of memberKeys){const record=originals.has(member)?originals.get(member):await readClientAsUser(member,context);if(!record||typeof record!=='object'||Array.isArray(record))throw fail('Falta un domicilio original autorizado.');originals.set(member,structuredClone(record));const identity=await Directory.resolve({clienteFbKey:member,...(record.id!=null?{clienteId:record.id}:{})},{read:point});if(identity.identity.status!=='linked'||identity.identity.accountKey!==resolved.identity.accountKey)throw fail('Un domicilio pertenece a otra identidad.');const binding=dependencies.get(Directory.ROOT+'/index/'+member);if(binding?.clienteKey===group&&!Object.hasOwn(memberships,member))throw fail('La consulta de membresías omitió un domicilio verificado.');const prepared=dependencies.get(Directory.ROOT+'/clients/'+member);if(!prepared||Object.keys(prepared).some(field=>!same(prepared[field],record[field])))throw fail('Un domicilio no coincide con su identidad preparada.');addresses.push({key:member,label:String(record.dir||record.direccion||record.domicilio||'').slice(0,300),status:identity.address.status});}
  const fresh=await access.authorize(req);if(fresh.uid!==context.uid||fresh.role!==context.role||fresh.revision!==context.revision)throw fail('La autorización cambió.');
  const again=await readClientAsUser(clientKey,fresh);if(!same(again,original))throw fail('El cliente cambió durante la consulta.');
  for(const [member,record]of originals)if(member!==clientKey&&!same(await readClientAsUser(member,fresh),record))throw fail('Un domicilio cambió durante la consulta.');
  if(!same(await queryClientMembers(group,101),memberships))throw fail('Las membresías de domicilios cambiaron.');
  for(const [path,value]of dependencies)if(!same(await read(path),value))throw fail('Las referencias del cliente cambiaron.');
  if(!same(await snapshot(),before))throw fail('La cobertura del cliente cambió.');
  const finalContext=await access.authorize(req);if(finalContext.uid!==context.uid||finalContext.role!==context.role||finalContext.revision!==context.revision)throw fail('La autorización cambió al completar la consulta.');
  const scalar=value=>['string','number','boolean'].includes(typeof value)&&!(typeof value==='number'&&!Number.isFinite(value));
  const contactOf=record=>{const fields={nombre:['nombre'],telefono:['telefono','tel','celular'],email:['email','mail'],direccion:['dir','direccion','domicilio']},result={};for(const [field,aliases]of Object.entries(fields)){const alias=aliases.find(name=>scalar(record[name]));if(alias)result[field]=String(record[alias]).slice(0,field==='telefono'?100:300);}return result;};
  const root=originals.get(resolved.identity.recordKey);if(!root)throw fail('Falta el cliente raíz autorizado.');
  const contact=contactOf(root),members=[...originals].map(([fbKey,record])=>({fbKey,...Object.fromEntries(['id','nombre','estado','activo','categoria','dir','direccion'].filter(field=>scalar(record[field])).map(field=>[field,record[field]]))}));
  return {accountId:Account.hash(resolved.identity.accountKey),identity:{status:'linked',recordKey:resolved.identity.recordKey,label:scalar(root.nombre)?String(root.nombre).slice(0,300):''},contact,selectedContact:contactOf(original),members,selectedClientKey:clientKey,addresses,addressesComplete:true,generation:before[0].generation,revision:before[1].revision};
 }
 return Object.freeze({resolve});
}
module.exports={create};
