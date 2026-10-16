'use strict';
// Sin --apply solo compila remotamente. Nunca modifica datos de negocio.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util');
const {gcloud}=require('./lib/gcloud-cli.cjs'),{build,baseHash,source}=require('./prepare-commercial-ownership-rules.cjs');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function main(){
 const apply=process.argv.includes('--apply'),expected=process.argv[process.argv.indexOf('--expected-candidate')+1];
 const token=gcloud(['auth','print-access-token']),headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const url='https://nixa-sisventas-default-rtdb.firebaseio.com/.settings/rules.json';
 async function request(method='GET',body,extra={},suffix=''){const r=await fetch(url+suffix,{method,headers:{...headers,...extra},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Reglas HTTP '+r.status);return {data:await r.json(),etag:r.headers.get('etag')};}
 const before=await request('GET',null,{'X-Firebase-ETag':'true'}),candidate=build(source()),candidateHash=hash(candidate);
 if(apply&&expected!==candidateHash)throw Error('Indicar --expected-candidate con la huella completa revisada');
 if(isDeepStrictEqual(before.data,candidate)){console.log(JSON.stringify({applied:true,alreadyApplied:true,candidateHash}));return;}
 if(hash(before.data)!==baseHash)throw Error('Cambió la base remota; detener y volver a preparar/probar');
 const backup=path.resolve('tmp/commercial-cutover-'+Date.now());fs.mkdirSync(backup,{recursive:true});fs.writeFileSync(path.join(backup,'rules-before.private.json'),JSON.stringify(before.data,null,2));
 // Mismo mecanismo de validación de firebase-tools/lib/rtdb.js y su herramienta
 // oficial validate_security_rules: updateRulesWithClient(...,{dryRun:true}).
 await request('PUT',candidate,{},'?dryRun=true');
 if(!isDeepStrictEqual((await request()).data,before.data))throw Error('La compilación no conservó las reglas remotas');
 if(apply){
  const current=await request();if(!isDeepStrictEqual(current.data,before.data))throw Error('Cambio concurrente de reglas');
  await request('PUT',candidate,before.etag?{'if-match':before.etag}:{});
  const after=await request();if(!isDeepStrictEqual(after.data,candidate))throw Error('La verificación posterior difiere');
 }
 const result={compiled:true,applied:apply,baseHash,candidateHash,backup};fs.writeFileSync(path.join(backup,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
