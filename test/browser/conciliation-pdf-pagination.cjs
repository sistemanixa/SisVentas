'use strict';
// Real download button, local html2pdf bundle and rendered PDF regression.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const out=process.env.SV_CONCILIATION_PDF_OUTPUT||path.join(os.tmpdir(),'sisventas-conciliation-pagination'),bundle=process.env.SV_TEST_HTML2PDF_BUNDLE;
const layoutSource=process.env.SV_PRINT_LAYOUT_SOURCE||'js/core/print-layout.v1.js';
if(!bundle)throw Error('SV_TEST_HTML2PDF_BUNDLE must name the existing local bundle.');
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const markerColors=Array.from({length:75},(_,i)=>[35+(i%5)*45,35+(Math.floor(i/5)%5)*45,45+Math.floor(i/25)*80]);
async function documentFor(page,count){
 await page.setContent('<html><body></body></html>');
 await page.addScriptTag({content:"window.notify=()=>{};window.__html='';window.open=()=>({document:{open(){},write(value){window.__html=value;},close(){}}});"});
 for(const file of [layoutSource,'js/modules/purchase-orders.js'])await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
 const result=await page.evaluate(count=>{
  const amounts=[375400.56,163420.18,23665.18,5955.95,44535.26,123456789.99],order={numero:'OC-FICTICIA',fecha:'2026-10-27',cliente:'Cliente ficticio',ventaId:'VENTA-FICTICIA',items:Array.from({length:count},(_,i)=>({codigo:'FIC-'+i,descripcion:'Producto ficticio '+i+(i===0?' con descripción extensa para comprobar espacio y orden sin ocultar los datos.':''),proveedorFinal:i===1?'Proveedor ficticio con nombre extenso':'Proveedor ficticio',cantidadCostoReal:i===3?5:1,costoUnitarioPresupuestado:amounts[i%6],costoUnitarioReal:amounts[i%6]}))};
  order.totalRealRecibido=order.items.reduce((sum,row)=>sum+row.cantidadCostoReal*row.costoUnitarioReal,0);order.totalPresupuestadoRecibido=order.totalRealRecibido;
  SisVentasCompras.state.activeOrder=order;const before=JSON.stringify(order);ocImprimirOrdenActual();if(JSON.stringify(order)!==before)throw Error('Print changed original amounts');return{html:window.__html,codes:order.items.map(row=>row.codigo)};
 },count);
 await page.setContent(result.html,{waitUntil:'load'});await page.waitForFunction(()=>typeof html2pdf==='function'&&!!SVPrintLayout);
 assert.deepEqual(await page.locator('tbody tr td:first-child').allTextContents(),result.codes);
 assert(await page.locator('td.num').evaluateAll(cells=>cells.every(cell=>{const range=document.createRange();range.selectNodeContents(cell);return new Set(Array.from(range.getClientRects(),r=>Math.round(r.top))).size===1&&cell.scrollWidth<=cell.clientWidth;})));
 return result;
}
async function download(page,filename){
 await page.evaluate(()=>{window.__downloadBlob=null;const original=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.__downloadBlob=blob;return original(blob);};});
 await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();await page.waitForFunction(()=>window.__downloadBlob instanceof Blob);
 const bytes=Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.__downloadBlob.arrayBuffer()))));fs.writeFileSync(filename,bytes);
 const prefix=filename.replace(/\.pdf$/,'');execFileSync(process.env.PDFTOPPM_BIN||'pdftoppm',['-r','96','-png',filename,prefix],{stdio:'pipe'});
 return fs.readdirSync(path.dirname(filename)).filter(name=>name.startsWith(path.basename(prefix)+'-')&&name.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(name=>path.join(path.dirname(filename),name));
}
async function main(){
 fs.mkdirSync(out,{recursive:true});let external=0;const sourceHash=hash(fs.readFileSync(layoutSource));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
 try{
  const expectedRenders=new Map(),results=[];
  for(const count of [6,75])for(const width of [390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:1200}});await page.route('**/*',route=>route.request().url()==='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'?route.fulfill({contentType:'application/javascript',body:fs.readFileSync(bundle)}):(external++,route.abort()));
   await documentFor(page,count);const filename=path.join(out,`conciliation-${count}-${width}.pdf`),renders=await download(page,filename),renderHashes=renders.map(file=>hash(fs.readFileSync(file)));
   assert.equal(renders.length,count===6?1:3);if(expectedRenders.has(count))assert.deepEqual(renderHashes,expectedRenders.get(count),'PDF pages differ by screen width');else expectedRenders.set(count,renderHashes);
   results.push({count,width,pages:renders.length,renderHashes});await page.close();
  }
  // Paint narrow test-only row markers without changing row geometry. Their
  // rendered runs prove every row survives intact on one downloaded PDF page.
  const page=await browser.newPage({viewport:{width:390,height:1200}});await page.route('**/*',route=>route.request().url()==='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'?route.fulfill({contentType:'application/javascript',body:fs.readFileSync(bundle)}):(external++,route.abort()));
  await documentFor(page,75);
  const rows=await page.evaluate(colors=>{
   const cells=Array.from(document.querySelectorAll('tbody tr td:first-child'));for(let i=0;i<cells.length;i++){cells[i].style.position='relative';const mark=document.createElement('span');mark.style.cssText=`position:absolute;left:0;top:2px;bottom:2px;width:8px;background:rgb(${colors[i].join(',')});`;cells[i].appendChild(mark);}
   const root=document.getElementById('oc-comprobante').getBoundingClientRect();return cells.map(cell=>{const r=cell.getBoundingClientRect();return{x:r.left-root.left+3,height:r.height-4};});
  },markerColors);
  const markerRenders=await download(page,path.join(out,'conciliation-markers.pdf')),observed=Array.from({length:75},()=>[]);
  for(let p=0;p<markerRenders.length;p++){
   const pixels=await page.evaluate(async({data,colors,x})=>{const img=new Image();img.src=data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const rgba=ctx.getImageData(0,0,img.width,img.height).data,column=Math.round(6/210*img.width+x/794*(198/210*img.width)),matches=[];for(let y=0;y<img.height;y++){const offset=(y*img.width+column)*4,color=rgba.slice(offset,offset+3);let best=-1,distance=Infinity;for(let i=0;i<colors.length;i++){const d=colors[i].reduce((n,c,j)=>n+(c-color[j])**2,0);if(d<distance){distance=d;best=i;}}if(distance<100)matches.push({row:best,y});}return matches;},{data:'data:image/png;base64,'+fs.readFileSync(markerRenders[p]).toString('base64'),colors:markerColors,x:rows[0].x});
   for(const {row,y}of pixels)observed[row].push({page:p,y});
  }
  // Ignore isolated JPEG/antialias colour coincidences, not real marker runs.
  const runs=observed.map(pixels=>{const groups=[];for(const pixel of pixels){const last=groups.at(-1);if(last&&last.page===pixel.page&&last.end+1===pixel.y){last.end=pixel.y;last.length++;}else groups.push({page:pixel.page,start:pixel.y,end:pixel.y,length:1});}return groups.filter(run=>run.length>=4);}),scale=198/210;
  for(let i=0;i<75;i++){assert(runs[i].reduce((n,run)=>n+run.length,0)>=Math.floor(rows[i].height*scale)-3,`row FIC-${i} lost pixels`);assert.equal(new Set(runs[i].map(run=>run.page)).size,1,`row FIC-${i} split between pages`);}
  assert.equal(external,0);assert.equal(hash(fs.readFileSync(layoutSource)),sourceHash,'Layout changed during verification');fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({sourceHash,results,rowsVerified:75,markerRuns:runs,externalRequests:external,businessWrites:0},null,2));console.log(JSON.stringify({cases:results.length,allRowMarkers:75,identicalAcrossWidths:true,externalRequests:0,out}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
