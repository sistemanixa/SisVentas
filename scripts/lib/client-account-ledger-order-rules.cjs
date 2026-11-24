'use strict';
const crypto=require('node:crypto'),PATH='rules/sv_client_accounts/v1/ledgers/$scope/$client/rows/.read';
function prepare(input){
 const out=structuredClone(input),row=out?.rules?.sv_client_accounts?.v1?.ledgers?.$scope?.$client?.rows,old=row?.['.read'],limit='query.limitToFirst > 0 && query.limitToFirst <= 50';
 if(typeof old!=='string'||!/^[)\s]*$/.test(old.slice(old.indexOf(limit)+limit.length))||old.indexOf(limit)!==old.lastIndexOf(limit)||!old.includes('query.orderByKey')||!old.includes('sv_chat_roles')||!old.includes('sv_permisos')||!old.includes('$scope')||!old.includes('$client'))throw Error('Revisar la regla vigente de historial antes de cambiar su dirección.');
 row['.read']=old.replace(limit,'((query.limitToFirst !== null && query.limitToFirst > 0 && query.limitToFirst <= 50 && query.limitToLast === null) || (query.limitToLast !== null && query.limitToLast > 0 && query.limitToLast <= 50 && query.limitToFirst === null))');
 const hash=value=>crypto.createHash('sha256').update(value).digest('hex');return{rules:out,manifest:{path:PATH,before:hash(old),after:hash(row['.read']),changedLeaves:1}};
}
module.exports={prepare,PATH};
