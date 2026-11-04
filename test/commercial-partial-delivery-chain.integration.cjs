'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fixture}=require('./helpers/commercial-partial-chain.cjs');
const evidence=process.env.SV_CHAIN_EVIDENCE;
const H=require('../cotizador/client-history-model'),Accounts=require('../cotizador/client-account-projection'),Pages=require('../cotizador/commercial-pages-model');
function financialProjections(f){assert.equal(f.get(Pages.ROOT+'/totals/all/debtCents'),26000);assert.equal(f.get(Accounts.ROOT+'/totals/all/balanceCents'),26000);assert.equal(f.get(H.ROOT+'/sources/ventas/s/row/balanceCents'),26000);}
async function capture(page,name){if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,name+'.png')});}}
// Same-base real finishReceipt2/3 before opening the browser public delivery UI.
// Purchase form presentation is not exercised. No real Firebase, production HTTP,
// or deployed rules; the fixture documents its RAM/Auth/SDK-stock boundaries.
for(const [width,lostAck]of [[1280,false],[390,true]])test('finishReceipt2of3 → public delivery2 → install2of3 → correct1 → receive1; '+width+(lostAck?' lost ACK':''),{timeout:45000},async()=>{
 const f=await fixture({width,lostAck}),p=f.page,before=structuredClone(f.state.sisventas);
 const material=()=>f.get('sisventas/ordenes_trabajo/ot/materiales/0'),inventory=()=>f.get('sisventas/inventario_operativo/p');
 try{
  assert.equal(inventory().asignaciones.s.reservado,2);assert.equal(inventory().enCompra,1);assert.equal(f.get('sisventas/ventas/s/items/0/costoTotalCompra'),34);assert.equal(f.purchase.ackLost,lostAck);const purchaseCommits=f.purchase.commits;financialProjections(f);
  await p.locator('#deliver').click();await p.locator('dialog input').fill('2');await p.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
  if(lostAck){await p.getByRole('button',{name:'Consultar operación',exact:true}).waitFor();assert.equal(material().entregada,2);assert.equal(f.commits.length,purchaseCommits+1);await p.getByRole('button',{name:'Consultar operación',exact:true}).click();}
  await p.waitForFunction(()=>otData[0].materiales[0].entregada===2);assert.equal(f.commits.length,purchaseCommits+1);assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path==='/ot/ciclo').length,1);assert.equal(f.dropped,lostAck);
  const receipts=f.get('sisventas/ordenes_trabajo/ot/remitosEntrega');assert.equal(Object.keys(receipts).length,1);assert.equal(Object.values(receipts)[0].items[0].cantidad,2);assert.deepEqual(inventory(),before.inventario_operativo.p);
  const replay=await p.evaluate(async command=>{const r=await fetch('/ot/ciclo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer fixture-token'},body:JSON.stringify(command)});return{status:r.status,data:await r.json()};},f.lifecycleCommands[0]);assert.equal(replay.status,200);assert.equal(replay.data.committed,true);assert.equal(f.commits.length,purchaseCommits+1);assert.deepEqual(f.get('sisventas/ordenes_trabajo/ot/remitosEntrega'),receipts,'same transport command is idempotent after confirmation/recovery');
  assert.equal(f.get('sisventas/listados_resumen/ordenes_trabajo/ot/materiales/0/entregada'),2);assert.equal(f.get('sv_client_history/v1/sources/ordenes_trabajo/ot/row/key'),'ot');
  financialProjections(f);
  await p.locator('#install').click();await p.waitForFunction(()=>otData[0].materiales[0].instalada===2);
  assert.deepEqual([material().vendida,material().entregada,material().instalada],[3,2,2]);assert.equal(inventory().consumido,2);assert.equal(inventory().asignaciones.s.reservado,0);assert.equal(inventory().general,4);
  financialProjections(f);
  await capture(p,'installed2of3-'+width);
  const consumed=structuredClone(inventory()),commits=f.commits.length;await p.locator('#install').click();await p.waitForTimeout(150);assert.deepEqual(inventory(),consumed,'repeat installation never consumes twice');assert.equal(f.commits.length,commits);
  await p.locator('#exceptions').click();await p.locator('.ot-ex-return').fill('1');await p.getByRole('button',{name:'Guardar rendición'}).click();await p.waitForFunction(()=>otData[0].materiales[0].devueltaPendiente===1);
  assert.equal(material().instalada,1);assert.equal(inventory().consumido,1);assert.equal(inventory().asignaciones.s.reservado,1);assert.equal(inventory().general,4);
  financialProjections(f);
  await p.locator('#receive').click();await p.waitForFunction(()=>otData[0].materiales[0].devuelta===1);
  assert.deepEqual([material().vendida,material().entregada,material().instalada,material().devuelta,material().devueltaPendiente],[3,2,1,1,0]);
  assert.equal(inventory().general,5);assert.equal(inventory().consumido,1);assert.equal(inventory().reservado,5);assert.equal(inventory().asignaciones.s.reservado,0);assert.equal(inventory().asignaciones.s.liberado,1);assert.equal(inventory().enCompra,1);assert.deepEqual(inventory().asignaciones.foreign,before.inventario_operativo.p.asignaciones.foreign);
  const receipt=inventory().rendicionesOT[material().stockRegistro];assert.equal(receipt.instalada,1);assert.equal(receipt.recibidas,1);assert.equal(receipt.enReserva,0);
  const final=structuredClone(f.state.sisventas),n=f.commits.length;await p.locator('#receive').click();await p.waitForTimeout(100);assert.equal(f.commits.length,n);assert.deepEqual(f.state.sisventas,final);
  for(const domain of ['pagos','comisiones','ctaemp','gastos'])assert.deepEqual(f.get('sisventas/'+domain),before[domain]);
  const sale=f.get('sisventas/ventas/s');for(const key of Object.keys(before.ventas.s).filter(k=>k!=='estadoInst'))assert.deepEqual(sale[key],before.ventas.s[key],'preserve sale financial/base field '+key);assert.equal(sale.estadoInst,'en_instalacion','partial delivery never finishes all3 sold units');
  assert.deepEqual(f.get('sisventas/ordenes_trabajo/ot/remitosEntrega'),receipts,'historical delivery receipt remains2 after correction/return');assert.equal(f.get('sisventas/listados_resumen/ordenes_trabajo/ot/materiales/0/instalada'),1);
  assert.deepEqual(f.failures,[]);assert.deepEqual(f.errors,[]);assert.deepEqual(f.blocked,[]);
  financialProjections(f);assert.deepEqual(f.get('sisventas/ordenes/o'),before.ordenes.o,'custody/return cannot rewrite the partial purchase reception');
  assert.equal(f.commits.length,purchaseCommits+6,'one delivery, two SDK stock adjustments, two custody saves and one return');assert.equal(f.lifecycleCommands.filter(c=>c.kind==='delivery').length,2);assert.equal(f.requests.filter(r=>r.path==='/laboral/operacion').length,lostAck?1:0);
  await capture(p,'returned1-'+width);if(evidence)fs.writeFileSync(path.join(evidence,'chain-'+width+'.json'),JSON.stringify({width,lostAck,real:'native public custody/selector/lifecycle/recovery, source HTTP route branches, lifecycle services, guard, list/H7/operational projections',fixtureOnly:'synthetic HTML host, RAM store/auth/fence proof, SDK-stock CAS bridge; purchase finishReceipt/transactionInventory/syncSalePurchaseCosts extracted from real source, memory SDK transport; not RTDB rules or deployed server',material:material(),inventory:inventory(),requests:f.requests,commits:f.commits.length,financialBaseUnchanged:true},null,2));
 }catch(error){console.error('Fixture diagnostic: '+JSON.stringify({notifications:await p.evaluate(()=>notifications),material:material(),inventory:inventory(),serverFailures:f.failures,browserErrors:f.errors,requests:f.requests}));throw error;}finally{await f.close();}
});
