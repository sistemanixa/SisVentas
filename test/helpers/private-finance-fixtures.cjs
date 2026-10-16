'use strict';
const M=require('../../cotizador/private-finance-model'),crypto=require('crypto');
const actor={uid:'owner-fixture'},now=Date.parse('2026-10-16T12:00:00Z');let n=0;
const card={id:'card-a',bank:'Banco ficticio',brand:'Visa',color:'#dfb767',policy:'Sin nuevos consumos'};
const statement={id:'statement-a',card:'card-a',period:'2026-10',close:'2026-10-01',due:'2026-10-20',previous:0,total:100001,usd:5025,minimum:10000,minimumCurrency:'ARS',tem:5.25,source:'Manual',reviewed:true,reconciliation:'Carga ficticia para pruebas',movements:[]};
function command(s,type,data,id){return {type,data,revision:s.revision,id:id||'op-'+(++n)};}
function run(s,type,data,id){const c=command(s,type,data,id);return M.apply(s,c,actor,{now,digest:crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex')}).state;}
function seed(){let s=run(M.empty(actor.uid),'card-save',card);return run(s,'statement-save',statement);}
function memoryDB(initial={}){
 const root=structuredClone(initial),locks=new Map();
 const get=p=>p.split('/').filter(Boolean).reduce((v,k)=>v?.[k],root)??null;
 const put=(p,v)=>{const parts=p.split('/').filter(Boolean);let target=root;for(const k of parts.slice(0,-1))target=target[k]??={};target[parts.at(-1)]=structuredClone(v);};
 return {root,ref(p){return {get:async()=>({val:()=>structuredClone(get(p))}),on(event,fn){queueMicrotask(()=>fn({val:()=>structuredClone(get(p))}));},off(){},async transaction(fn){const wait=locks.get(p)||Promise.resolve();let release;const done=new Promise(r=>release=r);locks.set(p,done);await wait;try{const v=fn(structuredClone(get(p)));if(v===undefined)return {committed:false,snapshot:{val:()=>get(p)}};put(p,v);return {committed:true,snapshot:{val:()=>structuredClone(v)}};}finally{release();}}};}};
}
module.exports={M,actor,now,card,statement,command,run,seed,memoryDB};
