'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{scan}=require('../cotizador/purchase-current-pending-scan'),{digest}=require('../cotizador/labor-guard'),{compareKey}=require('../cotizador/office-stock-order');
const ORDERS='sisventas/ordenes',LEGACY='sisventas/ordenes_compra',REVIEW='SV_PURCHASE_CURRENT_PENDING_SCAN_REVIEW';
const clone=value=>structuredClone(value),row=id=>({numero:'OC-'+id,items:[{productoKey:'p',cantidadOrdenada:1.25,cantidadRecibida:0}],unknown:{preserve:true}});
function rows(count){return Object.fromEntries(Array.from({length:count},(_,i)=>{const key='k'+String(i).padStart(4,'0');return [key,row(key)];}));}
function port(orders=null,legacy=null){
 const data={[ORDERS]:orders,[LEGACY]:legacy},calls=[];
 const query=async(path,options)=>{
  assert.ok([ORDERS,LEGACY].includes(path));assert.deepEqual(Object.keys(options).sort(),['limitToFirst','orderBy',...(Object.hasOwn(options,'startAt')?['startAt']:[])].sort());assert.equal(options.orderBy,'$key');assert.equal(options.limitToFirst,129);
  const source=data[path];if(source===null){calls.push({path,options:{...options},raw:null});return null;}
  const keys=Object.keys(source).sort(compareKey).filter(key=>options.startAt===undefined||compareKey(key,options.startAt)>=0).slice(0,129);
  // RTDB returns JSON maps, not an ordered row array. Reverse insertion order
  // intentionally; integer-property enumeration is not the RTDB comparator.
  const raw=Object.fromEntries([...keys].reverse().map(key=>[key,clone(source[key])]));calls.push({path,options:{...options},raw:clone(raw)});return raw;
 };
 return {data,calls,query};
}
async function review(query,options){await assert.rejects(scan(query,options),{code:REVIEW,statusCode:409,svLaborAttempted:false});}

test('null roots are empty, each raw null page is hashed, and only the two exact roots are queried',async()=>{
 const f=port(),result=await scan(f.query,{maxPages:2});assert.deepEqual(result,{sources:{orders:{},legacyOrders:{}},pages:[{path:ORDERS,options:{orderBy:'$key',limitToFirst:129},hash:digest(null)},{path:LEGACY,options:{orderBy:'$key',limitToFirst:129},hash:digest(null)}],eof:true});assert.equal(f.calls.length,2);
});
test('empty JSON maps also terminate but retain a different raw-page hash from null',async()=>{
 const f=port({},{}),result=await scan(f.query);assert.deepEqual(result.sources,{orders:{},legacyOrders:{}});assert.ok(result.pages.every(page=>page.hash===digest({})));assert.notEqual(digest({}),digest(null));
});
for(const count of [1,127,128,129,255,256,257,384,1024])test('complete enumeration of '+count+' records, inclusive cursors and preserved raw page evidence',async()=>{
 const source=rows(count),legacy={legacy_header:{migradaA:'old',unknown:['keep',false,0]}},f=port(source,legacy),result=await scan(f.query);
 assert.equal(result.eof,true);assert.deepEqual(result.sources,{orders:source,legacyOrders:legacy});assert.equal(Object.keys(result.sources.orders).length,count);assert.equal(result.pages.length,f.calls.length);
 for(let i=0;i<f.calls.length;i++){assert.equal(result.pages[i].path,f.calls[i].path);assert.deepEqual(result.pages[i].options,f.calls[i].options);assert.equal(result.pages[i].hash,digest(f.calls[i].raw));}
 const calls=f.calls.filter(call=>call.path===ORDERS);assert.equal(calls.length,count<=128?1:Math.floor((count-128)/128)+2);for(let i=1;i<calls.length;i++)assert.ok(calls[i].raw[calls[i].options.startAt]);
});

test('256 orders require the final cursor-only EOF page; exact global page budget includes legacy root',async()=>{
 const f=port(rows(256)),result=await scan(f.query,{maxPages:4});assert.equal(result.pages.length,4);assert.equal(f.calls[1].options.startAt,'k0127');assert.equal(f.calls[2].options.startAt,'k0255');assert.deepEqual(Object.keys(f.calls[2].raw),['k0255']);assert.equal(result.sources.orders.k0255.numero,'OC-k0255');
 const limited=port(rows(256));await review(limited.query,{maxPages:3});assert.equal(limited.calls.length,3);assert.ok(limited.calls.every(call=>call.path===ORDERS));
 const exact=port(rows(128));assert.equal((await scan(exact.query,{maxPages:2})).pages.length,2);const tooSmall=port();await review(tooSmall.query,{maxPages:1});assert.equal(tooSmall.calls.length,1);
});

test('RTDB integer keys through 2147483647 precede UTF16 string keys, including noncanonical numeric strings',async()=>{
 const keys=[...Array.from({length:126},(_,i)=>String(i)),'2147483647','-1','01','2147483648','A'],source=Object.fromEntries(keys.map(key=>[key,row(key)])),f=port(source),result=await scan(f.query);
 assert.deepEqual(result.sources.orders,source);assert.equal(f.calls[1].options.startAt,'-1');assert.deepEqual(Object.keys(source).sort(compareKey),keys);assert.equal(result.pages.length,3);
});

test('sources are isolated raw copies, without filtering received, cancelled, linked or legacy header orders',async()=>{
 const source={cancelled:{estado:'cancelada',arbitrary:1},received:{estado:'recibida',items:[]},linked:{ventaFbKey:'sale',items:[{costoUnitario:1.234567}]}},f=port(source,{legacy:{migradaA:'linked'}}),result=await scan(f.query);source.linked.items[0].costoUnitario=999;assert.equal(result.sources.orders.linked.items[0].costoUnitario,1.234567);result.sources.orders.cancelled.arbitrary=2;assert.equal(source.cancelled.arbitrary,1);assert.equal(result.sources.legacyOrders.legacy.migradaA,'linked');
});

test('external fresh rescan detects a phantom inserted beyond the previously captured EOF cursor',async()=>{
 const f=port(rows(256)),before=await scan(f.query);f.data[ORDERS].zz_phantom=row('phantom');const after=await scan(f.query);assert.equal(before.eof,true);assert.equal(after.eof,true);assert.notDeepEqual(before.pages,after.pages);assert.notEqual(before.pages[2].hash,after.pages[2].hash);assert.equal(Object.keys(before.sources.orders).length,256);assert.equal(Object.keys(after.sources.orders).length,257);
});
test('fresh scan detects null->object and changes to existing records, not merely key counts',async()=>{
 const f=port(null,{}),empty=await scan(f.query);f.data[ORDERS]={new:row('new')};const first=await scan(f.query);f.data[ORDERS].new.items[0].cantidadOrdenada=2;const changed=await scan(f.query);assert.notEqual(empty.pages[0].hash,first.pages[0].hash);assert.notEqual(first.pages[0].hash,changed.pages[0].hash);assert.equal(Object.keys(first.sources.orders).length,Object.keys(changed.sources.orders).length);
});

for(const raw of [undefined,[],[row('x')],false,0,'source',new Map(),new Date(),{bad:null},{bad:undefined},{bad:[]},{bad:1},{bad:{x:undefined}},{bad:{x:NaN}},{bad:{x:()=>{}}}])test('invalid raw page/source requires REVIEW: '+String(raw?.constructor?.name??typeof raw),async()=>{await review(async()=>raw);});
for(const key of ['__proto__','constructor','prototype','a/b','a.b','a b','ñ','a'.repeat(129),''])test('unsafe source key requires REVIEW: '+JSON.stringify(key.slice(0,20)),async()=>{await review(async()=>Object.fromEntries([[key,row(key)]]));});
test('oversized, cyclic, computed or symbol-bearing raw pages are rejected, not normalized',async()=>{
 await review(async()=>rows(130));const cyclic={};cyclic.self=cyclic;await review(async()=>({a:cyclic}));const computed={};Object.defineProperty(computed,'a',{enumerable:true,get:()=>row('a')});await review(async()=>computed);const symbol={a:row('a')};symbol[Symbol('extra')]=1;await review(async()=>symbol);
});
for(const bad of [0,-1,1.5,NaN,Infinity,'3',null])test('invalid explicit maxPages fails before reading: '+String(bad),async()=>{let calls=0;await review(async()=>{calls++;return null;},{maxPages:bad});assert.equal(calls,0);});
test('no arbitrary roots, filters, cursor, or limits can be injected via scanner options',async()=>{
 for(const options of [{path:'admin'},{equalTo:'x'},{endAt:'z'},{startAt:'x'},{orderBy:'child'},{limitToFirst:999},null,[]]){let calls=0;await review(async()=>{calls++;return null;},options);assert.equal(calls,0);}await review(null);
});

for(const mode of ['repeat','missingCursor','regression','missingLookahead','cursorChanged','lookaheadChanged','emptyContinuation'])test('bad continuation '+mode+' requires REVIEW without claiming EOF',async()=>{
 const source=rows(129),f=port(source);let n=0;const query=async(path,options)=>{
  if(path!==ORDERS)return f.query(path,options);n++;if(n===1)return f.query(path,options);
  if(mode==='repeat')return Object.fromEntries(Object.entries(source));
  if(mode==='missingCursor')return {k0128:row('k0128')};
  if(mode==='regression')return {k0000:row('k0000'),k0127:row('k0127'),k0128:row('k0128')};
  if(mode==='missingLookahead')return {k0127:row('k0127')};
  if(mode==='emptyContinuation')return null;
  return {k0127:mode==='cursorChanged'?{...row('k0127'),changed:true}:row('k0127'),k0128:mode==='lookaheadChanged'?{...row('k0128'),changed:true}:row('k0128')};
 };await review(query);assert.equal(n,2);
});
test('port read rejection propagates without retry, alternate roots, or partial successful result',async()=>{
 const error=Object.assign(Error('Synthetic read denial'),{code:'PERMISSION_DENIED'}),calls=[];await assert.rejects(scan(async(path,options)=>{calls.push({path,options});throw error;}),caught=>caught===error);assert.equal(calls.length,1);assert.equal(calls[0].path,ORDERS);
});

test('omitted and explicit undefined maxPages use the default complete two-root scan',async()=>{for(const options of [undefined,{maxPages:undefined}]){const f=port(),result=await scan(f.query,options);assert.equal(result.eof,true);assert.equal(result.pages.length,2);assert.equal(f.calls.length,2);}});

test('both roots paginate independently and a legacy EOF phantom changes fresh raw evidence',async()=>{
 const orders=rows(130),legacy=Object.fromEntries(Object.entries(rows(260)).map(([key,value])=>['legacy_'+key,value])),f=port(orders,legacy),before=await scan(f.query,{maxPages:5});
 assert.deepEqual(before.sources,{orders,legacyOrders:legacy});assert.equal(before.pages.length,5);assert.equal(f.calls.filter(call=>call.path===ORDERS).length,2);const oldCalls=f.calls.filter(call=>call.path===LEGACY);assert.equal(oldCalls.length,3);assert.equal(Object.hasOwn(oldCalls[0].options,'startAt'),false);
 f.data[LEGACY].zz_phantom={migradaA:'old-link'};const after=await scan(f.query,{maxPages:5});assert.notEqual(before.pages.at(-1).hash,after.pages.at(-1).hash);assert.equal(after.sources.legacyOrders.zz_phantom.migradaA,'old-link');
});
test('undefined legacy root is not silently accepted as an empty source',async()=>{const paths=[];await review(async path=>{paths.push(path);return path===ORDERS?null:undefined;});assert.deepEqual(paths,[ORDERS,LEGACY]);});
