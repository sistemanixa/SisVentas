const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
function session(store,uid){
 const c={URL,AbortSignal,TextEncoder,currentUserUid:uid,fbAuth:{currentUser:{uid,getIdToken:async()=>'fake-token'}},fbDB:{},FB_PATHS:{ventas:'ventas',presupuestos:'presupuestos'},fbRef:(_,p)=>({path:p,toString:()=>'https://fixture.invalid/'+p}),
 fbGet:async()=>({}),fbRunTransaction:async(ref,fn)=>{const path=ref.path;
  const next=fn(structuredClone(store[path]));if(next===undefined)return {committed:false};
  store[path]=next;return {committed:true,snapshot:{val:()=>structuredClone(next)}};
 },ventasPagosV3Invocar(){throw Error('No debe evadir la comprobación');},pptoV3Invocar(){throw Error('No debe evadir la comprobación');}};
 c.fetch=async(url,options)=>{assert.equal(options.method,undefined,'la comprobación de conflicto no escribe');const path=new URL(url).pathname.slice(1).replace(/\.json$/,'');return {ok:true,headers:{get:()=> 'v-current'},json:async()=>structuredClone(store[path])};};
 c.window=c;c.SVSaleCosts=require('../js/core/sale-costs.v1.js').create(c);require('./helpers/sale-writer-fixture.cjs')(c);vm.createContext(c);vm.runInContext(fs.readFileSync('js/core/guarded-writes.js','utf8'),c);
 c.refreshes=[];c.SVCommercialOwnership={captureWriteContext:()=>({uid}),isWriteContext:token=>token.uid===c.currentUserUid,confirmWrite:(_domain,record)=>record,refresh:domain=>c.refreshes.push(domain),clean:r=>Object.fromEntries(Object.entries(r||{}).filter(([k])=>k!=='fbKey'&&!k.startsWith('_sv'))),prepare:async(domain,id,baseline)=>({record:structuredClone(store[domain+'/'+id]),baseline:baseline?structuredClone(baseline):null})};
 vm.runInContext(fs.readFileSync('js/modules/commercial-document-controls.js','utf8'),c);
 load(c,['pptoPersistirGuardar','ventasPagosPersistirGuardarVenta']);return c;
}
for(const [kind,method] of [['presupuestos','pptoPersistirGuardar'],['ventas','ventasPagosPersistirGuardarVenta']]){
 test(kind+': dos sesiones no sobrescriben una edición guardada',async()=>{
  const base={total:100,items:[{qty:1,precio:100}],estado:'aprobado',fecha:'2026-10-03'};
  const store={[kind+'/a']:structuredClone(base)},a=session(store,'a'),b=session(store,'b');
  const original={...structuredClone(base),fbKey:'a'};
  await a[method]({...original,total:120},original);
  await assert.rejects(b[method]({...original,total:130},original),{code:'SV_CONFLICT'});
  assert.equal(store[kind+'/a'].total,120);assert.equal(store[kind+'/a'].fecha,base.fecha);
  assert.deepEqual(a.refreshes,[kind]);assert.deepEqual(b.refreshes,[]);
 });
 test(kind+': cambio de estado externo invalida el formulario anterior',async()=>{
  const base={total:100,estado:'aprobado'},store={[kind+'/a']:{...base,estado:'convertido',ventaId:'V-1'}},b=session(store,'b');
  await assert.rejects(b[method]({...base,fbKey:'a',total:120},{...base,fbKey:'a'}),{code:'SV_CONFLICT'});
  assert.equal(store[kind+'/a'].estado,'convertido');assert.equal(store[kind+'/a'].ventaId,'V-1');
 });
}
