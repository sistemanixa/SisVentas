'use strict';
const Model=require('../../cotizador/dashboard-budget-projection-proposal'),Index=require('../../cotizador/dashboard-budget-incremental-plan-proposal'),Bootstrap=require('../../cotizador/dashboard-budget-activity-bootstrap-proposal');
const {seed}=require('./dashboard-budget-reader-fixture.cjs');
function activitySeed(records){const data=seed(records),model=Model.build({records:data.sisventas.presupuestos,complete:true,users:data.sv_usuarios,identities:data.sv_chat_roles,permissions:data.sv_permisos,generation:'activity-fixture-generation',revision:1,offsetMinutes:-180});data.sv_dashboard_budget_proposal.v1=Bootstrap.buildActivitySnapshot({model,records:data.sisventas.presupuestos,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,sourceLocale:Intl.Collator().resolvedOptions().locale}).patch[Index.ROOT];return data;}
function memoryDb(state){
 const get=path=>path.split('/').reduce((node,key)=>node&&Object.hasOwn(node,key)?node[key]:null,state)??null;
 function ref(path,spec={}){return {orderByChild:field=>ref(path,{...spec,field}),equalTo:equalTo=>ref(path,{...spec,equalTo}),orderByKey:()=>ref(path,{...spec,orderBy:'key'}),startAt:startAt=>ref(path,{...spec,startAt}),startAfter:startAfter=>ref(path,{...spec,startAfter}),limitToFirst:limit=>ref(path,{...spec,limit}),async get(){let value=structuredClone(get(path));if(spec.limit){const rows=Object.entries(value||{}).sort(([a],[b])=>a<b?-1:a>b?1:0).filter(([key,row])=>(!spec.field||row[spec.field]===spec.equalTo)&&(!spec.startAt||key>=spec.startAt)&&(!spec.startAfter||key>spec.startAfter)).slice(0,spec.limit);value=rows.length?Object.fromEntries(rows):null;}return {val:()=>value,forEach:fn=>{for(const [key,row]of Object.entries(value||{}))fn({key,val:()=>row});}};}};}
 return {ref};
}
module.exports={activitySeed,memoryDb};
