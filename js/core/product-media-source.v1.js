(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SVProductMediaSource=api;
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const buckets=new Set(['nixa-sisventas.firebasestorage.app']);
 // Preserve the existing download capability. This does not create a token,
 // query RTDB, change an image field, or grant read access to another bucket.
 function direct(src){
  if(typeof src!=='string'||src.length>8192)return null;
  try{
   const url=new URL(src.trim());
   if(url.protocol!=='https:'||url.hostname!=='firebasestorage.googleapis.com'||url.port||url.username||url.password||url.hash)return null;
   const match=url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/);
   if(!match||!buckets.has(decodeURIComponent(match[1]))||!decodeURIComponent(match[2]).trim()||url.searchParams.getAll('alt').length!==1||url.searchParams.get('alt')!=='media'||url.searchParams.getAll('token').length!==1||!url.searchParams.get('token')?.trim())return null;
   return url.href;
  }catch{return null;}
 }
 return Object.freeze({direct});
});
