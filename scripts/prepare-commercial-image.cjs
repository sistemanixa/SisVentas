'use strict';
// Offline packaging only. Never submits a build or obtains credentials.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const BASE='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:ce214d16acc17a89acecab937a499c4984ca49c5f6a097fedba2d5aab73fb8a2';
const BUILDER='gcr.io/cloud-builders/docker@sha256:fbc05705e6f24467e40ae8a4097ab9b8fae1116551f838fa2c55f4367427fc36';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const fail=message=>{throw Error(message);};
function sources(docker,tracked){
 const files=new Map();
 for(const line of docker.split(/\r?\n/).filter(line=>/^COPY\s/.test(line))){
  const tokens=line.trim().split(/\s+/).slice(1),destination=tokens.pop();
  if(!['./','./commercial-models/'].includes(destination)||!tokens.length)fail('Unknown reviewed COPY destination');
  for(const token of tokens){
   let names;
   if(token==='package*.json')names=['package.json','package-lock.json'];
   else if(token==='commercial-models/'&&destination==='./commercial-models/')names=tracked.filter(name=>/^commercial-models\/[A-Za-z0-9_.-]+\.(js|json)$/.test(name));
   else if(/^[A-Za-z0-9_.-]+\.js$/.test(token)&&destination==='./')names=[token];
   else fail('Unknown reviewed COPY source');
   if(!names.length)fail('Empty COPY source');
   for(const name of names){if(!tracked.includes(name)||files.has(name))fail('Missing or duplicate COPY source: '+name);files.set(name,true);}
  }
 }
 if(!files.has('index.js')||!files.has('commercial-delete-runtime.js')||!files.has('office-stock.js')||!files.has('tecnoprices-login.js'))fail('Incomplete coordinated runtime');
 return [...files.keys()].sort();
}
function config(target){
 if(!/^southamerica-east1-docker\.pkg\.dev\/nixa-sisventas\/cloud-run-source-deploy\/cotizador:audit-validation-[a-f0-9]{8}$/.test(target))fail('Unreviewed registry target');
 const format='{{json .Config.Env}} {{json .Config.Entrypoint}} {{json .Config.Cmd}} {{json .Config.User}} {{json .Config.WorkingDir}} {{json .Config.ExposedPorts}} {{json .Config.Volumes}} {{json .Config.Healthcheck}} {{json .Config.StopSignal}} {{json .Config.Shell}}';
 return{timeout:'600s',queueTtl:'300s',serviceAccount:'projects/nixa-sisventas/serviceAccounts/171899432710-compute@developer.gserviceaccount.com',options:{machineType:'E2_STANDARD_2',logging:'CLOUD_LOGGING_ONLY'},steps:[
  {id:'build-frozen-coordinated-runtime',name:BUILDER,entrypoint:'bash',timeout:'480s',args:['-ceu',[
   'sha256sum --check context.sha256','docker pull '+BASE,
   'docker build --pull=false --network=bridge --tag '+target+' --file image/Dockerfile image',
   'docker image inspect --format '+JSON.stringify(format)+' '+BASE+' > /tmp/audit-base-config',
   'docker image inspect --format '+JSON.stringify(format)+' '+target+' > /tmp/audit-candidate-config',
   'cmp /tmp/audit-base-config /tmp/audit-candidate-config'
  ].join('\n')]},
  {id:'isolated-runtime-verification',name:BUILDER,entrypoint:'bash',timeout:'120s',args:['-ceu',[
   "trap 'docker rm -f audit-fixture-check >/dev/null 2>&1 || true' EXIT",
   'docker create --name audit-fixture-check --pull=never --network=none --read-only --cap-drop=ALL --security-opt=no-new-privileges --user=65534:65534 --pids-limit=128 --memory=512m --cpus=1 --tmpfs=/tmp:rw,noexec,nosuid,size=64m --mount=type=bind,src=/workspace/checks,dst=/checks,readonly --entrypoint=node '+target+' --require /checks/deny-network.cjs /checks/run.cjs',
   "test \"$$(docker inspect --format '{{.HostConfig.NetworkMode}}' audit-fixture-check)\" = none",
   'docker start --attach audit-fixture-check',
   "test \"$$(docker inspect --format '{{.State.ExitCode}}' audit-fixture-check)\" = 0"
  ].join('\n')]}
 ],images:[target]};
}
function prepare({source,expectedCommit,destination}){
 if(!/^[a-f0-9]{40}$/.test(expectedCommit||'')||!path.isAbsolute(source||'')||!path.isAbsolute(destination||''))fail('Exact source, commit and private destination required');
 const root=fs.realpathSync(source),git=args=>cp.execFileSync('git',['-c','core.fsmonitor=false',...args],{cwd:root,windowsHide:true,maxBuffer:32*1024*1024});
 if(git(['rev-parse','HEAD']).toString().trim()!==expectedCommit||git(['status','--porcelain','--untracked-files=all']).toString().trim())fail('Require frozen clean source');
 let parent=path.resolve(destination);while(true){if(fs.existsSync(parent)&&fs.lstatSync(parent).isSymbolicLink())fail('No linked destination');const next=path.dirname(parent);if(next===parent)break;parent=next;}
 const relative=path.relative(root,destination);if(!relative.startsWith('..'+path.sep)&&relative!=='..')fail('Output must be outside source');
 if(!path.resolve(destination).split(path.sep).some(part=>/^(tmp|temp)$/i.test(part))||fs.existsSync(destination))fail('Require a new private tmp destination');
 if(!fs.statSync(path.dirname(destination)).isDirectory())fail('Missing private parent');
 const tree=git(['ls-tree','-r','-z',expectedCommit,'--','cotizador']).toString().split('\0').filter(Boolean).map(row=>{const match=/^(\d+) blob [a-f0-9]+\t(cotizador\/.+)$/.exec(row);if(!match)return null;return{mode:match[1],name:match[2].slice(10)};}).filter(Boolean);
 const raw=name=>git(['show',expectedCommit+':cotizador/'+name]);
 const payload=sources(raw('Dockerfile').toString(),tree.filter(row=>row.mode==='100644'||row.mode==='100755').map(row=>row.name));
 const pkg=JSON.parse(raw('package.json')),lock=JSON.parse(raw('package-lock.json')),ordered=v=>JSON.stringify(Object.entries(v||{}).sort(([a],[b])=>a.localeCompare(b)));
 if(ordered(pkg.dependencies)!==ordered(lock.packages?.['']?.dependencies))fail('Dependency lock does not match the reviewed package');
 for(const info of Object.values(lock.packages||{})){if(!info.resolved)continue;const url=new URL(info.resolved);if(url.protocol!=='https:'||url.hostname!=='registry.npmjs.org'||url.username||url.password)fail('Unreviewed dependency registry');}
 const target='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador:audit-validation-'+expectedCommit.slice(0,8),buffers=new Map();
 for(const name of payload)buffers.set('image/server/'+name,raw(name));
 buffers.set('image/Dockerfile',Buffer.from('FROM '+BASE+'\nWORKDIR /app\nCOPY server/package.json server/package-lock.json /app/\nRUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund\nCOPY server/ /app/\n'));
 const checks=path.join(__dirname,'commercial-image-checks');
 for(const name of ['artifact.test.cjs','run.cjs'])buffers.set('checks/'+name,fs.readFileSync(path.join(checks,name)));
 for(const name of ['deny-network.cjs','command.test.cjs'])buffers.set('checks/'+name,fs.readFileSync(path.join(__dirname,'office-stock-build-checks',name)));
 const manifest={schema:1,sourceCommit:expectedCommit,baseImage:BASE,target,files:Object.fromEntries(payload.map(name=>[name,sha(raw(name))]))};
 buffers.set('checks/runtime-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 buffers.set('cloudbuild.proposal.json',Buffer.from(JSON.stringify(config(target),null,2)+'\n'));
 buffers.set('.gcloudignore',Buffer.from('**\n!image/\n!image/**\n!checks/\n!checks/**\n!cloudbuild.proposal.json\n!context.sha256\n!.gcloudignore\n'));
 buffers.set('context.sha256',Buffer.from([...buffers].map(([name,bytes])=>sha(bytes)+'  '+name).join('\n')+'\n'));
 fs.mkdirSync(destination);
 for(const [name,bytes]of buffers){const dest=path.join(destination,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});}
 return{schema:1,sourceCommit:expectedCommit,payloadFiles:payload.length,target,baseImage:BASE,manifestSha256:sha(buffers.get('checks/runtime-manifest.json')),context:Object.fromEntries([...buffers].map(([name,bytes])=>[name,sha(bytes)])),remoteActions:0};
}
if(require.main===module){try{if(process.argv.length!==5)fail('Expected source, full commit, new tmp destination');console.log(JSON.stringify(prepare({source:process.argv[2],expectedCommit:process.argv[3],destination:process.argv[4]})));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={sources,config,prepare,BASE,BUILDER};
