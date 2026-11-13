'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/sale-commission-assignment-native-fixture.cjs');

for(const retired of ['closed','removed','layer-removed'])test('native manual recovery restores a '+retired+' presentation without sending any financial command',async t=>{
 const f=await fixture(t,{width:390});await f.ready();
 await f.page.evaluate(()=>{
  SVSaleCommissionAssignment.close();document.body.style.overflow='auto';document.documentElement.style.overflow='scroll';
  window.recoveryParent=document.createElement('dialog');recoveryParent.innerHTML='<button type="button">Anterior</button>';document.body.append(recoveryParent);recoveryParent.showModal();
  window.recoveryRejected=null;
  window.recoveryPending=SVLaborWriteRecovery.execute({uid:'actor',id:'fiction-native-recovery',digest:'a'.repeat(64)},()=>Promise.reject(new TypeError('Pérdida ficticia')),()=>{}).catch(e=>{recoveryRejected=e.code;});
 });
 await f.page.getByRole('button',{name:'Consultar operación'}).waitFor();
 await f.page.evaluate(retired=>{
  window.recoveryLayer=document.getElementById('sv-labor-write-recovery');
  if(retired==='closed')recoveryParent.close();else if(retired==='removed')recoveryParent.remove();else recoveryLayer.remove();
  SVLaborWriteRecovery.restore();SVLaborWriteRecovery.restore();
 },retired);
 const button=f.page.getByRole('button',{name:'Consultar operación'});assert.equal(await button.isVisible(),true);assert.equal(await button.isEnabled(),true);
 assert.equal(await f.page.evaluate(()=>document.activeElement===recoveryLayer._button),true);
 assert.equal(await f.page.locator('#sv-labor-write-recovery').count(),1);
 assert.equal(await f.page.evaluate(()=>document.getElementById('sv-labor-write-recovery')===recoveryLayer),true);
 assert.equal((await f.trace()).commands.length,0);assert.equal((await f.trace()).checks,0);
 await f.page.evaluate(()=>{window.fetch=async(url,options)=>{if(!url.endsWith('/laboral/operacion'))throw Error('No financial transport permitted');const body=JSON.parse(options.body);if(body.id!=='fiction-native-recovery'||body.digest!=='a'.repeat(64))throw Error('Unexpected recovery metadata');trace.checks++;return {ok:true,json:async()=>({ok:true,status:'rejected'})};};});
 await button.click();await f.page.waitForFunction(()=>recoveryRejected==='SV_LABOR_REJECTED');
 assert.equal(await f.page.locator('#sv-labor-write-recovery').count(),0);
 assert.equal(await f.page.evaluate(()=>SVLaborWriteRecovery.state()),null);
 assert.equal(await f.page.evaluate(()=>sessionStorage.getItem(SVLaborWriteRecovery.STORAGE_KEY)),null);
 assert.equal(await f.page.evaluate(()=>document.body.style.overflow),'auto');assert.equal(await f.page.evaluate(()=>document.documentElement.style.overflow),'scroll');
 assert.equal((await f.trace()).commands.length,0);assert.equal((await f.trace()).checks,1);assert.deepEqual((await f.trace()).errors,[]);
});
