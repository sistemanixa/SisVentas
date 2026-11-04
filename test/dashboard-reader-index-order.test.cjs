'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
test('actual index loads prepared Dashboard factories in browser order without starting reads',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="\.\/(js\/(?:core\/(?:domain-read-policy|dashboard-[^"?]+)|modules\/dashboard-(?:budget|activity)-host\.v1)\.js)(?:\?[^" ]*)?"[^>]*><\/script>/g)].map(m=>m[1]);
 const browser={console,Intl,Date,URL,URLSearchParams,AbortController,setTimeout,clearTimeout};
 browser.window=browser;browser.globalThis=browser;
 for(const key of ['fetch','fbDB','fbAuth'])Object.defineProperty(browser,key,{get(){throw Error('factory import accessed '+key);}});
 const context=vm.createContext(browser);
 for(const script of scripts)vm.runInContext(fs.readFileSync(path.join(root,script),'utf8'),context,{filename:script});
 for(const name of ['SVDashboardHostContext','SVDashboardBudgetFreshRTDB','SVDashboardBudgetSDKProposal','SVDashboardActivityAggregateProposal','SVDashboardBudgetMonthPortProposal','SVDashboardHTTPPortsProposal','SVDashboardBudgetSource','SVDashboardBudgetNoticeConsumer','SVDashboardBudgetNoticeDetail','SVDashboardBudgetHost','SVDashboardActivityHostFactory'])assert.equal(typeof browser[name]?.create,'function',name);
 assert.equal(browser.SV_DASHBOARD_READS_LOCAL,undefined);
 assert.equal(browser.SV_BUDGET_NOTICES_LOCAL,undefined);
 assert.equal(browser._svDashboardBudgetSource,undefined);
 assert.ok(scripts.length>=16);
});
