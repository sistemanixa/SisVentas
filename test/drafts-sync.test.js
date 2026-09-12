const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('fs');
const source=fs.readFileSync('js/modules/commercial-drafts.js','utf8');
test('descarte se replica entre orígenes y sobrevive una recarga sin resucitar',async()=>{
 let server={},listeners=[];
 function client(initial={}){
  const storage={...initial};Object.defineProperties(storage,{getItem:{value:k=>storage[k]||null},setItem:{value:(k,v)=>storage[k]=v},removeItem:{value:k=>delete storage[k]}});
  const fields=[{id:'pp-cli',value:'Cliente',type:'text',dataset:{},closest:()=>null}];
  const root={querySelectorAll:()=>fields,getClientRects:()=>[1]};
  const c={document:{getElementById:id=>id==='ppto-form-view'?root:null,querySelectorAll:()=>[],addEventListener(){}},localStorage:storage,currentUserUid:'uid',_pptoConIva:true,_pptoConDetalle:false,_pptoMonedaActual:'ARS',setInterval:f=>c.tick=f,setTimeout:f=>{c.timeout=f;return 1},clearTimeout(){},notify(){},addEventListener(){},fbDB:{},fbRef:(_db,path)=>path,fbOnValue:(_ref,fn)=>{listeners.push(fn);fn({val:()=>structuredClone(server)});return()=>{}},fbUpdate:async(_ref,values)=>{Object.assign(server,structuredClone(values));listeners.forEach(fn=>fn({val:()=>structuredClone(server)}));}};c.window=c;vm.createContext(c);vm.runInContext(source,c);return {c,storage,fields};
 }
 const a=client();a.c.tick();a.c.svDrafts.begin('presupuesto');a.fields[0].value='Cliente editado';a.c.svDrafts.flush();a.c.timeout();
 const id=Object.keys(server)[0];assert(id);const b=client();b.c.tick();
 assert(Object.values(b.storage).some(v=>JSON.parse(v).id===id));
 a.c.svDrafts.complete('presupuesto');a.c.timeout();
 assert.equal(server[id].deleted,true);
 assert.equal(JSON.parse(b.storage['sv:commercial-draft:v1:uid:'+id]).deleted,true);
 const reloaded=client(b.storage);reloaded.c.tick();assert.equal(server[id].deleted,true);
});
