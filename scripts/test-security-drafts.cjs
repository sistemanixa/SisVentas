'use strict';
// Preparación y pruebas locales. Nunca aplica reglas ni usa un proyecto real.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const suites=['known-role-read','domain-reads','employee-account-reads','audit-final-permissions'].map(n=>'test/'+n+'.integration.cjs');
const rules=['known-role-read','domain-read','employee-account-read','audit-final'].map(n=>'security/database.'+n+'.candidate.json');
function check(){
  for(const name of rules){const parsed=JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));if(Object.keys(parsed).join()!=='rules')throw Error('Candidata inesperada: '+name);}
  for(const name of suites){const r=spawnSync(process.execPath,['--check',path.join(root,name)],{stdio:'inherit'});if(r.status!==0)throw Error('Sintaxis inválida: '+name);}
  console.log('OK: cuatro candidatas JSON y cuatro suites con sintaxis válida. Esto no prueba permisos.');
}
function main(){
  check();
  if(!process.argv.includes('--emulator'))return;
  const cli=path.join(root,'tmp/firebase-security-tools/node_modules/firebase-tools/lib/bin/firebase.js');
  if(!fs.existsSync(cli))throw Error('Instalar herramientas según docs/TRASLADO_NUBE_SEGURIDAD.md');
  const env={...process.env,CI:'true',GCLOUD_PROJECT:'demo-sisventas-security',GOOGLE_CLOUD_PROJECT:'demo-sisventas-security'};
  for(const key of ['GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_GHA_CREDS_PATH','FIREBASE_TOKEN','CLOUDSDK_AUTH_ACCESS_TOKEN'])delete env[key];
  const command='node --test --test-concurrency=1 '+suites.join(' ');
  const run=spawnSync(process.execPath,[cli,'emulators:exec','--only','database','--project','demo-sisventas-security','--config','security/firebase.emulator.json',command],{cwd:root,env,stdio:'inherit',windowsHide:true});
  if(run.error)throw run.error;
  process.exitCode=run.status??1;
}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={suites,rules,check};
