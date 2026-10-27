'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const Rules=require('../../scripts/prepare-ot-unit-confirmation-rules.cjs');
async function main(){
 assert.equal(process.env.SV_OT_ISOLATED_CONTAINER,'1','Run only in the reviewed isolated container');
 assert.deepEqual(Object.keys(os.networkInterfaces()).filter(name=>name!=='lo'),[],'No external network interface');
 for(const name of Object.keys(process.env))assert.equal(/TOKEN|SECRET|PASSWORD|GOOGLE_APPLICATION|GHA_CREDS|CLOUDSDK|FIREBASE|GITHUB/i.test(name),false,'Unexpected credential/environment name');
 assert.throws(()=>fs.writeFileSync('/work/unexpected-write','x'),e=>e.code==='EROFS');
 assert.equal(fs.existsSync('/github/workspace/.git'),false);assert.equal(fs.existsSync('/root/.config/gcloud'),false);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync('/opt/emulator.jar')).digest('hex'),'b70d99344caf17c98b6f910fa8f6edf32a7c016cb1035e8915f70d38901eb97f');
 fs.mkdirSync('/tmp/fictitious-home',{recursive:true});
 const source=require('./rules-base.cjs')(),file='/tmp/ot-source.json';fs.writeFileSync(file,JSON.stringify(source));
 const env={PATH:process.env.PATH,HOME:'/tmp/fictitious-home',LANG:'C.UTF-8',GCLOUD_PROJECT:'demo-ot-unit-confirmation-proof',GOOGLE_CLOUD_PROJECT:'demo-ot-unit-confirmation-proof'};
 const log=fs.openSync('/tmp/emulator.log','w'),java=spawn('java',['-Xmx512m','-Duser.home=/tmp/fictitious-home','-Djava.io.tmpdir=/tmp','-jar','/opt/emulator.jar','--host','127.0.0.1','--port','9041','--single_project_mode','Error'],{cwd:'/tmp',env,stdio:['ignore',log,log]});
 let tester;const deadline=setTimeout(()=>{tester?.kill('SIGKILL');java.kill('SIGKILL');},240000);
 try{
  let ready=false;for(let i=0;i<150;i++){if(java.exitCode!==null)throw Error('Emulator exited: '+fs.readFileSync('/tmp/emulator.log','utf8').slice(-2500));try{const r=await fetch('http://127.0.0.1:9041/.json?ns=demo-ot-unit-confirmation-proof',{headers:{Authorization:'Bearer owner'},signal:AbortSignal.timeout(300)});await r.body?.cancel();if(r.ok){ready=true;break;}}catch(_){}await new Promise(r=>setTimeout(r,200));}
  assert.equal(ready,true,'Emulator readiness');
  tester=spawn(process.execPath,['--test','--test-concurrency=1','test/ot-unit-confirmation-rules.integration.cjs'],{cwd:'/work',env:{...env,FIREBASE_DATABASE_EMULATOR_HOST:'127.0.0.1:9041',SV_OT_UNIT_RULES_FILE:file,SV_OT_UNIT_RULES_SHA:Rules.hash(source)},stdio:'inherit'});
  const code=await new Promise((resolve,reject)=>{tester.on('error',reject);tester.on('exit',resolve);});assert.equal(code,0,'Rules suite failed');
  console.log('ISOLATED_OT_RULES_PASS: no external network, no Google credentials, fictitious data only');
 }finally{clearTimeout(deadline);tester?.kill('SIGKILL');java.kill('SIGKILL');fs.closeSync(log);}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
