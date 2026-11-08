'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
 const events={},sources=new Set();let active=true,adapter,destroyed=0,response=()=>Promise.resolve({rows:[]});
 const root={SVOfficeStockAdapter:{create:()=>({session:()=>({}),list:args=>response(args)})},SVOfficeStock:{mount:(_host,options)=>{adapter=options.adapter;return{destroy(){destroyed++;},sessionChanged(){}};}},SVDataReadiness:{beginSource(){const source={ready:false,error:false,active:true};sources.add(source);return{ready(){if(source.active)source.ready=true;},error(){if(source.active)source.error=true;},cancel(){source.active=false;sources.delete(source);}};}}};
 const document={getElementById:id=>id==='page-stockoficina'?{classList:{contains:()=>active}}:{},addEventListener:(name,handler)=>{events[name]=handler;}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/modules/office-stock-host.js'),'utf8'),{window:root,document});
 return{root,sources,get adapter(){return adapter;},get destroyed(){return destroyed;},respond(fn){response=fn;},navigate(value){active=value;events['sisventas:page-changed']();}};
}
test('Stock readiness replaces failed and successful sources on retry and further pages',async()=>{
 const f=fixture();f.root.SVOfficeStockHost.start();f.respond(()=>Promise.reject(Error('Fallo ficticio')));
 await a.rejects(f.adapter.list({}),/Fallo ficticio/);a.equal(f.sources.size,1);a.equal([...f.sources][0].error,true);
 f.respond(()=>Promise.resolve({rows:[]}));await f.adapter.list({});a.equal(f.sources.size,1);a.equal([...f.sources][0].ready,true);a.equal([...f.sources][0].error,false);
 await f.adapter.list({cursor:'next'});await f.adapter.list({});a.equal(f.sources.size,1);a.equal([...f.sources][0].ready,true);
});
test('Stock cancels readiness on leaving and ignores late completion after returning',async()=>{
 const f=fixture();f.root.SVOfficeStockHost.start();let resolve;f.respond(()=>new Promise(done=>{resolve=done;}));const pending=f.adapter.list({});
 const old=[...f.sources][0];f.navigate(false);a.equal(f.sources.size,0);a.equal(f.destroyed,1);
 f.respond(()=>Promise.resolve({rows:[]}));f.navigate(true);await f.adapter.list({});const current=[...f.sources][0];a.equal(current.ready,true);
 resolve({rows:[]});await pending;a.equal(old.active,false);a.equal(old.ready,false);a.equal(f.sources.size,1);a.equal([...f.sources][0],current);
 f.navigate(false);a.equal(f.sources.size,0);
});
