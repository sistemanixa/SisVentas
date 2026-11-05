'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const Reader=require('../../js/core/commercial-pages-reader.v1.js'),Search=require('../../js/core/collection-search-model.v1.js'),Projection=require('../../cotizador/commercial-pages-projections');
async function fixture({config='native',holdConfig=false,configError=null}={}){
 const sales={},payments={};for(let i=0;i<65;i++){sales['s'+i]={id:'V-'+i,fecha:'2026-11-01',cliente:'Ficticio '+i,total:100,subtotal:100,responsableUid:'u'};payments['p'+i]={ventaFbKey:'s'+i,venta:'V-'+i,fecha:'2026-11-01',cliente:'Ficticio '+i,monto:25,medio:'Efectivo',totalVenta:100,saldoRestante:75};}
 const built=await Projection.prepare({sales,payments,owner:s=>s.responsableUid,generation:'fallback-fiction',nativeCollections:true}),data={sisventas:{ventas:sales,pagos:payments}};
 function set(path,value){const parts=path.split('/'),last=parts.pop();let node=data;for(const part of parts)node=node[part]||={};node[last]=value;}
 for(const [path,value]of Object.entries(built.patch))set(path,value);
 const native={ready:true,schema:1,generation:'fallback-fiction',nativeCollectionsReady:true,nativeCollectionsSchema:1};data.sv_commercial_pages_config=config==='native'?native:config;
 const events=new Map(),windowEvents=new Map(),nodes=new Map(),calls=[],cfgWaiters=[],stats={legacy:0,stops:0,coverageStops:0,sourceCalls:0,invalidations:0,readerCreates:0};
 function node(id){return{id,textContent:'',innerHTML:'',value:'',style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},replaceChildren(){this.innerHTML='';this.textContent='';},querySelector(){return {};},querySelectorAll(){return [];}};}
 for(const id of ['pagos-tbody','cob-paginacion','cob-contador','cob-met-cobrado','cob-met-pendiente','cob-met-promedio','cob-buscador','cob-filtro-medio','cob-drop'])nodes.set(id,node(id));
 // Sentinel DOM already owned by the legacy screen, not a legacy reader implementation.
 nodes.get('pagos-tbody').innerHTML='<tr data-legacy-sentinel="true"><td>Existing legacy DOM</td></tr>';nodes.get('cob-contador').textContent='Existing legacy status';
 const doc={hidden:false,readyState:'loading',getElementById:id=>nodes.get(id)||null,querySelector:()=>null,addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}};
 let route='cobranzas',permission=true,configHeld=holdConfig,error=configError;
 const root={document:doc,navigator:{onLine:true},location:{hash:'#/cobranzas'},currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},fbDB:{fixture:true},PERMISOS_ROLES:{admin:{indiceRevision:1}},_svPaginaDesdeRuta:()=>route,permisoModulo:()=>permission,svPuedeLeerDominio:()=>permission,svFechaLocalISO:()=> '2026-11-05',svMesLocalISO:()=> '2026-11',escapeHTML:String,SVCollectionSearchModel:Search,SVCommercialPagesReader:{createShared(options){stats.readerCreates++;return Reader.createShared(options);}},SVCommercialOwnership:{stopDomain(){stats.stops++;}},_ventasListenerActivo:true,_pagosListenerActivo:true,_svPagosStop(){stats.stops++;},fbCargarClientes(){},fbCargarClientesUnificados(){},svMarcarDatoInicialListo(){},addEventListener(name,fn){if(!windowEvents.has(name))windowEvents.set(name,[]);windowEvents.get(name).push(fn);}};
 const read=path=>path.split('/').reduce((value,key)=>value?.[key],data)??null;
 root.fbRef=(_,path)=>({path});root.fbOrderByKey=()=>({order:true});root.fbStartAt=start=>({start});root.fbLimitToFirst=limit=>({limit});root.fbQuery=(ref,...ops)=>Object.assign({},ref,...ops);
 root.fbGet=async spec=>{calls.push({...spec});if(spec.path==='sv_commercial_pages_config'){if(configHeld)await new Promise((resolve,reject)=>cfgWaiters.push({resolve,reject}));if(error)throw error;}let value=read(spec.path);if(spec.order)value=Object.fromEntries(Object.entries(value||{}).sort(([a],[b])=>a.localeCompare(b)).filter(([key])=>!spec.start||key>=spec.start).slice(0,spec.limit));return {val:()=>structuredClone(value)};};
 root.fbOnValue=(ref,callback)=>{callback({val:()=>read(ref.path)});return()=>stats.coverageStops++;};
 root.SVCommercialPagesHost={ready:true,activeRoute:()=>false,start:resume=>resume(),ensure:()=>false,renderList:()=>false,paintSalesStats:()=>false,refresh:()=>false,beforePage(){},financialState:()=>null};
 root.window=root;const context={window:root,document:doc,console,Map,Set,Promise,setTimeout,clearTimeout,requestAnimationFrame(){}};vm.createContext(context);vm.runInContext(fs.readFileSync('js/core/data-readiness.js','utf8'),context);
 const begin=root.SVDataReadiness.beginSource,invalidate=root.SVDataReadiness.invalidate;root.SVDataReadiness.beginSource=(...args)=>{stats.sourceCalls++;return begin(...args);};root.SVDataReadiness.invalidate=(...args)=>{stats.invalidations++;return invalidate(...args);};
 vm.runInContext(fs.readFileSync('js/modules/collections-indexed-host.v1.js','utf8'),context);
 const host=root.SVCollectionsIndexedHost,pages=root.SVCommercialPagesHost;
 const legacy=async()=>{stats.legacy++;};
 const bootstrap=()=>pages.start(()=>pages.activeRoute()?pages.ensure():legacy());
 return{root,host,pages,doc,nodes,calls,stats,data,legacy,bootstrap,emit(name){for(const fn of events.get(name)||[])fn();},emitWindow(name){for(const fn of windowEvents.get(name)||[])fn();},setRoute(value){route=value;},setPermission(value){permission=value;},hold(){configHeld=true;},release(){configHeld=false;for(const waiter of cfgWaiters.splice(0))waiter.resolve();},reject(e){configHeld=false;for(const waiter of cfgWaiters.splice(0))waiter.reject(e);},setConfig(value){data.sv_commercial_pages_config=value;},setError(value){error=value;},releaseOne(){cfgWaiters.shift()?.resolve();},pendingConfig:()=>cfgWaiters.length};
}
module.exports={fixture};
