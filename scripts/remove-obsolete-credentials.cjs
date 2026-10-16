'use strict';
// No lee valores de credenciales ni llama a Firebase Auth. Eliminación puntual
// irreversible, solo tras aprobación explícita de AMBOS campos.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),{gcloud}=require('./lib/gcloud-cli.cjs');
(async()=>{
 const apply=process.argv.includes('--apply'),check=process.argv.includes('--check');
 if(!apply&&!check){console.log(JSON.stringify({mode:'plan',credentialFields:2,readsCredentialValues:false,changesAuthPasswords:false}));return;}
 const inventory=JSON.parse(fs.readFileSync('tmp/user-directory-audit/inventory.private.json')),target=inventory.profiles.filter(p=>p.legacyCredentialFields.includes('claveAdmin'));assert.equal(target.length,1);const profile=target[0];assert.equal(profile.rol,'distribuidora');
 const metadataSha=crypto.createHash('sha256').update(JSON.stringify([profile.key,profile.uid,profile.rol])).digest('hex');
 if(apply){const at=process.argv.indexOf('--profile-metadata-sha');assert.equal(at>=0?process.argv[at+1]:'',metadataSha,'Indicar --profile-metadata-sha del inventario revisado');}
 const token=gcloud(['auth','print-access-token']),headers={Authorization:'Bearer '+token,'Content-Type':'application/json'},base='https://nixa-sisventas-default-rtdb.firebaseio.com/';
 const get=async p=>{const r=await fetch(base+p,{headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Metadatos HTTP '+r.status);return r.json();};
 assert.equal(await get('sv_usuarios/'+profile.key+'/uid.json'),profile.uid);assert.equal(await get('sv_usuarios/'+profile.key+'/rol.json'),'distribuidora');
 const fields=await get('sv_usuarios/'+profile.key+'.json?shallow=true'),config=await get('sisventas/config/loginRapido.json?shallow=true');
 assert.ok(fields.claveAdmin);assert.ok(config.pass);
 if(!apply){console.log(JSON.stringify({mode:'check',metadataSha,credentialFields:2,readSecretValues:false,applied:false}));return;}
 const patch={['sv_usuarios/'+profile.key+'/claveAdmin']:null,'sisventas/config/loginRapido/pass':null};
 const r=await fetch(base+'.json',{method:'PATCH',headers,body:JSON.stringify(patch),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Eliminación no confirmada HTTP '+r.status+'; leer metadatos antes de reintentar');await r.body?.cancel();
 const [after,afterConfig]=await Promise.all([get('sv_usuarios/'+profile.key+'.json?shallow=true'),get('sisventas/config/loginRapido.json?shallow=true')]);assert.equal(after.claveAdmin,undefined);assert.equal(afterConfig.pass,undefined);
 for(const k of Object.keys(fields).filter(k=>k!=='claveAdmin'))assert.ok(Object.hasOwn(after,k));for(const k of Object.keys(config).filter(k=>k!=='pass'))assert.ok(Object.hasOwn(afterConfig,k));
 fs.writeFileSync('tmp/user-directory-audit/obsolete-fields-result.json',JSON.stringify({removed:2,metadataPreserved:true,readSecretValues:false,authUnchanged:true}));console.log(JSON.stringify({removed:2,metadataPreserved:true,readSecretValues:false,authUnchanged:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
