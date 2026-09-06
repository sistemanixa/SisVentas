const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const s=require('./helpers/active-app').readActiveApp().source;
function setup(fail=false){
 const db={ventas:{v1:{id:'V1',total:100,totalPagado:0},v2:{id:'V2',total:200,totalPagado:0}},pagos:{}},reads=[],writes=[];
 const get=p=>p.split('/').filter(Boolean).reduce((a,k)=>a?.[k],db)??null;
 const put=(p,v)=>{let keys=p.split('/').filter(Boolean),o=db;for(const k of keys.slice(0,-1))o=o[k]??(o[k]={});o[keys.at(-1)]=v;};
 const w={fbDB:{},fbRef:(_,p)=>p.replace(/^sisventas\/?/,''),fbGet:async p=>{reads.push(p);return{val:()=>structuredClone(get(p))};},fbRunTransaction:async(p,fn)=>{assert.equal(p,'control_cobro_cuenta');const n=fn(structuredClone(get(p)));if(n!==undefined)put(p,n);return{committed:n!==undefined};},fbOnDisconnect:()=>({remove:async()=>{},cancel:async()=>{}}),fbUpdate:async(_,u)=>{writes.push(u);if(fail)throw Error('red');for(const [k,v] of Object.entries(u))put(k,v);}};
 const c={window:w,ventaValidaParaMetricas:v=>!v.anulada,_svPagoValido:p=>!p.anulado,_svRegistroPerteneceVenta:(p,v)=>p.ventaFbKey===v.fbKey,_svResumenPagoLegacyVenta:v=>v.totalPagado,_svTotalVentaCanonico:v=>v.total};vm.createContext(c);vm.runInContext(s.slice(s.indexOf('async function _ccGuardarPagoAcotado('),s.indexOf('async function confirmarPagoCuentaCorriente(')),c);
 const requests=[{ventaFbKey:'v1',ventaId:'V1',monto:100,pago:{fbKey:'p1',ventaFbKey:'v1',monto:100}},{ventaFbKey:'v2',ventaId:'V2',monto:50,pago:{fbKey:'p2',ventaFbKey:'v2',monto:50}}];
 return{c,db,reads,writes,requests};
}
test('guarda las imputaciones y un adjunto juntos sin leer ni transaccionar la raíz',async()=>{
 const t=setup(),r=await t.c._ccGuardarPagoAcotado('cc_uno',t.requests,{monto:150},{data:'PDF'});
 assert.equal(r.length,2);assert.equal(t.db.ventas.v1.totalPagado,100);assert.equal(t.db.ventas.v2.totalPagado,50);
 assert.equal(t.db.cobros_cuenta_adjuntos.cc_uno.data,'PDF');assert.equal(t.writes.length,1);
 assert.ok(!t.reads.includes(''));assert.equal(t.db.control_cobro_cuenta,null);
 await t.c._ccGuardarPagoAcotado('cc_uno',t.requests,{monto:150},null);assert.equal(t.writes.length,1);
});
test('saldo cambiado aborta todo, incluido el adjunto',async()=>{
 const t=setup();t.db.pagos.anterior={ventaFbKey:'v2',monto:180};
 await assert.rejects(t.c._ccGuardarPagoAcotado('cc_uno',t.requests,{},{}),/saldo/);
 assert.equal(t.writes.length,0);assert.equal(t.db.ventas.v1.totalPagado,0);assert.equal(t.db.control_cobro_cuenta,null);
});
test('fallo de red conserva todos los saldos y permite reintentar',async()=>{
 const t=setup(true);await assert.rejects(t.c._ccGuardarPagoAcotado('cc_uno',t.requests,{},{}),/red/);
 assert.equal(t.db.ventas.v1.totalPagado,0);assert.equal(t.db.cobros_cuenta,undefined);assert.equal(t.db.control_cobro_cuenta,null);
});
test('otro pago en proceso impide lecturas de ventas y escrituras',async()=>{
 const t=setup();t.db.control_cobro_cuenta={token:'otro'};
 await assert.rejects(t.c._ccGuardarPagoAcotado('cc_uno',t.requests,{},{}),/otro pago/);
 assert.equal(t.writes.length,0);assert.equal(t.db.control_cobro_cuenta.token,'otro');
});
