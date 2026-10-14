const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(items,inputs){
 const messages=[];let writes=0;const data={gastos:Object.fromEntries(items.map(g=>{const v={...g};delete v.fbKey;return [g.fbKey,v]}))};
 const w={currentUserUid:'u',currentUser:'Admin',gastosData:items,empData:{},APROBACION_CONFIG:{maxComisionPct:10},tienePermiso:()=>true,fbDB:{},fbRef:(_,p)=>p,fbGet:async()=>({val:()=>data}),fbRunTransaction:async(_,fn)=>{const next=fn(data);if(next===undefined)return{committed:false};writes++;Object.assign(data,next);return{committed:true,snapshot:{val:()=>data}};},notify:m=>messages.push(m)};
 const button={disabled:false,innerHTML:'Guardar distribución'};
 const document={addEventListener(){},getElementById:id=>id==='com-det-guardar'?button:null,querySelectorAll:()=>inputs.map(x=>({dataset:{gasto:x.key},value:String(x.pct)}))};
 const svc=require('../cotizador/commission-operations').createCommissionOperations({auth:{},db:{},transaction:async fn=>{const next=fn(structuredClone(data));if(!next)return {committed:false};writes++;Object.assign(data,next);return {committed:true};}});
 w.SVServiceAuth={headers:async h=>h};
 const context={SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://test'},fetch:async(_,opts)=>{try{return {ok:true,json:async()=>({ok:true,...await svc.redistribute({nombre:'Admin'},JSON.parse(opts.body))})};}catch(e){return {ok:false,json:async()=>({ok:false,mensaje:e.message})};}},window:w,document,setTimeout(){},console};vm.createContext(context);
 vm.runInContext(fs.readFileSync('js/core/guarded-writes.js','utf8'),context);vm.runInContext(fs.readFileSync('js/modules/commissions.js','utf8'),context);
 return {w,data,messages,button,context,get writes(){return writes}};
}
test('el límite del reparto incluye las participaciones pagadas',async()=>{
 const h=setup([{fbKey:'paid',tipo:'comision',ventaId:'V1',estado:'pagado',pct:8,monto:80},{fbKey:'pending',tipo:'comision',ventaId:'V1',estado:'pendiente_aprobacion',pct:2,monto:20}],[{key:'pending',pct:5}]);
 await h.w.abrirDetalleComision('V1');await h.w.guardarDistribucionComision();assert.equal(h.writes,0);assert.ok(h.messages.some(m=>m.includes('máximo global')));
});
test('un pago externo impide guardar el reparto capturado al abrir',async()=>{
 const h=setup([{fbKey:'a',tipo:'comision',ventaId:'V1',estado:'pendiente_aprobacion',pct:5,monto:50}],[{key:'a',pct:6}]);
 await h.w.abrirDetalleComision('V1');h.data.gastos.a.estado='pagado';await h.w.guardarDistribucionComision();assert.equal(h.writes,0);assert.equal(h.data.gastos.a.monto,50);assert.ok(h.messages.some(m=>m.includes('cambió')));
});
test('una nueva participación externa impide exceder el reparto desde un detalle antiguo',async()=>{
 const h=setup([{fbKey:'a',tipo:'comision',ventaId:'V1',estado:'pendiente_aprobacion',pct:5,monto:50}],[{key:'a',pct:8}]);
 await h.w.abrirDetalleComision('V1');h.data.gastos.b={tipo:'comision',ventaId:'V1',pct:5,monto:50};await h.w.guardarDistribucionComision();assert.equal(h.writes,0);
});
test('guardar muestra progreso, bloquea doble clic y recupera el botón después de un error',async()=>{
 const h=setup([{fbKey:'a',tipo:'comision',ventaId:'V1',estado:'pendiente_aprobacion',pct:5,monto:50}],[{key:'a',pct:6}]);
 await h.w.abrirDetalleComision('V1');let resolve,count=0;
 h.context.fetch=async()=>{count++;await new Promise(r=>{resolve=r;});return {ok:false,json:async()=>({mensaje:'Conflicto de prueba'})};};
 const save=h.w.guardarDistribucionComision();await Promise.resolve();await Promise.resolve();
 assert.equal(h.button.disabled,true);assert.equal(h.button.textContent,'Guardando…');
 await h.w.guardarDistribucionComision();assert.equal(count,1);resolve();await save;
 assert.equal(h.button.disabled,false);assert.equal(h.button.innerHTML,'Guardar distribución');assert.ok(h.messages.some(m=>m.includes('Conflicto de prueba')));assert.equal(h.writes,0);
});
