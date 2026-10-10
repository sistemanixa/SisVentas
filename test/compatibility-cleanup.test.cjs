const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {source}=require('./helpers/active-app').readActiveApp();

test('auxiliares retirados no reaparecen en la aplicación activa',()=>{
 const report=JSON.parse(fs.readFileSync('docs/auditoria-compatibilidades-v3106.json','utf8'));
 for(const item of report.removed_functions){
  const text=item.file.includes('/app.')?source:fs.readFileSync(item.file,'utf8');
  assert.doesNotMatch(text,new RegExp('\\b'+item.name+'\\b'),item.name);
 }
});

test('offline conserva operaciones online, bloqueos offline y reconexión sin consultar el indicador retirado',async()=>{
 const events={},docEvents={},writes=[];
 const navigator={onLine:true};
 const window={addEventListener:(name,fn)=>{(events[name]??=[]).push(fn);},fbRef:()=>{},
  fbSet:async(ref,value)=>{writes.push([ref,value]);return 'saved';},fbUpdate:async()=>{},
  fbRemove:async()=>{},fbPush:()=>{},fbOnValue:()=>{},fbRunTransaction:async()=> 'transaction'};
 const context={window,navigator,location:{search:'?offline_preview=1'},URLSearchParams,
  localStorage:{getItem:()=>null},console,document:{
   addEventListener:(name,fn)=>{docEvents[name]=fn;},
   getElementById:()=>{throw Error('No debe consultar un indicador retirado');},
   dispatchEvent:()=>{}
  }};
 vm.runInNewContext(fs.readFileSync('js/modules/offline-core.js','utf8'),context);
 navigator.onLine=false;docEvents['firebase-ready']();
 const ref={toString:()=> 'https://example.firebaseio.com/sisventas/ventas/test'};
 await assert.rejects(window.fbSet(ref,{total:100}),{code:'SISVENTAS_OFFLINE_BLOCKED'});
 await assert.rejects(window.fbRunTransaction(ref,()=>({})),{code:'SISVENTAS_OFFLINE_BLOCKED'});
 navigator.onLine=true;
 assert.equal(await window.fbSet(ref,{total:100}),'saved');
 assert.equal(writes.length,1);
 assert.equal(await window.fbRunTransaction(ref,()=>({})),'transaction');
 assert.equal(events.online.length,1);
 assert.equal(events.online[0],window.SisVentasOffline.sync);
 assert.equal(events.offline,undefined);
});
