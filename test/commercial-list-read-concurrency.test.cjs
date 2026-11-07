'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCommercialOwnership}=require('../cotizador/commercial-ownership');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs');

async function sample(listReadConcurrency,{fail=false}={}){
 const {db}=fixture(),source=structuredClone(db.root.sisventas.presupuestos.budget);
 db.root.sisventas.ventas={};db.root.sisventas.presupuestos={};
 for(let i=0;i<96;i++){
  db.root.sisventas.presupuestos['b'+i]=structuredClone(source);
  for(let j=0;j<3;j++)db.root.sisventas.ventas['s'+i+'-'+j]={id:'V-FICTICIA-'+i+'-'+j,presupuestoFbKey:'b'+i,total:100,items:[{qty:1,punit:100}],pagos:[]};
 }
 const before=structuredClone(db.root),ref=db.ref.bind(db),paths=[];let active=0,peak=0;
 db.ref=path=>{const r=ref(path);return {...r,get:async()=>{paths.push(path);if(path.startsWith('sisventas/presupuestos/')){active++;peak=Math.max(peak,active);try{await new Promise(resolve=>setTimeout(resolve,8));if(fail&&path.endsWith('/b0'))throw Error('Fallo ficticio de origen');return await r.get();}finally{active--;}}return r.get();}};};
 const api=createCommercialOwnership({db,auth:{verifyIdToken:async uid=>({uid})},enabled:true,...(listReadConcurrency===undefined?{}:{listReadConcurrency})});
 const actor=await api.authorize({headers:{authorization:'Bearer admin'}},'ventas');
 const start=performance.now();let result,error;try{result=await api.list(actor);}catch(e){error=e;}
 assert.equal(active,0,'All issued reads must settle before returning');assert.deepEqual(db.root,before,'Read optimization must not write records');
 assert(!paths.includes('sisventas/presupuestos'),'Never replace linked point reads with the full budget history');
 return {result,error,peak,paths,ms:performance.now()-start};
}

test('opt-in list reader reduces dependency waves, keeps the default bound and returns identical complete records',async()=>{
 const baseline=await sample(),optimized=await sample(16);
 assert.equal(baseline.peak,6);assert.equal(optimized.peak,16);
 assert.deepEqual(optimized.result,baseline.result);assert.equal(Object.keys(optimized.result.records).length,288);
 for(const run of [baseline,optimized])assert.equal(run.paths.filter(p=>p.startsWith('sisventas/presupuestos/')).length,96);
 console.log(JSON.stringify({fictional:true,baselineMs:baseline.ms,optimizedMs:optimized.ms,sourceReads:96,records:288}));
});

test('failed optimized list waits for outstanding reads and never returns partial records',async()=>{
 const run=await sample(16,{fail:true});assert.match(run.error?.message||'',/Fallo ficticio/);assert.equal(run.result,undefined);
 assert(run.paths.filter(p=>p.startsWith('sisventas/presupuestos/')).length<=16);assert.equal(run.peak,16);
});

test('list concurrency rejects unbounded or coerced configuration',()=>{
 for(const listReadConcurrency of [0,17,-1,1.5,'16',true,null,NaN,Infinity]){
  const {db}=fixture();assert.throws(()=>createCommercialOwnership({db,auth:{},enabled:true,listReadConcurrency}),/concurrencia/i);
 }
});
