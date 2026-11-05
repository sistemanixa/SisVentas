'use strict';
const vm=require('node:vm'),fs=require('node:fs');
const {readActiveApp}=require('./active-app');
function create({now='2026-11-05T12:00:00-03:00'}={}){
  const source=process.env.SV_ARCA_TEST_SOURCE?fs.readFileSync(process.env.SV_ARCA_TEST_SOURCE,'utf8'):readActiveApp().source,start=source.indexOf('var CF_DATA ='),end=source.indexOf('\nfunction spCargar()',start);
  if(start<0||end<0)throw Error('No se encontró el área ARCA activa');
  const nodes=new Map(),events=new Map(),subscriptions=new Map(),reads=[];let instant=new Date(now);
  function node(id){if(!nodes.has(id))nodes.set(id,{id,style:{},dataset:{},innerHTML:'',textContent:'',value:'',hidden:false,classList:{contains:()=>true,add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){}});return nodes.get(id);}
  const ctx={console,Math,Number,parseFloat,parseInt,Set,Map,Date:class extends Date{constructor(...a){super(...(a.length?a:[instant]));}static now(){return +instant;}},currentUserUid:'fixture-admin',currentRole:'admin',PERMISOS_ROLES:{admin:{indiceRevision:1}},currentUser:'Ficticio',escapeHTML:x=>String(x??''),escapeAttr:x=>String(x??''),jsStringAttr:x=>String(x??''),ventasList:[],isAuthenticated:true,notify(){},setTimeout(){},CustomEvent:class{constructor(type){this.type=type;}},document:{getElementById:node,querySelector:()=>node('page-creditofiscal'),querySelectorAll:()=>[],addEventListener:(n,f)=>{if(!events.has(n))events.set(n,[]);events.get(n).push(f);}},svPuedeLeerDominio:()=>true,_suscribirModuloUnaVez:(key,path,ok,error)=>{reads.push(path);subscriptions.set(key,{ok,error});return()=>{};}};
  ctx.window=ctx;ctx.fbDB={};ctx.fbAuth={currentUser:{uid:'fixture-admin'}};ctx.tienePermiso=()=>false;
  vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
  // Keep assertions focused on period/readiness, not reconciliation or unrelated history surfaces.
  ctx.fvRenderConciliacion=()=>{};ctx.fvRenderVentasFacturadas=()=>{};ctx.cfRenderAlicuotas=ctx.fvRenderAlicuotas=ctx.cfRenderTipos=ctx.fvRenderTipos=ctx.cfRenderHistorial=ctx.fvRenderHistorial=()=>{};
  return{ctx,node,reads,source,subscriptions,setNow:v=>instant=new Date(v),emit:(kind,rows)=>subscriptions.get(kind==='cf'?'comprobantesCompra':'comprobantesVenta').ok({val:()=>Object.fromEntries(rows.map((r,i)=>['f'+i,{tipo:'1',totalIVA:21,iva21:21,neto:100,total:121,...r}]))}),fail:kind=>subscriptions.get(kind==='cf'?'comprobantesCompra':'comprobantesVenta').error(Error('fixture denied')),event:n=>(events.get(n)||[]).forEach(fn=>fn())};
}
module.exports={create};
