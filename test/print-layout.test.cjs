'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const layout = require('../js/core/print-layout.v1');
function complete(pages, height) { assert.equal(pages[0].start, 0); assert.equal(pages.at(-1).end, height); for(let i=1;i<pages.length;i++) assert.equal(pages[i].start,pages[i-1].end); }
test('short document remains one page and natural trailing content is retained', () => {
  const pages=layout.plan(900,1100);assert.equal(pages.length,1);complete(pages,900);
});
test('a row fitting a page moves intact and table headers repeat only on continuations', () => {
  const pages=layout.plan(3400,1000,{atoms:[{top:900,bottom:1080}],tables:[{top:100,headBottom:130,bottom:2200}]});
  assert.equal(pages[0].end,900);assert.deepEqual(pages[1].repeat,{top:100,bottom:130});assert.equal(pages.at(-1).repeat,null);complete(pages,3400);
});
test('oversized row falls back to complete text lines and makes progress', () => {
  const lines=Array.from({length:150},(_,n)=>({top:n*18,bottom:n*18+16}));
  const pages=layout.plan(2700,1000,{atoms:[{top:0,bottom:2700}],lines});complete(pages,2700);
  for(const page of pages.slice(0,-1))assert.ok(!lines.some(l=>l.top<page.end-0.5&&l.bottom>page.end+0.5));
});
test('explicit page breaks add no leading or trailing blank sheet',()=>{
  const pages=layout.plan(1800,1000,{forced:[0,800,1800]});assert.deepEqual(pages.map(p=>[p.start,p.end]),[[0,800],[800,1800]]);
});
test('overlapping blocks and text line constraints cannot leave source gaps',()=>{
 const pages=layout.plan(2500,1000,{atoms:[{top:950,bottom:1100},{top:900,bottom:980}],lines:[{top:890,bottom:910}]});assert.equal(pages[0].end,890);complete(pages,2500);
});
test('injected source installs the same API without imports, endpoints or schedulers',()=>{
 const context={};vm.runInNewContext(layout.source(),context);assert.equal(typeof context.SVPrintLayout.pdf,'function');assert.equal(context.SVPrintLayout.plan(20,100).length,1);assert.doesNotMatch(layout.source(),/fetch\(|XMLHttpRequest|setInterval|https?:\/\//);
});
test('invalid dimensions fail clearly rather than exporting an empty PDF',()=>{for(const args of [[0,10],[20,0],[20,2]])assert.throws(()=>layout.plan(...args));});
test('a fractional trailing pixel is retained and is not removed as an empty page',()=>{complete(layout.plan(1000.1,1000),1000.1);});

function resourceFixture(images=[],fonts){
 const doc={defaultView:{setTimeout,clearTimeout},fonts,querySelectorAll:()=>images};
 return{nodeType:9,...doc};
}
test('ready waits for both fonts and decoded images before allowing a capture',async()=>{
 let fontDone,imageDone,settled=false;const font=new Promise(resolve=>{fontDone=resolve;}),image=new Promise(resolve=>{imageDone=resolve;});
 const task=layout.ready(resourceFixture([{naturalWidth:20,decode:()=>image}],{ready:font})).then(()=>{settled=true;});
 await Promise.resolve();fontDone();await Promise.resolve();assert.equal(settled,false);imageDone();await task;assert.equal(settled,true);
});
test('missing, undecodable and still-pending images reject instead of producing an incomplete PDF',async()=>{
 for(const image of [{complete:true,naturalWidth:0},{naturalWidth:0,decode:async()=>{}},{naturalWidth:20,decode:async()=>{throw Error('decode');}}])await assert.rejects(layout.ready(resourceFixture([image]),{timeoutMs:10}));
 await assert.rejects(layout.ready(resourceFixture([{decode:()=>new Promise(()=>{})}]),{timeoutMs:5}),/sin cargar/);
});
test('ready releases event listeners after success, failure and timeout so retries are independent',async()=>{
 for(const outcome of ['load','error','timeout']){
  const handlers=new Map(),image={naturalWidth:outcome==='load'?20:0,complete:false,addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:(name,fn)=>{assert.equal(handlers.get(name),fn);handlers.delete(name);}};
  const task=layout.ready(resourceFixture([image]),{timeoutMs:5});
  if(outcome!=='timeout')handlers.get(outcome)();
  if(outcome==='load')await task;else await assert.rejects(task);
  assert.equal(handlers.size,0);
 }
});
test('a closed print view never becomes ready even if its resources complete',async()=>{
 const fixture=resourceFixture();fixture.defaultView.closed=true;await assert.rejects(layout.ready(fixture),/cerró/);
});
test('removing a child frame cannot discard the caller timeout and leave ready pending forever',async()=>{
 const fixture=resourceFixture([{decode:()=>new Promise(()=>{})}]);fixture.defaultView.setTimeout=()=>{throw Error('Child clock is already gone');};fixture.defaultView.clearTimeout=()=>assert.fail('No child timer should be created');
 await assert.rejects(layout.ready(fixture,{timeoutMs:5}),/sin cargar/);
});
test('native printing releases only oversized indivisible blocks and removes its measurement probe',()=>{
 let removed=0;const classes=new Set(),small=new Set(['sv-print-allow-split']);
 const node=(height,set)=>({getBoundingClientRect:()=>({height}),classList:{contains:name=>set.has(name),toggle:(name,on)=>on?set.add(name):set.delete(name)}});
 const doc={defaultView:{getComputedStyle:()=>({breakInside:'avoid'})},createElement:()=>({style:{},getBoundingClientRect:()=>({height:986}),remove:()=>removed++}),body:{appendChild(){},querySelectorAll:()=>[node(1600,classes),node(120,small)]}};
 layout.native(doc);assert.ok(classes.has('sv-print-allow-split'));assert.ok(!small.has('sv-print-allow-split'));assert.equal(removed,1);
});
