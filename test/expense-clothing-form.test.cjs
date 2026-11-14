'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{start}=require('./helpers/employee-resources-full-app-fixture.cjs');
async function boot(t,width){
 const local=await start({role:'admin',financial:true});t.after(()=>local.close());
 const browser=await chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width,height:950}});page.setDefaultTimeout(15000);
 await page.route('**/*',r=>r.request().url().startsWith(local.url)?r.continue():r.abort());
 await page.goto(local.url);await page.waitForFunction(()=>window.fixtureBootReady);await page.evaluate(()=>showPage('gastos'));await page.locator('.gas-action-new').click();
 await page.locator('#g-categoria').selectOption('Indumentaria');await page.getByRole('region',{name:'Prendas de la compra'}).waitFor();return {local,page};
}
for(const width of [390,768,1280])test('expense garment form saves one purchase and makes stock deliverable at '+width,{timeout:60000},async t=>{
 const {local,page}=await boot(t,width);const form=page.getByRole('region',{name:'Prendas de la compra'});
 await page.locator('#g-descripcion').fill('Ropa nueva ficticia');await page.locator('#g-monto').fill('50.000,25');await page.locator('#g-monto').blur();
 await form.getByLabel('Prenda',{exact:true}).fill('Campera ficticia');await form.getByLabel('Talle',{exact:true}).fill('L');await form.getByLabel('Color',{exact:true}).fill('Azul');await form.getByLabel('Cantidad',{exact:true}).fill('2');
 await form.getByRole('button',{name:'Agregar prenda'}).click();const last=page.locator('.expense-clothing-row').last();await last.getByLabel('Prenda',{exact:true}).fill('Remera ficticia');await last.getByLabel('Talle',{exact:true}).fill('M');await last.getByLabel('Cantidad',{exact:true}).fill('3');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const folder=path.resolve(__dirname,'../tmp/expense-clothing');fs.mkdirSync(folder,{recursive:true});await page.screenshot({path:path.join(folder,'form-'+width+'.png'),fullPage:true});
 local.control.saveDelay=600;await page.getByRole('button',{name:'Guardar gasto',exact:true}).click();await page.getByText('Guardando gasto…',{exact:true}).waitFor();await page.waitForFunction(()=>!window._gastoCompletoGuardando);
 assert.equal(local.calls.filter(c=>c.path==='/laboral/gastos/crear-administrativo').length,1);
 const saved=Object.values(local.business.gastos).filter(g=>g.descripcion==='Ropa nueva ficticia');assert.equal(saved.length,1);assert.equal(saved[0].monto,50000.25);assert.equal(saved[0].indumentaria.items.length,2);
 await page.evaluate(()=>showPage('empleados'));await page.locator('#emp-tbody [data-employee-clothing="employee"]').click();await page.getByRole('searchbox',{name:'Buscar prenda o talle'}).fill('Campera ficticia');await page.getByText('2 disponibles',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Entregar',exact:true}).click();await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('1 disponibles',{exact:true}).waitFor();assert.equal(Object.values(local.business.gastos).filter(g=>g.descripcion==='Ropa nueva ficticia').length,1);
 assert.deepEqual(await page.evaluate(()=>__moduleAudit.errors),[]);
});
test('invalid clothing stays in the draft without any expense POST',{timeout:60000},async t=>{
 const {local,page}=await boot(t,1280);await page.locator('#g-descripcion').fill('Borrador ficticio');await page.locator('#g-monto').fill('100');await page.locator('#g-monto').blur();
 await page.getByRole('button',{name:'Guardar gasto',exact:true}).click();await page.getByText('Revisá la prenda.',{exact:true}).waitFor();assert.equal(local.calls.filter(c=>c.domain==='financial').length,0);assert.equal(await page.locator('#g-descripcion').inputValue(),'Borrador ficticio');
 await page.locator('#g-categoria').selectOption('Servicios');assert.equal(await page.getByRole('region',{name:'Prendas de la compra'}).isVisible(),false);
});
