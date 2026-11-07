'use strict';
// Offline public-code packaging only. No credentials, registry, build or deploy.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),Overlay=require('../cotizador/ot-rendition-atomic-overlay/attach.cjs'),root=path.resolve(__dirname,'..');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?'':process.argv[i+1];};
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
function getLine(source,prefix){const rows=source.split('\n').filter(s=>s.startsWith(prefix));if(rows.length!==1)throw Error('Unknown reviewed candidate hook');return rows[0];}
function replace(source,from,to){if(source.split(from).length!==2)throw Error('Unknown isolated OT model dependency');return source.replace(from,to);}
function payload(){
 const lifecycle=read('cotizador/ot-lifecycle.js'),policy=read('cotizador/ot-lifecycle-policy.js'),index=read('cotizador/index.js'),start=lifecycle.indexOf('   if(atomic){'),end=lifecycle.indexOf("   if(body.kind==='return')",start),routesStart=index.indexOf("  if(pathname==='/ot/rendicion/disponible')"),routesEnd=index.indexOf("  if(pathname==='/ot/ciclo/disponible')",routesStart);
 if(start<0||end<start||routesStart<0||routesEnd<routesStart)throw Error('Missing reviewed OT hooks');
 const hooks={validation:getLine(lifecycle,'  if(!body||'),capability:getLine(lifecycle,'  actor.otLifecycle=Policy.issue('),readiness:getLine(lifecycle,'   const sale=await scope.get(salePath)')+'\n'+getLine(lifecycle,'   try{others=Index.parseIndex'),stage:lifecycle.slice(start,end),methods:[' async function available(identity,args)',' async function availableAtomic(identity,args)',' async function executeAtomic(identity,body)'].map(p=>getLine(lifecycle,p)).join('\n'),policySignature:getLine(policy,'function issue('),policyCap:getLine(policy,' const cap=Object.freeze('),policyFunctions:policy.slice(policy.indexOf('// Internal capability only:'),policy.indexOf('module.exports=')),initializer:getLine(index,'const otLifecycle='),routes:index.slice(routesStart,routesEnd)};
 const isolated=s=>replace(s,"require('./commercial-models/commercial-money')","require('./ot-rendition-money')");
 return{
  'ot-rendition-stock-plan.js':isolated(replace(replace(replace(read('cotizador/ot-rendition-stock-plan.js'),"require('./ot-lifecycle-model')","require('./ot-rendition-model')"),"require('./ot-material-state')","require('./ot-rendition-material-state')"),"require('./ot-stock-consumption-model')","require('./ot-rendition-stock-model')")),
  'ot-rendition-model.js':isolated(replace(read('cotizador/ot-lifecycle-model.js'),"require('./ot-material-state')","require('./ot-rendition-material-state')")),
  'ot-rendition-material-state.js':isolated(read('cotizador/ot-material-state.js')),
  'ot-rendition-stock-model.js':replace(read('cotizador/ot-stock-consumption-model.js'),"require('./commercial-models/commercial-money.v1.js')","require('./ot-rendition-money')"),
  'ot-rendition-money.js':read('cotizador/commercial-models/commercial-money.v1.js'),
  'ot-rendition-hooks.json':JSON.stringify(hooks)
 };
}
function prepare({baseline,out,sourceCommit,sourceClean}){
 if(!/^[a-f0-9]{40}$/.test(sourceCommit||'')||sourceClean!==true)throw Error('A clean frozen source is required');if(fs.existsSync(out))throw Error('Refuse to overwrite an existing OT overlay directory');
 const body=payload(),files=Object.fromEntries(Object.keys(Overlay.BASE).map(name=>[name,fs.readFileSync(path.join(baseline,name))])),outputs=Overlay.compute(files,JSON.parse(body['ot-rendition-hooks.json']));
 const manifest={schema:1,sourceCommit,sourceClean,baseImage:Overlay.BASE_IMAGE,payload:Object.fromEntries(Object.entries(body).map(([n,v])=>[n,Overlay.sha(v)])),outputs:Object.fromEntries(Object.entries(outputs).map(([n,v])=>[n,Overlay.sha(v)]))},raw=JSON.stringify(manifest),manifestSha=Overlay.sha(raw);
 fs.mkdirSync(out,{recursive:true});for(const [name,value]of Object.entries(body))fs.writeFileSync(path.join(out,name),value);fs.writeFileSync(path.join(out,'ot-rendition-overlay.manifest.json'),raw);fs.copyFileSync(path.join(root,'cotizador/ot-rendition-atomic-overlay/attach.cjs'),path.join(out,'ot-rendition-attach.cjs'));fs.writeFileSync(path.join(out,'Dockerfile'),read('cotizador/ot-rendition-atomic-overlay/Dockerfile').replaceAll('__MANIFEST_SHA__',manifestSha));return{sourceCommit,manifestSha,files:fs.readdirSync(out).length,baseImage:Overlay.BASE_IMAGE,deployment:false};
}
if(require.main===module){try{const git=args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim(),out=arg('--out'),baseline=arg('--baseline-root'),expected=arg('--expected-commit');if(!out||!baseline||git(['rev-parse','HEAD'])!==expected)throw Error('Explicit baseline, new output directory and reviewed commit required');console.log(JSON.stringify(prepare({baseline,out,sourceCommit:expected,sourceClean:git(['status','--porcelain'])===''})));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={payload,prepare};
