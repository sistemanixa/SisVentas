(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SVDollarHistoryScope=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var modes=['day','week','month','year'];
  function iso(date){return String(date.getUTCFullYear()).padStart(4,'0')+'-'+String(date.getUTCMonth()+1).padStart(2,'0')+'-'+String(date.getUTCDate()).padStart(2,'0');}
  function validDate(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1000-01-01'||value>'9999-12-31')return false;
    var parsed=new Date(value+'T12:00:00.000Z');
    return Number.isFinite(parsed.getTime())&&iso(parsed)===value;
  }
  function create(kind,anchor,mode){
    if(kind==='all')return Object.freeze({kind:'all',anchor:null,mode:null,start:null,end:null,signature:'all'});
    if(kind!=='period'||!validDate(anchor)||modes.indexOf(mode)===-1)throw new TypeError('Período del histórico inválido');
    var start=new Date(anchor+'T12:00:00.000Z'),end=new Date(start);
    if(mode==='year'){start.setUTCMonth(0,1);end.setUTCMonth(11,31);}
    else if(mode==='month'){start.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1,0);}
    else if(mode==='week'){start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);end=new Date(start);end.setUTCDate(end.getUTCDate()+6);}
    var from=iso(start),to=iso(end);
    if(!validDate(from)||!validDate(to))throw new RangeError('Período del histórico fuera de rango');
    return Object.freeze({kind:'period',anchor:anchor,mode:mode,start:from,end:to,signature:'period|'+from+'|'+to});
  }
  function filter(raw,scope){
    if(scope.kind==='all')return raw;
    if(!raw||typeof raw!=='object')return {};
    var result=Array.isArray(raw)?new Array(raw.length):{};
    Object.keys(raw).forEach(function(key){
      if(validDate(key)&&key>=scope.start&&key<=scope.end)Object.defineProperty(result,key,{value:raw[key],enumerable:true,writable:true,configurable:true});
    });
    return result;
  }
  return Object.freeze({create:create,filter:filter,validDate:validDate});
});
