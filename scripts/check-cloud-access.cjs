'use strict';
// Diagnóstico de lectura. No inicia sesión, concede permisos ni aplica reglas.
const {gcloud}=require('./lib/gcloud-cli.cjs'),crypto=require('node:crypto');
const project='nixa-sisventas';
async function main(){
  let identities,description;
  try{identities=JSON.parse(gcloud(['auth','list','--filter=status:ACTIVE','--format=json(status)']));}
  catch(_){throw Error('Google Cloud CLI ausente o sesión no consultable. Configurar acceso en este entorno sin copiar credenciales al repositorio.');}
  if(!identities.length)throw Error('No hay sesión activa de gcloud en este entorno.');
  try{description=JSON.parse(gcloud(['projects','describe',project,'--format=json(projectId,lifecycleState)']));}
  catch(_){throw Error('La sesión existe pero no pudo consultar el proyecto esperado. Revisar IAM/red sin ampliar permisos automáticamente.');}
  console.log(JSON.stringify({gcloudSession:true,project:description.projectId,state:description.lifecycleState}));
  if(!process.argv.includes('--firebase'))return;
  let token;
  try{token=gcloud(['auth','print-access-token']);}catch(_){throw Error('No se pudo obtener un token temporal; no se muestra ni se guarda.');}
  const response=await fetch('https://nixa-sisventas-default-rtdb.firebaseio.com/.settings/rules.json',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
  token='';
  if(!response.ok)throw Error('Lectura de reglas Firebase rechazada: HTTP '+response.status+'. No se modificó nada.');
  const data=await response.json();if(!data.rules)throw Error('Respuesta de reglas inesperada.');
  console.log(JSON.stringify({firebaseRulesReadable:true,rulesSha256:crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),note:'Solo lectura de reglas; sin datos comerciales ni cambios remotos.'}));
}
if(require.main===module)main().catch(e=>{console.error(e.message.replace(/ya29\.[A-Za-z0-9._-]+/g,'[REDACTADO]'));process.exitCode=1;});
