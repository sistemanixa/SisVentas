'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const text=fs.readFileSync(require.resolve('./dashboard-activity-integrated-browser-independent.integration.cjs'),'utf8');
const {session,demand,ready}=new Function('require','__dirname',text.slice(0,text.indexOf('for(const width of'))+'\nreturn {session,demand,ready};')(require,__dirname);
for(const width of [1280,390])test('covered Dashboard startup omits original budget collection in real browser '+width,{
 skip:process.env.SV_ACTIVITY_INTEGRATED_BROWSER_QA!=='1',timeout:60000
},()=>session(width,async({page,local,calls})=>{
 local.setPhase('covered-dashboard');
 const marker=await page.evaluate(()=>({reads:__moduleAudit.reads.length,subscriptions:__moduleAudit.subscriptions.length}));
 await demand(page);await ready(page);
 const audit=await page.evaluate(marker=>({reads:__moduleAudit.reads.slice(marker.reads),subscriptions:__moduleAudit.subscriptions.slice(marker.subscriptions).map(s=>({path:s.path,active:s.active})),plan:svPlanInicioDashboard().sources}),marker);
 const original=p=>p==='sisventas/presupuestos'||p==='/comerciales/presupuestos';
 const forbiddenHttp=local.measures.filter(m=>m.phase==='covered-dashboard'&&(original(m.source)||original(m.path)));
 const forbiddenSdk=[...audit.reads,...audit.subscriptions].filter(r=>original(r.path));
 console.log(JSON.stringify({width,plan:audit.plan,originalHttp:forbiddenHttp,originalSdk:forbiddenSdk,boundedRequests:calls.length,newSdkPaths:[...new Set(audit.reads.map(r=>r.path))]}));
 assert(!audit.plan.includes('presupuestos'));assert.deepEqual(forbiddenHttp,[]);assert.deepEqual(forbiddenSdk,[]);assert.equal(calls.length,8);
}));
