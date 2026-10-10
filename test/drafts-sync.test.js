const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('fs');
const source=fs.readFileSync('js/modules/commercial-drafts.js','utf8');
test('el portal de compras no suscribe borradores y desconecta al cambiar de rol',()=>{
 let reads=0,stops=0,errors=0,onError;
 const c={currentUserUid:'uid',currentRole:'',localStorage:{},document:{hidden:true,getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){}},addEventListener(){},setInterval:f=>c.tick=f,notify:()=>errors++,fbDB:{},fbRef:(_db,path)=>path,fbUpdate(){},fbOnValue:(_ref,_next,error)=>{reads++;onError=error;return()=>stops++;}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);
 for(const role of ['', 'distribuidora','compras_paraguay']) {c.currentRole=role;c.tick();}
 assert.equal(reads,0);assert.equal(errors,0);
 c.currentRole='admin';c.tick();assert.equal(reads,1);
 c.currentRole='distribuidora';c.tick();assert.equal(stops,1);
 onError();c.tick();assert.equal(errors,0);assert.equal(reads,1);
 c.currentRole='administrativo';c.tick();assert.equal(reads,2);
 onError();assert.equal(errors,1,'los errores reales del usuario interno siguen avisándose');
});
test('descarte se replica entre orígenes y sobrevive una recarga sin resucitar',async()=>{
 let server={},listeners=[];
 function client(initial={}){
  const storage={...initial};Object.defineProperties(storage,{getItem:{value:k=>storage[k]||null},setItem:{value:(k,v)=>storage[k]=v},removeItem:{value:k=>delete storage[k]}});
  const fields=[{id:'pp-cli',value:'Cliente',type:'text',dataset:{},closest:()=>null}];
  const root={querySelectorAll:()=>fields,closest:()=>({classList:{contains:()=>true}}),getClientRects:()=>[1]};
  const c={document:{getElementById:id=>id==='ppto-form-view'?root:null,querySelectorAll:()=>[],addEventListener(){}},localStorage:storage,currentUserUid:'uid',_pptoConIva:true,_pptoConDetalle:false,_pptoMonedaActual:'ARS',setInterval:f=>c.tick=f,setTimeout:f=>{c.timeout=f;return 1},clearTimeout(){},notify(){},addEventListener(){},fbDB:{},fbRef:(_db,path)=>path,fbOnValue:(_ref,fn)=>{listeners.push(fn);fn({val:()=>structuredClone(server)});return()=>{}},fbUpdate:async(_ref,values)=>{Object.assign(server,structuredClone(values));listeners.forEach(fn=>fn({val:()=>structuredClone(server)}));}};c.window=c;vm.createContext(c);vm.runInContext(source,c);return {c,storage,fields};
 }
 const a=client();a.c.currentRole='admin';a.c.tick();a.c.svDrafts.begin('presupuesto');
 a.c.document.hidden=true;
 a.fields[0].value='Cliente editado';a.c.tick();
 const id=Object.keys(server)[0];assert(id);const b=client();b.c.currentRole='administrativo';b.c.tick();
 assert.equal(server[id].data.fields[0].value,'Cliente editado','el temporizador guarda y sincroniza también con la pestaña oculta');
 assert(Object.values(b.storage).some(v=>JSON.parse(v).id===id));
 a.c.svDrafts.complete('presupuesto');a.c.timeout();
 assert.equal(server[id].deleted,true);
 assert.equal(JSON.parse(b.storage['sv:commercial-draft:v1:uid:'+id]).deleted,true);
 const reloaded=client(b.storage);reloaded.c.currentRole='administrativo';reloaded.c.tick();assert.equal(server[id].deleted,true);
});
