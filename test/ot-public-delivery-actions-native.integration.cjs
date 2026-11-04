'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/commercial-partial-chain.cjs');

// Actual custody renderer and public actions, using the isolated fixture host.
// This does not replace the complete operational chain or certify remote rules.
async function showMaterials(page){
 await page.evaluate(()=>{
  const table=document.createElement('table');table.innerHTML='<tbody id="ot-materiales"></tbody>';
  document.body.appendChild(table);otCustodiaRenderMateriales(otData[0],otData[0].materiales);
 });
}
for(const width of [390,1280])test('row delivery is available before installation, then only the delivered quantity can be installed '+width,{timeout:45000},async()=>{
 const f=await fixture({width}),p=f.page;
 try{
  await showMaterials(p);
  const row=p.locator('#ot-materiales tr').first();
  assert.equal(await row.getByRole('button',{name:'Pendiente de entrega',exact:true}).isDisabled(),true);
  const before=f.lifecycleCommands.length;
  await p.evaluate(()=>otCustodiaInstalarItem(0));
  assert.equal(f.lifecycleCommands.length,before,'calling installation directly must not create delivery or consume stock');
  assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/0/instalada'),0);
  await row.getByRole('button',{name:'Entregar',exact:true}).click();
  await p.locator('dialog input').waitFor({state:'visible'});
  assert.equal(await p.locator('dialog input').count(),1);
  await p.locator('dialog input').fill('2');
  await p.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
  await p.waitForFunction(()=>otData[0].materiales[0].entregada===2);
  assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/0/vendida'),3);
  assert.equal(f.get('sisventas/inventario_operativo/p/consumido'),0);
  assert.equal(await row.getByRole('button',{name:'Marcar instalado',exact:true}).isEnabled(),true);
  assert.equal(await row.getByRole('button',{name:'Entregar',exact:true}).isVisible(),true,'one ordered unit remains pending');
  const command=f.lifecycleCommands.at(-1);
  assert.equal(command.kind,'delivery');assert.deepEqual(command.changes,{entregas:[{index:0,cantidad:2}]});
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.blocked,[]);
 }finally{await f.close();}
});

test('technical session with a mistakenly granted client action cannot expose or start delivery',{timeout:45000},async()=>{
 const f=await fixture({width:1280}),p=f.page;
 try{
  await p.evaluate(()=>window.currentRole='tecnico');await showMaterials(p);
  assert.equal(await p.locator('#ot-materiales').getByRole('button',{name:'Entregar',exact:true}).count(),0);
  const before=f.lifecycleCommands.length;await p.evaluate(()=>otCustodiaEntregar());
  assert.equal(f.lifecycleCommands.length,before);assert.equal(await p.locator('dialog').count(),0);
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
