'use strict';
// Synthetic transport timing, never a production latency measurement.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{createRequire}=require('node:module'),{AsyncLocalStorage}=require('node:async_hooks'),{performance}=require('node:perf_hooks');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),clone=v=>structuredClone(v),bytes=v=>Buffer.byteLength(JSON.stringify(v??null));
async function measure({serverRoot=path.resolve(__dirname,'../cotizador'),rttMs=175,richAliases=false,mutate}={}){
 if(!Number.isFinite(rttMs)||rttMs<0||rttMs>1000)throw Error('RTT must be between 0 and 1000 ms');
 const at=createRequire(path.join(serverRoot,'index.js')),Index=at('./payment-membership-index'),Matcher=at('./payment-membership-matcher'),Policy=at('./domain-read-policy'),Ownership=at('./commercial-ownership');
 const sale={id:'V-001',responsableUid:'fixture-user',total:100,totalPagado:40,pagos:[],...(richAliases?{idOriginal:'OR-002',numeroOriginal:'NUM-003',ventaIdOriginal:'SALE-004'}:{})};
 const root={sv_access_resets:{'fixture-user':{required:false,version:'fixture-v1'}},sv_chat_roles:{'fixture-user':{rol:'vendedor',activo:true}},sv_usuarios:{profile:{uid:'fixture-user',nombre:'Fixture user',rol:'vendedor',activo:true}},sv_permisos:{vendedor:{indiceVersion:2,indiceRevision:1,indiceModulos:{venta:true,detalle:true,cobranzas:true},acciones:{}}},sisventas:{ventas:{sale},pagos:{payment:{ventaFbKey:'sale',monto:40,fecha:'2026-11-26',medio:'Efectivo'}}}};
 const put=(p,v)=>{const ks=p.split('/');let n=root;for(const k of ks.slice(0,-1))n=n[k]??={};n[ks.at(-1)]=clone(v);},get=p=>clone(p.split('/').reduce((v,k)=>v?.[k],root)??null);
 for(const [p,v]of Object.entries(Index.buildIndex(root.sisventas.pagos,{generation:'measure-fixture-v1',ready:true}).patch))put(p,v);
 const original=JSON.stringify(root),events=[],als=new AsyncLocalStorage();let origin=performance.now(),maxConcurrent=0,inFlight=0,verifications=0,ownership,store,nativeReport;
 const category=p=>p==='verifyIdToken'?'auth':p.startsWith('sv_access_resets/')?'reset':p==='sv_usuarios'?'profile':p.startsWith('sv_chat_roles/')?'role':p.startsWith('sv_permisos/')?'permissions':p===Index.COVERAGE_PATH?'coverage':p.startsWith(Index.INDEX_ROOT+'/')?'membership':p.startsWith('sisventas/pagos/')?'payment':'sale';
 async function external(channel,p,work,requestBytes=0){
  const event={channel,path:p,category:category(p),phase:als.getStore()||'reader',startMs:performance.now()-origin,requestBytes};events.push(event);maxConcurrent=Math.max(maxConcurrent,++inFlight);
  try{if(rttMs)await new Promise(resolve=>setTimeout(resolve,rttMs));const value=await work();event.responseBytes=bytes(value);return value;}finally{inFlight--;event.endMs=performance.now()-origin;event.durationMs=event.endMs-event.startMs;}
 }
 const db={ref:p=>({get:async()=>{const value=await external('admin-point',p,()=>get(p),Buffer.byteLength(p));return{val:()=>value};}})};
 const nativeAuth={verifyIdToken:async(token,revoked)=>external('auth','verifyIdToken',()=>{if(token!=='FIXTURE_ONLY'||revoked!==true)throw Error('Invalid fixture token');verifications++;mutate?.({root,verifications});return{uid:'fixture-user',svAccessVersion:'fixture-v1'};},Buffer.byteLength(token))};
 const businessAuth=at('./user-access').createBusinessAuth(nativeAuth,db);
 store=at('./labor-rtdb-store').createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=synthetic-payment-measure',accessToken:async()=>'FIXTURE_ONLY',fetchImpl:async(url,options)=>{
  if(options.method!=='GET')throw Error('No writes permitted');const u=new URL(url);if(u.origin!=='http://127.0.0.1:1')throw Error('No network permitted');const p=decodeURIComponent(u.pathname).slice(1,-5),override=JSON.parse(u.searchParams.get('auth_variable_override')||'null');
  const value=await external(override?'user-rest':'service-rest',p,()=>{
   const data=get(p);if(override){const identity=get('sv_chat_roles/'+override.uid),cfg=get('sv_permisos/'+identity?.rol),domain=p.split('/')[1];if(override.uid!==override.token.uid||override.token.svAccessVersion!==get('sv_access_resets/'+override.uid)?.version||get('sv_access_resets/'+override.uid)?.required||identity?.activo!==true||!Policy.allows(domain,identity.rol,m=>Ownership.moduleAllowed(identity.rol,m,{[identity.rol]:cfg}),()=>false))throw Object.assign(Error('Fixture user read denied'),{statusCode:403});if(domain==='ventas'&&data?.responsableUid!==override.uid||domain==='pagos'&&!Matcher.belongsToSale(data,{...sale,fbKey:'sale'}))throw Object.assign(Error('Fixture ownership denied'),{statusCode:403});}
   if(u.searchParams.has('orderBy')){const key=JSON.parse(u.searchParams.get('orderBy')),equal=JSON.parse(u.searchParams.get('equalTo'));return Object.fromEntries(Object.entries(data||{}).filter(([,row])=>row?.[key]===equal));}return data;
  },Buffer.byteLength(u.pathname+u.search));return{ok:true,status:200,json:async()=>value};
 }});
 ownership=Ownership.createCommercialOwnership({auth:businessAuth,db,enabled:true,scopedReads:true,queryReader:store.query,readAsUser:(p,a)=>store.readAsUser(p,a)});
 const nativeAuthorize=ownership.authorize,nativeRecords=ownership.readAuthorizedRecordsByIds;let authCalls=0,originalReads=0;
 ownership.authorize=(...args)=>als.run(++authCalls===1?'initial-authorization':'final-authorization',()=>nativeAuthorize(...args));
 ownership.readAuthorizedRecordsByIds=(...args)=>als.run(++originalReads===1?'initial-original':'final-original',()=>nativeRecords(...args));
 const observedReader={create:options=>at('./commercial-sale-payments').create({...options,observe:r=>{nativeReport=r;}})};
 const source=fs.readFileSync(path.join(serverRoot,'index.js'),'utf8').replaceAll('\r\n','\n'),start="  if(pathname.startsWith('/comerciales/')){",end='\n  }\n';
 const begin=source.indexOf(start),finish=source.indexOf(end,begin);if(source.split(start).length!==2||finish<0)throw Error('Literal router anchors changed');const branch=source.slice(begin,finish+end.length);
 if(!branch.includes('/* sale-payment-history-v1 */'))throw Error('Payment history route missing');const sendStart=source.indexOf('function send(res, status, payload) {'),sendEnd=source.indexOf('\nfunction sendHtml(',sendStart);if(sendStart<0||sendEnd<0)throw Error('JSON sender missing');
 const handler=vm.runInNewContext(source.slice(sendStart,sendEnd)+'\n(async function(req,res){const pathname=new URL(req.url,"http://localhost").pathname;'+branch+'})',{URL,commercialOwnership:ownership,laborRuntime:{store},require:name=>name==='./commercial-sale-payments'?observedReader:at(name)});
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);},end(body){this.body=JSON.parse(body);}};
 origin=performance.now();await handler({method:'GET',url:'/comerciales/ventas/registro/sale?para=pagos',headers:{authorization:'Bearer FIXTURE_ONLY'}},response);const elapsedMs=performance.now()-origin;
 const byCategory={},byPhase={};for(const e of events){const c=byCategory[e.category]??={calls:0,requestBytes:0,responseBytes:0,serviceTimeMs:0};c.calls++;c.requestBytes+=e.requestBytes;c.responseBytes+=e.responseBytes||0;c.serviceTimeMs+=e.durationMs;const phase=byPhase[e.phase]??={calls:0,firstStartMs:e.startMs,lastEndMs:0};phase.calls++;phase.lastEndMs=Math.max(phase.lastEndMs,e.endMs);}
 for(const p of Object.values(byPhase))p.spanMs=p.lastEndMs-p.firstStartMs;
 const files=['index.js','commercial-sale-payments.js','commercial-ownership.js','payment-snapshot.js','user-access.js','labor-rtdb-store.js'];
 const bucketCount=Index.queryPaths({...sale,fbKey:'sale'}).length,criticalRounds=4+1+1+Math.ceil(bucketCount/6)+1+Math.ceil((bucketCount+2)/6)+4+1+1;
 return {model:'synthetic-one-RTT-per-external-operation; not production timing',rttMs,richAliases,bucketCount,criticalRounds,idealCriticalMs:criticalRounds*rttMs,elapsedMs,status:response.status,history:response.body.paymentHistory?{source:response.body.paymentHistory.source,paymentCount:response.body.paymentHistory.payments.length,paidAmount:response.body.paymentHistory.paidAmount}:null,unchanged:JSON.stringify(root)===original,writes:0,maxConcurrent,byCategory,byPhase,nativeReport,sourceHashes:Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(serverRoot,f)))])),normalizedSourceHashes:Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(serverRoot,f),'utf8').replaceAll('\r\n','\n'))])),literalBranchSha256:sha(branch),responseBytes:bytes(response.body),events};
}
module.exports={measure};
if(require.main===module)measure({serverRoot:process.env.PAYMENT_MEASURE_SERVER_ROOT||path.resolve(__dirname,'../cotizador'),rttMs:Number(process.env.PAYMENT_MEASURE_RTT_MS||175),richAliases:process.env.PAYMENT_MEASURE_RICH_ALIASES==='true'}).then(report=>{const text=JSON.stringify(report,null,2);if(process.env.PAYMENT_MEASURE_OUTPUT)fs.writeFileSync(process.env.PAYMENT_MEASURE_OUTPUT,text);else console.log(text);}).catch(e=>{console.error(e.message);process.exitCode=1;});
