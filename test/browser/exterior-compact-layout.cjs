'use strict';
// Isolated visual verification; no authentication or external business data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
 const report=[];
 try{
  for(const width of [320,390,768,950,1280])for(const stockOnly of [true,false]){
   const variants=process.env.COMPACT_BASELINE?['before','after']:['after'];const sizes={};
   for(const variant of variants){
    const page=await browser.newPage({viewport:{width,height:900}});let requests=0;const errors=[];
    await page.route('**/*',r=>{requests++;return r.abort();});page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<!doctype html><html class="dark-mode"><body><button id="origin">Abrir</button></body>');
    await page.addStyleTag({path:path.join(root,'css/app.css')});
    await page.evaluate(()=>Object.assign(window,{permisoModulo:()=>true,currentUserUid:'fixture',currentUser:'Fixture',notify:()=>{},fbGet:async()=>({val:()=>({})}),fbRef:()=>'',obtenerDolarReferenciaProducto:()=>({valor:1000}),__writes:0,SVPurchasePDF:{mount:({toolbar})=>{toolbar.innerHTML='<button class="btn">Importar comprobante con IA</button>';return {destroy(){}};}}}));
    await page.addScriptTag({path:path.join(root,'js/core/purchase-order-export.v1.js')});
    await page.addScriptTag({path:variant==='before'?process.env.COMPACT_BASELINE:path.join(root,'js/modules/exterior-preparation.js')});
    await page.evaluate(stockOnly=>{
     const catalog=[{key:'A',code:'P-A',description:'Producto de prueba',providers:[{proveedorKey:'E',nombre:'Proveedor exterior ficticio',exterior:true,usd:24,activo:true,disponible:true}]}];
     const item={key:'A|0|E',productKey:'A',code:'P-A',description:'Producto de prueba',qty:1,needed:1,baselinePart:24000,providerKey:'E',include:true};
     return SVExteriorPreparation.open({stockOnly,customer:stockOnly?'Stock general':'Cliente de prueba',saleId:stockOnly?'ST-FICTICIO':'V-FICTICIA',rates:()=>({usdt:1100}),rows:stockOnly?[]:[item],catalog,saved:stockOnly?{extras:[{...item,destination:'stock',method:'exterior',agreed:24}],parameters:{usd:1000,usdt:1100},exteriorAppliedAt:1}:null,save:async()=>__writes++,confirm:async()=>__writes++});
    },stockOnly);
    sizes[variant]=await page.locator('#py-planner').evaluate(el=>Object.fromEntries(['head','tabs','foot','body'].map(k=>[k,Math.round(el.querySelector('.ep-'+k).getBoundingClientRect().height)])));
    if(variant==='after'){
     const quantity=await page.locator('[data-field="qty"],[data-field="requestedQty"]').first().inputValue();
     const body=page.locator('.ep-body');await body.evaluate(el=>el.scrollTop=100);const scroll=await body.evaluate(el=>el.scrollTop);
     for(const disclosure of ['.ep-head-total','.ep-export-menu']){
      await page.locator(disclosure+' > summary').click();
      const panel=page.locator(disclosure+' > div');assert.equal(await panel.isVisible(),true);
      const rect=await panel.boundingBox();assert.ok(rect.x>=-1&&rect.x+rect.width<=width+1,JSON.stringify({width,rect}));
      if(disclosure==='.ep-export-menu')for(const name of ['Copiar para WhatsApp','Exportar PDF','Descargar CSV','Compartir'])assert.equal(await panel.getByRole('button',{name,exact:true}).isVisible(),true);
      await page.keyboard.press('Escape');assert.equal(await page.locator('#py-planner').count(),1);assert.equal(await page.locator(disclosure).getAttribute('open'),null);assert.equal(await page.locator(disclosure+' > summary').evaluate(el=>el===document.activeElement),true);
     }
     assert.equal(await body.evaluate(el=>el.scrollTop),scroll);assert.equal(await page.locator('[data-field="qty"],[data-field="requestedQty"]').first().inputValue(),quantity);
     const overflow=await page.locator('#py-planner').evaluate(el=>el.scrollWidth-el.clientWidth);assert.ok(overflow<=1,String(overflow));
     if(sizes.before)assert.ok(sizes.after.body>sizes.before.body+60,JSON.stringify(sizes));
     await body.evaluate(el=>el.scrollTop=0);
     if(process.env.COMPACT_OUTPUT){fs.mkdirSync(process.env.COMPACT_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.COMPACT_OUTPUT,(stockOnly?'stock':'sale')+'-'+width+'.png')});}
    }
    assert.equal(await page.evaluate(()=>__writes),0);assert.equal(requests,0);assert.deepEqual(errors,[]);await page.close();
   }
   report.push({width,mode:stockOnly?'stock':'sale',...sizes,gainedBody:sizes.before?sizes.after.body-sizes.before.body:undefined,writes:0,externalRequests:0});
  }
  console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
