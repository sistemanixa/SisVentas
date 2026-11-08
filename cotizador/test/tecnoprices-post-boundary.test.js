'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),helper=require('../tecnoprices-login');
const ORIGIN='https://www.tecnoprices.com';
const form=hidden=>`<form method="post" action="/control.php"><input name="usuario"><input name="password" type="password">${hidden||''}<button type="submit">Entrar</button></form>`;
test('API POST boundary uses explicit zero-redirect transport and local browser fixtures',async t=>{
 const browser=await chromium.launch({headless:true,...(process.env.SV_TEST_CHROMIUM?{executablePath:process.env.SV_TEST_CHROMIUM}:{})});
 async function fixture({status=200,location,hidden='',duringPost}={}){
  const context=await browser.newContext({serviceWorkers:'block'}),seen=[],calls=[];let disposed=0;
  await context.route('**/*',route=>{const req=route.request();seen.push(new URL(req.url()).pathname);assert.equal(new URL(req.url()).origin,ORIGIN,'No request may escape the browser guard');return route.fulfill({contentType:'text/html',body:new URL(req.url()).pathname==='/ingresar'?form(hidden):'<a href="/salir.php">Salir</a>'});});
  const page=await context.newPage();await page.goto(ORIGIN+'/ingresar');
  // Explicit APIRequestContext double: no underlying post/fetch/request call.
  context.request.post=async(url,options)=>{
   calls.push({url,options});assert.equal(url,ORIGIN+'/control.php');assert.equal(options.maxRedirects,0);assert.equal(options.timeout,10000);
   assert.equal(options.form.usuario,'fiction-user');assert.equal(options.form.password,'fiction-password');
   assert.deepEqual(await page.locator('input[name="usuario"],input[name="password"]').evaluateAll(inputs=>inputs.map(i=>i.value)),['','']);
   if(duringPost)await duringPost({context,page});
   return{status:()=>status,headers:()=>location?{location}:{},dispose:async()=>{disposed++;}};
  };
  return{context,page,calls,seen,disposed:()=>disposed};
 }
 try{
  for(const status of [307,308])for(const location of ['https://foreign.invalid/collect',ORIGIN+'/other'])await t.test(status+' never replays POST to '+location,async()=>{
   const f=await fixture({status,location});try{await assert.rejects(helper.login(f.page,'fiction-user','fiction-password'),{code:'TECNOPRICES_SESSION_REQUIRED'});assert.equal(f.calls.length,1);assert.deepEqual(f.seen,['/ingresar']);assert.equal(f.disposed(),1);}finally{await f.context.close();}
  });
  for(const location of ['https://foreign.invalid/cuenta','//foreign.invalid/cuenta'])await t.test('302 foreign target rejected without browser navigation '+location,async()=>{
   const f=await fixture({status:302,location});try{await assert.rejects(helper.login(f.page,'fiction-user','fiction-password'),{code:'TECNOPRICES_SESSION_REQUIRED'});assert.equal(f.calls.length,1);assert.deepEqual(f.seen,['/ingresar']);assert.equal(f.disposed(),1);}finally{await f.context.close();}
  });
  await t.test('302 same-origin uses GET and the existing context cookie jar',async()=>{
   const f=await fixture({status:302,location:'/cuenta',hidden:'<input type="hidden" name="csrf_token" value="fiction-csrf">',duringPost:async({context})=>context.addCookies([{name:'fixture_session',value:'fiction-cookie',url:ORIGIN}])});
   try{await helper.login(f.page,'fiction-user','fiction-password');assert.deepEqual(f.seen,['/ingresar','/cuenta']);assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.form.csrf_token,'fiction-csrf');assert.equal((await f.context.cookies(ORIGIN)).find(c=>c.name==='fixture_session').value,'fiction-cookie');assert.equal(f.disposed(),1);}finally{await f.context.close();}
  });
  for(const hidden of ['<input type="hidden" name="csrf" value="one"><input type="hidden" name="csrf" value="two">','<input type="hidden" name="password" value="shadow">','<input type="hidden" name="constructor" value="bad">'])await t.test('ambiguous or reserved hidden fields refuse before POST '+hidden,async()=>{
   const f=await fixture({hidden});try{await assert.rejects(helper.login(f.page,'fiction-user','fiction-password'),{code:'TECNOPRICES_SESSION_REQUIRED'});assert.equal(f.calls.length,0);}finally{await f.context.close();}
  });
  await t.test('page fetch and image attempts during authentication are aborted before lower fixtures',async()=>{
   let failed=0;
   const f=await fixture({duringPost:async({page})=>{
    page.on('requestfailed',request=>{if(new URL(request.url()).origin!==ORIGIN)failed++;});
    await page.evaluate(async()=>{await Promise.all([fetch('https://foreign.invalid/collect?data=fiction').catch(()=>{}),new Promise(resolve=>{const image=new Image();image.onload=image.onerror=resolve;image.src='https://foreign.invalid/pixel?data=fiction';})]);});
   }});
   try{await helper.login(f.page,'fiction-user','fiction-password');assert.equal(failed,2);assert.deepEqual(f.seen,['/ingresar','/']);}finally{await f.context.close();}
  });
  for(const status of [302,401,403,500])await t.test('HTTP '+status+' without Location refuses and disposes response',async()=>{
   const f=await fixture({status});try{await assert.rejects(helper.login(f.page,'fiction-user','fiction-password'),{code:'TECNOPRICES_SESSION_REQUIRED'});assert.equal(f.disposed(),1);assert.deepEqual(f.seen,['/ingresar']);}finally{await f.context.close();}
  });
 }finally{await browser.close();}
});
