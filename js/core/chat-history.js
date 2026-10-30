(function(root,factory){
 'use strict';const create=factory();if(typeof module==='object'&&module.exports)module.exports={create};else root.SVChatHistory=create(root);
})(typeof window==='object'?window:null,function(){
 'use strict';return function create(root){
  function watch(channel,next,error,pageSize=75){
   const uid=root.currentUserUid,user=root.fbAuth?.currentUser,body=root.SVChatReadModel.paths(channel).body;
   let stopped=false,busy=false,hasOlder=true,loaded=new Map(),stops=[],epoch=0,latestKeys=new Set(),pointKeys=new Set();
   const live=()=>!stopped&&user===root.fbAuth?.currentUser&&uid===root.currentUserUid;
   function emit(older=false,statusOnly=false){if(live())next({val:()=>Object.fromEntries(loaded)}, {older,statusOnly,busy,hasOlder,count:loaded.size});}
   function fail(e){if(live())error?.(e);}
   const query=(cursor)=>root.fbQuery(root.fbRef(root.fbDB,body),root.fbOrderByChild('ts'),...(cursor?[root.fbEndBefore(cursor.ts??null,cursor.key)]:[]),root.fbLimitToLast(pageSize));
   function follow(key){
    if(pointKeys.has(key))return;pointKeys.add(key);
    stops.push(root.fbOnValue(root.fbRef(root.fbDB,body+'/'+key),snap=>{if(!live())return;const value=snap.val();if(value==null)loaded.delete(key);else loaded.set(key,value);if(!busy)emit();},fail));
   }
   stops.push(root.fbOnValue(query(),snap=>{
    if(!live())return;const data=snap.val()||{};for(const [key,value]of Object.entries(data))loaded.set(key,value);
    for(const key of latestKeys)if(!Object.hasOwn(data,key))follow(key);
    latestKeys=new Set(Object.keys(data));
    if(loaded.size<pageSize)hasOlder=false;emit();
   },fail));
   async function older(){
    if(!live()||busy||!hasOlder||!loaded.size)return;
    busy=true;const serial=++epoch;emit(false,true);
    const first=[...loaded].sort((a,b)=>((a[1].ts==null?-Infinity:a[1].ts)-(b[1].ts==null?-Infinity:b[1].ts))||a[0].localeCompare(b[0]))[0];
    const q=query({ts:first[1].ts,key:first[0]}),readiness=root.SVDataReadiness?.begin(q.ref||q);
    try{
     const snapshot=await root.fbGet(q);if(!live()||serial!==epoch){readiness?.cancel();return;}
     const data=snapshot.val()||{},keys=Object.keys(data);hasOlder=keys.length===pageSize;
     for(const key of keys){loaded.set(key,data[key]);follow(key);}
     readiness?.ready?.();busy=false;emit(true);
    }catch(e){readiness?.error?.(e);busy=false;fail(e);emit();}
   }
   return Object.freeze({older,stop(){if(stopped)return;stopped=true;epoch++;stops.forEach(stop=>stop());stops=[];loaded.clear();}});
  }
  return Object.freeze({watch});
 };
});
