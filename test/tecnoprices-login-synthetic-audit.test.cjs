'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),Login=require('../cotizador/tecnoprices-login');
const origin='https://www.tecnoprices.com';
function fixture({action='/control.php',status=200,location='/',hidden=[],forms=1,login=false,logout=true,postError=false}={}){
 const posts=[],visits=[],routes=[];let current=origin+'/ingresar';
 const form={method:'post',ownerDocument:{baseURI:origin+'/ingresar'},getAttribute:name=>name==='action'?action:null};
 const user={form},password={form},submit={form,hasAttribute:()=>false};
 form.querySelectorAll=selector=>selector.startsWith('button')?[submit]:selector==='input[name="usuario"]'?[user]:selector.startsWith('input[name="password"]')?[password]:hidden.map(([name,value])=>({name,value,form,disabled:false}));
 const document={baseURI:origin+'/',querySelector:()=>login?{}:null,querySelectorAll:()=>logout?[{getAttribute:()=>'/salir.php',textContent:'Salir'}]:[]};
 const page={url:()=>current,route:async(pattern,handler)=>{assert.equal(pattern,'**/*');routes.push(handler);},locator:selector=>{assert.equal(selector,'form');return{evaluateAll:async fn=>fn(Array.from({length:forms},()=>form))};},context:()=>({request:{post:async(url,options)=>{posts.push({url,options});if(postError)throw Error('PRIVATE_PASSWORD_DIAGNOSTIC');return{status:()=>status,headers:()=>({location}),dispose:async()=>{}};}}}),goto:async url=>{visits.push(url);current=url;},evaluate:async fn=>vm.runInNewContext('('+fn.toString()+')()',{document,URL})};
 return {page,posts,visits,routes};
}
for(const action of ['/control.php','./control.php','https://WWW.TECNOPRICES.COM:443/control.php'])test('real login validates form and performs one API POST with hidden CSRF: '+action,async()=>{
 const f=fixture({action,hidden:[['csrf','fictional-csrf']]});await Login.login(f.page,'fictional-user','fictional-password');assert.equal(f.posts.length,1);assert.equal(f.posts[0].url,origin+'/control.php');assert.deepEqual(f.posts[0].options.form,{csrf:'fictional-csrf',usuario:'fictional-user',password:'fictional-password'});assert.equal(f.posts[0].options.maxRedirects,0);assert.equal(f.visits.length,1);
});
for(const options of [{action:'https://foreign.invalid/control.php'},{action:'/control.php?other=1'},{action:'/other/control.php'},{forms:2},{hidden:[['password','forged']]},{hidden:[['csrf','one'],['csrf','two']]}])test('invalid form rejects without a credential POST '+JSON.stringify(options),async()=>{const f=fixture(options);await assert.rejects(Login.login(f.page,'fictional-user','fictional-password'),{code:'TECNOPRICES_SESSION_REQUIRED'});assert.equal(f.posts.length,0);assert.equal(f.visits.length,0);});
for(const options of [{status:307},{status:308},{status:302,location:'https://foreign.invalid/escape'},{status:401},{login:true},{logout:false},{postError:true}])test('redirect/session failure never retries or exposes diagnostic '+JSON.stringify(options),async()=>{const f=fixture(options);await assert.rejects(Login.login(f.page,'fictional-user','fictional-password'),error=>error.code==='TECNOPRICES_SESSION_REQUIRED'&&!/PRIVATE_|fictional-password/.test(error.message));assert.equal(f.posts.length,1);if([307,308,401].includes(options.status)||options.location||options.postError)assert.equal(f.visits.length,0);});
test('browser guard allows only same-origin GET/HEAD and is installed once',async()=>{
 const f=fixture();await Login.login(f.page,'fictional-user','fictional-password');await Login.login(f.page,'fictional-user','fictional-password');assert.equal(f.routes.length,1);
 for(const [url,method,blocked]of [[origin+'/product','GET',false],[origin+'/product','HEAD',false],[origin+'/control.php','POST',true],['https://foreign.invalid/x','GET',true]]){let aborted=0,fallback=0;await f.routes[0]({request:()=>({url:()=>url,method:()=>method}),abort:()=>aborted++,fallback:()=>fallback++});assert.equal(aborted,blocked?1:0);assert.equal(fallback,blocked?0:1);}
});
test('synthetic API facade cannot fall through to an actual API or browser POST',async()=>{
 const apiFixture=require('../cotizador/test/tecnoprices-api-fixture');let network=0;
 const context={request:{post:async()=>{network++;throw Error('Real network must never run');}},route:async()=>{},newPage:async()=>({context:()=>context})},wrapped=apiFixture(context),page=await wrapped.newPage();
 assert.equal(page.context(),wrapped);
 await assert.rejects(wrapped.request.post(origin+'/control.php',{form:{},maxRedirects:0}),/fallback forbidden/);
 await wrapped.route('**/*',async route=>{assert.equal(route.request().method(),'POST');await route.fulfill({status:302,headers:{location:'/'}});});
 assert.equal((await page.context().request.post(origin+'/control.php',{form:{usuario:'fictional'},maxRedirects:0})).status(),302);
 await assert.rejects(wrapped.request.post('https://foreign.invalid/',{maxRedirects:0}));await assert.rejects(wrapped.request.post(origin+'/control.php',{maxRedirects:1}));assert.equal(network,0);
});
