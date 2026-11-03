'use strict';
const crypto=require('node:crypto');
const ROOT='sv_client_accounts/v1';
const uid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
// Same normalization as commercial-ownership; accents deliberately remain distinct.
const normalize=v=>String(v||'').trim().normalize('NFC').toLocaleLowerCase('es');
const hash=v=>crypto.createHash('sha256').update(normalize(v)).digest('hex');
const fail=()=>Object.assign(Error('No se puede verificar un ámbito vacío. Un administrador debe revisar su habilitación.'),{code:'SV_CLIENT_ACCOUNTS_INCOMPLETE'});
function fromSale(record){
 if(!record||typeof record!=='object'||Array.isArray(record))throw fail();
 let explicit=[];
 if(Object.hasOwn(record,'responsableUid'))explicit=[record.responsableUid];
 else explicit=['creadaPorUid','creadoPorUid','usuarioUid','empleadoUid'].map(k=>record[k]).filter(Boolean);
 const names=explicit.length||Object.hasOwn(record,'responsableUid')?[]:['creadaPor','creadoPor','createdBy','usuario'].map(k=>record[k]).filter(Boolean);
 return{schema:1,complete:true,uids:[...new Set(explicit.filter(uid))].sort(),legacyAliases:[...new Set(names.map(hash))].sort()};
}
function validate(value){if(value?.schema!==1||value.complete!==true||!Array.isArray(value.uids)||!Array.isArray(value.legacyAliases)||value.uids.some(v=>!uid(v))||value.legacyAliases.some(v=>typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v)))throw fail();return value;}
function additions(rows){const patch={};for(const row of rows){const value=validate(row);for(const id of value.uids)patch[ROOT+'/ownerUIDHistory/'+id]=true;for(const alias of value.legacyAliases)patch[ROOT+'/ownerAliasHistory/'+alias]=true;}return patch;}
// Proof only: never writes coverage and never treats absent evidence as an empty history.
async function proveEmpty({identity,aliases,generation,coverage,evidence,read}){
 if(!uid(identity)||!Array.isArray(aliases)||!aliases.length||aliases.some(v=>typeof v!=='string'||!normalize(v))||typeof read!=='function'||coverage?.ready!==true||coverage.schema!==1||coverage.ownerEvidenceVersion!==1||coverage.generation!==generation||!Number.isSafeInteger(coverage.revision)||coverage.revision<1||!Number.isSafeInteger(coverage.salesRecords)||coverage.salesRecords<0||evidence?.schema!==1||evidence.ready!==true||evidence.generation!==generation||evidence.revision!==coverage.revision||evidence.salesRecords!==coverage.salesRecords)throw fail();
 const paths=[ROOT+'/owners/'+identity,ROOT+'/ownerUIDHistory/'+identity,...new Set(aliases.map(a=>ROOT+'/ownerAliasHistory/'+hash(a)))];
 for(const path of paths)if(await read(path)!==null)throw fail();
 return{schema:1,generation,revision:coverage.revision,uid:identity,verifiedEmpty:true};
}
module.exports={ROOT,fromSale,validate,additions,proveEmpty};
