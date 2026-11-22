'use strict';
// BrowserContext.request bypasses Playwright routing. This test-only facade
// dispatches API POSTs through the fixture's explicit handlers, never a network
// client or browser page, so credentials stay outside page scripts.
module.exports=function apiFixture(context){
 const handlers=[];let wrapped;
 const bind=(target,name)=>{const value=Reflect.get(target,name);return typeof value==='function'?value.bind(target):value;};
 const post=async(url,options={})=>{
  if(new URL(url).origin!=='https://www.tecnoprices.com'||options.maxRedirects!==0)throw Error('Fixture refuses external API requests or redirect replay');
  const body=new URLSearchParams(options.form).toString();
  const request={url:()=>url,method:()=> 'POST',postData:()=>body,headers:()=>({'content-type':'application/x-www-form-urlencoded'})};
  let response;
  async function dispatch(index){
   if(index<0)throw Error('No synthetic API fixture response; network fallback forbidden');
   const route={request:()=>request,fulfill:async value=>{response={status:value.status??200,headers:value.headers||{},body:value.body||''};},abort:async()=>{throw Error('Synthetic API request aborted');},fallback:()=>dispatch(index-1),continue:async()=>{throw Error('Real network forbidden in synthetic API fixture');}};
   await handlers[index](route);
  }
  await dispatch(handlers.length-1);if(!response)throw Error('Synthetic API handler did not fulfill');
  return {status:()=>response.status,headers:()=>response.headers,text:async()=>String(response.body),dispose:async()=>{}};
 };
 wrapped=new Proxy(context,{get(target,name){
  if(name==='route')return async(pattern,handler)=>{if(pattern!=='**/*')throw Error('Explicit catch-all fixture required');handlers.push(handler);return target.route(pattern,handler);};
  if(name==='request')return {post};
  if(name==='newPage')return async(...args)=>{const page=await target.newPage(...args);return new Proxy(page,{get(target,name){if(name==='context')return ()=>wrapped;return bind(target,name);}});};
  return bind(target,name);
 }});
 return wrapped;
};
