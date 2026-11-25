'use strict';
// Diagnóstico de evidencia de fuente; no ejecuta endpoints ni prueba despliegue.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function audit(root,{runtimeDir}={}){
 const cache=new Map(),read=file=>{if(!cache.has(file))cache.set(file,fs.readFileSync(path.join(root,file),'utf8'));return cache.get(file);},exists=file=>fs.existsSync(path.join(root,file));
 const inventory=JSON.parse(read('docs/OPTIMIZACION_SERVIDOR_20261125.json'));
 const active=read('index.html').match(/src=["']\.\/js\/(app\.v[\d.]+\.js)(?:\?[^"']*)?["']/)?.[1];
 if(!active)throw Error('No se identificó aplicación activa');
 const activeFile='js/'+active;
 const routes=inventory.routes.map(route=>({route:route.route,method:route.method,group:route.group,
  runtime:'not-verified',measurement:'not-measured-by-this-script',callers:route.callers.map(caller=>{
   const file=/^js\/app\.v[^/]+\.js$/.test(caller.file)?activeFile:caller.file;
   const token=new RegExp('([\x22\x27])'+route.route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\1');
   const present=exists(file),source=present?read(file):'',literal=route.route!=='/'&&!route.route.includes(':')&&token.test(source);
   const lines=literal?source.split(/\r?\n/).flatMap((line,i)=>token.test(line)?[i+1]:[]):[];
   return {file,historicalFile:caller.file,present,fileKind:file.includes('*')?'family-pattern':'literal-file',evidence:route.route==='/'?'generic-slash-is-not-endpoint-evidence':literal?'literal-token-current-source':'family-inference-needs-review',lines,
    loadStatus:'not-proven-by-literal-match',historicalEvidence:caller.evidence};
  })}));
 const runtime=[];
 if(runtimeDir){for(const name of fs.readdirSync(runtimeDir).filter(n=>n.endsWith('.js')).sort()){
  const file='cotizador/'+name;if(!exists(file))continue;
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const sourceHash=hash(path.join(root,file)),runtimeHash=hash(path.join(runtimeDir,name));runtime.push({file,sourceHash,runtimeHash,equal:sourceHash===runtimeHash});
 }}
 const callers=routes.flatMap(r=>r.callers);
 return {schema:1,activeApp:activeFile,historicalApp:inventory.sourceApp,scope:'Static diagnostic only: tokens/family inferences are not proof of active call, authority, measurement or deployment.',summary:{routes:routes.length,callerReferences:callers.length,genericSlashReferences:callers.filter(c=>c.evidence==='generic-slash-is-not-endpoint-evidence').length,literalTokenReferences:callers.filter(c=>c.evidence==='literal-token-current-source').length,familyReferences:callers.filter(c=>c.evidence==='family-inference-needs-review').length,familyPatterns:callers.filter(c=>c.fileKind==='family-pattern').length,missingFiles:callers.filter(c=>!c.present&&c.fileKind==='literal-file').length,runtimeFiles:runtime.length,runtimeExactMatches:runtime.filter(r=>r.equal).length},runtime,routes};
}
module.exports={audit};
if(require.main===module){const runtimeDir=process.argv[2];console.log(JSON.stringify(audit(path.resolve(__dirname,'..'),{runtimeDir}),null,2));}
