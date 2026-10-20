'use strict';
// Herramienta de corte explícito. No es un trabajo programado ni un endpoint.
const crypto=require('node:crypto');
const URL_DB='https://nixa-sisventas-default-rtdb.firebaseio.com';
async function main(args=process.argv.slice(2)){
 if(args.length!==3||args[0]!=='--apply'||args[1]!=='--expected-rules-hash'||!/^[a-f0-9]{64}$/.test(args[2]))throw Error('Requiere --apply --expected-rules-hash SHA256. Leer el protocolo de corte antes de ejecutar.');
 const admin=require('../cotizador/node_modules/firebase-admin');
 const credential=admin.credential.applicationDefault(),accessToken=async()=>(await credential.getAccessToken()).access_token;
 const response=await fetch(URL_DB+'/.settings/rules.json',{headers:{Authorization:'Bearer '+await accessToken()},signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('No se pudo verificar la regla remota; no se inició la preparación');}
 const rules=await response.json(),hash=crypto.createHash('sha256').update(JSON.stringify(rules)).digest('hex');
 if(hash!==args[2])throw Error('Las reglas remotas no coinciden con la candidata revisada; no se inició la preparación');
 const {rulesProtectPasswords}=require('../cotizador/password-policy');if(!rulesProtectPasswords(rules)||!rules.rules?.sv_labor_guard||!rules.rules?.sv_labor_indexes)throw Error('Falta la protección revisada del circuito; no se inició la preparación');
 const store=require('../cotizador/labor-rtdb-store').createLaborRtdbStore({databaseURL:URL_DB,accessToken});
 const guard=require('../cotizador/labor-guard').createLaborGuard({store,leaseMs:60000});
 const result=await require('../cotizador/labor-bootstrap').createLaborBootstrap({guard})();
 console.log(JSON.stringify({project:'nixa-sisventas',rulesHash:hash,...result}));
}
if(require.main===module)main().catch(error=>{console.error(error.statusCode?'Preparación no confirmada ('+error.statusCode+'). Revisar el recibo antes de repetir.':error.message);process.exitCode=1;});
module.exports={main};
