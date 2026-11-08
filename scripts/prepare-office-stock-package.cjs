'use strict';
// Offline only: no deployment, credentials, registry calls or original data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const BASE_IMAGE='sha256:cf7bcefb95650282ecb6a29aec3f33871c5f05371976ff3b1970d0122825dc65';
const BASE={
 'index.js':'833d54e9ccc7779a686d3c1b1aeb713b1d32632c47cb926d05194beed232a159',
 'labor-guard.js':'315c03c3a18cd236c8efaf2f39ac6b4cc18854ebdfe3d94085723555c91b4020',
 'labor-rtdb-store.js':'b0f13f6253b946f10d3c86bff08d8a7b904a2e1b124c999f74d66fdab26a7273',
 'ot-lifecycle-model.js':'7e27f03108c3630ab8947a3c7abb00c591a9bbabf5c93008de09107a1dbeee5b'
};
const FRONT=['index.html','sw.js','js/app.v3.19.19.js','js/core/version.js','js/core/version.v3.19.19.js','js/core/access-control.js','js/core/data-readiness.js','js/core/labor-write-recovery.js','js/core/office-stock-adjustment.js','js/modules/action-permissions.js','js/modules/office-stock.js','js/modules/office-stock-adapter.js','js/modules/office-stock-host.js','css/office-stock.css'];
function once(s,a,b){if(s.split(a).length!==2)throw Error('Unknown or duplicate Stock anchor');return s.replace(a,b);}
function line(s,p){const rows=s.split('\n').filter(x=>x.startsWith(p));if(rows.length!==1)throw Error('Unknown Stock source line');return rows[0];}
function compose(base,source){
 for(const[n,h]of Object.entries(BASE))if(sha(base[n]||'')!==h)throw Error('Retained runtime changed: '+n);
 let index=base['index.js'].toString(),guard=base['labor-guard.js'].toString(),store=base['labor-rtdb-store.js'].toString();
 const init=line(source.index,'const officeStock='),start=source.index.indexOf("  if(['/stock-oficina/listar'"),end=source.index.indexOf("  if(pathname==='/ot/rendicion/disponible')",start);
 if(start<0||end<start)throw Error('Unknown reviewed routes');
 index=once(index,'const otOfficeCount=',init+'\nconst otOfficeCount=');
 index=once(index,"  if(pathname==='/ot/ciclo/disponible'){",source.index.slice(start,end)+"  if(pathname==='/ot/ciclo/disponible'){");
 guard=once(guard," const actions={'ventas.moverPresupuesto':"," const actions={'stock.ajustar':['stockoficina','stock','ajustar',['admin','administrativo']],'ventas.moverPresupuesto':");
 store=once(store,"  const override=service('commit',lease,actor);","  require('./office-stock-policy').validate(actor,lease,patch);\n  const override=service('commit',lease,actor);if(actor?.officeStock||actor.operation==='office-stock-adjustment'||Object.keys(actor?.claims||{}).some(k=>k.startsWith('svOfficeStock'))){const stockToken=require('./office-stock-policy').token(actor,lease);Object.assign(override.token,stockToken,stockToken.svOfficeStockVersion===1?{svLaborWriterSchema:2}:{});}");
 const output={'index.js':index,'labor-guard.js':guard,'labor-rtdb-store.js':store};
 for(const[n,s]of Object.entries(output))new vm.Script(s,{filename:n});
 return output;
}
function prepare({baseline,out,commit,clean}){
 if(!/^[a-f0-9]{40}$/.test(commit||'')||clean!==true)throw Error('Clean reviewed commit required');if(fs.existsSync(out))throw Error('Refuse overwrite');
 const read=n=>fs.readFileSync(path.join(root,n)),base=Object.fromEntries(Object.keys(BASE).map(n=>[n,fs.readFileSync(path.join(baseline,n))]));
 const output=compose(base,{index:read('cotizador/index.js').toString()});
 for(const n of ['office-stock.js','office-stock-policy.js'])output[n]=read('cotizador/'+n);
 output['office-stock-model.js']=once(read('cotizador/office-stock-model.js').toString(),"require('./commercial-models/commercial-money.v1.js')","require('./office-stock-money')");
 output['office-stock-money.js']=read('cotizador/commercial-models/commercial-money.v1.js');
 const files={...Object.fromEntries(Object.entries(output).map(([n,b])=>['server/'+n,b])),...Object.fromEntries(FRONT.map(n=>['frontend/'+n,read(n)]))};
 files.Dockerfile='FROM southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@'+BASE_IMAGE+'\nWORKDIR /app\nCOPY server/ ./\nRUN node --check index.js && node --check labor-guard.js && node --check labor-rtdb-store.js && node -e "require(\'./office-stock\');require(\'./office-stock-policy\');require(\'./office-stock-model\');"\n';
 const manifest={schema:1,sourceCommit:commit,baseImage:BASE_IMAGE,baseline:BASE,files:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,sha(b)])),productionApplied:false};
 fs.mkdirSync(out,{recursive:true});for(const[n,b]of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(out,n)),{recursive:true});fs.writeFileSync(path.join(out,n),b);}
 fs.writeFileSync(path.join(out,'stock-package.manifest.json'),JSON.stringify(manifest,null,2));return{commit,files:Object.keys(files).length,manifestSha:sha(fs.readFileSync(path.join(out,'stock-package.manifest.json'))),baseImage:BASE_IMAGE,productionApplied:false};
}
if(require.main===module){try{const arg=n=>process.argv[process.argv.indexOf(n)+1],git=a=>cp.execFileSync('git',a,{cwd:root,encoding:'utf8',windowsHide:true}).trim(),commit=arg('--expected-commit');if(!process.argv.includes('--out')||!process.argv.includes('--baseline-root')||git(['rev-parse','HEAD'])!==commit)throw Error('Explicit reviewed commit, baseline and new destination required');console.log(JSON.stringify(prepare({baseline:arg('--baseline-root'),out:arg('--out'),commit,clean:git(['status','--porcelain'])===''})));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={BASE_IMAGE,BASE,FRONT,compose,prepare,sha};
