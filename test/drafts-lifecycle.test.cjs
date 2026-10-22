'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(process.env.SV_DRAFTS_AUDIT_SOURCE||'js/modules/commercial-drafts.js','utf8');
const settle=()=>new Promise(setImmediate);
function fixture(writer=()=>Promise.resolve()){
 const events={},timers=new Map(),subscriptions=[],writes=[],storage={},messages=[];let serial=0;
 Object.defineProperties(storage,{getItem:{value:k=>storage[k]||null},setItem:{value:(k,v)=>storage[k]=v},removeItem:{value:k=>delete storage[k]}});
 const fields=[{id:'pp-cli',value:'Cliente ficticio',type:'text',dataset:{},closest:()=>null}],root={querySelectorAll:()=>fields,closest:()=>({classList:{contains:()=>true}}),getClientRects:()=>[1]};
 const on=(name,fn)=>{(events[name]||=[]).push(fn);};
 const c={currentUserUid:'demo',currentRole:'admin',navigator:{onLine:true},localStorage:storage,document:{hidden:true,getElementById:id=>id==='ppto-form-view'?root:null,querySelectorAll:()=>[],addEventListener:on},addEventListener:on,setInterval:fn=>{c.tick=fn;},setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),notify:text=>messages.push(text),_pptoConIva:true,_pptoConDetalle:false,_pptoMonedaActual:'ARS',fbDB:{},fbRef:(_,path)=>path,fbOnValue:(path,next,error)=>{const sub={path,next,error,stopped:0};subscriptions.push(sub);next({val:()=>({})});return()=>sub.stopped++;},fbUpdate:(path,batch)=>{writes.push({path,batch:structuredClone(batch)});return writer(path,batch);}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);
 const emit=name=>(events[name]||[]).forEach(fn=>fn());
 c.tick();emit('sisventas:session-ready');
 return {c,fields,subscriptions,writes,storage,messages,emit,runTimers(){for(const [id,fn]of [...timers])if(timers.delete(id))fn();},edit(value){fields[0].value=value;c.svDrafts.flush();}};
}
test('error de escucha no provoca reconexiones por reloj; vuelve sólo con acción/foco',()=>{
 const f=fixture();assert.equal(f.subscriptions.length,1);f.subscriptions[0].error(Error('Fallo ficticio'));
 for(let i=0;i<120;i++)f.c.tick();assert.equal(f.subscriptions.length,1);assert.equal(f.writes.length,0);
 f.emit('focus');assert.equal(f.subscriptions.length,2);for(let i=0;i<20;i++)f.emit('sisventas:page-changed');assert.equal(f.subscriptions.length,2);
});
test('rechazo de guardado conserva copia local sin reenvío infinito en reposo',async()=>{
 let failures=1;const f=fixture(()=>failures-->0?Promise.reject(Error('Fallo ficticio')):Promise.resolve());
 f.c.svDrafts.begin('presupuesto');f.edit('Cambio ficticio');f.runTimers();await settle();assert.equal(f.writes.length,1);
 for(let i=0;i<60;i++){f.c.tick();await settle();}assert.equal(f.writes.length,1);assert.ok(Object.values(f.storage).some(v=>JSON.parse(v).data?.fields[0].value==='Cambio ficticio'));
 f.emit('online');await settle();assert.equal(f.writes.length,2);assert.equal(f.messages.length,1);
});
test('una sola escritura en curso; al terminar envía el cambio más nuevo sin invertir orden',async()=>{
 const pending=[];const f=fixture(()=>new Promise(resolve=>pending.push(resolve)));
 f.c.svDrafts.begin('presupuesto');f.edit('Primero');f.runTimers();f.edit('Segundo');f.runTimers();assert.equal(f.writes.length,1);
 pending.shift()();await settle();f.runTimers();assert.equal(f.writes.length,2);const value=Object.values(f.writes[1].batch)[0];assert.equal(value.data.fields[0].value,'Segundo');pending.shift()();await settle();
});
test('el eco de un guardado anterior en el mismo milisegundo no pisa el cambio local pendiente',async()=>{
 const pending=[],f=fixture(()=>new Promise(resolve=>pending.push(resolve)));f.c.Date=class extends Date{static now(){return 1792360000000;}};f.c.svDrafts.begin('presupuesto');f.edit('Primero');f.runTimers();f.edit('Segundo');f.subscriptions[0].next({val:()=>structuredClone(f.writes[0].batch)});assert.equal(JSON.parse(Object.values(f.storage)[0]).data.fields[0].value,'Segundo');pending.shift()();await settle();f.runTimers();pending.shift()();await settle();
});
test('los snapshots de reversión del SDK tras un rechazo no crean un bucle de reenvío',async()=>{
 const f=fixture(()=>Promise.reject(Error('Permiso ficticio rechazado')));f.c.svDrafts.begin('presupuesto');f.edit('Conservar localmente');f.runTimers();await settle();assert.equal(f.writes.length,1);
 for(let i=0;i<20;i++){f.subscriptions[0].next({val:()=>({})});await settle();f.runTimers();await settle();}assert.equal(f.writes.length,1);f.emit('focus');await settle();assert.equal(f.writes.length,2);
});
test('cerrar y volver con el mismo UID invalida callbacks viejos y no revive datos',()=>{
 const f=fixture(),old=f.subscriptions[0];f.emit('sisventas:session-ended');f.emit('sisventas:session-ready');assert.equal(old.stopped,1);assert.equal(f.subscriptions.length,2);
 old.next({val:()=>({obsoleto:{schema:1,id:'obsoleto',kind:'presupuesto',updated:Date.now(),data:{fields:[],rows:[]}}})});assert.equal(Object.keys(f.storage).length,0);assert.equal(f.writes.length,0);
});
test('cambiar de usuario durante un guardado no reencola el error ni el contenido ajeno',async()=>{
 let reject;const f=fixture(()=>new Promise((_,fail)=>reject=fail));f.c.svDrafts.begin('presupuesto');f.edit('Sólo cuenta anterior');f.runTimers();f.emit('sisventas:session-ended');f.c.currentUserUid='otra';f.emit('sisventas:session-ready');reject(Error('Fallo tardío ficticio'));await settle();f.emit('online');f.runTimers();assert.equal(f.writes.length,1);assert.equal(f.messages.length,0);assert.equal(Object.keys(f.storage).some(k=>k.startsWith('sv:commercial-draft:v1:otra:')),false);
});
test('un formulario vacío no publica tombstones por cambiar valores auxiliares; revertir un borrador real lo descarta una sola vez',async()=>{
 const f=fixture();f.fields[0].value='';f.fields.push({id:'pp-fecha',value:'2026-10-18',type:'date',dataset:{},closest:()=>null});f.c.svDrafts.begin('presupuesto');f.fields[1].value='2026-10-19';f.c.svDrafts.flush();f.runTimers();await settle();assert.equal(f.writes.length,0);assert.equal(Object.keys(f.storage).length,0);
 f.edit('Cliente ficticio');f.runTimers();await settle();assert.equal(f.writes.length,1);f.edit('');f.runTimers();await settle();assert.equal(f.writes.length,2);assert.equal(Object.values(f.writes[1].batch)[0].deleted,true);
 f.fields[1].value='2026-10-20';f.c.svDrafts.flush();f.runTimers();await settle();assert.equal(f.writes.length,2);assert.equal(JSON.parse(Object.values(f.storage)[0]).deleted,true);
});
test('abrir y reiniciar un formulario sin guardado previo no crea eliminaciones remotas',async()=>{const f=fixture();for(let i=0;i<20;i++){f.c.svDrafts.begin('presupuesto');f.c.svDrafts.complete('presupuesto');f.runTimers();await settle();}assert.equal(f.writes.length,0);assert.equal(Object.keys(f.storage).length,0);});

test('rechazos sucesivos al editar conservan el último cambio y avisan una vez hasta recuperar la escritura',async()=>{
 let reject=true;const f=fixture(()=>reject?Promise.reject(Error('Rechazo ficticio')):Promise.resolve());f.c.svDrafts.begin('presupuesto');
 for(let i=1;i<=20;i++){f.edit('Edición ficticia '+i);f.runTimers();await settle();}
 assert.equal(f.messages.length,1);assert.equal(f.writes.length,20);
 assert.equal(JSON.parse(Object.values(f.storage)[0]).data.fields[0].value,'Edición ficticia 20');
 for(let i=0;i<120;i++){f.c.tick();f.runTimers();await settle();}assert.equal(f.writes.length,20);
 reject=false;f.emit('online');await settle();assert.equal(f.writes.length,21);
 reject=true;f.edit('Cambio tras recuperación');f.runTimers();await settle();assert.equal(f.messages.length,2);
});

test('leer la nube o reconectar sin poder escribir no repite el aviso de sincronización pendiente',async()=>{
 const f=fixture(()=>Promise.reject(Error('Rechazo ficticio')));f.c.svDrafts.begin('presupuesto');f.edit('Conservar');f.runTimers();await settle();
 f.subscriptions[0].next({val:()=>({})});f.edit('Conservar último');f.runTimers();await settle();
 f.subscriptions[0].error(Error('Escucha ficticia fallida'));f.emit('focus');await settle();f.runTimers();await settle();
 assert.equal(f.messages.length,1);assert.equal(JSON.parse(Object.values(f.storage)[0]).data.fields[0].value,'Conservar último');
});
