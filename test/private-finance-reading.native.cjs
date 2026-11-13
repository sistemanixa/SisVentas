'use strict';
// Ejecutar contra scripts/dev-private-finance.cjs: servidor ficticio en loopback.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),pdf=require('./helpers/private-finance-pdf-fixture.cjs');
let server;before(async()=>{process.env.PRIVATE_FINANCE_TEST_PORT='8960';server=require('../scripts/dev-private-finance.cjs').server;if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));});after(()=>new Promise(resolve=>server.close(resolve)));
for(const width of [390,820,1440])test('corregir lectura pendiente en interfaz completa '+width,async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],requests=[];page.setDefaultTimeout(5000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();if(route.request().method()==='POST')requests.push(u.pathname);return route.continue();});
  await page.goto('http://127.0.0.1:8960/');
  await page.getByRole('button',{name:'Gastos personales',exact:true}).click();
  const f=page.frameLocator('iframe');
  if(width<701)await f.getByRole('button',{name:'Mostrar navegación',exact:true}).click();
  await f.getByRole('button',{name:'Importar resúmenes',exact:true}).click();
  await f.locator('#pdfInput').setInputFiles({name:'ficticio.pdf',mimeType:'application/pdf',buffer:pdf()});
  await f.getByRole('button',{name:'Revisar',exact:true}).waitFor();
  await f.getByRole('button',{name:'Revisar',exact:true}).click();
  const card=f.locator('select[name="resultCard"]');if(await card.count())await card.selectOption('card-a');
  await f.locator('summary').filter({hasText:'Corregir lectura'}).click();
  await f.getByRole('button',{name:'Corregir Compra ficticia',exact:true}).click();
  const d=f.getByRole('dialog');
  await d.getByLabel('Importe con signo',{exact:true}).fill('-2,13');
  await d.locator('select[name="currency"]').selectOption('USD');
  await d.getByRole('button',{name:'Aplicar a la lectura',exact:true}).click();
  assert.equal(await f.getByRole('button',{name:'Guardar resumen',exact:true}).isEnabled(),false);
  await f.locator('summary').filter({hasText:'Corregir lectura'}).click();
  await f.getByRole('button',{name:'Corregir Compra ficticia',exact:true}).click();
  assert.equal(await d.getByLabel('Importe con signo',{exact:true}).inputValue(),'-2.13');
  await d.getByLabel('Importe con signo',{exact:true}).fill('250.00');
  await d.locator('select[name="currency"]').selectOption('ARS');
  await d.getByRole('button',{name:'Cerrar',exact:true}).first().click();
  assert.equal(await f.getByRole('button',{name:'Guardar resumen',exact:true}).isEnabled(),false);
  await f.getByRole('button',{name:'Corregir Compra ficticia',exact:true}).click();
  await d.getByLabel('Importe con signo',{exact:true}).fill('250.00');
  await d.locator('select[name="currency"]').selectOption('ARS');
  const out=path.resolve('tmp/private-finance-reader-qa');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'review-'+width+'.png')});
  await d.getByRole('button',{name:'Aplicar a la lectura',exact:true}).click();
  assert.equal(await f.getByRole('button',{name:'Guardar resumen',exact:true}).isEnabled(),true,await f.locator('#app').innerText());
  await f.getByRole('button',{name:'Volver',exact:true}).click();
  await f.getByRole('button',{name:'Abrir',exact:true}).click();
  assert.equal(await f.getByRole('button',{name:'Guardar resumen',exact:true}).isEnabled(),true);
  assert.deepEqual(requests,['/statement-import']);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
