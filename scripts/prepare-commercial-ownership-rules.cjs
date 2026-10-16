'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const baseHash='e5dbd9b0ca5e7e63f7966184a39350184d55fa9d7c4111c23e82ef0beb4dbc10';
function build(input){
 if(crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')!==baseHash)throw Error('La base no coincide con las reglas efectivas revisadas');
 const r=structuredClone(input),s=r.rules.sisventas;if(s['.read']!==false||s['.write']!==false)throw Error('Hay una concesión padre incompatible');
 const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()",admin=`${role} === 'admin'`;
 const targetRole="root.child('sv_chat_roles').child(newData.child('responsableUid').val()).child('rol').val()";
 function targetModule(m){const cfg=`root.child('sv_permisos').child(${targetRole})`;return `((${cfg}.exists() && ${cfg}.child('indiceVersion').val() === 2 && ${cfg}.child('indiceModulos').child('${m}').val() === true) || (!${cfg}.exists() && (${['admin','administrativo','vendedor','tecnico_vendedor'].map(v=>targetRole+" === '"+v+"'").join(' || ')})))`;}
 for(const domain of ['ventas','presupuestos']){
  const node=s[domain],id=domain==='ventas'?'$venta':'$presupuesto',record=node[id]||{},read=node['.read'],write=node['.write'];
  if(!read||!write)throw Error('Dominio incompleto '+domain);
  const sameOwner="newData.child('responsableUid').val() === data.child('responsableUid').val()";
  const own="data.child('responsableUid').val() === auth.uid";
  const create="!data.exists() && newData.child('responsableUid').val() === auth.uid";
  node['.read']=`(${read}) && (${admin})`;node['.write']=false;
  record['.read']=`(${read}) && (${admin} || ${own})`;
  record['.write']=`(${write}) && (${admin} || (newData.exists() && ((${create}) || (${own} && ${sameOwner}))))`;
  const frozen=['creadaPor','creadaPorRol','creadaPorUid','creadoPor','creadoPorUid','createdBy','usuario','ts','creadoEn','creadorOriginalUid','creadorOriginalNombre'];
  const identityStable=frozen.map(k=>`(!data.child('${k}').exists() || newData.child('${k}').val() === data.child('${k}').val())`).join(' && ');
  const assignmentStable=['responsableUid','responsableNombre','responsableRol','responsableRevision','responsableActualizadoEn'].map(k=>`newData.child('${k}').val() === data.child('${k}').val()`).join(' && ');
  const target=`root.child('sv_chat_roles').child(newData.child('responsableUid').val()).child('activo').val() === true && (${(domain==='ventas'?['venta','detalle']:['presupuesto']).map(targetModule).join(' || ')})`;
  const targetValid=`(${sameOwner} || (!newData.child('responsableUid').exists() && !data.child('responsableUid').exists()) || (${target}))`;
  const dateStable="(!data.child('fecha').exists() || newData.child('fecha').val() === data.child('fecha').val() || (newData.child('fechaCambioManual').child('anteriorValor').val() === data.child('fecha').val() && newData.child('fechaCambioManual').child('nueva').val() === newData.child('fecha').val() && newData.child('fechaCambioManual').child('actorUid').val() === auth.uid))";
  const newAuthor="(data.child('creadorOriginalUid').exists() || (data.exists() && !newData.child('creadorOriginalUid').exists()) || (newData.child('creadorOriginalUid').isString() && ("+admin+" || (!data.exists() && newData.child('creadorOriginalUid').val() === auth.uid)) && newData.child('creadorOriginalNombre').val() === root.child('sv_chat_directorio').child(newData.child('creadorOriginalUid').val()).child('nombre').val()))";
  const sourceBudget="root.child('sisventas').child('presupuestos').child(newData.child('presupuestoFbKey').val())";
  const conversionAuthor=`(${sourceBudget}.exists() && (${admin} || ${sourceBudget}.child('responsableUid').val() === auth.uid) && ${id} === 'ppto_' + newData.child('presupuestoFbKey').val() && ${sourceBudget}.child('creadorOriginalUid').isString() && newData.child('creadorOriginalUid').val() === ${sourceBudget}.child('creadorOriginalUid').val() && newData.child('creadorOriginalNombre').val() === ${sourceBudget}.child('creadorOriginalNombre').val() && newData.child('usuario').val() === newData.child('creadorOriginalNombre').val() && newData.child('creadaPor').val() === newData.child('creadorOriginalNombre').val() && newData.child('convertidaPorUid').val() === auth.uid)`;
  const authorValid=domain==='ventas'?`((!data.exists() && newData.child('presupuestoFbKey').exists()) ? ${conversionAuthor} : ${newAuthor})`:newAuthor;
  record['.validate']=`(${record['.validate']||'true'}) && (${identityStable}) && (!data.exists() || ${admin} || (${assignmentStable})) && (${targetValid}) && ${dateStable} && ${authorValid}`;
  const ownerAtRoot=`root.child('sisventas').child('${domain}').child(${id}).child('responsableUid').val() === auth.uid`;
  function closeChildren(n){for(const [k,v]of Object.entries(n)){if(k==='.write')n[k]=`(${v}) && (${admin} || ${ownerAtRoot})`;else if(v&&typeof v==='object')closeChildren(v);}}
  for(const [k,v]of Object.entries(record))if(!k.startsWith('.')&&v&&typeof v==='object')closeChildren(v);
  node[id]=record;
 }
 return r;
}
function source(){return JSON.parse(execFileSync('git',['show','5193bc10d3a215f1ca1f5cd5e87ebe6e0ec732d9:security/database.compact-final.candidate.json'],{maxBuffer:2e6,encoding:'utf8'}));}
if(require.main===module){const output=path.resolve(process.argv[2]||'tmp/commercial-ownership.candidate.json');fs.mkdirSync(path.dirname(output),{recursive:true});const rules=build(source());fs.writeFileSync(output,JSON.stringify(rules,null,2));console.log('Candidata local, sin despliegue: '+output);console.log('SHA256 '+crypto.createHash('sha256').update(JSON.stringify(rules)).digest('hex'));}
module.exports={build,source,baseHash};
