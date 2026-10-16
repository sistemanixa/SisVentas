'use strict';
// Plan por defecto. --check solo lee/compila; --apply exige huellas explícitas,
// cliente publicado, API disponible y copia privada antes de cambiar reglas.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {gcloud}=require('./lib/gcloud-cli.cjs'),index=require('../js/core/permission-index'),{rulesProtectPasswords}=require('../cotizador/password-policy');
const root=path.resolve(__dirname,'..'),base='https://nixa-sisventas-default-rtdb.firebaseio.com/';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const permissionHash=x=>hash(ordered(x));
const baseline='2fab3dfbda44e88c165729f4ab41bdcd8c3b36318f8dd280d81286675a20b56c';
function preparePermissions(source){
 assert.equal(source?._version,7,'Revisar una versión de permisos distinta de la auditada');
 const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
 assert.deepEqual(Object.keys(source).filter(k=>k!=='_version').sort(),roles.slice().sort(),'Cambió el inventario de roles');
 for(const role of roles){assert.ok(source[role]&&typeof source[role]==='object');if(role!=='admin')assert.ok(Array.isArray(source[role].bloqueados),'Revisar el rol sin bloqueos explícitos');}
 return index.build(source);
}
async function main(){
 const args=process.argv.slice(2),arg=name=>args.includes(name)?args[args.indexOf(name)+1]:'';
 const apply=args.includes('--apply'),check=args.includes('--check');
 const file=path.join(root,'security/database.compact-final.candidate.json'),candidate=JSON.parse(fs.readFileSync(file));
 assert.ok(rulesProtectPasswords(candidate));assert.equal(candidate.rules.sisventas['.read'],false);assert.equal(candidate.rules.sisventas['.write'],false);
 if(!apply&&!check){console.log(JSON.stringify({mode:'plan',candidate:path.relative(root,file),sha256:hash(candidate),writes:'Solo --apply autorizado: índice de sv_permisos y reglas. Nunca reemplaza la base comercial.'}));return;}
 if(apply){for(const name of ['--expected-rules-sha','--expected-permissions-sha'])assert.match(arg(name),/^[a-f0-9]{64}$/,'Falta huella explícita '+name);assert.equal(arg('--expected-rules-sha'),hash(candidate));}
 const token=gcloud(['auth','print-access-token']),headers={Authorization:'Bearer '+token,'Content-Type':'application/json','X-Goog-User-Project':'nixa-sisventas'};
 async function get(url,etag=false){const r=await fetch(url,{headers:{...headers,...(etag?{'X-Firebase-ETag':'true'}:{})},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Lectura HTTP '+r.status);return {data:await r.json(),etag:r.headers.get('etag')};}
 const [rules,permissions]=await Promise.all([get(base+'.settings/rules.json',true),get(base+'sv_permisos.json',true)]);
 assert.equal(hash(rules.data),arg('--base-sha')||baseline,'Cambió la base remota. No reemplazarla');assert.ok(rulesProtectPasswords(rules.data));
 const next=preparePermissions(permissions.data);
 const compile=await fetch(base+'.settings/rules.json?dryRun=true',{method:'PUT',headers,body:JSON.stringify(candidate),signal:AbortSignal.timeout(90000)});
 if(!compile.ok)throw Error('Compilación de reglas HTTP '+compile.status);await compile.body?.cancel();
 const summary={mode:apply?'apply':'check',baseSha:hash(rules.data),candidateSha:hash(candidate),permissionsBeforeSha:permissionHash(permissions.data),permissionsAfterSha:permissionHash(next),compiled:true,applied:false};
 if(!apply){console.log(JSON.stringify(summary));return;}
 assert.equal(arg('--expected-permissions-sha'),permissionHash(permissions.data),'La configuración cambió desde la revisión');
 const site=await fetch('https://ventas.sistemanixa.com/index.html?_audit='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(25000)});assert.equal(site.status,200);assert.match(await site.text(),/js\/app\.v3\.11\.11\.js/,'Publicar y verificar antes el cliente compatible');
 const endpoint=await fetch('https://cotizador-171899432710.southamerica-east1.run.app/usuarios/perfil',{signal:AbortSignal.timeout(25000)});assert.equal(endpoint.status,401,'Activar primero el API compatible');await endpoint.body?.cancel();
 assert.ok(permissions.etag,'No aplicar la configuración sin control condicional');
 const backup=path.join(root,'tmp','audit-cutover-'+Date.now());fs.mkdirSync(backup,{recursive:true});
 fs.writeFileSync(path.join(backup,'rules-before.private.json'),JSON.stringify(rules.data));fs.writeFileSync(path.join(backup,'permissions-before.private.json'),JSON.stringify(permissions.data));
 const recheck=await get(base+'.settings/rules.json');assert.equal(hash(recheck.data),summary.baseSha,'Las reglas cambiaron durante la preparación');
 const putPermissions=await fetch(base+'sv_permisos.json',{method:'PUT',headers:{...headers,'if-match':permissions.etag},body:JSON.stringify(next),signal:AbortSignal.timeout(30000)});
 if(!putPermissions.ok)throw Error('No se confirmó el índice: HTTP '+putPermissions.status+'. Leer el estado antes de reintentar');await putPermissions.body?.cancel();
 assert.equal(permissionHash((await get(base+'sv_permisos.json')).data),summary.permissionsAfterSha);
 const lastCheck=await get(base+'.settings/rules.json');assert.equal(hash(lastCheck.data),summary.baseSha,'Las reglas cambiaron: índice preparado, corte detenido');
 const putRules=await fetch(base+'.settings/rules.json',{method:'PUT',headers:{...headers,...(rules.etag?{'if-match':rules.etag}:{})},body:JSON.stringify(candidate),signal:AbortSignal.timeout(90000)});
 if(!putRules.ok)throw Error('No se confirmó el corte: HTTP '+putRules.status+'. Leer reglas antes de reintentar');await putRules.body?.cancel();
 assert.equal(hash((await get(base+'.settings/rules.json')).data),summary.candidateSha);
 summary.applied=true;summary.backup=path.relative(root,backup);fs.writeFileSync(path.join(backup,'result.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={preparePermissions,hash,permissionHash};
