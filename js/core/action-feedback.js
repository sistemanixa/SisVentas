(function(root){
 'use strict';
 var document=root.document,api=root.SisVentas?.carga;if(!document||!api?.iniciar)return;
 var scopes=new WeakMap(),flights=new Map(),wrapped=new WeakSet(),bindings=new Map(),current=null,waitingDialogs=0;
 var stats={globales:0,callbacks:0},types=new Set(['click','submit','change','keydown']);
 var proto=root.EventTarget?.prototype,add=proto?.addEventListener,remove=proto?.removeEventListener,listeners=new WeakMap();
 function trigger(event){
  var node=event?.target;if(!node?.closest)return null;
  if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return null;
  if(event.type!=='submit'&&node.closest('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]),textarea,select'))return null;
  var result=event.type==='submit'&&(event.submitter||node.querySelector?.('button[type="submit"],input[type="submit"]')||node)||node.closest('button,input[type="button"],input[type="submit"],input[type="checkbox"],[role="button"],[onclick]');
  // Typing remains free: the query owner renders its own loading region.
  if(result?.matches?.('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]),textarea,select'))return null;
  return result;
 }
 function capture(){return{uid:root.currentUserUid,user:root.fbAuth?.currentUser,role:root.currentRole,epoch:root._svOperacionesSesionEpoch||0};}
 function valid(c){return c.uid===root.currentUserUid&&c.user===root.fbAuth?.currentUser&&c.role===root.currentRole&&c.epoch===(root._svOperacionesSesionEpoch||0);}
 function scope(event){var c=scopes.get(event);if(c)return c;var button=trigger(event);if(!button)return null;c={button:button,context:capture(),disabled:button.disabled,pending:0,dialogs:0,close:null,name:'',stopped:false};scopes.set(event,c);return c;}
 function kind(c,name){var text=name+' '+(c.button.getAttribute?.('aria-label')||c.button.textContent||'');return /elimin|borr|anular/i.test(text)?'eliminar':/guardar|registr|save|crear|confirm|aprobar|aplicar|asignar|enviar|actualizar/i.test(text)?'guardar':/buscar|search|filtrar/i.test(text)?'buscar':/abrir|ver |cargar|mostrar|detalle|editar/i.test(text)?'cargar':'procesar';}
 function ownsIndicator(button){return button.getAttribute?.('aria-busy')==='true'||!!button.querySelector?.('.sv-operation-spinner,.ti-loader-2,.ti-spin,.spin');}
 function show(c){
  if(c.stopped||c.close||!c.pending||waitingDialogs||!valid(c.context))return;
  c.close=api.iniciar({tipo:c.kind,boton:c.button.isConnected&&c.button.tagName!=='FORM'?c.button:null,deshabilitadoInicial:c.disabled,conservarIndicador:ownsIndicator(c.button),persistirAlNavegar:c.kind==='guardar'||c.kind==='eliminar'});
 }
 function stop(c){c.stopped=true;c.close?.();c.close=null;if(flights.get(c.button)===c)flights.delete(c.button);}
 function track(result,c,name){
  if(!c||!result||typeof result.then!=='function')return result;
  if(!c.pending){c.name=name;c.kind=kind(c,name);flights.set(c.button,c);}c.pending++;show(c);
  return Promise.resolve(result).finally(function(){c.pending--;if(!c.pending)stop(c);});
 }
 function invoke(fn,self,args,c,name){var previous=current;current=c;try{return track(fn.apply(self,args),c,name);}finally{current=previous;}}
 function dialogs(){
  ['svConfirm','svPrompt','svAlert'].forEach(function(name){var fn=root[name];if(typeof fn!=='function'||wrapped.has(fn))return;
   var proxy=function(){waitingDialogs++;for(var c of flights.values()){c.close?.();c.close=null;}var result;
    function resume(){waitingDialogs--;for(var c of flights.values())show(c);}
    try{result=fn.apply(this,arguments);}catch(e){resume();throw e;}
    if(!result||typeof result.then!=='function'){resume();return result;}
    return Promise.resolve(result).finally(resume);};
   wrapped.add(proxy);try{root[name]=proxy;}catch(_){/* An immutable API keeps its own feedback. */}
  });
 }
 function bind(name){
  if(['svConfirm','svPrompt','svAlert'].includes(name))return;
  var fn=root[name];if(typeof fn!=='function'||wrapped.has(fn)||/\[native code\]/.test(Function.prototype.toString.call(fn)))return;
  var descriptor=Object.getOwnPropertyDescriptor(root,name);if(descriptor&&descriptor.writable===false&&!descriptor.set)return;
  var proxy=function(){return invoke(fn,this,arguments,current,name);};wrapped.add(proxy);
  try{root[name]=proxy;if(root[name]===proxy){bindings.set(name,proxy);stats.globales++;}}catch(_){/* Do not change a sealed module. */}
 }
 function bindElement(element){
  for(var attr of ['onclick','onchange','onsubmit','onkeydown']){
   var text=element.getAttribute?.(attr);if(!text)continue;
   for(var match of text.matchAll(/(?<![\w$.])(?:window\.)?([A-Za-z_$][\w$]*)\s*\(/g))bind(match[1]);
  }
 }
 function scan(container){if(container?.getAttribute)bindElement(container);for(var node of container?.querySelectorAll?.('[onclick],[onchange],[onsubmit],[onkeydown]')||[])bindElement(node);}
 function before(event){
  var button=trigger(event),existing=button&&flights.get(button);
  if(existing&&!existing.stopped&&valid(existing.context)){event.preventDefault();event.stopImmediatePropagation();return;}
  dialogs();var c=scope(event);if(!c)return;current=c;
  var node=event.target;while(node&&node!==document){bindElement(node);node=node.parentElement;}
  // Property callbacks registered before this module are still observable.
  var property='on'+event.type,fn=button[property];if(typeof fn==='function'&&!wrapped.has(fn)){
   var proxy=function(e){return invoke(fn,this,arguments,scope(e),fn.name||property);};wrapped.add(proxy);button[property]=proxy;stats.callbacks++;
  }
  root.queueMicrotask(function(){if(current===c)current=null;});
 }
 function on(target,type,fn,options){if(add)add.call(target,type,fn,options);else target.addEventListener(type,fn,options);}
 for(var type of types)on(document,type,before,true);
 // Observe Promise-returning callbacks without changing transport, data or auth.
 if(proto&&add&&remove){
  function cap(options){return typeof options==='boolean'?options:!!options?.capture;}
  function entries(target,type,capture){var a=listeners.get(target);if(!a){a=new Map();listeners.set(target,a);}var key=type+'|'+capture,b=a.get(key);if(!b){b=new Map();a.set(key,b);}return b;}
  try{
   proto.addEventListener=function(type,listener,options){
    if(!types.has(type)||!listener||options?.signal?.aborted)return add.call(this,type,listener,options);
    var map=entries(this,type,cap(options)),proxy=map.get(listener),target=this;
    if(!proxy){proxy=function(event){if(options?.once)map.delete(listener);var c=scope(event),fn=typeof listener==='function'?listener:listener.handleEvent;if(typeof fn!=='function')return;return invoke(fn,typeof listener==='function'?this:listener,[event],c,fn.name||type);};map.set(listener,proxy);stats.callbacks++;
     if(options?.signal)on(options.signal,'abort',function(){if(map.get(listener)===proxy)map.delete(listener);},{once:true});}
    return add.call(target,type,proxy,options);
   };
   proto.removeEventListener=function(type,listener,options){var map=listeners.get(this)?.get(type+'|'+cap(options)),proxy=map?.get(listener);if(proxy)map.delete(listener);return remove.call(this,type,proxy||listener,options);};
  }catch(_){/* DOM property and named-handler coverage remain available. */}
 }
 function retire(all){for(var c of Array.from(flights.values()))if(all||!['guardar','eliminar'].includes(c.kind))stop(c);}
 on(document,'sisventas:page-changed',function(){retire(false);});
 on(document,'sisventas:session-ended',function(){retire(true);});on(document,'sisventas:role-changed',function(){retire(true);});
 on(document,'DOMContentLoaded',function(){dialogs();scan(document);});
 dialogs();scan(document);
 if(root.MutationObserver&&document.body){var observer=new root.MutationObserver(function(records){for(var record of records){if(record.type==='attributes')bindElement(record.target);else for(var node of record.addedNodes)scan(node);}for(var c of flights.values())if(!c.button.isConnected&&c.close&&!c.detached){c.detached=true;c.close();c.close=null;show(c);}});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['onclick','onchange','onsubmit','onkeydown']});}
 api.registrarHandlers=scan;
 api.cobertura=function(){return{globales:bindings.size,callbacks:stats.callbacks,pendientes:flights.size};};
})(window);
