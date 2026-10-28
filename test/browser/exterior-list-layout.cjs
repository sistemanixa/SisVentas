'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});const report=[];
 try{for(const width of [320,390,768,950,1280])for(const stockOnly of [true,false]){
  const variants=process.env.LIST_BASELINE?['before','after']:['after'];const heights={};
  for(const variant of variants){
   const page=await browser.newPage({viewport:{width,height:900}});let requests=0;const errors=[];await page.route('**/*',r=>{requests++;return r.abort();});page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<!doctype html><html class="dark-mode"><body><button>Abrir</button></body>');await page.addStyleTag({path:path.join(root,'css/app.css')});
   await page.addStyleTag({content:'#py-planner *{overscroll-behavior:contain}'});
   await page.evaluate(()=>Object.assign(window,{permisoModulo:()=>true,currentUserUid:'fixture',currentUser:'Fixture',notify:()=>{},fbGet:async()=>{__reads++;return {val:()=>({})};},fbRef:()=>'',obtenerDolarReferenciaProducto:()=>({valor:1000}),__saved:[],__confirmed:0,__reads:0}));
   await page.addScriptTag({path:variant==='before'?process.env.LIST_BASELINE:path.join(root,'js/modules/exterior-preparation.js')});
   await page.evaluate(stockOnly=>{
    const catalog=Array.from({length:12},(_,i)=>({key:'F'+i,code:'P-'+(100+i),description:'Producto ficticio '+(i+1)+' con descripción para verificar la lista',providers:[{proveedorKey:'E',nombre:'Proveedor exterior',exterior:true,usd:20+i,activo:true,disponible:true}]}));
    const rows=catalog.map((p,i)=>({key:p.key,productKey:p.key,code:p.code,description:p.description,qty:i+1,needed:i+1,method:'exterior',destination:stockOnly?'stock':'venta',providerKey:'E',include:true,agreed:20+i,reference:{currency:'USD',amount:20+i,providerKey:'E'}}));
    const picture='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52"><rect width="52" height="52" fill="lightblue"/></svg>');
    return SVExteriorPreparation.open({stockOnly,customer:'Pedido ficticio',catalog,rows:stockOnly?[]:rows,saved:{extras:stockOnly?rows:[],parameters:{usd:1000,usdt:1100},exteriorAppliedAt:1},rates:()=>({usdt:1100}),thumbnail:()=>'<span class="oc-product-thumb" style="width:48px;height:48px;flex:0 0 48px;overflow:hidden;display:grid"><img class="item-prod-img" src="'+picture+'"></span>',save:async s=>__saved.push(s),confirm:async()=>__confirmed++});
   },stockOnly);
   const body=page.locator('.ep-body'),card=page.locator('.ep-card').first(),image=card.locator('img');
   heights[variant]=Math.round((await card.boundingBox()).height);
   await image.scrollIntoViewIfNeeded();await image.hover();const before=await body.evaluate(el=>el.scrollTop);await page.mouse.wheel(0,300);
   if(variant==='before'){await page.waitForTimeout(100);assert.equal(await body.evaluate(el=>el.scrollTop),before,'Baseline reproduce rueda atrapada por miniatura');}
   else{
    await page.waitForFunction(start=>document.querySelector('.ep-body').scrollTop>start,before,{timeout:2000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollTop),0);assert.equal(await page.locator('.ep-code').count(),12);
    const initial=await page.locator('[data-field="qty"],[data-field="requestedQty"]').evaluateAll(es=>es.map(e=>e.value));
    await page.getByRole('button',{name:'Tarjetas',exact:true}).click();assert.equal(await page.locator('.ep-list').count(),0);assert.equal(await page.locator('.ep-code').first().isVisible(),true);
    await image.scrollIntoViewIfNeeded();await image.hover();const start=await body.evaluate(el=>el.scrollTop);await page.mouse.wheel(0,300);await page.waitForFunction(v=>document.querySelector('.ep-body').scrollTop>v,start,{timeout:2000});
    await page.getByRole('button',{name:'Lista',exact:true}).click();assert.equal(await page.locator('.ep-list').count(),1);
    assert.deepEqual(await page.locator('[data-field="qty"],[data-field="requestedQty"]').evaluateAll(es=>es.map(e=>e.value)),initial);assert.equal(await page.evaluate(()=>__saved.length),0);assert.equal(await page.evaluate(()=>__reads),2);
    if(stockOnly){
     assert.equal(await page.locator('[data-remove]').count(),12);await page.locator('[data-remove="0"]').dblclick();assert.equal(await page.locator('.ep-card').count(),11);assert.equal(await page.locator('[data-remove="0"]').evaluate(el=>el===document.activeElement),true);
     assert.deepEqual(await page.locator('[data-field="qty"]').evaluateAll(es=>es.map(e=>e.value)),initial.slice(1));assert.equal(await page.evaluate(()=>__saved.length),0);
     await page.locator('[data-save]').click();await page.waitForFunction(()=>__saved.length===1);const saved=await page.evaluate(()=>__saved[0]);assert.equal(saved.extras.length,11);saved.extras.forEach((r,i)=>{assert.equal(r.code,'P-'+(101+i));assert.equal(Number(r.qty),i+2);assert.equal(Number(r.agreed),21+i);assert.equal(r.providerKey,'E');});assert.equal(await page.evaluate(()=>__confirmed),0);
    }else assert.equal(await page.locator('[data-remove]').count(),0,'No se eliminan renglones de la venta de origen por una acción visual');
    await body.evaluate(el=>el.scrollTop=0);const overflow=await page.locator('#py-planner').evaluate(el=>el.scrollWidth-el.clientWidth);assert.ok(overflow<=1,JSON.stringify({width,overflow,wide:await page.locator(".ep-card").first().evaluate(el=>Array.from(el.children).map(n=>({cls:n.className,w:n.getBoundingClientRect().width,x:n.getBoundingClientRect().x}))) }));
    if(process.env.LIST_OUTPUT){fs.mkdirSync(process.env.LIST_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.LIST_OUTPUT,(stockOnly?'stock':'sale')+'-'+width+'.png')});}
    if(stockOnly){const saved=await page.evaluate(()=>__saved[0]);await page.locator('[data-close]').click();await page.evaluate(saved=>SVExteriorPreparation.open({stockOnly:true,closed:true,saved,catalog:[],rows:[],rates:()=>({usdt:1100})}),saved);assert.equal(await page.locator('[data-remove]').count(),0);assert.equal(await page.locator('[data-save]').count(),0);}
   }
   assert.equal(requests,0);assert.deepEqual(errors,[]);await page.close();
  }
  if(heights.before)assert.ok(heights.after<=heights.before-30,JSON.stringify({width,heights}));report.push({width,mode:stockOnly?'stock':'sale',rowHeights:heights,photoWheel:'PASS',externalRequests:0});
 }
 console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
