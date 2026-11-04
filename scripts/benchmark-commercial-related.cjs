'use strict';
// Synthetic benchmark only. Default dry plan never loads Playwright or starts a server/browser.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');

function reserveOutputDirectory(outputDir){if(!path.isAbsolute(outputDir))throw Error('--output-dir must be absolute');fs.mkdirSync(path.dirname(outputDir),{recursive:true});try{fs.mkdirSync(outputDir);}catch(error){if(error.code==='EEXIST')throw Error('Output directory already exists; choose a new run directory');throw error;}return outputDir;}
function parseArguments(args){const options={run:false,preset:'light',photos:'URL',repetitions:3};for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--run'){options.run=true;continue;}if(arg==='--help'){options.help=true;continue;}const fields={'--expected-commit':'expectedCommit','--output-dir':'outputDir','--preset':'preset','--photos':'photos','--repetitions':'repetitions','--chrome':'chrome'};if(!fields[arg]||!args[i+1]||args[i+1].startsWith('--'))throw Error('Unknown option or missing value: '+arg);options[fields[arg]]=args[++i];}options.repetitions=Number(options.repetitions);if(!['light','heavy'].includes(options.preset)||!['URL','embedded'].includes(options.photos)||!Number.isInteger(options.repetitions)||options.repetitions<1||options.repetitions>5)throw Error('Invalid preset/photos/repetitions');if(options.expectedCommit&&!/^[a-f0-9]{40}$/.test(options.expectedCommit))throw Error('--expected-commit requires a complete lowercase SHA');if(options.outputDir&&!path.isAbsolute(options.outputDir))throw Error('--output-dir must be absolute');if(options.run&&(!options.expectedCommit||!options.outputDir))throw Error('--run requires --expected-commit and an absolute --output-dir');return options;}
const options=require.main===module?parseArguments(process.argv.slice(2)):{run:false,preset:'light',photos:'URL',repetitions:3};
if(options.help){console.log('Dry plan by default. Explicit execution: node --expose-gc --max-old-space-size=640 scripts/benchmark-commercial-related.cjs --run --expected-commit <fullSHA> --output-dir <absoluteIgnoredDirectory> --preset light|heavy --photos URL|embedded --repetitions 1..5 [--chrome executable]');process.exit(0);}

const assert=require('node:assert/strict');
function replaceOnce(text,needle,replacement){assert.equal(text.split(needle).length-1,1,'Private fixture extension requires exactly one occurrence: '+needle);return text.replace(needle,replacement);}
const heavy=options.preset==='heavy',embedded=options.photos==='embedded';
const config={preset:heavy?'heavy':'light',photoStorage:embedded?'dataURI':'URL',sales:1095,payments:1095,clients:heavy?1000:100,products:heavy?2000:200,photoCount:heavy?500:50,width:heavy?1280:640,height:heavy?960:480,targetPhotoBytes:(heavy?250:50)*1024,repetitions:options.repetitions,latencyMs:100,downloadBytesPerSec:6250000,uploadBytesPerSec:625000,cpuRate:4};
config.requestedSalesCount=1095;config.memoryPolicy='Node RSS at most1GiB, OS free at least3GiB, serializedJSON at most128MiB; estimates and observed samples reported separately.';config.requestedPhotoCount=config.photoCount;config.relatedPerDomain=heavy?500:50;
// Conservative preallocation bound: embedded JSON is replicated by the original
// fixture's bootstrap/backend snapshots. Keep its contribution below 8 MiB.
if(embedded)config.photoCount=Math.min(config.photoCount,Math.floor((8*1024*1024)/(Math.ceil(config.targetPhotoBytes*1.4)+1024)));
config.estimatedRelatedJsonBytes=config.clients*(heavy?1400:500)+config.products*(heavy?1600:600)+config.relatedPerDomain*6*(heavy?1600:1000)+(embedded?config.photoCount*Math.ceil(config.targetPhotoBytes*1.4):0);
config.estimatedRamBytes=64*1024*1024+config.sales*600*1024+config.estimatedRelatedJsonBytes*8;
if(config.estimatedRelatedJsonBytes>128*1024*1024||config.estimatedRamBytes>1024*1024*1024)throw Error('Scenario exceeds preallocation budget; reduce counts before execution');
function crc(b){let c=0xffffffff;for(const v of b){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([t,data])),8+data.length);return b;}
function png(id){const {width:w,height:h,targetPhotoBytes:target}=config,raw=Buffer.alloc((w*3+1)*h,120);for(let y=0;y<h;y++)raw[y*(w*3+1)]=0;let seed=id+1;for(let i=0;i<Math.min(target-1000,raw.length);i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const at=Math.floor(i/(w*3))*(w*3+1)+i%(w*3)+1;raw[at]=seed>>>24;}const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
function verifyCheckout(expectedCommit,repositoryRoot=root){const git=require('node:child_process'),actual=git.execFileSync('git',['rev-parse','HEAD'],{cwd:repositoryRoot,encoding:'utf8'}).trim();assert.equal(actual,expectedCommit,'Checkout differs from --expected-commit');if(git.execFileSync('git',['status','--porcelain'],{cwd:repositoryRoot,encoding:'utf8'}).trim())throw Error('Benchmark --run requires a clean checkout');return actual;}
function validateOutputLocation(outputDir,repositoryRoot=root){if(!path.isAbsolute(outputDir))throw Error('--output-dir must be absolute');const relative=path.relative(repositoryRoot,outputDir);if(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)){const probe=path.join(outputDir,'benchmark-output.private.json');if(require('node:child_process').spawnSync('git',['check-ignore','--quiet','--',probe],{cwd:repositoryRoot}).status!==0)throw Error('Output within the repository must be ignored by Git');}return outputDir;}
function allowedNetworkUrl(value,origin){try{const url=new URL(value);if(['http:','https:'].includes(url.protocol))return url.origin===origin;if(url.protocol==='data:')return true;if(url.protocol==='blob:')return new URL(url.pathname).origin===origin;return false;}catch{return false;}}
async function cleanupRun({context,server,pending=[]},errors){try{await context?.close();}catch(error){errors.push('Context cleanup: '+error.message);}try{if(server?.listening)await new Promise(resolve=>{server.close(error=>{if(error)errors.push('Server cleanup: '+error.message);resolve();});server.closeAllConnections?.();});}catch(error){errors.push('Server cleanup: '+error.message);}await Promise.allSettled(pending);}

async function main(){if(!options.run){console.log(JSON.stringify({prepared:true,browserStarted:false,networkStarted:false,root,config,execution:'Explicit --run, clean reviewed --expected-commit and absolute ignored --output-dir required.'}));return;}
 config.commit=verifyCheckout(options.expectedCommit);validateOutputLocation(options.outputDir);if(require('node:os').freemem()<3*1024**3)throw Error('OS free memory below3GiB');reserveOutputDirectory(options.outputDir);
 const images=new Map(),image=i=>{if(!images.has(i))images.set(i,png(i));return images.get(i);};
 const photo=i=>embedded?'data:image/png;base64,'+image(i).toString('base64'):'/synthetic-photo/'+i+'.png';
 const related={clientes:{c:{nombre:'Cliente ficticio'}},productos:{},ordenes_trabajo:{},reclamos:{},equipos:{},gastos:{},proveedores:{},presupuestos:{}};
 for(let i=0;i<config.clients;i++)related.clientes['synthetic'+i]={nombre:'Cliente sintetico '+i,id:'SYN-C-'+i,observaciones:'X'.repeat(heavy?1024:128)};
 for(let i=0;i<config.products;i++)related.productos[i<16?'p'+i:'synthetic'+i]={codigo:i<16?'P-'+i:'SYN-P-'+i,nombre:'Producto sintetico '+i,compraARS:20,ventaARS:100,pventa:100,imagenUrl:i<config.photoCount?photo(i):'',descripcion:'X'.repeat(heavy?1024:128)};
 config.relatedPerDomain=heavy?500:50;
 for(let i=0;i<config.relatedPerDomain;i++){
  const key='synthetic'+i,base={id:'SYN-'+i,fecha:'2026-11-04',cliente:'Cliente sintetico '+i%config.clients,clienteFbKey:'synthetic'+i%config.clients,responsableUid:'fixture',descripcion:'Registro sintetico '+i+' '+ 'X'.repeat(heavy?512:64)};
  related.ordenes_trabajo[key]={...base,cliente:'Cliente ficticio',clienteFbKey:'c',id:'OT-SYN-'+i,ventaFbKey:'fixture'+i,estado:'pendiente',materiales:[]};
  related.reclamos[key]={...base,cliente:'Cliente ficticio',clienteFbKey:'c',id:'R-SYN-'+i,ventaFbKey:'fixture'+i,estado:'pendiente',problema:'Incidencia sintetica',prioridad:'normal'};
  related.equipos[key]={...base,cliente:'Cliente ficticio',clienteFbKey:'c',id:'E-SYN-'+i,ventaFbKey:'fixture'+i,equipo:'Equipo sintetico',modelo:'SYN',serie:'SYN-'+i,estado:'activo',fechaVenc:'2027-11-04'};
  related.gastos[key]={fecha:base.fecha,tipo:'Variable',categoria:'Materiales',descripcion:base.descripcion,monto:100,montoPagado:0,estado:'pendiente',esFijoBase:false};
  related.proveedores[key]={nombre:'Proveedor sintetico '+i,activo:true,observaciones:base.descripcion};
  related.presupuestos[key]={...base,id:'P-SYN-'+i,estado:'pendiente',total:100,subtotal:100,iva:0,conIva:false,items:[{cod:'P-0',productoFbKey:'p0',desc:'Producto sintetico',qty:1,punit:100,sub:100}]};
 }
 if(Buffer.byteLength(JSON.stringify(related))>config.estimatedRelatedJsonBytes)throw Error('Actual related JSON exceeds conservative estimate; stopped before boot/browser');
 // Reuse exact full-HTML helper; private in-memory extension, no shared source writes.
 const original=path.join(root,'test/fixtures/commercial-full-app.cjs');let source=fs.readFileSync(original,'utf8');
 source=replaceOnce(source,"Object.assign(fixtureRoot,${JSON.stringify(backend.state)});fixtureRoot.sisventas.ventas=${JSON.stringify(sales)};fixtureRoot.sisventas.productos=${JSON.stringify(products)};__moduleAuditSourceControl.hold(['productos','empleados']);","/* Private minimal seed: actual SDK reads and listeners use fixture-read; do not embed originals/indexes or artificially hold sources. */");
 source=replaceOnce(source,"const built=await Model.build({sales,payments,owner:()=> 'fixture',generation:'fixture-full-html-generation'}),data={};","const built={patch:{}},data={};");
 source=replaceOnce(source,'const built={patch:{}},data={};',"Object.assign(products,globalThis.__perfRelated.productos);const built={patch:{}},data={};");
 source=replaceOnce(source,'createCoordinatedBackend({ventas:sales',"createCoordinatedBackend({...globalThis.__perfRelated,ventas:sales");
 source=replaceOnce(source,"clientes:{c:{id:'c',nombre:'Cliente ficticio'}}", "clientes:globalThis.__perfRelated.clientes");
 source=replaceOnce(source,'if(!allowed.has(name))',"if(name.startsWith('synthetic-photo/')){const id=Number(name.match(/(\\d+)\\.png$/)?.[1]);if(!Number.isInteger(id)||id<0||id>=globalThis.__perfConfig.photoCount)return res.writeHead(404).end();res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','public,max-age=3600');return res.end(globalThis.__perfImage(id));}if(!allowed.has(name))");
 globalThis.__perfRelated=related;globalThis.__perfConfig=config;globalThis.__perfImage=image;
 const compiled=new Module(original,module);compiled.filename=original;compiled.paths=Module._nodeModulePaths(path.dirname(original));compiled._compile(source,original);

 const {chromium}=require('playwright'),results=[];let browser;
 const runtime={node:process.version,execArgv:process.execArgv,gcAvailable:typeof global.gc==='function',heapSizeLimitBytes:require('node:v8').getHeapStatistics().heap_size_limit,requestedChrome:options.chrome||null};
 try{
  browser=await chromium.launch({headless:true,...(options.chrome?{executablePath:options.chrome}:{})});runtime.browserVersion=browser.version();runtime.browserExecutable=options.chrome?fs.realpathSync(options.chrome):chromium.executablePath();
  for(let rep=0;rep<config.repetitions;rep++){
   let local,context,page,cdp,before,baseWeights;const errors=[],network=[],pending=[],steps=[],memorySamples=[],requestAudit=[];let phase='setup',cleaning=false;
   try{
    if(global.gc)global.gc();local=await compiled.exports.start({count:config.sales,historicalCount:20,paymentAmount:400});before=JSON.stringify(local.backend.state.sisventas);
    baseWeights={originalJsonBytes:Buffer.byteLength(before),backendStateJsonBytes:Buffer.byteLength(JSON.stringify(local.backend.state))};assert(baseWeights.backendStateJsonBytes<=128*1024**2,'Prepared JSON exceeds128MiB');
    if(global.gc)global.gc();memorySamples.push({phase:'post-prepare',node:process.memoryUsage(),osFreeBytes:require('node:os').freemem()});
    if(process.memoryUsage().rss>1024**3||require('node:os').freemem()<3*1024**3)throw Error('Preboot memory budget exceeded');
    for(const [domain,records]of Object.entries(related))assert.equal(Object.keys(local.backend.state.sisventas[domain]).length,Object.keys(records).length);
    assert.equal(local.backend.get('sv_commercial_pages/v1/coverage').sales,config.sales);assert.equal(local.backend.get('sv_commercial_pages/v1/coverage').payments,config.payments);
    for(const domain of ['presupuestos','ordenes_trabajo','reclamos','equipos'])assert.equal(Object.keys(local.backend.get('sv_client_history/v1/sources/'+domain)||{}).length,config.relatedPerDomain);
    context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});page=await context.newPage();cdp=await context.newCDPSession(page);
    const allowedOrigin=new URL(local.url).origin;assert.equal(new URL(allowedOrigin).hostname,'127.0.0.1');
    cdp.on('Fetch.requestPaused',event=>{const task=(async()=>{const target=new URL(event.request.url),allowed=allowedNetworkUrl(event.request.url,allowedOrigin);requestAudit.push({phase,origin:target.origin,path:target.pathname,allowed});if(!allowed){errors.push('Blocked external HTTP(S) origin: '+target.origin);await cdp.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'});}else await cdp.send('Fetch.continueRequest',{requestId:event.requestId});})();pending.push(task);task.catch(error=>{if(!cleaning)errors.push('Request interception: '+error.message);});});
    await cdp.send('Fetch.enable',{patterns:[{urlPattern:'http://*',requestStage:'Request'},{urlPattern:'https://*',requestStage:'Request'}]});
    await cdp.send('Performance.enable');await cdp.send('Network.enable');runtime.chromeProtocol=await cdp.send('Browser.getVersion');
    const rules=[{urlPattern:local.url+'/fixture-bootstrap.js',latency:0,downloadThroughput:-1,uploadThroughput:-1},{urlPattern:'*',latency:config.latencyMs,downloadThroughput:config.downloadBytesPerSec,uploadThroughput:config.uploadBytesPerSec}];
    await cdp.send('Network.emulateNetworkConditionsByRule',{offline:false,matchedNetworkConditions:rules});config.bootstrapTransportUnthrottled=true;
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:config.cpuRate});runtime.applied={cpuThrottleRate:config.cpuRate,latencyMs:config.latencyMs,downloadBytesPerSec:config.downloadBytesPerSec,uploadBytesPerSec:config.uploadBytesPerSec,bootstrapTransportExempt:true,exactHttpOriginAllowlist:true};
    const cachedRequests=new Set();cdp.on('Network.requestServedFromCache',event=>cachedRequests.add(event.requestId));
    cdp.on('Network.responseReceived',event=>network.push({phase,url:event.response.url.startsWith('data:')?'<embedded-image>':event.response.url,status:event.response.status,fromDiskCache:!!event.response.fromDiskCache,fromMemoryCache:cachedRequests.has(event.requestId),fromServiceWorker:!!event.response.fromServiceWorker,requestId:event.requestId}));
    cdp.on('Network.loadingFinished',e=>{const row=network.findLast(r=>r.requestId===e.requestId);if(row)row.encodedDataLength=e.encodedDataLength;});page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{const url=new URL(r.url());errors.push(url.origin+url.pathname+': '+r.failure()?.errorText);});
    page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);
async function step(name,action,ready){phase=name;local.setPhase(name);const t=performance.now();await action();await page.waitForFunction(ready,null,{timeout:90000});steps.push({name,readyMs:performance.now()-t});if(global.gc)global.gc();memorySamples.push({phase:name,node:process.memoryUsage(),osFreeBytes:require('node:os').freemem(),chrome:(await cdp.send('Performance.getMetrics')).metrics.filter(m=>['JSHeapUsedSize','JSHeapTotalSize','Nodes'].includes(m.name))});if(process.memoryUsage().rss>1024*1024*1024||require('node:os').freemem()<3*1024*1024*1024)throw Error('Node RSS exceeds fixture budget1GiB; stopping scenario');console.log(JSON.stringify({rep,phase:name,readyMs:steps.at(-1).readyMs}));}

for(const temp of ['cold','warm']){await step(temp+'-open',()=>page.goto(local.url),()=>document.querySelectorAll('#ventas-tbody tr').length===50&&SVDataReadiness.statusFor('detalle').ready);
   await step(temp+'-search',()=>page.locator('#ventas-search').fill('Antigua'),()=>document.querySelectorAll('#ventas-tbody tr').length===20);await page.locator('#ventas-search').fill('');await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===50);
   await step(temp+'-dashboard',()=>page.evaluate(()=>showPage('dashboard')),()=>SVDataReadiness.statusFor('dashboard').ready&&SVCommercialPagesHost.financialState()?.recent.length===5);
   assert.equal(await page.evaluate(()=>SVCommercialPagesHost.financialState().debtCents),local.fixture.expectedDebtCents);await step(temp+'-collections',()=>page.evaluate(()=>showPage('cobranzas')),()=>SVDataReadiness.statusFor('cobranzas').ready&&document.querySelectorAll('#pagos-tbody tr').length===50);
   await step(temp+'-detail-source-readiness',()=>page.evaluate(()=>{__moduleAuditSourceControl.release('productos');__moduleAuditSourceControl.release('empleados');fbCargarProductos();fbCargarEmpleados();}),()=>SVDataReadiness.status(['productos','empleados']).ready);await step(temp+'-detail',async()=>{await page.evaluate(()=>showPage('detalle'));await page.locator('#ventas-tbody tr').first().click();},()=>document.querySelectorAll('#venta-detalle-view tr[data-venta-item-index]').length===16);
   phase=temp+'-photos-scroll-decode';local.setPhase(phase);const decodeStart=performance.now();const imgs=page.locator('#venta-detalle-view tr[data-venta-item-index] img');assert.equal(await imgs.count(),16);const initialImages=await imgs.evaluateAll(nodes=>nodes.map(n=>({loading:n.loading,complete:n.complete,naturalWidth:n.naturalWidth,sourceKind:(n.currentSrc||n.src).startsWith('data:')?'embedded':'URL',sourceCharacters:(n.currentSrc||n.src).length})));for(const img of await imgs.all())await img.scrollIntoViewIfNeeded();await page.waitForFunction(width=>{const nodes=Array.from(document.querySelectorAll('#venta-detalle-view tr[data-venta-item-index] img'));return nodes.length===16&&nodes.every(n=>n.complete&&n.naturalWidth===width);},config.width);steps.push({name:phase,readyMs:performance.now()-decodeStart,images:await imgs.evaluateAll(nodes=>nodes.map(n=>({loading:n.loading,width:n.naturalWidth,height:n.naturalHeight,complete:n.complete})))});
   phase=temp+'-native-photo-viewer';const photoStart=performance.now();const viewer=await page.evaluate(url=>{if(typeof otAbrirFoto!=='function')return{supported:false};otAbrirFoto(url,'Imagen sintetica de rendimiento');return{supported:true};},photo(0));assert.equal(viewer.supported,true);await page.waitForFunction(()=>{const img=document.getElementById('ot-foto-ampliada');return img?.complete&&img.naturalWidth>0&&document.getElementById('modal-ver-foto-ot').style.display==='flex';});await page.waitForLoadState('networkidle');steps.push({name:phase,readyMs:performance.now()-photoStart,entry:'native viewer API; not an end-to-end gallery navigation assertion',viewer,initialImages});}
   if(local.backend.commands.length||local.backend.commits.length||JSON.stringify(local.backend.state.sisventas)!==before)throw Error('Read-only invariant violated');

   }catch(error){errors.push(error.stack||error.message);}
   finally{
    cleaning=true;await cleanupRun({context,server:local?.server,pending},errors);
    const readonly=!!local&&JSON.stringify(local.backend.state.sisventas)===before&&local.backend.commands.length===0&&local.backend.commits.length===0;
    results.push({rep,baseWeights,ok:errors.length===0&&steps.length===16&&readonly,memorySamples,steps,errors,network,requestAudit,httpPayload:local?.measures||[],relatedJsonBytes:Buffer.byteLength(JSON.stringify(related)),domainSizes:Object.fromEntries(Object.entries(related).map(([k,v])=>[k,{count:Object.keys(v).length,jsonBytes:Buffer.byteLength(JSON.stringify(v))}])),actualPhotoBytes:image(0).length,readonly});
    fs.writeFileSync(path.join(options.outputDir,'results-'+config.preset+'-'+config.photoStorage+'.private.json'),JSON.stringify({config,runtime,manifest:{commit:config.commit,helperSha256:sha256(fs.readFileSync(original)),appSha256:sha256(fs.readFileSync(path.join(root,'js',require(path.join(root,'test/helpers/active-app.js')).readActiveApp().filename))),harnessSha256:sha256(fs.readFileSync(__filename)),uiCoreSha256:'3619ea6c21cda659fe45f38c4ee1432b3b46d72cd685f99057470f4ea0461cf0'},limits:'Synthetic scenario, not a production clone. Unknown hoteles meaning/real cardinalities. Harness startup includes fake setup; not real production latency. Warm means same-context reload, not SW. Only sixteen product photos visited; native photo viewer API, not full gallery navigation. GC/heap/browser/Node conditions explicitly recorded; timings include automation scrolling. All HTTP(S) requests restricted to the exact fixture origin.',results},null,2));
   }
   if(errors.length)break;
  }
 }finally{await browser?.close();}
 if(results.length!==config.repetitions||results.some(r=>!r.ok))process.exitCode=1;
}
module.exports={parseArguments,reserveOutputDirectory,verifyCheckout,validateOutputLocation,allowedNetworkUrl,cleanupRun};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
