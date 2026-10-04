const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
const page=await browser.newPage();await page.setContent('<main id="page-balancecompra"></main>');await page.evaluate(()=>{
window.reads=[];window.currentRole='admin';window.currentUserUid='admin';window.permisoModulo=()=>true;window.imagenCatalogoHTML=()=>'';window.fbDB={};window.fbRef=(_,p)=>p;
const data={sv_usuarios:{a:{uid:'admin',nombre:'Administrador',rol:'admin'},y:{uid:'yago',nombre:'Yago Gil',rol:'distribuidora'}},'sisventas/productos':{},'sv_listas_paraguay/admin':{a:{nombre:'Lista del administrador',productos:{p:1}}},'sv_listas_paraguay/yago':{y:{nombre:'Lista de Yago',productos:{p:2}}}};
window.fbOnValue=(path,cb)=>{reads.push(path);cb({val:()=>data[path]});return()=>{}};
});await page.addScriptTag({path:'js/modules/exterior-user-lists.js'});await page.evaluate(()=>SVExteriorLists.mount());await page.locator('[data-group="yago"]').waitFor();assert.equal(await page.locator('[data-group]').count(),2);await page.locator('[data-group="yago"] summary').first().click();assert.equal(await page.getByText('Lista de Yago',{exact:true}).isVisible(),true);
assert.deepEqual(await page.evaluate(()=>reads.filter(p=>p.startsWith('sv_listas_paraguay/'))),['sv_listas_paraguay/admin','sv_listas_paraguay/yago']);
await page.getByRole('button',{name:'Ver por proveedor',exact:true}).click();assert.equal(await page.locator('[data-select-list]').count(),2);assert.match(await page.locator('.exterior-combined').innerText(),/3 unidades/);await page.locator('[data-select-list="yago:y"]').uncheck();assert.match(await page.locator('.exterior-combined').innerText(),/1 unidades/);await page.locator('[data-select-list="yago:y"]').check();
await page.evaluate(()=>{currentRole='distribuidora';reads=[];SVExteriorLists.mount()});assert.equal(await page.locator('#exterior-user-lists').count(),0);assert.equal(await page.evaluate(()=>reads.length),0);
console.log('OK: administrador ve listas propias y de Distribuidora; usuario no abre la vista global.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
