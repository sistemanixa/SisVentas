(function(root,factory){
 'use strict';var API=factory();if(typeof module==='object'&&module.exports)module.exports=API;if(root)root.SVCommercialViews=API.create(root);
})(typeof window==='object'?window:null,function(){
 'use strict';
 var DOMAINS=['ventas','presupuestos'],PRIVATE=['sv_commercial_views','sv_commercial_view_sources'];
 var COST=new Set('costoTotal costoTotalCompra costoUnitarioCompra costoUnitario costoCompra costo costoUnitarioAntesPreparacion costoUnitarioPresupuestado costoUnitarioUSD compra precioCompra precio_compra ganancia margen margenPct gananciaTotal porcentajeVentaCompra'.split(' '));
 var clone=function(value){return value==null?null:JSON.parse(JSON.stringify(value));};
 var canonical=function(value){return value==null?'null':Array.isArray(value)?'['+value.map(canonical).join(',')+']':typeof value==='object'?'{'+Object.keys(value).filter(function(k){return value[k]!==undefined;}).sort().map(function(k){return JSON.stringify(k)+':'+canonical(value[k]);}).join(',')+'}':JSON.stringify(value);};
 var equal=function(a,b){return canonical(a)===canonical(b);},nonce=function(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(value);};
 var key=function(value){return typeof value==='string'&&!!value&&value.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','prototype','constructor'].includes(value);};
 function fail(code,message){return Object.assign(Error(message||'Volvé a abrir la ficha comercial para continuar.'),{code:code});}
 function pathOf(ref){var text=String(ref&&ref.toString?ref.toString():ref||'');if(/^https?:\/\//.test(text))text=decodeURIComponent(new URL(text).pathname);text=text.replace(/^\/+|\/+$/g,'');if(text&&text.split('/').some(function(part){return !key(part);}))throw fail('SV_COMMERCIAL_PATH');return text;}
 function route(path){var p=path.split('/');if(PRIVATE.includes(p[0]))return {private:true};if(p[0]!=='sisventas'||!DOMAINS.includes(p[1]))return null;return {domain:p[1],id:p[2]||'',relative:p.slice(3)};}
 function select(value,parts){for(var p of parts){if(!value||typeof value!=='object'||!Object.hasOwn(value,p))return null;value=value[p];}return clone(value);}
 function meta(record){if(!record||typeof record!=='object'||Array.isArray(record)||record._svCommercial?.schema!==1||typeof record._svCommercial.readOnly!=='boolean'||typeof record._svCommercial.costsVisible!=='boolean'||record._svCommercial.revision!==null&&!nonce(record._svCommercial.revision))throw fail('SV_COMMERCIAL_PROTOCOL','La ficha necesita completar su preparación.');return record._svCommercial;}
 function dto(record){if(record===null)return null;var header=meta(record);if(!header.costsVisible){for(var field of COST)if(Object.hasOwn(record,field)||Array.isArray(record.items)&&record.items.some(function(line){return line&&Object.hasOwn(line,field);}))throw fail('SV_COMMERCIAL_PROTOCOL','La ficha recibida requiere una revisión de privacidad.');}return clone(record);}
 function recordsDTO(records){if(!records||typeof records!=='object'||Array.isArray(records))throw fail('SV_COMMERCIAL_PROTOCOL');var out={};for(var id of Object.keys(records)){if(!key(id))throw fail('SV_COMMERCIAL_PATH');out[id]=dto(records[id]);}return out;}
 function keyCompare(a,b){var numeric=function(v){return /^(0|[1-9]\d*)$/.test(v)&&Number(v)<=2147483647;},x=numeric(a),y=numeric(b);return x&&y?Number(a)-Number(b):x?-1:y?1:a<b?-1:a>b?1:0;}
 function valueCompare(a,b){var type=function(v){return v==null?0:v===false?1:v===true?2:typeof v==='number'?3:typeof v==='string'?4:5;},x=type(a),y=type(b);return x!==y?x-y:x===3?a-b:x===4?(a<b?-1:a>b?1:0):0;}
 function applyQuery(value,constraints){
  if(!constraints.length)return {value:clone(value),order:null};if(value===null)return {value:null,order:[]};if(!value||typeof value!=='object')throw fail('SV_COMMERCIAL_QUERY');
  var order=constraints.filter(function(c){return c.name.startsWith('orderBy');});if(order.length>1)throw fail('SV_COMMERCIAL_QUERY');order=order[0]||{name:'orderByKey',args:[]};
  var field=function(k){return order.name==='orderByKey'?k:order.name==='orderByValue'?value[k]:select(value[k],String(order.args[0]).split('/'));};
  var compare=order.name==='orderByKey'?keyCompare:valueCompare,entries=Object.keys(value).filter(function(k){return value[k]!==null;}).sort(function(a,b){return compare(field(a),field(b))||keyCompare(a,b);});
  var bounds=constraints.filter(function(c){return ['equalTo','startAt','startAfter','endAt','endBefore'].includes(c.name);}),limits=constraints.filter(function(c){return c.name.startsWith('limitTo');});
  if(limits.length>1||bounds.filter(function(c){return c.name==='equalTo';}).length&&bounds.length>1||bounds.filter(function(c){return c.name.startsWith('start');}).length>1||bounds.filter(function(c){return c.name.startsWith('end');}).length>1)throw fail('SV_COMMERCIAL_QUERY');
  entries=entries.filter(function(k){return bounds.every(function(c){var n=compare(field(k),c.args[0]);if(n===0&&c.args[1]!==undefined)n=keyCompare(k,c.args[1]);return c.name==='equalTo'?n===0:c.name==='startAt'?n>=0:c.name==='startAfter'?n>0:c.name==='endAt'?n<=0:n<0;});});
  if(limits.length){var size=limits[0].args[0];if(!Number.isSafeInteger(size)||size<=0)throw fail('SV_COMMERCIAL_QUERY');entries=limits[0].name==='limitToFirst'?entries.slice(0,size):entries.slice(-size);}
  var result={};for(var id of entries)Object.defineProperty(result,id,{value:clone(value[id]),enumerable:true,writable:true,configurable:true});return {value:entries.length?result:null,order:entries};
 }
 function changesFor(baseline,changes){
  var version=meta(baseline),out={};if(!nonce(version.revision)||version.readOnly)throw fail('SV_COMMERCIAL_VERSION','Prepará nuevamente la ficha antes de guardar.');
  if(!changes||typeof changes!=='object'||Array.isArray(changes))throw fail('SV_COMMERCIAL_CHANGES');
  for(var field of Object.keys(changes)){
   if(field==='fbKey'||field.startsWith('_sv')||COST.has(field)||changes[field]===undefined||equal(changes[field],baseline[field]))continue;
   if(field!=='items'){out[field]=clone(changes[field]);continue;}
   if(!Array.isArray(changes.items)||!Array.isArray(baseline.items))throw fail('SV_COMMERCIAL_ITEMS');var used=new Set();
   out.items=changes.items.map(function(line){if(!line||typeof line!=='object'||Array.isArray(line))throw fail('SV_COMMERCIAL_ITEMS');var result={},reference=line._svLineRef;
    if(reference!==undefined){var match=typeof reference==='string'&&reference.match(/^([A-Za-z0-9_-]{16,128}):(0|[1-9]\d*)$/),index=match?Number(match[2]):-1;if(!match||match[1]!==version.revision||!Number.isSafeInteger(index)||index>=baseline.items.length||used.has(index)||baseline.items[index]?._svLineRef!==reference)throw fail('SV_COMMERCIAL_LINE_VERSION');used.add(index);result._svLineRef=reference;}
    else if(line._svCommercialNew!==true)throw fail('SV_COMMERCIAL_LINE_REFERENCE','Volvé a abrir la ficha para conservar la referencia de cada renglón.');
    for(var name of Object.keys(line))if(!name.startsWith('_sv')&&!COST.has(name)&&line[name]!==undefined)result[name]=clone(line[name]);return result;
   });
  }
  return out;
 }
 function commercialWrite(values,patch,proofs){
  var changes={},others={},expected={};
  for(var entry of Object.entries(proofs||{})){if(entry[1]!==null&&!nonce(entry[1]))throw fail('SV_COMMERCIAL_VERSION','Prepará la ficha antes de confirmar el cambio.');expected[entry[0]]=entry[1];}
  function clean(value){if(Array.isArray(value))return value.map(clean);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(function(e){return e[0]==='_svLineRef'||!e[0].startsWith('_sv')&&e[0]!=='fbKey'&&!COST.has(e[0]);}).map(function(e){return [e[0],clean(e[1])];}));return clone(value);}
  function put(target,path,value){var out=clone(target)||{},node=out;for(var part of path.slice(0,-1)){if(!key(part))throw fail('SV_COMMERCIAL_PATH');if(!node[part]||typeof node[part]!=='object')node[part]={};node=node[part];}var last=path[path.length-1];if(!key(last))throw fail('SV_COMMERCIAL_PATH');if(value===null)delete node[last];else node[last]=clean(value);return out;}
  for(var pair of Object.entries(patch||{})){
   var path=pair[0],next=pair[1],mapping=route(path);if(!mapping){others[path]=clone(next);continue;}if(mapping.private||!mapping.id)throw fail('SV_COMMERCIAL_COLLECTION','Esta operación necesita referencias comerciales concretas.');var recordPath='sisventas/'+mapping.domain+'/'+mapping.id;
   if(!Object.hasOwn(expected,recordPath))throw fail('SV_COMMERCIAL_VERSION','Falta comprobar la versión o ausencia de esta ficha.');
   if(!mapping.relative.length){
    if(next===null){changes[recordPath]={kind:'delete'};continue;}
    if(expected[recordPath]===null){changes[recordPath]={kind:'create',changes:clean(next)};continue;}
    var before=values[recordPath];if(!before||typeof before!=='object')throw fail('SV_COMMERCIAL_VERSION');var delta={},all=new Set(Object.keys(before).concat(Object.keys(next||{})));
    for(var name of all){if(name==='fbKey'||name.startsWith('_sv'))continue;if(COST.has(name)){if(!equal(before[name],next[name]))throw fail('SV_COMMERCIAL_COST_COMMAND','Este cambio de costo requiere su operación financiera autorizada.');continue;}if(!equal(before[name],next[name]))delta[name]=Object.hasOwn(next,name)?clone(next[name]):null;}
    if(Object.hasOwn(delta,'items')){var itemDelta=changesFor(before,{items:delta.items});delta.items=itemDelta.items;}
    changes[recordPath]={kind:'merge',changes:delta};continue;
   }
   var relative=mapping.relative;if(relative[0].startsWith('_sv'))continue;if(COST.has(relative[0])||relative[0]==='items'&&relative.length>=3&&COST.has(relative[2]))throw fail('SV_COMMERCIAL_COST_COMMAND','Este cambio de costo requiere su operación financiera autorizada.');
   var command=changes[recordPath];if(!command)command=changes[recordPath]={kind:expected[recordPath]===null?'create':'merge',changes:{}};if(command.kind==='create')command.changes=put(command.changes,relative,next);else command.changes[relative.join('/')]=clean(next);
  }
  return {commercialChanges:changes,value:others,expectedCommercial:expected};
 }
 function create(root){
  var sdk,installed=false,generation=0,settings={},pending=new Map(),queries=new WeakMap(),constraints=new WeakMap(),consumers=new Set(),snapshots=new WeakMap();
  function capture(write){
   var user=root.fbAuth?.currentUser,uid=root.currentUserUid,role=root.currentRole,db=root.fbDB,config=canonical(root.PERMISOS_ROLES?.[role]||null),view=root._impersonacionOriginal,epoch=root._svOperacionesSesionEpoch||0,dataEpoch=root._svDataEpoch||0,g=generation;
   var valid=function(){return g===generation&&db===root.fbDB&&(!installed||root.fbGet===get)&&user===root.fbAuth?.currentUser&&uid===root.currentUserUid&&role===root.currentRole&&config===canonical(root.PERMISOS_ROLES?.[role]||null)&&view===root._impersonacionOriginal&&epoch===(root._svOperacionesSesionEpoch||0)&&dataEpoch===(root._svDataEpoch||0)&&root.isAuthenticated!==false;};
   if(!user||!uid||!role||!valid()||write&&(user.uid!==uid||view))throw fail('SV_COMMERCIAL_SESSION','La sesión cambió. Volvé a abrir la ficha.');return {user:user,uid:uid,role:role,view:view,valid:valid};
  }
  function visible(){return root.document?.hidden!==true&&root.SVForegroundSession?.isVisible?.()!==false;}
  function assert(scope){if(!scope.valid())throw fail('SV_COMMERCIAL_SESSION');if(!visible())throw fail('SV_COMMERCIAL_RETIRED','La lectura se retiró al salir de la pantalla. Volvé a abrirla.');}
  function own(){if(!root.SVCommercialOwnership?.request)throw fail('SV_COMMERCIAL_PROTOCOL');return root.SVCommercialOwnership;}
  function snapshot(ref,value,scope,order,proofs){
   var data=clone(value),path=pathOf(ref),read=function(){assert(scope);},result={ref:ref,key:path.split('/').pop()||null,val:function(){read();return clone(data);},exists:function(){read();return data!==null;},toJSON:function(){read();return clone(data);},exportVal:function(){read();return clone(data);},getPriority:function(){read();return null;},child:function(child){read();var p=String(child).split('/');if(p.some(function(k){return !key(k);}))throw fail('SV_COMMERCIAL_PATH');return snapshot(sdk.ref(root.fbDB,path+'/'+child),select(data,p),scope,undefined,proofs);},hasChild:function(child){return result.child(child).exists();},hasChildren:function(){read();return !!data&&typeof data==='object'&&Object.keys(data).length>0;},forEach:function(fn){read();for(var id of order||Object.keys(data||{}))if(fn(result.child(id))===true)return true;return false;}};
   Object.defineProperty(result,'size',{enumerable:true,get:function(){read();return data&&typeof data==='object'?Object.keys(data).length:0;}});snapshots.set(result,clone(proofs||{}));return result;
  }
  function recordProof(proofs,domain,id,record){if(!proofs)return;var metadata=record===null?null:meta(record);proofs['sisventas/'+domain+'/'+id]=record===null?null:metadata.readOnly||!nonce(metadata.revision)?false:metadata.revision;}
  async function read(mapping,scope,proofs){
   assert(scope);var path=mapping.id?'detalle/'+encodeURIComponent(mapping.id):'',id=mapping.domain+'/'+path,entry=pending.get(id);
   if(!entry||!entry.scope.valid()||entry.scope.user!==scope.user||entry.scope.uid!==scope.uid||entry.scope.role!==scope.role){entry={scope:scope,promise:null};entry.promise=Promise.resolve().then(function(){assert(entry.scope);return own().request(mapping.domain,path,undefined,{check:function(){assert(entry.scope);}});}).catch(function(error){if(mapping.id&&(error.status===404||error.statusCode===404))return {record:null};throw error;}).finally(function(){if(pending.get(id)===entry)pending.delete(id);});pending.set(id,entry);}
   var response=await entry.promise;assert(scope);if(mapping.id){if(!Object.hasOwn(response,'record'))throw fail('SV_COMMERCIAL_PROTOCOL');var item=dto(response.record);recordProof(proofs,mapping.domain,mapping.id,item);return select(item,mapping.relative);}
   var records=recordsDTO(response.records);for(var id of Object.keys(records))recordProof(proofs,mapping.domain,id,records[id]);return records;
  }
  function queryConstraints(ref){if(!queries.has(ref)&&ref?.ref&&typeof sdk.queryEqual==='function'&&!sdk.queryEqual(ref,ref.ref))throw fail('SV_COMMERCIAL_QUERY','La consulta comercial necesita conservar sus restricciones originales.');return queries.get(ref)||[];}
  async function get(ref){var mapping=route(pathOf(ref));if(!mapping)return sdk.get(ref);if(mapping.private)throw fail('SV_COMMERCIAL_PRIVATE');var scope=capture(false),selection=queryConstraints(ref),proofs={},data=await read(mapping,scope,proofs);assert(scope);var projected=applyQuery(data,selection);return snapshot(ref,projected.value,scope,projected.order,proofs);}
  function onValue(ref,callback,error,options){
   var mapping=route(pathOf(ref));if(!mapping)return sdk.onValue(ref,callback,error,options);var source={closed:false,off:null},scope;
   function stop(){if(source.closed)return;source.closed=true;consumers.delete(source);source.off?.();}stop.valid=function(){return !source.closed&&!!scope?.valid();};source.stop=stop;consumers.add(source);
   function reject(e){stop();if(typeof error==='function')error(e);}
   try{if(mapping.private)throw fail('SV_COMMERCIAL_PRIVATE');queryConstraints(ref);scope=capture(false);assert(scope);if(typeof own().subscribe!=='function')throw fail('SV_COMMERCIAL_SUBSCRIPTION','Abrí el listado comercial para activar esta lectura.');
    source.off=own().subscribe(mapping.domain,function(snap){if(source.closed)return;try{assert(scope);var records=recordsDTO(snap.val()),value=mapping.id?select(records,[mapping.id].concat(mapping.relative)):records,projected=applyQuery(value,queries.get(ref)||[]),signature=canonical(projected);if(source.signature===signature)return;source.signature=signature;var observed={valid:function(){return !source.closed&&scope.valid();}},task=callback(snapshot(ref,projected.value,observed,projected.order));Promise.resolve(task).then(function(){if(options?.onlyOnce)stop();},reject);}catch(e){reject(e);}},reject);if(source.closed)source.off?.();
   }catch(e){reject(e);}return stop;
  }
  function query(ref){var args=Array.prototype.slice.call(arguments,1),mapping=route(pathOf(ref));if(!mapping)return sdk.query.apply(null,[ref].concat(args));if(mapping.private)throw fail('SV_COMMERCIAL_PRIVATE');var list=queryConstraints(ref).slice();for(var arg of args){var constraint=constraints.get(arg);if(!constraint)throw fail('SV_COMMERCIAL_QUERY','La consulta comercial necesita sus restricciones originales.');list.push(constraint);}applyQuery({},list);var result=sdk.query.apply(null,[ref].concat(args));queries.set(result,list);return result;}
  async function save(domain,id,baseline,changes){
   if(!DOMAINS.includes(domain)||!key(id))throw fail('SV_COMMERCIAL_PATH');var scope=capture(true);assert(scope);var version=meta(baseline),fields=changesFor(baseline,changes),ownership=own(),context=ownership.captureWriteContext?.(domain);
   var uuid=settings.uuid||function(){return root.crypto.randomUUID();},body={id:uuid(),action:'edit',domain:domain,recordKey:id,expectedRevision:version.revision,changes:fields},check=function(){assert(scope);if(context&&ownership.isWriteContext(context)!==true)throw fail('SV_COMMERCIAL_SESSION');};
   var send=async function(){check();var data=await ownership.request(domain,'guardar',body);check();if(data.ok!==true||data.committed!==true||data.recordKey!==id)throw fail('SV_COMMERCIAL_ACK','No se recibió el acuse de la ficha guardada.');return data;},recovery=root.SVLaborWriteRecovery,result;
   if(recovery){if(typeof root.SVLaborWrites?.hash!=='function')throw fail('SV_COMMERCIAL_PROTOCOL');recovery.assertAvailable?.();var digest=await root.SVLaborWrites.hash(body);check();result=await recovery.execute({uid:scope.uid,id:body.id,digest:digest},send,check);}else result=await send();check();
   var record=null;try{if(Object.hasOwn(result,'record'))record=dto(result.record);else if(result.recovered===true)record=await read({domain:domain,id:id,relative:[]},scope);if(record){check();record.fbKey=id;ownership.confirmWrite?.(domain,record,context);}}catch(_){record=null;}
   // El acuse confirmado no se convierte en fallo financiero si la vista ya
   // no está disponible. Nunca reconstruirlo con el borrador o la base vieja.
   return {ok:true,committed:true,recordKey:id,record:clone(record),currentView:record!==null};
  }
  function acceptRecords(records){
   var scope=capture(true);assert(scope);var accepted={},plans=[];
   for(var entry of Object.entries(records||{})){var mapping=route(entry[0]);if(!mapping?.id||!key(mapping.id)||mapping.relative.length)throw fail('SV_COMMERCIAL_ACK');var record=dto(entry[1]);if(record)record.fbKey=mapping.id;plans.push({mapping:mapping,record:record,path:entry[0]});}
   assert(scope);for(var plan of plans){var ownership=own(),context=ownership.captureWriteContext?.(plan.mapping.domain);assert(scope);if(plan.record===null)ownership.confirmDelete?.(plan.mapping.domain,plan.mapping.id,context);else ownership.confirmWrite?.(plan.mapping.domain,plan.record,context);accepted[plan.path]=plan.record;}return clone(accepted);
  }
  function reset(){generation++;pending.clear();for(var source of Array.from(consumers))source.stop();}
  function install(options){if(installed)return api;settings=options||{};sdk=settings.sdk||{};for(var name of ['ref','get','onValue','query','queryEqual'])if(typeof sdk[name]!=='function')throw fail('SV_COMMERCIAL_SDK');root.fbGet=get;root.fbOnValue=onValue;root.fbQuery=query;
   for(var method of ['orderByChild','orderByKey','orderByValue','equalTo','startAt','startAfter','endAt','endBefore','limitToFirst','limitToLast']){var fn=sdk[method],global='fb'+method[0].toUpperCase()+method.slice(1);if(typeof fn!=='function')fn=root[global];if(typeof fn==='function')(function(method,fn,global){root[global]=function(){var args=Array.from(arguments),result=fn.apply(null,args);constraints.set(result,{name:method,args:clone(args)});return result;};})(method,fn,global);}
   root.document?.addEventListener?.('visibilitychange',function(){if(!visible())reset();});for(var event of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed','sisventas:foreground-paused'])root.document?.addEventListener?.(event,reset);installed=true;return api;
  }
  var api={install:install,proofs:function(snap){var proof=clone(snapshots.get(snap)||{}),mapping=route(pathOf(snap.ref));if(mapping?.id)proof=Object.fromEntries(Object.entries(proof).filter(function(entry){return entry[0]==='sisventas/'+mapping.domain+'/'+mapping.id;}));return proof;},isFinancial:function(){return typeof root.svEsAdministradorFinanciero==='function'&&root.svEsAdministradorFinanciero()===true&&!root._impersonacionOriginal&&root.fbAuth?.currentUser?.uid===root.currentUserUid;},buildWrite:commercialWrite,acceptRecords:acceptRecords,stripTechnical:function clean(value){if(Array.isArray(value))return value.map(clean);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(function(entry){return !entry[0].startsWith('_sv');}).map(function(entry){return [entry[0],clean(entry[1])];}));return value;},get:get,onValue:onValue,query:query,save:save,reset:reset,route:route,pathOf:pathOf,changesFor:changesFor,newLine:function(line){return Object.assign({},line,{_svCommercialNew:true});},lineRef:function(line){return line?._svLineRef||'';}};return api;
 }
 return {create:create,route:route,pathOf:pathOf,changesFor:changesFor,applyQuery:applyQuery,canonical:canonical};
});
