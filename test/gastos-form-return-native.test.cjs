'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {functionSource}=require('./helpers/app-functions.cjs');
const root=path.resolve(__dirname,'..');

async function fixture(t,width){
  const browser=await chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROME||process.env.SV_TEST_CHROMIUM||process.env.CHROME_BIN||undefined});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width,height:850}});
  let requests=0;
  await page.route('**/*',route=>{requests++;return route.abort();});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fs.readFileSync(path.join(root,'css/app.css'),'utf8')+'</style><style>.content{height:700px;overflow:auto}#page-gastos{padding:12px}.fixture-spacer{height:950px}</style><main class="content"><section class="page active" id="page-gastos"><div id="gasto-list" class="card"><input id="gas-buscar" value="filtro conservado"><select id="gas-f-categoria"><option selected>Servicios</option></select><div class="table-wrap"><table id="gas-tbl"><thead><tr><th>Fecha</th><th>Descripción</th><th>Monto</th></tr></thead><tbody><tr class="gas-row"><td>01/11/2026</td><td>Servicio ficticio</td><td>100,25</td></tr></tbody></table></div></div><div id="gasto-form" style="display:none"><input id="g-descripcion" value="Edición ficticia"><button type="button" id="back">Volver</button></div><div class="fixture-spacer"></div></section></main>');
  await page.addScriptTag({content:'window.trace={reads:0,writes:0,renders:0};window.fbGet=()=>{trace.reads++;throw Error("No real reads");};window.fbSet=window.fbUpdate=window.fbPush=()=>{trace.writes++;throw Error("No writes");};window.renderTablaGastos=()=>{trace.renders++;};'+functionSource('cerrarFormGasto')});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'js/modules/resizable-tables.js'),'utf8')});
  await page.waitForFunction(()=>document.getElementById('gas-tbl').dataset.svResizableReady==='1');
  return {page,errors,requests:()=>requests};
}

for(const width of [390,768,1280])test('return from expense form restores deferred real table without reading or replacing rows at '+width,async t=>{
  const f=await fixture(t,width),p=f.page;
  for(const update of ['snapshot','error','snapshot']){
    await p.evaluate(update=>{
      document.getElementById('gasto-list').style.display='none';
      document.getElementById('gasto-form').style.display='';
      document.getElementById('back').focus();
      const tbody=document.querySelector('#gas-tbl tbody');
      if(update==='snapshot')tbody.innerHTML='<tr class="gas-row"><td>02/11/2026</td><td>Servicio ficticio actualizado</td><td>200,50</td></tr>';
      else tbody.innerHTML='<tr class="gas-empty-row"><td colspan="3" role="status">No se pudo actualizar. Se conserva el estado de prueba.</td></tr>';
      window.savedRow=tbody.firstElementChild;
    },update);
    await p.waitForFunction(()=>document.getElementById('gas-tbl').classList.contains('sv-columns-pending'));
    assert.equal(await p.locator('#gas-tbl').evaluate(table=>getComputedStyle(table).visibility),'hidden');
    const before=await p.evaluate(()=>({scroll:document.querySelector('.content').scrollTop,filter:document.getElementById('gas-buscar').value,category:document.getElementById('gas-f-categoria').value}));
    await p.evaluate(()=>cerrarFormGasto());
    assert.equal(await p.locator('#gas-tbl').evaluate(table=>getComputedStyle(table).visibility),'visible');
    assert.equal(await p.locator('#gas-tbl').evaluate(table=>table.classList.contains('sv-columns-pending')),false);
    assert.equal(await p.evaluate(()=>document.querySelector('#gas-tbl tbody').firstElementChild===savedRow),true);
    assert.deepEqual(await p.evaluate(()=>({scroll:document.querySelector('.content').scrollTop,filter:document.getElementById('gas-buscar').value,category:document.getElementById('gas-f-categoria').value})),before);
    assert.equal(await p.locator('#gasto-form').isVisible(),false);
    assert.equal(await p.locator('#gasto-list').isVisible(),true);
    // Closing does not steal focus from a visible control when invoked again.
    await p.locator('#gas-buscar').focus();await p.evaluate(()=>cerrarFormGasto());
    assert.equal(await p.evaluate(()=>document.activeElement.id),'gas-buscar');
  }
  assert.deepEqual(await p.evaluate(()=>trace),{reads:0,writes:0,renders:0});
  assert.equal(f.requests(),0);assert.deepEqual(f.errors,[]);
});

test('legacy display-only return leaves the real deferred table invisible',async t=>{
  const {page:p}=await fixture(t,1280);
  await p.evaluate(()=>{document.getElementById('gasto-list').style.display='none';document.querySelector('#gas-tbl tbody').appendChild(document.createElement('tr'));});
  await p.waitForFunction(()=>document.getElementById('gas-tbl').classList.contains('sv-columns-pending'));
  await p.evaluate(()=>{document.getElementById('gasto-form').style.display='none';document.getElementById('gasto-list').style.display='';});
  assert.equal(await p.locator('#gas-tbl').evaluate(table=>getComputedStyle(table).visibility),'hidden');
  await p.evaluate(()=>cerrarFormGasto());
  assert.equal(await p.locator('#gas-tbl').evaluate(table=>getComputedStyle(table).visibility),'visible');
});
