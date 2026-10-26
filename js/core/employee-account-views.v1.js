(function(root,factory){
 'use strict';var API=factory();if(typeof module==='object'&&module.exports)module.exports=API;if(root)root.SVEmployeeAccountViews=API.create(root);
})(typeof window==='object'?window:null,function(){
 'use strict';
 var BASE='sv_employee_account_views/v1',GLOBAL=BASE+'/globalExpenses',ROW=GLOBAL+'/rows/';
 var key=function(v){return typeof v==='string'&&v.length>0&&v.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);};
 var nonce=function(v){return typeof v==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(v);};
 var clone=function(v){return v==null?null:JSON.parse(JSON.stringify(v));};
 function failure(code,message){var error=Error(message||'No se pudo completar la lectura protegida de la cuenta.');error.code=code;return error;}
 function pathOf(ref){var value=String(ref&&ref.toString?ref.toString():ref||'');if(/^https?:\/\//.test(value))value=decodeURIComponent(new URL(value).pathname);value=value.replace(/^\/+|\/+$/g,'');if(value==='.info/connected')return value;if(value.split('/').some(function(k){return !key(k);}))throw failure('SV_ACCOUNT_VIEW_PATH');return value;}
 function select(value,parts){for(var part of parts){if(!value||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,part))return null;value=value[part];}return clone(value);}
 function validateEnvelope(value){if(!value||typeof value!=='object'||Array.isArray(value)||!value.meta||value.meta.schema!==1||value.meta.ready!==true||!nonce(value.meta.revision))throw failure('SV_ACCOUNT_VIEW_UNREADY','Tu cuenta necesita completar su preparación. No se muestran saldos incompletos.');return value;}
 function route(path){
  var p=path.split('/');if(p[0]!=='sisventas')return null;
  if(p[1]==='ctaemp')return p.length===2?{kind:'all-accounts',path:BASE+'/employees'}:{kind:'account',path:BASE+'/employees/'+p[2],relative:['ctaemp'].concat(p.slice(3))};
  if(p[1]==='gastos')return p.length===2?{kind:'expenses',path:GLOBAL}:{kind:'expense',path:ROW+p[2],relative:['value'].concat(p.slice(3))};
  if(p[1]==='empleados'){var staff=BASE+'/globalEmployeeDirectory';return p.length===2?{kind:'expenses',path:staff}:{kind:'directory',path:staff+'/rows/'+p[2],relative:['value'].concat(p.slice(3))};}
  if(p[1]==='config'&&p[2]==='cargos'){var rates=BASE+'/globalCargoDirectory';return p.length===3?{kind:'expenses',path:rates}:{kind:'directory',path:rates+'/rows/'+p[3],relative:['value'].concat(p.slice(4))};}
  if(['pagos_realizados','auditoria_pagos'].includes(p[1])){var base=BASE+(p[1]==='pagos_realizados'?'/globalPaymentBatches':'/globalPaymentAudit');return p.length===2?{kind:'expenses',path:base}:{kind:'companion',path:base+'/rows/'+p[2],relative:['value'].concat(p.slice(3))};}
  if(p[1]==='comisiones_generacion'||p[1]==='config'&&['comisiones','maxComisionPct','comisionesEmpleados'].includes(p[2]))return {kind:'private'};
  return null;
 }
 function decode(mapping,value){
  var proofs={},data;if(['companion','directory'].includes(mapping.kind)&&value===null){proofs[mapping.path]=null;return {value:null,proofs:proofs};}
  if(mapping.kind==='all-accounts'){
   if(!value||typeof value!=='object')throw failure('SV_ACCOUNT_VIEW_UNREADY');data={};
   Object.keys(value).filter(function(id){return value[id]!==null;}).forEach(function(id){if(!key(id))throw failure('SV_ACCOUNT_VIEW_PATH');var envelope=validateEnvelope(value[id]);data[id]=clone(envelope.ctaemp||{});proofs[mapping.path+'/'+id]=envelope.meta.revision;});
  }else{
   var envelope=validateEnvelope(value);proofs[mapping.path]=envelope.meta.revision;
   if(mapping.kind==='expenses'){data={};Object.keys(envelope.rows||{}).filter(function(id){return envelope.rows[id]!==null;}).forEach(function(id){if(!key(id))throw failure('SV_ACCOUNT_VIEW_PATH');var row=validateEnvelope(envelope.rows[id]);data[id]=clone(row.value);proofs[mapping.path+'/rows/'+id]=row.meta.revision;});}
   else data=select(envelope,mapping.relative);
  }
  return {value:data,proofs:proofs};
 }
 function create(root){
  var sdk=null,settings={},sources=new Map(),rawSources=new Set(),snapshots=new WeakMap(),installed=false,queries=new WeakMap(),pendingGets=new Map(),generation=0;
  function capture(trackEmployee){
   trackEmployee=trackEmployee!==false;
   var capturedGeneration=generation,user=root.fbAuth&&root.fbAuth.currentUser,uid=root.currentUserUid,role=root.currentRole,revision=root.PERMISOS_ROLES&&root.PERMISOS_ROLES[role]&&root.PERMISOS_ROLES[role].indiceRevision;
   var epoch=root._svOperacionesSesionEpoch||0,dataEpoch=root._svDataEpoch||0,view=root._impersonacionOriginal,viewId=view&&view.usuarioFbKey;var permissionSignature=JSON.stringify(root.PERMISOS_ROLES&&root.PERMISOS_ROLES[role]||null),ownEmployee=trackEmployee&&root.svEmpleadoPropio,ownId=ownEmployee&&String((ownEmployee()||{}).fbKey||'');
   if(!user||!uid||user.uid!==uid||(typeof root.svSesionVistaCuentaAutenticada==='function'?root.svSesionVistaCuentaAutenticada():root.isAuthenticated)!==true)throw failure('SV_ACCOUNT_VIEW_SESSION','La sesión cambió. Volvé a ingresar.');
   var valid=function(){return generation===capturedGeneration&&(typeof root.svSesionVistaCuentaAutenticada==='function'?root.svSesionVistaCuentaAutenticada():root.isAuthenticated)===true&&root.fbAuth.currentUser===user&&root.currentUserUid===uid&&root.currentRole===role&&revision===(root.PERMISOS_ROLES&&root.PERMISOS_ROLES[role]&&root.PERMISOS_ROLES[role].indiceRevision)&&epoch===(root._svOperacionesSesionEpoch||0)&&dataEpoch===(root._svDataEpoch||0)&&view===root._impersonacionOriginal&&viewId===(root._impersonacionOriginal&&root._impersonacionOriginal.usuarioFbKey)&&permissionSignature===JSON.stringify(root.PERMISOS_ROLES&&root.PERMISOS_ROLES[role]||null)&&(!trackEmployee||ownEmployee===root.svEmpleadoPropio&&ownId===(ownEmployee&&String((ownEmployee()||{}).fbKey||'')));};
   return {uid:uid,role:role,revision:revision,epoch:epoch,dataEpoch:dataEpoch,view:view,viewId:viewId,user:user,valid:valid,financial:typeof root.svEsAdministradorFinanciero==='function'?root.svEsAdministradorFinanciero():role==='admin'&&!view};
  }
  function visible(){return (!root.document||root.document.hidden!==true&&!['hidden','prerender'].includes(root.document.visibilityState))&&(!root.SVForegroundSession||root.SVForegroundSession.isVisible()!==false);}
  function assert(scope){if(!scope.valid())throw failure('SV_ACCOUNT_VIEW_SESSION');if(!visible())throw failure('SV_ACCOUNT_VIEW_RETIRED','La lectura se retiró al salir de la pantalla. Volvé a abrirla para consultar.');}
  function rawSnapshot(ref,snap,scope){
   function current(){if(!scope.valid())throw failure('SV_ACCOUNT_VIEW_SESSION');}
   var result={ref:snap.ref||ref,key:snap.key===undefined?pathOf(ref).split('/').pop():snap.key,
    val:function(){current();return snap.val();},exists:function(){current();return snap.exists();},
    child:function(path){current();return rawSnapshot(sdk.ref(root.fbDB,pathOf(ref)+'/'+path),snap.child(path),scope);},
    hasChild:function(path){current();return snap.hasChild(path);},hasChildren:function(){current();return snap.hasChildren();},
    toJSON:function(){current();return typeof snap.toJSON==='function'?snap.toJSON():snap.val();},
    exportVal:function(){current();return typeof snap.exportVal==='function'?snap.exportVal():snap.val();},getPriority:function(){current();return typeof snap.getPriority==='function'?snap.getPriority():null;},
    forEach:function(callback){current();return snap.forEach(function(child){current();return callback(rawSnapshot(child.ref||sdk.ref(root.fbDB,pathOf(ref)+'/'+child.key),child,scope));});}};
   Object.defineProperty(result,'size',{enumerable:true,get:function(){current();return snap.size;}});return result;
  }
  function rawOnValue(ref,callback,error,options,scope){
   assert(scope);var source={closed:false,off:null};rawSources.add(source);
   function stop(){if(source.closed)return;source.closed=true;rawSources.delete(source);if(typeof source.off==='function')source.off();}
   function reject(reason){stop();if(typeof error==='function'){try{error(reason);}catch(_){}}}
   stop.valid=function(){return !source.closed&&scope.valid();};source.stop=stop;
   try{source.off=sdk.onValue(ref,function(snap){if(source.closed)return;try{assert(scope);if(options&&options.onlyOnce&&source.delivered)return;source.delivered=true;var result=callback(rawSnapshot(ref,snap,scope));return Promise.resolve(result).then(function(){if(options&&options.onlyOnce)stop();},reject);}catch(reason){reject(reason);}},reject,options);if(source.closed&&typeof source.off==='function')source.off();}
   catch(reason){reject(reason);}source.stop=stop;return stop;
  }
  function snapshot(ref,value,proofs){
   var data=clone(value),path=pathOf(ref);var result={ref:ref,key:path.split('/').pop(),val:function(){return clone(data);},exists:function(){return data!==null;},toJSON:function(){return clone(data);},exportVal:function(){return clone(data);},getPriority:function(){return null;},child:function(child){return snapshot(sdk.ref(root.fbDB,path+'/'+child),select(data,String(child).split('/')),proofs);},hasChild:function(child){return select(data,String(child).split('/'))!==null;},hasChildren:function(){return !!data&&typeof data==='object'&&Object.keys(data).length>0;},size:data&&typeof data==='object'?Object.keys(data).length:0,forEach:function(cb){for(var id of Object.keys(data||{}))if(cb(result.child(id))===true)return true;return false;}};
   snapshots.set(result,Object.assign({},proofs));return result;
  }
  function mappingFor(ref,scope){var mapping=route(pathOf(ref));if(!mapping||scope.financial)return null;if(mapping.kind==='private')throw failure('SV_ACCOUNT_FINANCIAL_PRIVATE','La configuración de comisiones es privada del administrador.');if(queries.has(ref))throw failure('SV_ACCOUNT_VIEW_QUERY','Actualizá la lectura de cuenta para usar su vista protegida.');return mapping;}
  async function get(ref){
   var logical=route(pathOf(ref));if(!logical)return sdk.get(ref);var scope=capture(['account','all-accounts'].includes(logical.kind)),mapping=mappingFor(ref,scope);if(!mapping){assert(scope);var raw=await sdk.get(ref);assert(scope);return rawSnapshot(ref,raw,scope);}assert(scope);
   var entry=pendingGets.get(mapping.path);if(!entry||!entry.scope.valid()||!matches(entry.scope,scope)){
    entry={scope:scope,promise:null};entry.promise=Promise.resolve().then(function(){assert(entry.scope);return sdk.get(sdk.ref(root.fbDB,mapping.path));}).finally(function(){if(pendingGets.get(mapping.path)===entry)pendingGets.delete(mapping.path);});pendingGets.set(mapping.path,entry);
   }
   var result=await entry.promise;assert(scope);var projected=decode(mapping,result.val());assert(scope);return snapshot(ref,projected.value,projected.proofs);
  }
  async function queryExpensesByType(type){
   if(type!=='bonificacion')throw failure('SV_ACCOUNT_VIEW_QUERY','Esta consulta sólo permite buscar bonificaciones.');
   var scope=capture(false);assert(scope);
   if(!sdk||typeof sdk.orderByChild!=='function'||typeof sdk.equalTo!=='function')throw failure('SV_ACCOUNT_VIEW_SDK');
   var logical=sdk.ref(root.fbDB,'sisventas/gastos'),physical=scope.financial?'sisventas/gastos':GLOBAL+'/rows';
   var query=sdk.query(sdk.ref(root.fbDB,physical),sdk.orderByChild(scope.financial?'tipoPagable':'value/tipoPagable'),sdk.equalTo(type));
   assert(scope);var result=await sdk.get(query);assert(scope);
   if(scope.financial)return rawSnapshot(logical,result,scope);
   var rows=result.val();assert(scope);var data=null,proofs={};
   if(rows!==null){
    if(!rows||typeof rows!=='object')throw failure('SV_ACCOUNT_VIEW_UNREADY');data={};
    Object.keys(rows).forEach(function(id){
     assert(scope);if(rows[id]===null)return;if(!key(id))throw failure('SV_ACCOUNT_VIEW_PATH');
     var envelope=validateEnvelope(rows[id]);assert(scope);var value=envelope.value;
     if(!value||typeof value!=='object'||Array.isArray(value)||value.tipoPagable!==type)throw failure('SV_ACCOUNT_VIEW_UNREADY');
     data[id]=clone(value);proofs[ROW+id]=envelope.meta.revision;assert(scope);
    });
   }
   assert(scope);var answer=rawSnapshot(logical,snapshot(logical,data,proofs),scope);snapshots.set(answer,Object.assign({},proofs));return answer;
  }
  function matches(a,b){return a.user===b.user&&a.uid===b.uid&&a.role===b.role&&a.revision===b.revision&&a.epoch===b.epoch&&a.dataEpoch===b.dataEpoch&&a.view===b.view&&a.viewId===b.viewId;}
  function retireConsumer(source,c,error){
   if(c.cancelled)return;c.cancelled=true;c.run++;source.consumers.delete(c);
   try{if(c.load)c.load[error?'error':'cancel']();}catch(_){}
   if(error&&c.error){try{c.error(error);}catch(_){} }
  }
  function close(source,error){
   if(source.closed)return;source.closed=true;if(sources.get(source.path)===source)sources.delete(source.path);source.value=null;source.proofs=null;
   try{if(typeof source.off==='function')source.off();}catch(_){}
   Array.from(source.consumers).forEach(function(c){retireConsumer(source,c,error);});source.consumers.clear();
  }
  function onValue(ref,callback,error,options,override){
   if(error&&typeof error==='object'&&!options){options=error;error=undefined;}if(!override&&!route(pathOf(ref)))return sdk.onValue(ref,callback,error,options);
   var scope,mapping;try{scope=capture(['account','all-accounts'].includes((override||route(pathOf(ref))||{}).kind));mapping=override||mappingFor(ref,scope);}catch(e){if(typeof error==='function'){error(e);return function(){};}throw e;}
   if(!mapping)return rawOnValue(ref,callback,error,options,scope);assert(scope);
   var source=sources.get(mapping.path);if(source&&(!source.scope.valid()||!matches(source.scope,scope))){close(source);source=null;}
   var created=!source;if(!source){source={path:mapping.path,scope:scope,consumers:new Set(),value:undefined,off:null,closed:false};sources.set(mapping.path,source);}
   var consumer={mapping:mapping,ref:ref,callback:callback,error:typeof error==='function'?error:null,load:root.SVDataReadiness&&root.SVDataReadiness.begin(ref),cancelled:false,options:options,lastJSON:undefined,run:0,stop:null};source.consumers.add(consumer);
   function deliver(c){
    if(c.cancelled||source.closed||c.options&&c.options.onlyOnce&&c.deliveredOnce)return;
    var projected,json;try{assert(source.scope);projected=decode(c.mapping,source.value);assert(source.scope);json=JSON.stringify(projected.value);}catch(e){close(source,e);return;}
    if(c.lastJSON===json)return;c.lastJSON=json;c.deliveredOnce=true;var run=++c.run,result;
    function consumerFailure(error){if(c.cancelled||source.closed||c.run!==run)return;retireConsumer(source,c,error);if(!source.consumers.size)close(source);}
    try{result=c.callback(snapshot(c.ref,projected.value,projected.proofs));}catch(e){consumerFailure(e);return;}
    Promise.resolve(result).then(function(){if(!c.cancelled&&!source.closed&&source.scope.valid()&&c.run===run){try{c.load&&c.load.ready();}catch(e){consumerFailure(e);return;}if(c.options&&c.options.onlyOnce)c.stop();}},consumerFailure);
   }
   function stop(){if(consumer.cancelled)return;retireConsumer(source,consumer);if(!source.consumers.size)close(source);}
   consumer.stop=stop;stop.valid=function(){return !source.closed&&!consumer.cancelled&&source.scope.valid();};
   if(created){try{source.off=sdk.onValue(sdk.ref(root.fbDB,mapping.path),function(snap){if(source.closed)return;try{assert(source.scope);source.value=snap.val();assert(source.scope);Array.from(source.consumers).forEach(deliver);}catch(e){close(source,e);}},function(e){close(source,e);});if(source.closed&&typeof source.off==='function')source.off();}catch(e){close(source,e);}}
   else if(source.value!==undefined)Promise.resolve().then(function(){deliver(consumer);});return stop;
  }
  function ownExpenses(callback,error){var scope=capture();if(scope.financial)return onValue(sdk.ref(root.fbDB,'sisventas/gastos'),callback,error);var employee=root.svEmpleadoPropio&&root.svEmpleadoPropio();if(!employee||!key(String(employee.fbKey||'')))throw failure('SV_ACCOUNT_VIEW_OWNER');return onValue(sdk.ref(root.fbDB,'sisventas/gastos'),callback,error,undefined,{kind:'account',path:BASE+'/employees/'+employee.fbKey,relative:['gastos']});}
  function reset(){generation++;pendingGets.clear();Array.from(rawSources).forEach(function(source){source.stop&&source.stop();});Array.from(sources.values()).forEach(function(source){close(source);});snapshots=new WeakMap();}
  function install(options){if(installed)return api;settings=options||{};sdk=settings.sdk||{};for(var name of ['get','onValue','ref','query'])if(typeof sdk[name]!=='function')throw failure('SV_ACCOUNT_VIEW_SDK');root.fbGet=get;root.fbOnValue=onValue;root.fbQuery=function(ref){var args=Array.prototype.slice.call(arguments,1),result=sdk.query.apply(null,[ref].concat(args));queries.set(result,true);return result;};installed=true;
   if(root.document&&root.document.addEventListener){['sisventas:session-ended','sisventas:role-changed'].forEach(function(name){root.document.addEventListener(name,reset);});}if(root.addEventListener)root.addEventListener('pagehide',reset);return api;}
  var api={install:install,get:get,onValue:onValue,queryExpensesByType:queryExpensesByType,subscribeOwnExpenses:ownExpenses,proofs:function(snap){return clone(snapshots.get(snap)||{});},route:route,pathOf:pathOf,reset:reset,isWriteProtected:function(ref){try{return !capture().financial&&/^sisventas\/(?:ctaemp|gastos|pagos_realizados|auditoria_pagos)(?:\/|$)/.test(pathOf(ref));}catch(_){return true;}},isProtected:function(ref){try{return !capture().financial&&!!route(pathOf(ref));}catch(_){return !!route(pathOf(ref));}}};return api;
 }
 return {create:create,route:route,decode:decode,validateEnvelope:validateEnvelope,BASE:BASE,GLOBAL:GLOBAL};
});
