'use strict';
// Offline proposal only. No credentials, HTTP requests, or deployment path.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {GUARD,PRESENCE_RETIRE_OWN:RETIRE_OWN,rulesProtectPasswords}=require('../cotizador/password-policy');
function build(input){
 const result=structuredClone(input),rules=result?.rules;
 if(!rules||![false,'false',undefined].includes(rules['.read'])||![false,'false',undefined].includes(rules['.write'])||![false,'false',undefined].includes(rules.sv_chat_presencia?.['.write'])||![false,'false',undefined].includes(rules.sv_chat_presencia?.['$uid']?.['.write']))throw Error('Hay una concesión padre incompatible');
 if(!rules.sv_access_resets||!rules.sv_access_control)throw Error('Aplicar sólo después del guard de acceso revisado');
 const node=rules.sv_chat_presencia?.['$uid']?.['$session'];
 if(!node||node['$other']?.['.validate']!==false||node.uid?.['.validate']!=='newData.val() === auth.uid')throw Error('Esquema de presencia inesperado');
 const previous=node['.write'],prefix='('+RETIRE_OWN+') || (';
 if(typeof previous!=='string')throw Error('Falta autorización existente');
 if(previous.startsWith(prefix)){if(!rulesProtectPasswords(result))throw Error('Excepción o política de acceso alterada');return result;}
 if(!previous.endsWith(' && '+GUARD)||!previous.includes('auth.uid === $uid'))throw Error('La base no conserva el guard de acceso esperado');
 // Keep the complete existing permission branch (including the access guard)
 // intact. The sole new branch authorizes removing an existing own session.
 node['.write']=prefix+previous+')';
 if(!rulesProtectPasswords(result))throw Error('La candidata no conserva la política de acceso');
 return result;
}
if(require.main===module){
 const [source,destination]=process.argv.slice(2);
 if(!source||!destination||!destination.endsWith('.candidate.json'))throw Error('Uso: node scripts/prepare-presence-retirement.cjs base-local.json salida.candidate.json');
 const result=build(JSON.parse(fs.readFileSync(source,'utf8')));fs.mkdirSync(path.dirname(path.resolve(destination)),{recursive:true});fs.writeFileSync(destination,JSON.stringify(result,null,2)+'\n');
 console.log('Candidata local, sin publicar. SHA256 '+crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex'));
}
module.exports={build,RETIRE_OWN};
