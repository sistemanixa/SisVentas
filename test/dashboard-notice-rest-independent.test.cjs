'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Runtime=require('../js/core/dashboard-budget-notice-detail-proposal');
// Reuse only the existing fixture builder, without registering its test cases.
const text=fs.readFileSync(require.resolve('./dashboard-budget-notice-detail-runtime.test.cjs'),'utf8');
const {fixture,deferred}=new Function('Runtime',text.slice(text.indexOf('function deferred()'),text.indexOf("test('functional helper"))+'\nreturn {fixture,deferred};')(Runtime);
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
const {create}=require('../cotizador/dashboard-rtdb-read-db');

test('data epoch retirement clears the point editor as well as its detail source',async()=>{
 const f=fixture();assert(await f.host.open('key'));f.root.svCargarDatosDePaginaActual=()=>{};f.root.SVDataReadiness.waitForPage=async()=>{};
 assert(await f.host.enterForm('key',()=>{f.root.document.getElementById('ppto-form-view').style.display='block';f.root._pptoEditandoFbKey='key';f.root._pptoEditorBase={fbKey:'key'};}));
 f.ctx.dataEpoch++;f.root.document.dispatchEvent({type:'sisventas:data-state-changed'});
 assert.equal(f.host.resolve('key'),null);assert.equal(f.root.pptoActualId,null);
 assert.equal(f.root.document.getElementById('ppto-form-view').style.display,'none','Retired point editor must be hidden');
 assert.equal(f.root._pptoEditandoFbKey,null);assert.equal(f.root._pptoEditorBase,null);
});

test('pending form preparation cannot invoke editor after epoch retirement',async()=>{
 const f=fixture(),d=deferred();assert(await f.host.open('key'));let opened=0;
 f.root.svCargarDatosDePaginaActual=()=>{};f.root.SVDataReadiness.waitForPage=()=>d.promise;
 const pending=f.host.enterForm('key',()=>{opened++;});f.ctx.dataEpoch++;f.root.document.dispatchEvent({type:'sisventas:data-state-changed'});d.resolve();
 assert.equal(await pending,false);assert.equal(opened,0);assert.equal(f.handles[0].readyCount,1);assert.equal(f.handles[0].cancelCount,1);
});

for(const status of [401,403,500])test('REST failure '+status+' propagates without retry or cached snapshot',async()=>{
 let calls=0,tokens=0,cancelled=0;const store=createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=>{tokens++;return 'fictitious';},fetchImpl:async()=>{calls++;return {ok:false,status,body:{cancel:async()=>{cancelled++;}}};}});
 await assert.rejects(create({store}).ref('metadata').get(),{statusCode:status<500?403:503});assert.equal(calls,1);assert.equal(tokens,1);assert.equal(cancelled,1);
});

test('REST malformed bounds never request service credentials',async()=>{
 const store=createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=>assert.fail('No token'),fetchImpl:async()=>assert.fail('No HTTP')});
 for(const q of [{orderBy:'$key',limitToFirst:0},{orderBy:'$key',limitToFirst:1.5},{orderBy:'$key',limitToFirst:51},{orderBy:'$key',limitToFirst:5,equalTo:'u'},{orderBy:'$key',limitToFirst:5,startAt:5},{orderBy:'$key',limitToFirst:5,startAt:'x'.repeat(770)},{orderBy:'uid',equalTo:'u',limitToFirst:3},{orderBy:'uid',equalTo:'u',limitToFirst:2,startAt:'u'},{orderBy:'uid',equalTo:'u',limitToFirst:2,endAt:'u'}])await assert.rejects(store.readQuery('index',q),{statusCode:400});
});

test('Chrome: retiring dataEpoch after point editor opens removes the stale form',{
 skip:process.env.SV_DASHBOARD_NOTICE_INDEPENDENT_NATIVE!=='1',timeout:60000
},async()=>{
 const path=require('node:path'),Module=require('node:module'),root=path.resolve(__dirname,'..');
 const native=fs.readFileSync(require.resolve('./dashboard-budget-notice-detail-native.integration.cjs'),'utf8');
 const helpers=native.slice(native.indexOf('function fixtureFactory()'),native.indexOf('for(const width of'))
  .replace('window.__detailEpoch=1;','window.__detailEpoch=1;window.__detailDataEpoch=1;')
  .replace('dataEpoch:0,sessionEpoch:__detailEpoch','dataEpoch:__detailDataEpoch,sessionEpoch:__detailEpoch');
 const session=new Function('require','module','__dirname','root','fs','path','Module','assert',helpers+'\nreturn session;')(require,module,__dirname,root,fs,path,Module,assert);
 await session(1280,async({page})=>{
  assert(await page.evaluate(()=>abrirPresupuestoDesdeNotificacion("key'canonical")));
  await page.evaluate(()=>{__moduleAuditSourceControl.release('productos');__moduleAuditSourceControl.release('empleados');});
  await page.locator('#ppto-det-items button').press('Enter');await page.locator('#ppto-form-view').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>_pptoEditandoFbKey),"key'canonical");
  await page.evaluate(()=>{__detailDataEpoch++;document.dispatchEvent(new Event('sisventas:data-state-changed'));});
  assert.equal(await page.evaluate(()=>_svBudgetNoticeDetailHost.resolve("key'canonical")),null);
  assert.equal(await page.locator('#ppto-form-view').isVisible(),false,'Epoch retirement must hide the actual point editor');
  assert.equal(await page.evaluate(()=>_pptoEditandoFbKey),null);
 });
});
