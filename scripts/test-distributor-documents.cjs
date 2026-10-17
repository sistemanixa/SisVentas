'use strict';
// Requires an explicitly supplied snapshot of the full effective RTDB rules.
// Runs only against a credential-free demo emulator, never production.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tools=path.resolve(process.env.SV_SECURITY_TOOLS||path.join(root,'tmp/firebase-security-tools')),rulesFile=process.env.SV_DISTRIBUTOR_RULES;
if(!rulesFile||!JSON.parse(fs.readFileSync(rulesFile,'utf8')).rules)throw Error('Configurar SV_DISTRIBUTOR_RULES con una instantánea completa de reglas efectivas, no el fragmento candidato');
const cli=path.join(tools,'node_modules/firebase-tools/lib/bin/firebase.js');if(!fs.existsSync(cli))throw Error('Configurar SV_SECURITY_TOOLS con las herramientas del emulador');
const temp=path.join(root,'tmp/distributor-emulator');fs.mkdirSync(temp,{recursive:true});fs.copyFileSync(rulesFile,path.join(temp,'rules.json'));fs.writeFileSync(path.join(temp,'firebase.json'),JSON.stringify({database:{rules:'rules.json'},emulators:{database:{host:'127.0.0.1',port:9007},ui:{enabled:false},singleProjectMode:true}}));
const env={...process.env,CI:'true',SV_SECURITY_TOOLS:tools,SV_DISTRIBUTOR_RULES:path.join(temp,'rules.json'),SV_DISTRIBUTOR_ADMIN_MODULE:process.env.SV_DISTRIBUTOR_ADMIN_MODULE||path.join(root,'cotizador/node_modules/firebase-admin'),GCLOUD_PROJECT:'demo-sisventas-distributor-documents',GOOGLE_CLOUD_PROJECT:'demo-sisventas-distributor-documents'};
for(const key of ['GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_GHA_CREDS_PATH','FIREBASE_TOKEN','CLOUDSDK_AUTH_ACCESS_TOKEN'])delete env[key];
const result=spawnSync(process.execPath,[cli,'emulators:exec','--only','database','--project','demo-sisventas-distributor-documents','--config',path.join(temp,'firebase.json'),'node --test --test-concurrency=1 test/distributor-documents.integration.cjs'],{cwd:root,env,stdio:'inherit',windowsHide:true});if(result.error)throw result.error;process.exitCode=result.status??1;
