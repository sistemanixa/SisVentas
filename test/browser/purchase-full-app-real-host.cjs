'use strict';
// Preparación, NO evidencia de ejecución. Espera SHA host/domains y montaje root.
// No simula respuestas de /compras, /ot o /laboral/operacion ni carga una pantalla aislada.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const plan={status:'PREPARED_NOT_RUN',viewports:[390,1280],base:'e42ab8b3',availablePorts:{host:'Root b32476e3 / A e3d0c972: cotizador/purchase-command-host.create; handle(path,req,body), capabilities(), readiness()',composition:'test/helpers/purchase-full-app-real-host-fixture.cjs: Guard/RESTStore/GH reales; requiere fixture E/B y authorize/delete del montaje'},flows:[
 {id:'manual-create',steps:['Abrir Compras desde app completa','Crear OC por formulario nativo','Verificar orden y NumberingB en el commit real']},
 {id:'receive-stock',steps:['Abrir OC confirmada','Registrar recepción por formulario','Ver Stock disponible desde app y contrastar ledger original']},
 {id:'ot-roundtrip',steps:['Entrega OT','Instalación','Devolución','Contrastar ledger e historial del dominio entregado, sin fijar reservas históricas']},
 {id:'uncertain-doubleclick',steps:['Perder ACK después del commit real','Doble clic nativo','Consultar operación con Recovery real','Comprobar un único efecto/contador y ningún replay al recuperar']}
],missingPorts:[
 'Checkout final con SHA host/domains compatibles que incluya host b32476e3, sin mezclar instancias WeakMap entre checkouts.',
 'SHAs dominios A/D/E compatibles, Guard/Store reales y fixture de DB/emulador con fuentes originales genuinas.',
 'Fixture de activación firmada, admisión mapped, referenciasP/J/R, NumberingB y rol/permisos/revisión/sesión auténticos del fixture.',
 'Servidor loopback root que monte index/app/activos completos y host real; bootstrap de Auth/lecturas contra fixture, sin Firebase real.',
 'Punto de pérdida de ACK POSTCOMMIT y contadores observables de POST/commit/numbering/ledger/SDKwrites; resolver real /laboral/operacion.',
 'Estado operativo final de entrega/instalación/devolución A/D: aserciones sobre fuentes/efectos reales, sin codificar semántica vieja de reservas.'
]};
plan.requiredFreeze='Root v3.21.17: NO ejecutar hasta SHA congelado explícito';
plan.otContract={source:'docs/OT_FINAL_FAMILIES_20261125.md',quote:'changes.confirmacionStock={sourceHash,rows:[{index,cantidad,descontadoGeneral,descontadoReserva,faltante}]}',errors:['SV_OT_SHORTAGE_CONFIRMATION_REQUIRED','SV_OT_DELIVERY_QUOTE_CHANGED'],receipt:'warehouse.schema2; instalar no descuenta General otra vez; devolución sólo acredita saldo respaldado'};
function assertPins({host,domains}){for(const [name,sha]of Object.entries({host,...domains})){assert.match(sha||'',/^[a-f0-9]{40}$/,'Falta SHA revisado de '+name);}assert.ok(domains&&Object.keys(domains).length,'Faltan dominios revisados');}
async function openFullApp(browser,{baseURL,checkout,width,installFixtureSession}){
 const base=new URL(baseURL);assert.equal(base.protocol,'http:');assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Sólo loopback');assert.ok(plan.viewports.includes(width));
 const index=fs.readFileSync(path.join(checkout,'index.html'),'utf8'),script=index.match(/src=["']\.\/js\/(app\.v[\d.]+\.js)(?:\?[^"']*)?["']/)?.[1];assert.ok(script,'Falta app inmutable en índice real');
 const context=await browser.newContext({viewport:{width,height:900}});
 try{
  await context.route('**/*',route=>new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
  assert.equal(typeof installFixtureSession,'function','Falta bootstrap de sesión contra fixture, antes de navegar');await installFixtureSession(context);
  const page=await context.newPage(),response=await page.goto(new URL('/index.html',base).href);assert.ok(response?.ok());
  const served=await response.text(),hash=s=>crypto.createHash('sha256').update(s).digest('hex');assert.equal(hash(served),hash(index),'El servidor no entrega el index completo del checkout revisado');
  await page.locator('script[src*="'+script+'"]').waitFor({state:'attached'});
  return {context,page,script,close:()=>context.close()};
 }catch(error){await context.close();throw error;}
}
async function fillManualOrder(page,{providerKey,productCode,quantity,unitCost,publicPrice}){
 await page.locator('#oc-manual-provider').selectOption(providerKey);
 await page.locator('#oc-manual-product-search').fill(productCode);await page.locator('#oc-manual-product-search').press('Enter');
 await page.locator('.oc-manual-qty').fill(String(quantity));await page.locator('.oc-manual-cost').fill(String(unitCost));await page.locator('.oc-manual-public-price').fill(String(publicPrice));
}
async function fillReceive(page,{quantity,unitCost}){await page.locator('.oc-receive-now').fill(String(quantity));await page.locator('.oc-real-cost').fill(String(unitCost));}
async function resolveUnknown(page){await page.getByRole('alertdialog',{name:'Confirmación del guardado'}).waitFor();await page.getByRole('button',{name:'Consultar operación',exact:true}).click();}
function assertSingleCreationEffect(before,after){for(const key of ['businessPosts','commits','numberingAllocations'])assert.equal(after[key]-before[key],1,key+' debe ocurrir exactamente una vez en creación');assert.equal(after.sdkWrites,0,'No permitir SDKwrites reales ni fallback');}
async function confirmVisible(page,text){const dialog=page.getByRole('alertdialog');await dialog.waitFor();assert.match(await dialog.innerText(),text);await dialog.getByRole('button',{name:/^(Confirmar|Aceptar|Sí)$/}).click();}
async function navigate(page,id){const nav=page.locator('.nav-item[onclick*="showPage(\''+id+'\'"]'),box=await nav.boundingBox();if(!box||box.x<0)await page.getByRole('button',{name:'Menú',exact:true}).click();await nav.click();await page.locator('#page-'+id+'.active').waitFor();}
async function doubleClickOnce(button){await button.dblclick();}
async function runCriticalPath(page,{freezeSHA,scenario,read,counts,armPostCommitAckLoss,waitCommitted}){
 // Estos son puertos de OBSERVACIÓN del harness/montaje Root, no outputs inventados de E.
 // E entrega sus fuentes/cohorte reales; Root deriva scenario antes de firmarlas.
 assert.match(freezeSHA||'',/^[a-f0-9]{40}$/,'Esperando SHA Root17 congelado y revisado');for(const port of [read,counts,armPostCommitAckLoss,waitCommitted])assert.equal(typeof port,'function','Falta puerto de fixture real');
 assert.ok(scenario&&scenario.inventoryPath&&scenario.otPath&&scenario.otKey);const initial=await read(scenario.inventoryPath),originalOT=await read(scenario.otPath);
 assert.ok(originalOT.materiales?.length===1,'Caso crítico acotado a una fila original');
 const before=await counts();await armPostCommitAckLoss('/compras/ordenes/crear');
 await navigate(page,'ordenes');await page.locator('button[onclick="abrirNuevaOrden()"],button[onclick="ocNuevaOrdenManual()"]',{}).first().click();
 await fillManualOrder(page,scenario.purchase);await doubleClickOnce(page.locator('#oc-manual-save'));await resolveUnknown(page);
 const creation=await waitCommitted('manualCreate');assert.ok(creation.orderKey,'Recibo real debe identificar orden creada');assertSingleCreationEffect(before,await counts());
 const order=await read('sisventas/ordenes/'+creation.orderKey);assert.equal(order.items[0].costoUnitario,scenario.purchase.unitCost);assert.equal(order.items[0].precioPublico,scenario.purchase.publicPrice);
 await page.locator('[onclick*="ocAbrirOrden"][onclick*="'+creation.orderKey+'"]').first().click();await page.locator('#oc-order-modal').waitFor();
 await fillReceive(page,scenario.receive);await page.getByRole('button',{name:'Registrar recepción',exact:true}).click();await waitCommitted('receive');
 const received=await read(scenario.inventoryPath);assert.equal(received.general,initial.general+scenario.receive.quantity);assert.equal(received.reservado,initial.reservado);
 await navigate(page,'stockoficina');await page.locator('#page-stockoficina').getByText(scenario.purchase.productCode,{exact:false}).first().waitFor();
 await navigate(page,'ordentrabajo');await page.locator('[onclick*="abrirOTConCarga"][onclick*="'+scenario.otKey+'"]').first().click();
 const quoteResponse=page.waitForResponse(async response=>{if(!['/ot/inventario','/ot/ciclo'].includes(new URL(response.url()).pathname)||response.status()!==409)return false;const body=await response.json().catch(()=>null);return body?.code==='SV_OT_SHORTAGE_CONFIRMATION_REQUIRED';});
 await page.locator('[onclick="otCustodiaEntregar(0)"]').click();await confirmVisible(page,/Se entregarán/);const quote=await (await quoteResponse).json();assert.ok(quote.deliveryQuote?.rows?.some(row=>row.faltante>0),'El faltante debe provenir del modelo real');
 await confirmVisible(page,/faltante autorizado no se repondrá/);await waitCommitted('delivery');
 const delivered=await read(scenario.inventoryPath);await page.locator('[onclick="otCustodiaAbrirExcepciones()"]').click();const modal=page.locator('#ot-custodia-modal');
 await modal.locator('.ot-ex-return').fill(String(scenario.returnQuantity));for(const name of ['.ot-ex-tech','.ot-ex-damaged','.ot-ex-missing'])await modal.locator(name).fill('0');
 await modal.getByRole('button',{name:'Guardar rendición',exact:true}).click();await waitCommitted('custody');
 const consumed=await read(scenario.inventoryPath);assert.equal(consumed.general,delivered.general,'Instalar no puede descontar General otra vez');
 await page.locator('#ot-btn-recibir-devolucion').click();await confirmVisible(page,/devoluci/);await waitCommitted('return');
 const returned=await read(scenario.inventoryPath),finalOT=await read(scenario.otPath),row=quote.deliveryQuote.rows[0],installed=row.cantidad-scenario.returnQuantity;
 assert.ok(installed>0&&scenario.returnQuantity>0);assert.equal(finalOT.materiales[0].instalada,installed);assert.equal(finalOT.materiales[0].devuelta,scenario.returnQuantity);
 const receipt=returned.rendicionesOT?.[finalOT.materiales[0].stockRegistro];assert.equal(receipt?.warehouse?.schema,2,'La evidencia debe ser recibo genuino v2');
 const backed=row.descontadoGeneral+row.descontadoReserva,credit=Math.min(scenario.returnQuantity,Math.max(0,backed-installed));assert.equal(receipt.warehouse.returnedCredited,credit);assert.equal(receipt.warehouse.returnedUncredited,scenario.returnQuantity-credit);assert.equal(returned.general,consumed.general+credit);
 for(const [key,value]of Object.entries(initial.rendicionesOT||{}))assert.deepEqual(returned.rendicionesOT[key],value,'Recibo histórico intacto: '+key);assert.equal((await counts()).sdkWrites,0);
 return {creation,quote:quote.deliveryQuote,initial,received,delivered,consumed,returned,finalOT};
}
module.exports={plan,assertPins,openFullApp,fillManualOrder,fillReceive,resolveUnknown,assertSingleCreationEffect,confirmVisible,navigate,runCriticalPath};
if(require.main===module){
 if(process.argv.includes('--prepare'))console.log(JSON.stringify(plan,null,2));
 else{console.error('NO EJECUTADO: esperando SHA host/domains y montaje real del coordinador. Usar --prepare para puertos pendientes.');process.exitCode=2;}
}
