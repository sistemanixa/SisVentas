'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/commercial-partial-chain.cjs');
// Real public renderer/actions in an isolated browser. No delivery is submitted:
// closed-original new delivery is unsupported; custody correction stays enabled.
for(const width of [390,1280])test('closed correction keeps original custody editable but offers new delivery only for canonical extras '+width,{timeout:30000},async()=>{
 const f=await fixture({width}),p=f.page;
 try{
  const ot=f.state.sisventas.ordenes_trabajo.ot;Object.assign(ot,{estado:'completada',custodiaIniciada:true,custodiaRendida:false});Object.assign(ot.materiales[0],{entregada:2,instalada:1,devuelta:0,custodiaActiva:true,stockRegistro:'a'.repeat(64),stockRevision:1});
  await p.evaluate(async()=>{otData=[{...(await fbGet('sisventas/ordenes_trabajo/ot')).val(),fbKey:'ot'}];const host=document.createElement('section');host.innerHTML='<div><span id="ot-custodia-estado"></span></div><button id="ot-btn-entregar-materiales" onclick="otCustodiaEntregar()">Entregar</button><button id="ot-btn-todo-instalado">Todo instalado</button><button id="ot-btn-excepciones">Excepciones</button><table><tbody id="ot-materiales"></tbody></table>';document.body.appendChild(host);otCustodiaRenderMateriales(otData[0],otData[0].materiales);});
  await p.locator('#ot-corregir-materiales').click();await p.waitForFunction(()=>!document.querySelector('#ot-corregir-materiales'));
  const row=p.locator('#ot-materiales tr').first();assert.equal(await row.getByRole('button',{name:'Marcar instalado',exact:true}).isEnabled(),true,'correction of already delivered original remains available');assert.equal(await row.getByRole('button',{name:'Entregar',exact:true}).count(),0);assert.equal(await p.locator('#ot-btn-entregar-materiales').isVisible(),false);
  const calls=f.requests.length,commands=f.lifecycleCommands.length;await p.evaluate(()=>otCustodiaEntregar(0));assert.equal(f.requests.length,calls,'direct call for unsupported closed original does not even prepare');assert.equal(f.lifecycleCommands.length,commands);assert.equal(await p.locator('dialog').count(),0);
  // A legacy alias alone is not the server's canonical additional permission.
  await p.evaluate(()=>{otData[0].materiales.push({cod:'ALIAS',vendida:1,entregada:0,instalada:0,devuelta:0,origen:'adicional_ot'});otCustodiaRenderMateriales(otData[0],otData[0].materiales);});assert.equal(await p.locator('#ot-materiales tr').nth(1).getByRole('button',{name:'Entregar',exact:true}).count(),0);
  await p.evaluate(()=>{otData[0].materiales.push({cod:'EXTRA',desc:'Adicional ficticio',vendida:1,entregada:0,instalada:0,devuelta:0,adicionalOT:true});otCustodiaRenderMateriales(otData[0],otData[0].materiales);});assert.equal(await p.locator('#ot-btn-entregar-materiales').isVisible(),true);assert.equal(await row.getByRole('button',{name:'Entregar',exact:true}).count(),0);
  await p.locator('#ot-btn-entregar-materiales').click();await p.locator('dialog input').waitFor();assert.equal(await p.locator('dialog input').count(),1);assert.equal(await p.locator('dialog input').getAttribute('aria-label'),'Cantidad de Adicional ficticio');await p.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(f.lifecycleCommands.length,commands);assert.deepEqual(f.errors,[]);assert.deepEqual(f.blocked,[]);
 }finally{await f.close();}
});
