'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
// Dedicated demo project and explicit loopback endpoints. No deployment, gcloud,
// production credentials or real mail transport are used by these tests.
function run(){
  const cli=path.join(root,'tmp/firebase-security-tools/node_modules/firebase-tools/lib/bin/firebase.js');
  if(!fs.existsSync(cli))throw Error('Instalar herramientas demo indicadas en docs/TRASLADO_NUBE_SEGURIDAD.md');
  const config=path.join(root,'tmp/user-access-emulators.json');
  fs.copyFileSync(path.join(root,'security/database.password-access.candidate.json'),path.join(root,'tmp/user-access-emulator.rules.json'));
  fs.copyFileSync(path.join(root,'security/storage.password-access.candidate.rules'),path.join(root,'tmp/user-access-emulator.storage.rules'));
  fs.writeFileSync(config,JSON.stringify({database:{rules:'user-access-emulator.rules.json'},storage:{rules:'user-access-emulator.storage.rules'},emulators:{database:{host:'127.0.0.1',port:9005},auth:{host:'127.0.0.1',port:9098},storage:{host:'127.0.0.1',port:9198},ui:{enabled:false},singleProjectMode:true}}));
  const env={...process.env,CI:'true',GCLOUD_PROJECT:'demo-sisventas-access',GOOGLE_CLOUD_PROJECT:'demo-sisventas-access'};
  for(const key of ['GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_GHA_CREDS_PATH','FIREBASE_TOKEN','CLOUDSDK_AUTH_ACCESS_TOKEN'])delete env[key];
  const result=spawnSync(process.execPath,[cli,'emulators:exec','--only','auth,database,storage','--project','demo-sisventas-access','--config',config,'node --test --test-concurrency=1 test/user-access.integration.cjs'],{cwd:root,env,stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
}
try{run();}catch(e){console.error(e.message);process.exitCode=1;}
