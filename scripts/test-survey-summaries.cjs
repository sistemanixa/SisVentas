'use strict';
// Ejecución aislada; sin credenciales, reglas ni registros de producción.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tools=process.env.SV_SECURITY_TOOLS,project='demo-survey-summary-local';
if(!tools)throw Error('Indicar SV_SECURITY_TOOLS con dependencias locales del emulador');
const directory=path.join(root,'tmp/survey-summary-emulator');fs.mkdirSync(directory,{recursive:true});
fs.writeFileSync(path.join(directory,'rules.json'),JSON.stringify({rules:{'.read':false,'.write':false}}));
fs.writeFileSync(path.join(directory,'firebase.json'),JSON.stringify({database:{rules:'rules.json'},emulators:{database:{host:'127.0.0.1',port:9009},ui:{enabled:false},singleProjectMode:true}}));
const env={...process.env,CI:'true',FIREBASE_CLI_DISABLE_USAGE_TRACKING:'true',GCLOUD_PROJECT:project,GOOGLE_CLOUD_PROJECT:project,SV_SECURITY_TOOLS:path.resolve(tools)};
for(const key of ['GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_GHA_CREDS_PATH','FIREBASE_TOKEN','CLOUDSDK_AUTH_ACCESS_TOKEN','FIREBASE_CONFIG'])delete env[key];
const result=spawnSync(process.execPath,[path.join(tools,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:exec','--only','database','--project',project,'--config',path.join(directory,'firebase.json'),'node --test --test-concurrency=1 test/survey-summary.integration.cjs'],{cwd:root,env,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;process.exitCode=result.status??1;
