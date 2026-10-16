'use strict';
const fs=require('fs'),assert=require('assert/strict'),{chromium}=require(process.env.SV_PLAYWRIGHT_MODULE||'playwright'),source=require('../helpers/active-app').readActiveApp().source;
const extract=name=>{const start=source.indexOf('function '+name+'(');return (source.slice(start-6,start)==='async '?'async ':'')+source.slice(start,source.indexOf('\n}',start)+2);};
async function main(){const browser=await chromium.launch({headless:true});let checks=0;try{
 for(const role of ['admin','administrativo','vendedor','tecnico','tecnico_vendedor','distribuidora','compras_paraguay'])for(const width of [1366,390]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[],paths=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const u=new URL(r.request().url());assert.equal(u.origin,'http://127.0.0.1:18769');paths.push(u.pathname);
   const own={fbKey:'own',uid:'actor',rol:role,nombre:'Persona ficticia',activo:true,mail:'own@example.test',empleadoFbKey:'employee-own'},other={fbKey:'other',uid:'other',rol:'tecnico',nombre:'Otra persona',activo:true,empleadoFbKey:'employee-other'};
   if(u.pathname==='/usuarios/perfil')return r.fulfill({json:{ok:true,profile:own}});
   if(u.pathname==='/usuarios/directorio')return r.fulfill({json:{ok:true,users:[{...own,mail:undefined},other]}});
   if(u.pathname==='/usuarios/administracion')return r.fulfill({json:{ok:true,users:[own,{...other,mail:'other@example.test'}]}});
   if(u.pathname==='/')return r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><h1 id="status">Verificando</h1><div id="error"></div><ul id="users"></ul><script>
    var currentRole='',currentUserUid='',currentUserEmail='',SV_USER_DIRECTORY_V2=true,SV_SECURITY_STORAGE_V2=true,fbDB={},SISVENTAS_FUNCTIONS={cotizadorProveedor:location.origin};
    var actor={uid:'actor',email:'own@example.test',getIdToken:async()=> 'FAKE_TOKEN'},fbAuth={currentUser:actor},readPaths=[],roleCallbacks=[];
    var fbQuery=(r,...f)=>({ref:r}),fbOrderByChild=x=>x,fbEqualTo=x=>x,fbRef=(_,p)=>p,fbGet=async p=>{readPaths.push(p);if(p==='sv_chat_roles/actor')return {val:()=>({rol:${JSON.stringify(role)},activo:true})};throw Error('Lectura no permitida: '+p);};
    var fbOnValue=(p,cb)=>{readPaths.push(p);if(p==='sv_chat_roles/actor')roleCallbacks.push(cb);return()=>{};},fbUpdate=async()=>{},permisoModulo=()=>true,notify=t=>document.getElementById('error').textContent=t;
    function renderTablaUsuarios(){document.getElementById('users').innerHTML=usuariosData.map(u=>'<li data-uid="'+u.uid+'" data-email="'+(u.mail||'')+'">'+u.nombre+'</li>').join('');}
    function renderHistorialComunicados(){}function svActualizarCuentaTrasDatos(){document.body.dataset.employee=(usuariosData.find(u=>u.uid===currentUserUid)||{}).empleadoFbKey||'';}
    function _completarLogin(){document.getElementById('status').textContent=currentRole;if(['distribuidora','compras_paraguay'].includes(currentRole)){renderTablaUsuarios();svActualizarCuentaTrasDatos();}else fbCargarUsuarios();document.dispatchEvent(new CustomEvent('sisventas:session-ready'));}
    function _cancelarAutenticacionParcial(m){document.getElementById('error').textContent=m;document.getElementById('users').replaceChildren();document.getElementById('status').textContent='Acceso cerrado';}
   </script><script>${fs.readFileSync('js/core/data-readiness.js','utf8')}</script><script>${fs.readFileSync('js/core/user-directory.js','utf8')}</script><script>${fs.readFileSync('js/modules/security-storage.js','utf8')}</script><script>${extract('fbCargarUsuarios')}\n${extract('_resolverRolYCompletarLogin')}\n_resolverRolYCompletarLogin(actor);</script>`});
   return r.fulfill({status:404,body:''});
  });
  await page.goto('http://127.0.0.1:18769/');await page.getByRole('heading',{name:role,exact:true}).waitFor();await page.locator('#users li').first().waitFor();checks++;
  assert.equal(await page.locator('body').getAttribute('data-employee'),'employee-own');if(['distribuidora','compras_paraguay'].includes(role))assert.equal(await page.locator('#users li[data-uid=other]').count(),0);else assert.equal(await page.locator('#users li[data-uid=other]').getAttribute('data-email'),role==='admin'?'other@example.test':'');assert.equal(await page.evaluate(()=>readPaths.some(p=>p==='sv_usuarios')),false);checks++;
  assert.equal(paths.includes('/usuarios/perfil'),true);assert.equal(paths.includes(role==='admin'?'/usuarios/administracion':'/usuarios/directorio'),!['distribuidora','compras_paraguay'].includes(role));assert.deepEqual(errors,[]);checks++;
  if(!['distribuidora','compras_paraguay'].includes(role)){assert.equal(await page.evaluate(()=>SVDataReadiness.status(['usuarios']).ready),true);checks++;}
  await page.evaluate(()=>roleCallbacks.forEach(cb=>cb({val:()=>({rol:'tecnico',activo:false})})));await page.getByRole('heading',{name:'Acceso cerrado'}).waitFor();assert.equal(await page.locator('#users li').count(),0);checks++;
  await page.close();
 }
}finally{await browser.close();}console.log(JSON.stringify({checks,passed:true,scope:'7 roles, escritorio/móvil emulado; perfil propio, directorio mínimo, administración, vínculo y revocación. Solo fixtures, sin red real.'},null,2));}
main().catch(e=>{console.error(e);process.exitCode=1;});
