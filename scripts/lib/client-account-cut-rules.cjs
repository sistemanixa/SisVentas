'use strict';
// Proposal only. Call against a freshly read baseline, test in the emulator,
// then compare that exact baseline again before a separately authorized cut.
const Native=require('./native-collections-rules.cjs'),Accounts=require('./client-account-rules.cjs');
function prepare(baseline){
 const native=Native.build(baseline),users=native.rules.sv_usuarios;
 if(!users||typeof users!=='object'||Array.isArray(users))throw Error('Falta la configuración de Usuarios para comprobar su consulta por UID.');
 const index=users['.indexOn'];
 if(index!==undefined&&typeof index!=='string'&&(!Array.isArray(index)||index.some(value=>typeof value!=='string')))throw Error('El índice de Usuarios requiere revisión.');
 users['.indexOn']=[...new Set([...(Array.isArray(index)?index:typeof index==='string'?[index]:[]),'uid'])];
 return Accounts.prepare(native);
}
module.exports={prepare};
