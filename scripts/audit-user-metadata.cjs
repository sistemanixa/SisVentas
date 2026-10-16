const fs=require('fs'),{gcloud}=require('./lib/gcloud-cli.cjs');
(async()=>{
 if(!process.argv.includes('--check')){console.log(JSON.stringify({mode:'plan',reads:'Solo tipos/campos, UID/rol/activo/vínculo y permisos; salida privada en tmp. --check consulta el proyecto.'}));return;}
 fs.mkdirSync('tmp/user-directory-audit',{recursive:true});
 const token=gcloud(['auth','print-access-token']),base='https://nixa-sisventas-default-rtdb.firebaseio.com/';
 const get=async p=>{const r=await fetch(base+p,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Lectura de inventario HTTP '+r.status);return r.json();};
 const [keys,identities,bindings,permissions]=await Promise.all(['sv_usuarios.json?shallow=true','sv_chat_roles.json','sv_empleado_uid.json','sv_permisos.json'].map(get));
 const profiles=[];for(const key of Object.keys(keys||{})){
  const fields=await get('sv_usuarios/'+encodeURIComponent(key)+'.json?shallow=true');const values={};for(const f of ['uid','rol','activo','empleadoFbKey'])values[f]=await get('sv_usuarios/'+encodeURIComponent(key)+'/'+f+'.json');
  profiles.push({key,...values,fieldNames:Object.keys(fields||{}),legacyCredentialFields:Object.keys(fields||{}).filter(f=>/(password|clave|contras|token|secret)/i.test(f))});
 }
 const duplicated=profiles.filter(p=>p.uid&&profiles.filter(q=>q.uid===p.uid).length!==1),badBindings=profiles.filter(p=>p.uid&&p.empleadoFbKey&&p.activo!==false&&identities?.[p.uid]?.activo===true&&bindings?.[p.uid]?.perfilFbKey!==p.key);
 const configurationFieldNames={};for(const name of ['loginRapido','asistente']){const value=await get('sisventas/config/'+name+'.json?shallow=true');configurationFieldNames[name]=value&&typeof value==='object'?Object.keys(value):[];}
 const out={capturedAt:new Date().toISOString(),profiles,identities,bindings,permissions,configurationFieldNames,duplicatedUIDs:duplicated.map(p=>p.key),missingOrWrongBindings:badBindings.map(p=>p.key)};fs.writeFileSync('tmp/user-directory-audit/inventory.private.json',JSON.stringify(out,null,2));
 const response=await fetch('https://ventas.sistemanixa.com/',{method:'HEAD',signal:AbortSignal.timeout(25000)});const headerNames=['content-security-policy','x-frame-options','x-content-type-options','strict-transport-security','referrer-policy'];const headers=Object.fromEntries(headerNames.map(k=>[k,response.headers.get(k)]));fs.writeFileSync('tmp/user-directory-audit/site-headers.json',JSON.stringify(headers,null,2));
 console.log(JSON.stringify({profiles:profiles.length,duplicateUIDs:duplicated.length,missingOrWrongBindings:badBindings.length,profileCredentialLikeFieldNames:profiles.reduce((n,p)=>n+p.legacyCredentialFields.length,0),configurationCredentialLikeFieldNames:Object.values(configurationFieldNames).flat().filter(k=>/(password|pass|clave|token|secret)/i.test(k)).length,note:'Los nombres similares incluyen metadatos; no se leyeron valores de credenciales.',permissionRoleKeys:Object.keys(permissions||{}),headers},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
