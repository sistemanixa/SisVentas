'use strict';
// Preparación, NO evidencia de ejecución. Espera SHA host/domains y montaje root.
// No simula respuestas de /compras, /ot o /laboral/operacion ni carga una pantalla aislada.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const plan={status:'PREPARED_NOT_RUN',viewports:[390,1280],base:'e42ab8b3',flows:[
 {id:'manual-create',steps:['Abrir Compras desde app completa','Crear OC por formulario nativo','Verificar orden y NumberingB en el commit real']},
 {id:'receive-stock',steps:['Abrir OC confirmada','Registrar recepción por formulario','Ver Stock disponible desde app y contrastar ledger original']},
 {id:'ot-roundtrip',steps:['Entrega OT','Instalación','Devolución','Contrastar ledger e historial del dominio entregado, sin fijar reservas históricas']},
 {id:'uncertain-doubleclick',steps:['Perder ACK después del commit real','Doble clic nativo','Consultar operación con Recovery real','Comprobar un único efecto/contador y ningún replay al recuperar']}
],missingPorts:[
 'SHA y API literal del purchase-command-host real deA; constructor y handler HTTP, no respuesta fake.',
 'SHAs dominios A/D/E compatibles, Guard/Store reales y fixture de DB/emulador con fuentes originales genuinas.',
 'Fixture de activación firmada, admisión mapped, referenciasP/J/R, NumberingB y rol/permisos/revisión/sesión auténticos del fixture.',
 'Servidor loopback root que monte index/app/activos completos y host real; bootstrap de Auth/lecturas contra fixture, sin Firebase real.',
 'Punto de pérdida de ACK POSTCOMMIT y contadores observables de POST/commit/numbering/ledger/SDKwrites; resolver real /laboral/operacion.',
 'Estado operativo final de entrega/instalación/devolución A/D: aserciones sobre fuentes/efectos reales, sin codificar semántica vieja de reservas.'
]};
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
module.exports={plan,assertPins,openFullApp,fillManualOrder,fillReceive,resolveUnknown,assertSingleCreationEffect};
if(require.main===module){
 if(process.argv.includes('--prepare'))console.log(JSON.stringify(plan,null,2));
 else{console.error('NO EJECUTADO: esperando SHA host/domains y montaje real del coordinador. Usar --prepare para puertos pendientes.');process.exitCode=2;}
}
