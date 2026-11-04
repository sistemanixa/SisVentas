'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {chromium}=require('playwright'),{readActiveApp}=require('./helpers/active-app');
function extract(name){const source=readActiveApp().source,start=source.search(new RegExp('^function '+name+'\\(','m'));assert.ok(start>=0,name);const ends=/^\}/gm;ends.lastIndex=start;for(let match;(match=ends.exec(source));){const text=source.slice(start,match.index+1);try{new vm.Script(text);return text;}catch{}}throw Error(name);}
for(const width of [390,1280])test('native late document images preserve editing at '+width,async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width,height:850}}),external=[],errors=[];
  await page.route('**/*',route=>{external.push(route.request().url());return route.abort();});page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px;background:#101827;color:white;font:16px sans-serif}table{width:100%;table-layout:fixed}img,.item-prod-img-placeholder{width:40px;height:40px;display:inline-block}input{max-width:100%;box-sizing:border-box}</style><input id="editing" value="123,45"><table id="venta-detalle-view"><tbody><tr data-venta-item-index="0"><td><span class="item-prod-img item-prod-img-placeholder"></span></td></tr></tbody></table><table><tbody id="det-body"><tr data-producto-fb-key="fixture"><td><span class="item-prod-img-edit"></span><span class="prod-sel-cod">60876</span></td></tr></tbody></table><table><tbody id="pp-body"><tr data-producto-fb-key="fixture"><td><span class="item-prod-img-edit"></span><span class="prod-sel-cod">60876</span></td></tr></tbody></table><div id="ppto-detalle-view"><table><tbody id="ppto-det-items"><tr data-ppto-item-index="0"><td><span class="item-prod-img"></span></td></tr></tbody></table></div>');
  const functions=['_codigoProductoComparable','productoRefDesdeItem','productoDesdeItem','urlImagenProductoVisual','imagenProductoItemHTML','refrescarImagenesDetallePresupuesto','refrescarImagenesVentaYEditores'].map(extract).join('\n');
  await page.addScriptTag({content:"window.prodData={};window.escapeHTML=value=>String(value??'');window._ventaDetActualId='fixture';window.pptoActualId='fixture';window.fixtureRecord={items:[{cod:'60876',qty:2,punit:123.45,costoUnitarioCompra:12.345}]};window._svResolverVentaRegistro=()=>fixtureRecord;window.buscarPptoPorRef=()=>fixtureRecord;"+functions});
  await page.evaluate(()=>{const input=document.getElementById('editing');input.focus();input.setSelectionRange(1,4);refrescarImagenesDetallePresupuesto();refrescarImagenesVentaYEditores();});
  assert.equal(await page.locator('img').count(),0);
  await page.evaluate(()=>{const image='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="orange"/></svg>');prodData={fixture:{fbKey:'fixture',codigo:'P-60876',imagenUrl:image,imagenUrlOriginal:'https://fixture.invalid/must-not-fetch.png'}};refrescarImagenesDetallePresupuesto();refrescarImagenesVentaYEditores();});
  await page.waitForFunction(()=>document.images.length===4&&Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));
  assert.deepEqual(await page.evaluate(()=>({value:editing.value,start:editing.selectionStart,end:editing.selectionEnd,focused:document.activeElement===editing,overflow:document.documentElement.scrollWidth>innerWidth,record:fixtureRecord})),{value:'123,45',start:1,end:4,focused:true,overflow:false,record:{items:[{cod:'60876',qty:2,punit:123.45,costoUnitarioCompra:12.345}]}});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 }finally{await browser.close();}
});
