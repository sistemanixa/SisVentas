'use strict';
// Only I/O is leased. A worker may perform another bounded read without
// holding a slot, avoiding nested-batch deadlocks.
function createWindow(limit=6){
 if(!Number.isInteger(limit)||limit<1||limit>6)throw Error('Ventana de referencias inválida.');
 let active=0;const queue=[];
 function drain(){while(active<limit&&queue.length){const task=queue.shift();active++;Promise.resolve().then(task.work).then(task.resolve,task.reject).finally(()=>{active--;drain();});}}
 return{run:work=>new Promise((resolve,reject)=>{queue.push({work,resolve,reject});drain();})};
}
async function mapOrdered(items,work){
 const result=new Array(items.length);let next=0,firstError,failed=false;
 const workers=Array.from({length:Math.min(6,items.length)},async()=>{while(!failed&&next<items.length){const index=next++;try{result[index]=await work(items[index],index);}catch(error){if(!failed){failed=true;firstError=error;}throw error;}}});
 await Promise.allSettled(workers);if(failed)throw firstError;return result;
}
const window=createWindow(),phases=new WeakSet(),byQuery=new WeakMap(),readers=new WeakSet();
function boundedRead(read){if(readers.has(read))return read;const bounded=path=>window.run(()=>read(path));readers.add(bounded);return bounded;}
function memoRead(read,{onRead}={}){
 const point=boundedRead(read),pending=new Map(),values=new Map(),reader=async path=>{
  if(!pending.has(path))pending.set(path,point(path).then(async value=>{const copy=structuredClone(value);values.set(path,copy);await onRead?.(path,structuredClone(copy));return copy;}));
  return structuredClone(await pending.get(path));
 };readers.add(reader);return{read:reader,values};
}
function createReferencePhase({queryPage}){
 if(typeof queryPage!=='function')throw Error('Falta lector dirigido de fase.');
 if(byQuery.has(queryPage))return byQuery.get(queryPage);
 const pending=new Map(),phase={queryPage:async(path,options)=>{
  const id=require('./office-stock-reference').digest({path,options});
  if(!pending.has(id))pending.set(id,window.run(()=>queryPage(path,structuredClone(options))).then(value=>structuredClone(value)));
  return structuredClone(await pending.get(id));
 }};phases.add(phase);byQuery.set(phase.queryPage,phase);return Object.freeze(phase);
}
module.exports={createWindow,mapOrdered,createReferencePhase,isReferencePhase:phase=>phases.has(phase),boundedRead,memoRead,read:work=>window.run(work)};
