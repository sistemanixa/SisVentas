'use strict';
const ORIGIN='https://www.tecnoprices.com';
const fail=()=>Object.assign(new Error('No se pudo validar la sesión de Tecnoprices. Revisá el acceso del proveedor.'),{code:'TECNOPRICES_SESSION_REQUIRED'});
function assertOrigin(url){const parsed=new URL(url);if(parsed.origin!==ORIGIN||parsed.username||parsed.password)throw fail();return parsed;}
const guarded=new WeakSet();
async function guardBrowser(page){
 if(guarded.has(page))return;
 await page.route('**/*',async route=>{
  try{assertOrigin(route.request().url());if(!['GET','HEAD'].includes(route.request().method()))return route.abort();}catch{return route.abort();}
  return route.fallback();
 });
 guarded.add(page);
}
async function login(page,usuario,password){
 try{
  assertOrigin(page.url());
  await guardBrowser(page);
  const candidates=await page.locator('form').evaluateAll(forms=>forms.flatMap(form=>{
   let action;try{action=new URL(form.getAttribute('action')||'',form.ownerDocument.baseURI);}catch{return [];}
   const submits=form.querySelectorAll('button[type="submit"],input[type="submit"]');
   const valid=action.origin==='https://www.tecnoprices.com'&&action.pathname==='/control.php'&&!action.search&&!action.hash&&!action.username&&!action.password&&form.method.toLowerCase()==='post'&&submits.length===1&&!submits[0].hasAttribute('formaction')&&!submits[0].hasAttribute('formmethod');
   const users=form.querySelectorAll('input[name="usuario"]'),passwords=form.querySelectorAll('input[name="password"][type="password"]');
   if(!(valid&&users.length===1&&passwords.length===1&&users[0].form===form&&passwords[0].form===form&&submits[0].form===form))return [];
   const hidden=Array.from(form.querySelectorAll('input[type="hidden"][name]')).filter(input=>!input.disabled);
   const names=new Set();for(const input of hidden){if(input.form!==form||! /^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(input.name)||['usuario','password','__proto__','constructor','prototype'].includes(input.name)||names.has(input.name))return [];names.add(input.name);}
   return [Object.fromEntries(hidden.map(input=>[input.name,input.value]))];
  }));
  if(candidates.length!==1)throw fail();
  // BrowserContext.request shares its cookie jar, but never exposes the secret
  // to page scripts. No redirect may replay this POST (including 307/308).
  const response=await page.context().request.post(ORIGIN+'/control.php',{
   form:{...candidates[0],usuario,password},maxRedirects:0,timeout:10000
  });
  let destination=ORIGIN+'/';
  try{
   const status=response.status();
   if([301,302,303].includes(status)){
    const location=response.headers().location;if(typeof location!=='string'||!location.trim())throw fail();
    destination=assertOrigin(new URL(location,ORIGIN+'/control.php').href).href;
   }
   else if(status<200||status>=300)throw fail();
  }finally{await response.dispose();}
  await page.goto(destination,{waitUntil:'domcontentloaded',timeout:10000});
  await assertSession(page);
 }catch{throw fail();}
}
async function assertSession(page){
 try{
  const url=assertOrigin(page.url());
  if(/^\/ingresar(?:\/|$)/i.test(url.pathname))throw fail();
  const state=await page.evaluate(()=>({
   login:!!document.querySelector('form input[type="password"]'),
   logout:Array.from(document.querySelectorAll('a[href]')).some(link=>{
    try{const url=new URL(link.getAttribute('href'),document.baseURI);return url.origin==='https://www.tecnoprices.com'&&!url.username&&!url.password&&(/^\/(?:salir|logout|cerrar[-_]sesion)(?:\.php|\/|$)/i.test(url.pathname)||/^(?:salir|cerrar sesi[oó]n|logout)$/i.test(link.textContent.trim()));}catch{return false;}
   })
  }));
  if(state.login||!state.logout)throw fail();
 }catch{throw fail();}
}
module.exports={login,assertSession};
