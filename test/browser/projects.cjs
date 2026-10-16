'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.SV_PLAYWRIGHT_MODULE||'playwright');
const base='http://127.0.0.1:18767';
async function main(){
 const browser=await chromium.launch({headless:true});let checks=0;fs.mkdirSync('tmp',{recursive:true});
 try{for(const viewport of [{width:1366,height:900},{width:390,height:844}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[],outgoing=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base){outgoing.push(url.origin);return route.abort();}if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html class="dark-mode sv-v3-preview"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/v3-preview.css"><link rel="stylesheet" href="/css/projects.css"></head><body class="dark-mode" style="padding:20px"><main id="page-proyectos" class="page active" style="display:block"></main><script>var currentRole="admin",currentUserUid="fixture",isAuthenticated=true;var permisoModulo=()=>true,notify=()=>{},svConfirm=async()=>true;</script><script src="/js/core/projects-model.js"></script><script src="/js/modules/projects.js"></script><script>SVProjects.open()</script></body></html>'});const file=path.resolve('.'+url.pathname);if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(file)});});
  await page.goto(base+'/?proyectos_preview=1');await page.getByRole('heading',{name:'Planificá el próximo trabajo'}).waitFor();assert.equal(await page.locator('.px-card').count(),3);checks++;
  const layout=await page.locator('.px-card').first().boundingBox(),searchBox=await page.locator('.px-search').boundingBox();assert.ok(layout.y>searchBox.y+searchBox.height,'Las tarjetas deben quedar debajo del buscador');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sin desborde horizontal');checks++;
  await page.screenshot({path:'tmp/proyectos-lista-'+viewport.width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Acceso inteligente · Edificio Aurora',exact:true}).click();await page.getByRole('heading',{name:'Acceso inteligente · Edificio Aurora',exact:true}).waitFor();checks++;
  await page.screenshot({path:'tmp/proyectos-resumen-'+viewport.width+'.png',fullPage:true});
  await page.getByRole('tab',{name:/Necesidades/}).click();await page.getByRole('button',{name:'Agregar necesidad'}).click();
  await page.getByRole('textbox',{name:'¿Qué hace falta?'}).fill('Sensor de puerta de prueba');await page.getByRole('textbox',{name:'Sector o etapa'}).fill('Acceso lateral');
  const field=page.getByRole('textbox',{name:'¿Qué hace falta?'});await field.focus();await page.setViewportSize({width:viewport.width,height:viewport.height-180});assert.equal(await field.evaluate(e=>e===document.activeElement),true);assert.equal(await field.inputValue(),'Sensor de puerta de prueba');checks++;
  await page.setViewportSize(viewport);await page.getByRole('button',{name:'Guardar necesidad',exact:true}).click();await page.getByText('Sensor de puerta de prueba',{exact:true}).waitFor();assert.ok((await page.locator('.px-need').allTextContents()).some(t=>t.includes('Sensor de puerta de prueba')&&t.includes('A definir')));checks++;
  await page.getByRole('tab',{name:/Integrantes/}).click();await page.getByRole('button',{name:'Gestionar integrantes'}).click();
  await page.locator('input[name=member][value="preview-mateo"]').uncheck();await page.getByRole('button',{name:'Guardar integrantes'}).click();assert.equal(await page.locator('.px-person').count(),2);checks++;
  await page.getByRole('tab',{name:/Presupuestos/}).click();await page.getByRole('button',{name:'Preparar',exact:true}).click();await page.getByRole('textbox',{name:'Nombre de la propuesta'}).fill('Borrador de prueba');await page.getByRole('button',{name:'Guardar borrador'}).click();await page.getByRole('heading',{name:'Borrador de prueba'}).waitFor();checks++;
  await page.getByRole('button',{name:'Vincular',exact:true}).click();await page.locator('input[type=radio][value="quote-a-alt"]').check();await page.getByRole('button',{name:'Vincular presupuesto',exact:true}).click();await page.getByRole('heading',{name:'Control de acceso · Alternativa básica',exact:true}).waitFor();checks++;
  await page.screenshot({path:'tmp/proyectos-presupuestos-'+viewport.width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Todos los proyectos'}).click();const search=page.getByRole('searchbox',{name:'Buscar proyectos'});await search.fill('aurora');assert.equal(await page.locator('.px-card').count(),1);assert.equal(await search.evaluate(e=>e===document.activeElement),true);checks++;
  await page.reload();await page.getByRole('button',{name:'Acceso inteligente · Edificio Aurora',exact:true}).click();await page.getByRole('tab',{name:/Necesidades/}).click();await page.getByText('Sensor de puerta de prueba',{exact:true}).waitFor();checks++;
  await page.getByRole('button',{name:'Todos los proyectos'}).click();await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();
  await page.getByRole('textbox',{name:'Nombre del proyecto',exact:true}).fill('Proyecto <seguro> de prueba');await page.getByLabel('Cliente',{exact:true}).selectOption('client-c');await page.getByRole('button',{name:'Crear proyecto',exact:true}).click();await page.getByRole('heading',{name:'Proyecto <seguro> de prueba',exact:true}).waitFor();assert.equal(await page.locator('.px-detail-hero script').count(),0);checks++;
  assert.deepEqual(outgoing,[]);assert.deepEqual(errors,[]);checks++;await context.close();
 }}finally{await browser.close();}
 console.log(JSON.stringify({passed:true,checks,scope:'Escritorio y móvil emulado; CRUD local de proyectos/necesidades/integrantes, borradores, vínculo y persistencia. Sin Firebase real.'},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
