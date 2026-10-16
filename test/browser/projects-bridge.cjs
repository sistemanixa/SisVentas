'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),M=require('../../js/core/projects-model');
const {chromium}=require(process.env.SV_PLAYWRIGHT_MODULE||'playwright');
const base='http://127.0.0.1:18768',actor={uid:'owner',name:'Responsable ficticio',role:'admin',enabled:true,createAllowed:true,editAllowed:true,quoteAllowed:true};
let p=M.apply(null,{type:'create',data:{name:'Proyecto ficticio',clientId:'cliente',clientName:'Cliente ficticio'}},actor,{id:'project',now:1,directory:[{uid:'owner',name:actor.name}]});
p=M.apply(p,{type:'need-save',revision:p.revision,data:{title:'Instalación',kind:'mano',qty:4,unit:'horas',status:'definido'}},actor,{id:'need',now:2});
p=M.apply(p,{type:'budget-brief',revision:p.revision,data:{title:'Alcance ficticio',needIds:['need']}},actor,{id:'brief',now:3});
async function main(){
 const browser=await chromium.launch({headless:true}),page=await browser.newPage();const posts=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,base,'La prueba no puede usar servicios reales');
   if(u.pathname==='/proyectos')return route.fulfill({json:{ok:true,canCreate:true,projects:[M.project(p,actor)]}});
   if(u.pathname==='/proyectos/guardar'){posts.push(route.request().postDataJSON());return route.fulfill({json:{ok:true,project:M.project(p,actor)}});}
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="UTF-8"><main id="page-proyectos"></main><section id="ppto-form-view"><input id="pp-cli"><input id="pp-cli-id"><input id="pp-titulo-solucion"><table><tbody id="pp-body"></tbody></table></section><div id="notice"></div><script>
    var currentRole='admin',currentUserUid='owner',permisoModulo=()=>true,tienePermiso=()=>true,svConfirm=async()=>true;
    var fbAuth={currentUser:{uid:'owner',getIdToken:async()=> 'FAKE_TOKEN'}},SISVENTAS_FUNCTIONS={cotizadorProveedor:location.origin};
    var notify=t=>document.getElementById('notice').textContent=t,showPage=()=>{},getPpItems=()=>[];
    var abrirNuevoPresupuesto=()=>SVProjects.resetBudgetContext(),calcRow=()=>{},calcPpTotales=()=>{},_pptoAsegurarFilaVacia=()=>{};
    var crearFilaProducto=(code,title,price,qty)=>{var row=document.createElement('tr');row.innerHTML='<td>'+title+'</td><td><input class="qty" value="'+qty+'"><input class="price" value="'+price+'"><input class="disc" value="0"></td>';return row;};
   </script><script src="/js/core/projects-model.js"></script><script src="/js/modules/projects.js"></script><script>SVProjects.open()</script>`});
   const file=path.resolve('.'+u.pathname);assert.ok(file.startsWith(process.cwd()+path.sep));return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(file)});
  });
  await page.goto(base);await page.getByRole('button',{name:p.name,exact:true}).click();await page.getByRole('tab',{name:/Presupuestos/}).click();await page.getByRole('button',{name:'Ver',exact:true}).click();await page.getByRole('button',{name:'Armar en Presupuestos'}).click();
  assert.equal(await page.locator('#pp-cli-id').inputValue(),'cliente');assert.equal(await page.locator('#pp-cli').inputValue(),'Cliente ficticio');assert.equal(await page.locator('#pp-titulo-solucion').inputValue(),'Alcance ficticio');assert.equal(await page.locator('.qty').inputValue(),'4');assert.equal(await page.locator('.price').inputValue(),'0');
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('sisventas:budget-saved',{detail:{key:'wrong',context:'wrong'}})));assert.equal(posts.length,0);
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('sisventas:budget-saved',{detail:{key:'persisted-key',context:document.getElementById('ppto-form-view').dataset.projectBrief}})));await page.getByText('Presupuesto vinculado al proyecto.',{exact:true}).waitFor();assert.equal(posts.length,1);assert.equal(posts[0].data.sourceId,'persisted-key');assert.equal(posts[0].data.briefId,'brief');assert.equal(posts[0].projectId,'project');
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('sisventas:budget-saved',{detail:{key:'duplicate',context:document.getElementById('ppto-form-view').dataset.projectBrief}})));assert.equal(posts.length,1);
  assert.deepEqual(errors,[]);console.log('Puente Proyectos → Presupuestos: cliente, alcance, cantidad, precio pendiente, nonce, vínculo único y sin red real: OK.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
