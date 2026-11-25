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
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',timezoneId:'America/Argentina/Buenos_Aires'});
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
async function confirmVisible(page,text){const dialog=page.locator('.sv-system-dialog-overlay');await dialog.waitFor();assert.match(await dialog.innerText(),text);await dialog.getByRole('button',{name:/^(Confirmar|Aceptar|Sí)$/}).click();}
async function navigate(page,id){const nav=page.locator('.nav-item[onclick*="showPage(\''+id+'\'"]'),box=await nav.boundingBox();if(!box||box.x<0)await page.getByRole('button',{name:'Menú',exact:true}).click();await nav.click();await page.locator('#page-'+id+'.active').waitFor();}
async function doubleClickOnce(button){await button.dblclick();}
async function inspectProductReadOnly(page,{scenario,read,counts}){
 const path='sisventas/productos/'+scenario.purchase.productKey,original=await read(path),before=await counts();
 await navigate(page,'productos');await page.locator('#prod-search').fill(scenario.purchase.productCode);
 await page.locator('button[onclick*="editarProductoById"][data-pid="'+scenario.purchase.productKey+'"]').click();await page.locator('#prod-form-view').waitFor();
 const stock=page.locator('#pf-stock');assert.equal(await stock.getAttribute('readonly'),'');assert.equal(await stock.inputValue(),String(original.stock));await stock.scrollIntoViewIfNeeded();
 const box=await stock.boundingBox();assert.ok(box&&box.width>=80&&box.x>=0&&box.x+box.width<=page.viewportSize().width+1,'Stock readonly legible dentro de viewport');
 await page.getByRole('button',{name:'Abrir Stock de oficina',exact:true}).click();await page.locator('#page-stockoficina.active').waitFor();
 await navigate(page,'productos');await page.locator('#prod-list-view').waitFor();
 assert.deepEqual(await read(path),original,'Ficha sin Guardar debe conservar RAWstock/stockReal y resto');const after=await counts();assert.equal(after.commits,before.commits);assert.equal(after.sdkWrites,before.sdkWrites);await navigate(page,'ordenes');
}
async function runCriticalPath(page,{freezeSHA,scenario,read,counts,armPostCommitAckLoss,waitCommitted,createCriticalOT,progress=()=>{}}){
 // Estos son puertos de OBSERVACIÓN del harness/montaje Root, no outputs inventados de E.
 // E entrega sus fuentes/cohorte reales; Root deriva scenario antes de firmarlas.
 assert.match(freezeSHA||'',/^[a-f0-9]{40}$/,'Esperando SHA Root17 congelado y revisado');for(const port of [read,counts,armPostCommitAckLoss,waitCommitted])assert.equal(typeof port,'function','Falta puerto de fixture real');
 assert.ok(scenario&&scenario.inventoryPath);const initial=await read(scenario.inventoryPath);progress('readonly product');await inspectProductReadOnly(page,{scenario,read,counts});
 const before=await counts();await armPostCommitAckLoss('/compras/ordenes/crear');
 await navigate(page,'ordenes');await page.locator('button[onclick="abrirNuevaOrden()"],button[onclick="ocNuevaOrdenManual()"]',{}).first().click();
 await fillManualOrder(page,scenario.purchase);await doubleClickOnce(page.locator('#oc-manual-save'));await resolveUnknown(page);
 const creation=await waitCommitted('manualCreate');assert.ok(creation.orderKey,'Recibo real debe identificar orden creada');assertSingleCreationEffect(before,await counts());
 progress('create recovered');const order=await read('sisventas/ordenes/'+creation.orderKey);assert.equal(order.items[0].costoUnitario,scenario.purchase.unitCost);assert.equal(order.items[0].precioPublico,scenario.purchase.publicPrice);
 await page.locator('[onclick*="ocAbrirOrden"][onclick*="'+creation.orderKey+'"]').first().click();await page.locator('#oc-order-modal').waitFor();
 await fillReceive(page,scenario.receive);await page.getByRole('button',{name:'Registrar recepción',exact:true}).click();await waitCommitted('receive');
 const received=await read(scenario.inventoryPath);assert.equal(received.general,initial.general+scenario.receive.quantity);assert.equal(received.reservado,initial.reservado);progress('receive general');
 assert.equal(typeof createCriticalOT,'function');const createdOT=await createCriticalOT(received);scenario={...scenario,otKey:createdOT.otKey,otPath:'sisventas/ordenes_trabajo/'+createdOT.otKey,returnQuantity:received.general};assert.equal((await read(scenario.otPath)).materiales.length,1);
 await navigate(page,'stockoficina');await page.locator('#page-stockoficina').getByText(scenario.purchase.productCode,{exact:false}).first().waitFor();
 await navigate(page,'ordentrabajo');await page.locator('[onclick*="verOT"][onclick*="'+scenario.otKey+'"],[onclick*="abrirOTConCarga"][onclick*="'+scenario.otKey+'"]').first().click();
 await page.getByRole('button',{name:'2 Materiales',exact:true}).click();
 const quoteResponse=page.waitForResponse(async response=>{if(!['/ot/inventario','/ot/ciclo'].includes(new URL(response.url()).pathname)||response.status()!==409)return false;const body=await response.json().catch(()=>null);return body?.code==='SV_OT_SHORTAGE_CONFIRMATION_REQUIRED';});quoteResponse.catch(()=>{});
 await page.locator('[onclick="otCustodiaEntregar(0)"]').click();await confirmVisible(page,/Se entregarán/);const quote=await (await quoteResponse).json();assert.ok(quote.deliveryQuote?.rows?.some(row=>row.faltante>0),'El faltante debe provenir del modelo real');
 await confirmVisible(page,/faltante autorizado no se repondrá/);await waitCommitted('delivery');progress('delivery shortage confirmed');
 const delivered=await read(scenario.inventoryPath);await page.locator('[onclick="otCustodiaAbrirExcepciones()"]').click();const modal=page.locator('#ot-custodia-modal');
 await modal.locator('.ot-ex-return').fill(String(scenario.returnQuantity));for(const name of ['.ot-ex-tech','.ot-ex-damaged','.ot-ex-missing'])await modal.locator(name).fill('0');
 await modal.getByRole('button',{name:'Guardar rendición',exact:true}).click();await waitCommitted('custody');progress('consume');
 const consumed=await read(scenario.inventoryPath);assert.equal(consumed.general,delivered.general,'Instalar no puede descontar General otra vez');
 await page.locator('#ot-btn-recibir-devolucion').click();await confirmVisible(page,/devoluci/);await waitCommitted('return');
 const returned=await read(scenario.inventoryPath),finalOT=await read(scenario.otPath),row=quote.deliveryQuote.rows[0],installed=row.cantidad-scenario.returnQuantity;
 assert.ok(installed>0&&scenario.returnQuantity>0);assert.equal(finalOT.materiales[0].instalada,installed);assert.equal(finalOT.materiales[0].devuelta,scenario.returnQuantity);
 const receipt=returned.rendicionesOT?.[finalOT.materiales[0].stockRegistro];assert.equal(receipt?.warehouse?.schema,2,'La evidencia debe ser recibo genuino v2');
 const backed=row.descontadoGeneral+row.descontadoReserva,credit=Math.min(scenario.returnQuantity,Math.max(0,backed-installed));assert.equal(receipt.warehouse.returnedCredited,credit);assert.equal(receipt.warehouse.returnedUncredited,scenario.returnQuantity-credit);assert.equal(returned.general,consumed.general+credit);
 for(const [key,value]of Object.entries(initial.rendicionesOT||{}))assert.deepEqual(returned.rendicionesOT[key],value,'Recibo histórico intacto: '+key);assert.equal((await counts()).sdkWrites,0);progress('return genuine credited/uncredited');
 return {creation,quote:quote.deliveryQuote,initial,received,delivered,consumed,returned,finalOT};
}
async function runFrozen(){
 const {execFileSync}=require('node:child_process'),{chromium}=require('playwright'),H=require('../helpers/purchase-full-app-real-host-fixture.cjs'),Seed=require('../helpers/purchase-full-app-critical-seed.cjs'),Auth=require('../helpers/purchase-full-app-auth-bootstrap.cjs');
 const sourceRoot=process.env.SV_NATIVE_SOURCE_ROOT,uiRoot=process.env.SV_NATIVE_UI_ROOT||sourceRoot,freezeSHA=process.env.SV_FULL_APP_FREEZE_SHA;assert.match(freezeSHA||'',/^[a-f0-9]{40}$/);assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),freezeSHA);
 const nativeFactoryFile=path.join(sourceRoot,'test/helpers/inventory-native-application-fixture.cjs'),options={sourceRoot,uiRoot,baselineRulesPath:process.env.SV_NATIVE_RULES_BASELINE,baselineDigest:process.env.SV_NATIVE_RULES_DIGEST};
 const output=process.env.PURCHASE_COMMAND_OUTPUT||path.join(require('node:os').tmpdir(),'purchase-full-app-real-host');fs.mkdirSync(output,{recursive:true});const seedFile=path.join(output,'derived-seed.private.json'),seedPin=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../helpers/purchase-full-app-critical-seed.cjs'))).digest('hex');let cached;
 if(fs.existsSync(seedFile))cached=JSON.parse(fs.readFileSync(seedFile,'utf8'));console.log('PREPARE source seed from genuine originals');const seed=cached?.freezeSHA===freezeSHA&&cached.seedPin===seedPin?cached.seed:await Seed.prepare({nativeFactoryFile,...options});fs.writeFileSync(seedFile,JSON.stringify({freezeSHA,seedPin,seed}));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN});
 try{for(const width of plan.viewports){let f,server,view;try{
  console.log('SETUP '+width);f=await require(nativeFactoryFile).create({...options,rolePermissions:seed.rolePermissions,sourceSeed:seed.sourceSeed});assert.deepEqual(f.get('sisventas/ordenes_trabajo/ot'),seed.originalOT);
  let mount;const at=file=>require(path.join(sourceRoot,file)),authorize=req=>mount.gateway.authorize(req);
  const composed=await H.createFixture({sourceRoot,nativeFixture:f,authorize,createOrderDelete:({store,guard,authorize})=>at('cotizador/purchase-order-delete').createPurchaseOrderDelete({authorize,store,guard,enabled:true,review:at('cotizador/purchase-order-delete-review').create({env:{}})})});
  assert.equal((await composed.readiness()).ready,true);mount=await H.createApiMount({sourceRoot,composed,nativeFixture:f});server=await H.startFullAppServer({checkout:uiRoot,apiHandler:mount.apiHandler});
  view=await openFullApp(browser,{baseURL:server.baseURL,checkout:uiRoot,width,installFixtureSession:Auth.install});await view.page.waitForFunction(()=>window.__qa?.bootReady,{},{timeout:30000});console.log('BOOT '+width);
  const scenario={inventoryPath:'sisventas/inventario_operativo/'+f.keys.inventory,purchase:{productKey:f.keys.product,productCode:f.get('sisventas/productos/'+f.keys.product).codigo,providerKey:'qaProvider',quantity:2,unitCost:10,publicPrice:25},receive:{quantity:2,unitCost:10}};
  const result=await runCriticalPath(view.page,{freezeSHA,scenario,read:composed.read,counts:async()=>({...mount.counts(),...await view.page.evaluate(()=>({sdkWrites:__qa.sdkWrites.filter(x=>!x.path.startsWith('sv_chat_presencia/'+window.currentUserUid+'/')).length,blockedPresenceAttempts:__qa.sdkWrites.filter(x=>x.path.startsWith('sv_chat_presencia/'+window.currentUserUid+'/')).length,totalSdkAttempts:__qa.sdkWrites.length}))}),armPostCommitAckLoss:mount.armPostCommitAckLoss,waitCommitted:mount.waitCommitted,progress:stage=>console.log(width+' '+stage),createCriticalOT:async received=>{
   const body={id:'qa-critical-ot-'+width,kind:'create',changes:{clienteFbKey:'qaClient',tecnicoFbKey:'qaTech',materiales:[{productoKey:f.keys.product,qty:received.general+1,instalada:0}]}};
   const response=await fetch(server.baseURL+'/ot/metadata',{method:'POST',headers:{Authorization:'Bearer FIXTURE_ONLY','Content-Type':'application/json'},body:JSON.stringify(body)}),result=await response.json();assert.equal(response.ok,true,JSON.stringify(result));assert.equal(result.committed,true);return result;
  }});
  assert.deepEqual(f.get('sisventas/ordenes_trabajo/ot'),seed.originalOT);await view.page.screenshot({path:path.join(output,'critical-'+width+'.private.png'),fullPage:true});console.log('PASS_CRITICAL '+width+' '+JSON.stringify({orderKey:result.creation.orderKey,counts:mount.counts()}));
 }catch(error){if(view){const diagnostic=await view.page.evaluate(()=>({qa:window.__qa,uid:window.currentUserUid,role:window.currentRole,text:document.body.innerText.slice(0,1600)})).catch(e=>({error:e.message}));console.error('QA_DIAGNOSTIC '+JSON.stringify(diagnostic));fs.writeFileSync(path.join(output,'diagnostic-'+width+'.private.json'),JSON.stringify(diagnostic,null,2));await view.page.screenshot({path:path.join(output,'failure-'+width+'.private.png'),fullPage:true}).catch(()=>{});}throw error;}finally{await view?.close();await server?.close();f?.cleanup();}}}finally{await browser.close();}
}
module.exports={plan,assertPins,openFullApp,fillManualOrder,fillReceive,resolveUnknown,assertSingleCreationEffect,confirmVisible,navigate,inspectProductReadOnly,runCriticalPath,runFrozen};
if(require.main===module){
 if(process.argv.includes('--prepare'))console.log(JSON.stringify(plan,null,2));
 else if(process.argv.includes('--run'))runFrozen().catch(error=>{console.error(error);process.exitCode=1;});
 else{console.error('NO EJECUTADO: esperando SHA host/domains y montaje real del coordinador. Usar --prepare para puertos pendientes.');process.exitCode=2;}
}
