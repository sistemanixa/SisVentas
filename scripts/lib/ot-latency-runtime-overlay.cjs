'use strict';
// The published REST store deliberately differs from the prepared repository
// runtime. Apply only this reviewed read-scheduling change to its exact bytes.
const crypto=require('node:crypto');
const BASE_STORE_SHA256='e794f63170b178bee3fc5aa0281f6e861c336f13b66cc0301a8630dbe07a6254';
const BEFORE="if(actor?.otLifecycle)require('./ot-lifecycle-policy').validate(actor,await read('sv_chat_roles/'+actor.uid),await read('sv_permisos/'+actor.role));";
const AFTER="if(actor?.otLifecycle){const [profile,permissions]=await Promise.all([read('sv_chat_roles/'+actor.uid),read('sv_permisos/'+actor.role)]);require('./ot-lifecycle-policy').validate(actor,profile,permissions);}";
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function applyStore(bytes,{expectedSha256=BASE_STORE_SHA256}={}){
 const original=Buffer.from(bytes),text=original.toString('utf8');
 if(sha256(original)!==expectedSha256||text.split(BEFORE).length!==2||text.includes(AFTER))throw Error('The reviewed published REST store does not match.');
 return Buffer.from(text.replace(BEFORE,AFTER));
}
module.exports={BASE_STORE_SHA256,BEFORE,AFTER,sha256,applyStore};
