'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright'),helper=require('../tecnoprices-login');
const VIRTUAL='https://www.tecnoprices.com';
async function serve(handler){const server=http.createServer(handler);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return{origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};}
test('real BrowserContext APIRequest cookie jar over loopback only; URL translation double',async t=>{
 const browser=await chromium.launch({headless:true,...(process.env.SV_TEST_CHROMIUM?{executablePath:process.env.SV_TEST_CHROMIUM}:{})});
 try{for(const status of [200,302,303,307,308])await t.test('HTTP '+status+' cookie/redirect boundary',async()=>{
  const context=await browser.newContext({serviceWorkers:'block'}),sourceHits=[],trapHits=[];let source,trap;
  try{
   trap=await serve((req,res)=>{trapHits.push(req.method);req.resume();res.end('unexpected redirect target');});
   source=await serve(async(req,res)=>{
    sourceHits.push({method:req.method,path:req.url,cookie:req.headers.cookie||''});
    if(req.method==='POST'){
     let body='';for await(const chunk of req)body+=chunk;
     const form=new URLSearchParams(body);assert.equal(form.get('usuario'),'fixture-only');assert.equal(form.get('password'),'not-a-secret');assert.equal(form.get('csrf'),'fixture-csrf');
     res.setHeader('Set-Cookie','fixture_session=loopback-only; Path=/; HttpOnly; SameSite=Lax');
     if(status>=300)res.setHeader('Location',status>=307?trap.origin+'/must-not-receive-body':'/cuenta');
     res.statusCode=status;res.end('fictitious login response');return;
    }
    assert.equal(req.headers.cookie,'fixture_session=loopback-only','Real request cookie jar must send the POST Set-Cookie on the subsequent GET');
    res.end('<a href="/salir.php">Salir</a>');
   });
   const post=context.request.post.bind(context.request),get=context.request.get.bind(context.request),calls=[];
   const translate=url=>{const parsed=new URL(url);assert.equal(parsed.origin,VIRTUAL);return source.origin+parsed.pathname+parsed.search;};
   let virtualURL=VIRTUAL+'/ingresar',body='';
   // Only URL and DOM are doubled. The API response, status, headers, HTTP form
   // encoding, Set-Cookie processing, redirect limit and cookie jar are real.
   const page={url:()=>virtualURL,route:async()=>{},locator:selector=>{assert.equal(selector,'form');return{evaluateAll:async()=>[{csrf:'fixture-csrf'}]};},context:()=>({request:{post:async(url,options)=>{
    assert.equal(url,VIRTUAL+'/control.php');assert.equal(options.maxRedirects,0);assert.equal(options.timeout,10000);calls.push({method:'POST',path:new URL(url).pathname});
    return post(translate(url),options);
   }}}),goto:async(url,options)=>{
    assert.equal(options.waitUntil,'domcontentloaded');calls.push({method:'GET',path:new URL(url).pathname});
    const response=await get(translate(url),{maxRedirects:0,timeout:10000});try{assert.equal(response.status(),200);body=await response.text();virtualURL=url;}finally{await response.dispose();}
   },evaluate:async()=>({login:false,logout:body.includes('href="/salir.php"')})};
   if(status>=307){
    await assert.rejects(helper.login(page,'fixture-only','not-a-secret'),{code:'TECNOPRICES_SESSION_REQUIRED'});
    assert.deepEqual(calls,[{method:'POST',path:'/control.php'}]);assert.equal(sourceHits.length,1);
   }else{
    await helper.login(page,'fixture-only','not-a-secret');
    assert.deepEqual(calls,[{method:'POST',path:'/control.php'},{method:'GET',path:status===200?'/':'/cuenta'}]);
    assert.equal(sourceHits.length,2);assert.equal(sourceHits[1].cookie,'fixture_session=loopback-only');
   }
   assert.deepEqual(trapHits,[],'307/308 must never reach the second loopback origin');
   const cookies=await context.cookies(source.origin);assert.equal(cookies.find(cookie=>cookie.name==='fixture_session')?.value,'loopback-only');
  }finally{await context.close();if(source)await source.close();if(trap)await trap.close();}
 });}finally{await browser.close();}
});
