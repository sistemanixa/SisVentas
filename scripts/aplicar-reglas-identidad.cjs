'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{isDeepStrictEqual}=require('node:util');
const {restringirIdentidad}=require('./generar-reglas-identidad.cjs');
async function main(){
  const readiness=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'verificar-identidades-firebase.cjs')],{encoding:'utf8',windowsHide:true}));
  if(!readiness.aptoParaRestringir)throw Error('Identidades inconsistentes: no aplicar');
  const token=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
  const base='https://nixa-sisventas-default-rtdb.firebaseio.com/';
  async function request(route,options={}){
    const r=await fetch(base+route,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
    return r;
  }
  const previousResponse=await request('.settings/rules.json');
  if(!previousResponse.ok)throw Error('No se pudieron leer las reglas vigentes');
  const previous=await previousResponse.json();
  const baseline=JSON.parse(fs.readFileSync('docs/auditoria-v3.6.0/reglas-rtdb.json','utf8'));
  if(!isDeepStrictEqual(previous,baseline))throw Error('Las reglas vigentes difieren de las probadas: no aplicar');
  const candidate=restringirIdentidad(previous);
  const checked=JSON.parse(fs.readFileSync('security/database.identity.rules.json','utf8'));
  if(!isDeepStrictEqual(candidate,checked))throw Error('El archivo candidato difiere del probado');
  if(!process.argv.includes('--apply')){console.log('Verificación previa correcta. No se modificaron reglas.');return;}
  const backup=path.join('tmp','backups','reglas-identidad-'+Date.now()+'.json');
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  fs.writeFileSync(backup,JSON.stringify(previous,null,2));
  const response=await request('.settings/rules.json',{method:'PUT',body:JSON.stringify(candidate)});
  if(!response.ok)throw Error('Firebase rechazó la publicación de reglas');
  const verify=await request('.settings/rules.json');
  if(!verify.ok||!isDeepStrictEqual(await verify.json(),candidate))throw Error('No se pudo confirmar la versión aplicada; revisar servidor');
  const identitiesResponse=await request('sv_chat_roles.json');
  if(!identitiesResponse.ok)throw Error('No se pudieron comprobar identidades');
  const identities=await identitiesResponse.json();
  let checks=0;
  for(const [uid,identity] of Object.entries(identities)){
    const override=encodeURIComponent(JSON.stringify({uid}));
    const r=await request('sisventas/config/version.json?auth_variable_override='+override);
    if(r.ok!==(identity.activo===true))throw Error('Verificación de acceso inesperada; revisar reglas');
    checks++;
  }
  for(const auth of [null,{uid:'verification-unregistered-identity'}]){
    const r=await request('sisventas/config/version.json?auth_variable_override='+encodeURIComponent(JSON.stringify(auth)));
    if(r.status!==401&&r.status!==403)throw Error('La sesión no autorizada no fue bloqueada');
    checks++;
  }
  console.log(JSON.stringify({reglasAplicadas:true,accesosVerificados:checks,datosComercialesModificados:false,respaldo:backup}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
