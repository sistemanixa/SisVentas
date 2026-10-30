'use strict';
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const Model=require('../../js/core/survey-summaries.v1');
const sample={id:'REL-ficticio',cliente:'Cliente ficticio',direccion:'Lugar ficticio',autor:'Técnico ficticio',savedAt:'2026-10-30T12:00:00.000Z',services:['otro'],items:{otro:{necesidad:{value:'Servicio ficticio',note:'Nota de ejemplo',photo:{data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD9sAAAAASUVORK5CYII=',name:'ejemplo.png'}}}}};
const styles=fs.readFileSync('css/app.css','utf8')+'\n'+fs.readFileSync('css/surveys.css','utf8');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'"><style>'+styles+'</style></head><body class="dark-mode" style="height:auto;overflow:auto"><p>Ejemplo local · Datos ficticios</p><main id="page-relevamientos" class="page active"></main></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN}),results=[];
 try{for(const width of [390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});let external=0;const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)route.continue();else{external++;route.abort();}});await page.goto(origin+'/#/relevamientos');
  await page.evaluate(({sample,index})=>{
   Object.assign(window,{isAuthenticated:true,currentUserUid:'fixture',currentUser:'Técnico ficticio',currentUserEmail:'fixture@example.test',currentRole:'tecnico',fbAuth:{currentUser:{uid:'fixture'}},PERMISOS_ROLES:{tecnico:{indiceRevision:1}},_svOperacionesSesionEpoch:1,_svDataEpoch:1,_impersonacionOriginal:null,SISVENTAS_SURVEY_SUMMARIES_READY:true,fbDB:{},permisoModulo:()=>true,fbRef:(_,path)=>path,notify(){},watches:[],writes:0,loading:{ready:0,error:0,cancel:0}});
   window.SVDataReadiness={beginSource:()=>({ready:()=>loading.ready++,error:()=>loading.error++,cancel:()=>loading.cancel++})};
   window.fbSet=window.fbUpdate=()=>{writes++;throw Error('No guardar durante prueba de lectura');};
   window.fbOnValue=(path,next,error)=>{const item={path,next,error,stopped:false};watches.push(item);if(path==='sisventas/relevamientos_resumen')queueMicrotask(()=>{if(!item.stopped)next({val:()=>index});});return ()=>item.stopped=true;};
   window.fixtureSample=sample;
  },{sample,index:Model.buildIndex({[sample.id]:sample},'a'.repeat(64))});
  await page.addScriptTag({content:fs.readFileSync('js/core/survey-summaries.v1.js','utf8')});await page.addScriptTag({content:fs.readFileSync('js/modules/surveys.js','utf8')});
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('sisventas:page-changed',{detail:{page:'relevamientos'}})));
  await page.getByRole('button',{name:'Ver guardados',exact:true}).click();await page.locator('details.rel-summary').waitFor();
  assert.deepEqual(await page.evaluate(()=>watches.map(w=>w.path)),[Model.INDEX]);assert.equal(await page.locator('.rel-photo').count(),0);
  await page.locator('details.rel-summary summary').click();await page.locator('.rel-detail-loading').waitFor();
  assert.equal(await page.evaluate(()=>watches[1].path),Model.DETAIL+'/'+sample.id);await page.screenshot({path:'C:/SisVentas/tmp/survey-summary-loading-'+width+'.private.png'});
  await page.evaluate(()=>watches[1].next({val:()=>fixtureSample}));await page.getByText('Nota de ejemplo',{exact:true}).waitFor();assert.equal(await page.locator('.rel-photo').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'C:/SisVentas/tmp/survey-summary-open-'+width+'.private.png'});
  await page.locator('details.rel-summary summary').click();await page.waitForFunction(()=>watches[1].stopped);assert.equal(await page.locator('.rel-photo').count(),0);
  await page.locator('details.rel-summary summary').click();await page.waitForFunction(()=>watches.length===3);await page.evaluate(()=>watches[2].error(Error('Fallo ficticio')));await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.waitForFunction(()=>watches.length===4);await page.evaluate(()=>watches[3].next({val:()=>fixtureSample}));await page.getByText('Nota de ejemplo',{exact:true}).waitFor();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(()=>watches.every(w=>w.stopped)),true);assert.equal(await page.evaluate(()=>writes),0);assert.equal(external,0);assert.deepEqual(errors,[]);
  results.push({width,indexReads:1,detailReads:3,closedListeners:4,writes:0,external,overflow:false});await page.close();
 }fs.writeFileSync('C:/SisVentas/tmp/survey-summary-qa.private.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
