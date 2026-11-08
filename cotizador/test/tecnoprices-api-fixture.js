'use strict';
// Explicit APIRequestContext double: never calls a real API/network transport.
const assert=require('node:assert/strict');
module.exports=function apiFixture(context){
 let handler;
 const install=context.route.bind(context);
 context.route=async(pattern,next)=>{handler=next;return install(pattern,next);};
 context.request.post=async(url,options)=>{
  assert.equal(url,'https://www.tecnoprices.com/control.php');
  assert.equal(options.maxRedirects,0);assert.equal(options.timeout,10000);
  assert.equal(typeof options.form.usuario,'string');assert.equal(typeof options.form.password,'string');
  for(const page of context.pages())assert.deepEqual(await page.locator('input[name="usuario"],input[name="password"]').evaluateAll(inputs=>inputs.map(input=>input.value)),['',''],'Credentials must remain absent from the page DOM');
  assert(handler,'A fully local response fixture must be installed');
  let result;
  const request={url:()=>url,method:()=> 'POST',postData:()=>new URLSearchParams(options.form).toString()};
  await handler({request:()=>request,fulfill:async value=>{result=value;},abort:async()=>{throw Error('Fixture aborted API request');}});
  assert(result,'API fixture must supply a response');
  return{status:()=>result.status||200,headers:()=>result.headers||{},dispose:async()=>{}};
 };
 return context;
};
