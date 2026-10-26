'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
function fixture(){
 let handler,error;const calls=[],constructors={},db={ref:()=>assert.fail('No database IO')},publicTransport={projectRecord:()=>assert.fail('Projection belongs to the service')};
 const service={authorize:async(req,domain,view)=>{calls.push({kind:'authorize',domain,view});if(error)throw error;return {uid:'fixture',domain};}};
 for(const name of ['list','detail','options','prepare','assign'])service[name]=async(actor,input)=>{calls.push({kind:name,actor,input});return {record:{id:'SAFE-RECORD'}};};
 const runtime={db,guard:{},store:{},run:async(actor,operation,body,work)=>{calls.push({kind:'guard',actor,operation,body});return work();}};
 function isolatedRequire(name){
  if(name==='http')return{createServer:fn=>{handler=fn;return{listen:()=>assert.fail('No sockets')};}};
  if(name==='crypto')return require('node:crypto');
  if(name==='firebase-admin')return {apps:[{}],database:()=>db};
  if(name==='./labor-runtime')return{createLaborRuntime:options=>{assert.equal(options.commercialProtocol,true);constructors.runtime=options;return runtime;}};
  if(name==='./commercial-public-transport')return{createCommercialPublicTransport:options=>{assert.equal(options.guard,runtime.guard);assert.equal(options.store,runtime.store);assert.equal(options.db,db);return publicTransport;}};
  if(name==='./commercial-ownership')return{createCommercialOwnership:options=>{assert.equal(options.commercialProtocol,true);assert.equal(options.publicTransport,publicTransport);return service;}};
  if(name==='./payment-commands')return{createPaymentCommands:options=>{assert.equal(options.commercialProtocol,true);constructors.payment=options;return {};}};
  if(name==='./commercial-response')return{sendCommercial:async(_req,res,data)=>{res.writeHead(200);res.end(JSON.stringify(data));}};
  if(name.startsWith('./'))return new Proxy({},{get(_t,key){if(key==='crearCache'||String(key).startsWith('create'))return()=>({});return()=>assert.fail('Unrelated operation '+name+'.'+String(key));}});
  assert.fail('No native dependency '+name);
 }
 vm.runInNewContext(fs.readFileSync('cotizador/index.js','utf8'),{require:isolatedRequire,module:{exports:{}},process:{env:{}},console:{log(){},warn(){},error(){}},Buffer,URL,URLSearchParams,AbortSignal,AbortController,setTimeout,clearTimeout,setInterval:()=>assert.fail('No polling'),clearInterval,fetch:()=>assert.fail('No external network')});
 async function request(path,method='GET',body={recordKey:'fixture'}){const req=new EventEmitter();req.url='/comerciales/'+path;req.method=method;req.headers={};req.destroy=()=>{};let status,data;const headers={},res={setHeader:(k,v)=>headers[k]=v,writeHead:s=>status=s,end:v=>data=v===undefined?undefined:JSON.parse(v)};const promise=handler(req,res);if(method==='POST')setImmediate(()=>{req.emit('data',Buffer.from(JSON.stringify(body)));req.emit('end');});await promise;return {status,data,headers};}
 return {request,calls,constructors,error:value=>error=value};
}
for(const domain of ['ventas','presupuestos']){
 test(domain+' point detail preserves encoded key and authorized view without a guard write',async()=>{const f=fixture(),r=await f.request(domain+'/detalle/antiguo%20%C3%B1?verComo=selected');assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(r.headers.Vary,'Authorization, Origin');assert.equal(r.headers['X-Content-Type-Options'],'nosniff');assert.deepEqual(f.calls.map(c=>c.kind),['authorize','detail']);assert.equal(f.calls[0].domain,domain);assert.equal(f.calls[0].view,'selected');assert.equal(f.calls[1].input,'antiguo ñ');});
 for(const [action,method]of [['preparar','prepare'],['reasignar','assign']])test(domain+' '+action+' stays inside the protected USER runtime',async()=>{const f=fixture(),body={recordKey:'fixture',revision:3},r=await f.request(domain+'/'+action,'POST',body);assert.equal(r.status,200);assert.deepEqual(f.calls.map(c=>c.kind),['authorize','guard',method]);assert.equal(f.calls[1].operation,'commercial-'+method);assert.equal(JSON.stringify(f.calls[1].body),JSON.stringify(body));});
 for(const [suffix,method,status]of [['/detalle/a','POST',405],['/detalle/a','PUT',405],['/preparar','GET',405],['/reasignar','GET',405],['/opciones','POST',405],['','POST',405],['/detalle/%ZZ','GET',400],['/detalle','GET',404],['/detalle/a/b','GET',404],['/detalle/a','OPTIONS',204]])test(domain+suffix+' '+method+' rejects before any authority/data call',async()=>{const f=fixture(),r=await f.request(domain+suffix,method);assert.equal(r.status,status);if(method==='OPTIONS')assert.equal(r.data,undefined);else assert.equal(r.headers['Cache-Control'],'private, no-store');assert.deepEqual(f.calls,[]);});
 test(domain+' detail does not turn auth failure into a raw fallback',async()=>{const f=fixture();f.error(Object.assign(Error('Sesión requerida'),{statusCode:401}));const r=await f.request(domain+'/detalle/a');assert.equal(r.status,401);assert.deepEqual(f.calls.map(c=>c.kind),['authorize']);assert.equal(r.data.record,undefined);});
}
test('unknown commercial failure returns no private exception body',async()=>{const f=fixture();f.error(Error('COST_AND_PERCENT_CANARY'));const r=await f.request('ventas/detalle/a');assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(r),/COST_AND_PERCENT_CANARY/);});
