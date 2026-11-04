'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/sales-indexed-host.v1.js','utf8');
const clear=source.slice(source.indexOf('function clearRendered('),source.indexOf('function retireVerified('));
function fixture(drafts){let rows=8,pages=1;const root={_svSalesDraftGrid:drafts},body={replaceChildren(){rows=0;}},pager={replaceChildren(){pages=0;}};const c={root,document:{getElementById:id=>id==='ventas-tbody'?body:id==='ventas-paginacion'?pager:null},text(){},capture:()=>({online:true})};vm.createContext(c);vm.runInContext(clear,c);return {c,get rows(){return rows;},get pages(){return pages;}};}
test('retiring sales coverage preserves the independently owned draft rows',()=>{const f=fixture(true);f.c.clearRendered(true);assert.equal(f.rows,8);assert.equal(f.pages,0);assert.match(source,/function retireVerified\(\)\{dashboardPresentation=null;clearRendered\(true\)/);});
test('session reset still clears private rows, including drafts',()=>{const f=fixture(true);f.c.clearRendered();assert.equal(f.rows,0);assert.match(source,/function reset\(\)\{dashboardPresentation=null;clearRendered\(\)/);});
test('normal sales lose unverified rows and late paints do not own the drafts grid',()=>{const f=fixture(false);f.c.clearRendered(true);assert.equal(f.rows,0);assert.match(source,/function paint\(\)\{if\(!state\|\|root\._svSalesDraftGrid\)return;/);});
