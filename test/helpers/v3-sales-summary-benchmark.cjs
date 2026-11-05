'use strict';
// Offline, fictional fixture. Run against an explicit checkout/archive root.
const path=require('node:path');
const {performance}=require('node:perf_hooks');
function measure(root){
 const Sales=require(path.join(root,'js/v3/sales-read-model.js'));
 const Economics=require(path.join(root,'js/v3/budget-read-model.js'));
 const sales=Array.from({length:10000},(_,i)=>({fbKey:'-sale-'+i,id:'V-'+i,total:i+100}));
 const payments=sales.map((sale,i)=>({fbKey:'-payment-'+i,ventaFbKey:sale.fbKey,monto:10}));
 const build=Economics.build;let economicBuilds=0,checksum=0;
 Economics.build=function(...args){economicBuilds++;return build.apply(this,args);};
 try{
  const cpuStart=process.cpuUsage(),start=performance.now();
  const model=new Sales.SalesReadModel(sales,payments),built=performance.now();
  for(let i=0;i<50000;i++){
   const summary=model.summaryFor('-sale-'+i%10000);
   if(summary.status!=='found')throw Error('Fictional sale missing');
   checksum+=summary.total+summary.paid+summary.balance;
  }
  const end=performance.now(),cpu=process.cpuUsage(cpuStart);
  return {root,node:process.version,buildMs:built-start,queryMs:end-built,totalMs:end-start,economicBuilds,checksum,cpuMs:(cpu.user+cpu.system)/1000};
 }finally{Economics.build=build;}
}
if(require.main===module)console.log(JSON.stringify(measure(path.resolve(process.argv[2]||'.'))));
module.exports={measure};
