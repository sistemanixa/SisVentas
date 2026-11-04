'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Runtime=require('../js/core/dashboard-budget-notice-detail-proposal');
const source=fs.readFileSync(require.resolve('./dashboard-budget-notice-detail-runtime.test.cjs'),'utf8');
const {fixture}=new Function('Runtime',source.slice(source.indexOf('function deferred()'),source.indexOf("test('functional helper"))+'\nreturn {fixture};')(Runtime);
test('authority retiring inside the editor callback cannot leave a visible editor or report success',async()=>{
 const f=fixture();assert(await f.host.open('key'));f.root.svCargarDatosDePaginaActual=()=>{};f.root.SVDataReadiness.waitForPage=async()=>{};
 const result=await f.host.enterForm('key',()=>{f.root.document.getElementById('ppto-form-view').style.display='block';f.root._pptoEditandoFbKey='key';f.root._pptoEditandoId='PP-0001';f.root._pptoEditorBase={fbKey:'key'};f.ctx.dataEpoch++;f.root.document.dispatchEvent({type:'sisventas:data-state-changed'});});
 assert.equal(result,false);assert.equal(f.host.resolve('key'),null);assert.equal(f.root.document.getElementById('ppto-form-view').style.display,'none');assert.equal(f.root._pptoEditandoFbKey,null);assert.equal(f.root._pptoEditorBase,null);
});
