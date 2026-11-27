'use strict';
// Operator tool. Default invocation is offline. Never writes configuration,
// credentials, signed URLs, response bodies or secret references to disk/logs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const PARENT='projects/nixa-sisventas/locations/southamerica-east1',NAME=PARENT+'/functions/emitirFactura',BASE='https://cloudfunctions.googleapis.com/v2/',FLAG='SALE_DELETE_RELATIONS_ENABLED';
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),hash=v=>sha(canonical(v)),fail=code=>{throw Error(code);};
function config(value){
 const v=structuredClone(value);for(const k of ['state','updateTime','createTime','stateMessages','upgradeInfo','url','satisfiesPzs','satisfiesPzi'])delete v[k];
 for(const k of ['source','sourceProvenance','build'])delete v.buildConfig[k];
 if(v.buildConfig.onDeployUpdatePolicy)delete v.buildConfig.onDeployUpdatePolicy.runtimeVersion;
 for(const k of ['service','uri','revision'])delete v.serviceConfig[k];return v;
}
function check(v){if(v?.name!==NAME||v.environment!=='GEN_2'||v.state!=='ACTIVE'||v.buildConfig?.entryPoint!=='emitirFactura'||!v.serviceConfig?.serviceAccountEmail||v.eventTrigger||!v.updateTime)fail('FUNCTION_SHAPE_NOT_APPROVED');}
function report(v){check(v);const c=config(v),s=v.serviceConfig;return{name:NAME,configurationSha256:hash(c),updateTime:v.updateTime,groupsSha256:{environment:hash(s.environmentVariables||{}),serviceAccount:hash(s.serviceAccountEmail),trigger:hash(v.eventTrigger??null),scaling:hash(Object.fromEntries(['availableCpu','availableMemory','minInstanceCount','maxInstanceCount','maxInstanceRequestConcurrency','timeoutSeconds'].map(k=>[k,s[k]??null]))),secrets:hash([s.secretEnvironmentVariables||[],s.secretVolumes||[]])}};}
async function run({mode='plan',zipPath,expectedZipSha256,expectedConfigurationSha256,expectedUpdateTime,enableRelations=false}={},{fetchImpl=fetch,token,wait=ms=>new Promise(r=>setTimeout(r,ms)),notify=()=>{}}={}){
 if(mode==='plan')return{mode,name:NAME,remoteIO:false,maskWhenEnabled:'buildConfig.source,serviceConfig.environmentVariables',preserveLatestTrafficWhenAlreadyTrue:true};
 if(!['inspect','apply'].includes(mode)||typeof token!=='function'||typeof enableRelations!=='boolean')fail('INVALID_OPERATOR_OPTIONS');
 let zip;
 if(mode==='apply'){
  if(!path.isAbsolute(zipPath||'')||!zipPath.endsWith('.zip')||!fs.statSync(zipPath).isFile()||!(/^[a-f0-9]{64}$/).test(expectedZipSha256||'')||!(/^[a-f0-9]{64}$/).test(expectedConfigurationSha256||'')||typeof expectedUpdateTime!=='string'||!expectedUpdateTime)fail('REVIEWED_ZIP_AND_CONFIGURATION_REQUIRED');
  zip=fs.readFileSync(zipPath);if(sha(zip)!==expectedZipSha256||zip.length<4||zip.readUInt32LE(0)!==0x04034b50)fail('ZIP_HASH_OR_FORMAT_MISMATCH');
 }
 async function api(resource,method='GET',body){
  let response;try{response=await fetchImpl(BASE+resource,{method,headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(120000),...(body?{body:JSON.stringify(body)}:{})});}catch{fail('FUNCTION_API_TRANSPORT_FAILED');}
  if(!response.ok)fail('FUNCTION_API_HTTP_'+response.status);try{return await response.json();}catch{fail('FUNCTION_API_INVALID_RESPONSE');}
 }
 const before=await api(NAME);check(before);if(mode==='inspect')return report(before);
 if(hash(config(before))!==expectedConfigurationSha256||before.updateTime!==expectedUpdateTime)fail('FUNCTION_CONFIGURATION_CHANGED');
 const upload=await api(PARENT+'/functions:generateUploadUrl','POST',{environment:'GEN_2',...(before.kmsKeyName?{kmsKeyName:before.kmsKeyName}:{})});
 let url;try{url=new URL(upload.uploadUrl);}catch{fail('INVALID_UPLOAD_URL');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!(url.hostname==='storage.googleapis.com'||url.hostname.endsWith('.storage.googleapis.com'))||typeof upload.storageSource?.bucket!=='string'||!upload.storageSource.bucket||typeof upload.storageSource?.object!=='string'||!upload.storageSource.object)fail('INVALID_UPLOAD_TARGET');
 // Signed upload gets NO ADC/Bearer header. Do not reuse api() here.
 let uploaded;try{uploaded=await fetchImpl(url.href,{method:'PUT',headers:{'Content-Type':'application/zip'},body:zip,redirect:'error',signal:AbortSignal.timeout(120000)});}catch{fail('SOURCE_UPLOAD_TRANSPORT_FAILED');}if(!uploaded.ok)fail('SOURCE_UPLOAD_HTTP_'+uploaded.status);
 const fresh=await api(NAME);check(fresh);if(fresh.updateTime!==before.updateTime||hash(fresh)!==hash(before))fail('FUNCTION_CHANGED_BEFORE_PATCH');
 const desired=config(before),body={name:NAME,buildConfig:{source:{storageSource:upload.storageSource}}};let mask='buildConfig.source';
 if(enableRelations){body.serviceConfig={environmentVariables:{...(before.serviceConfig.environmentVariables||{}),[FLAG]:'true'}};desired.serviceConfig.environmentVariables=body.serviceConfig.environmentVariables;mask+=',serviceConfig.environmentVariables';}
 // The GCF source update can omit this indicator and leave traffic on an older
 // revision. Preserve only a previously verified 100%-latest setting; never
 // change a pre-existing split/false/absent setting into 100%-latest.
 if(before.serviceConfig.allTrafficOnLatestRevision===true){body.serviceConfig={...body.serviceConfig,allTrafficOnLatestRevision:true};mask+=',serviceConfig.allTrafficOnLatestRevision';}
 let op=await api(NAME+'?updateMask='+encodeURIComponent(mask),'PATCH',body);
 if(typeof op.name!=='string'||!new RegExp('^'+PARENT+'/operations/[A-Za-z0-9_-]+$').test(op.name))fail('UNEXPECTED_OPERATION_NAME');
 notify({operation:op.name,phase:'submitted',zipSha256:expectedZipSha256});
 for(let i=0;op.done!==true&&i<180;i++){await wait(10000);op=await api(op.name);}if(op.done!==true)fail('OPERATION_PENDING_DO_NOT_RESUBMIT');if(op.error)fail('FUNCTION_OPERATION_FAILED');
 const after=await api(NAME);check(after);if(hash(config(after))!==hash(desired))fail('POST_DEPLOY_CONFIGURATION_DRIFT');
 // GCF may copy the uploaded ZIP into its managed source bucket. The operator
 // verifies resolved source/build provenance separately; no bucket equality claim.
 return{mode,completed:true,zipSha256:expectedZipSha256,updateMask:mask,configurationPreserved:true,relationFlagEnabled:enableRelations,...report(after)};
}
async function main(){
 const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1],allowed=new Set(['--inspect','--apply','--zip','--expected-zip-sha256','--expected-configuration-sha256','--expected-update-time','--enable-relations']);
 for(let i=0;i<args.length;i++){if(!allowed.has(args[i]))fail('UNKNOWN_OPTION');if(['--zip','--expected-zip-sha256','--expected-configuration-sha256','--expected-update-time'].includes(args[i])){if(!args[i+1]||args[i+1].startsWith('--'))fail('MISSING_OPTION_VALUE');i++;}}
 if(args.includes('--inspect')&&args.includes('--apply'))fail('CHOOSE_ONE_MODE');
 const mode=args.includes('--apply')?'apply':args.includes('--inspect')?'inspect':'plan';
 const token=async()=>{try{const executable=process.platform==='win32'?'cmd.exe':'gcloud',argv=process.platform==='win32'?['/d','/s','/c','gcloud.cmd auth print-access-token']:['auth','print-access-token'];return execFileSync(executable,argv,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).trim()||fail('AUTH_REQUIRED');}catch{fail('AUTH_REQUIRED');}};
 console.log(JSON.stringify(await run({mode,zipPath:value('--zip'),expectedZipSha256:value('--expected-zip-sha256'),expectedConfigurationSha256:value('--expected-configuration-sha256'),expectedUpdateTime:value('--expected-update-time'),enableRelations:args.includes('--enable-relations')},{token,notify:v=>console.log(JSON.stringify(v))})));
}
if(require.main===module)main().catch(()=>{console.error('SOURCE_ONLY_STOPPED: no response bodies or credentials logged; inspect current operation before retry.');process.exitCode=1;});
module.exports={NAME,PARENT,config,report,run,hash};
