'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline='210fea1e4d7261761ce4317b59ef99409c4eb548';
function fixture(previous){
 const names=['labor-commission-participant','commission-write-proof','labor-write-gateway'],saved=new Map();
 for(const n of names){const filename=path.join(root,'cotizador',n+'.js');require(filename);saved.set(filename,require.cache[filename]);}
 try{
  if(previous)for(const n of names){const filename=path.join(root,'cotizador',n+'.js'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));require.cache[filename]=m;m._compile(cp.execFileSync('git',['show',baseline+':cotizador/'+n+'.js'],{cwd:root,encoding:'utf8',windowsHide:true}),filename);}
  const filename=path.join(__dirname,'labor-commission-participant.test.cjs'),text=fs.readFileSync(filename,'utf8'),end=text.indexOf('const rejected=');assert(end>0);const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(__dirname);m._compile(text.slice(0,end)+'\nmodule.exports=fixture;',filename);return m.exports();
 }finally{for(const[k,v]of saved)require.cache[k]=v;}
}
async function sample(previous){
 const f=fixture(previous),trace=[];let active=0,peak=0;
 for(const kind of ['read','readAsUser','query']){const read=f.store[kind];f.store[kind]=async(...args)=>{trace.push([kind,...args.slice(0,kind==='query'?3:1)]);active++;peak=Math.max(peak,active);try{await new Promise(r=>setTimeout(r,20));return await read(...args);}finally{active--;}};}
 for(const p of [f.paths.mp,f.paths.gp,f.paths.cp])f.body.value[p].ts=1795798800000;
 const at=performance.now();await f.run();const ms=performance.now()-at;assert.equal(active,0);assert.equal(f.calls.commits.length,1);
 const patch=structuredClone(f.calls.commits[0]);for(const p of Object.keys(patch))if(p==='sv_labor_guard'||p.startsWith('sv_labor_receipts/'))delete patch[p];
 return{patch,trace:trace.map(v=>JSON.stringify(v)).sort(),peak,ms};
}
test('bounded parallel reads retain the exact financial patch and read set of the previous participant circuit',async()=>{
 const before=await sample(true),after=await sample(false);assert.deepEqual(after.patch,before.patch);assert.deepEqual(after.trace,before.trace);assert.equal(before.peak,1);assert(after.peak>1&&after.peak<=6);console.log(JSON.stringify({fictionalRttMs:20,beforeMs:Math.round(before.ms),afterMs:Math.round(after.ms),sameReads:after.trace.length,maxConcurrency:after.peak,scope:'participant and gateway with real guard; excludes production projections/network'}));
});
