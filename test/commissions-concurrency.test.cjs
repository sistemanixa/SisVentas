const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(items,inputs){
 const messages=[];let writes=0;const data={gastos:Object.fromEntries(items.map(g=>{const v={...g};delete v.fbKey;return [g.fbKey,v]}))};
 const w={currentUserUid:'u',currentUser:'Admin',gastosData:items,empData:{},APROBACION_CONFIG:{maxComisionPct:10},tienePermiso:()=>true,fbDB:{},fbRef:(_,p)=>p,fbGet:async()=>({val:()=>data}),fbRunTransaction:async(_,fn)=>{const next=fn(data);if(next===undefined)return{committed:false};writes++;Object.assign(data,next);return{committed:true,snapshot:{val:()=>data}};},notify:m=>messages.push(m)};
 const document={addEventListener(){},getElementById(){return null},querySelectorAll:()=>inputs.map(x=>({dataset:{gasto:x.key},value:String(x.pct)}))};
 const context={window:w,document,setTimeout(){},console};vm.createContext(context);
 vm.runInContext(fs.readFileSync('js/core/guarded-writes.js','utf8'),context);vm.runInContext(fs.readFileSync('js/modules/commissions.js','utf8'),context);
 return {w,data,messages,get writes(){return writes}};
}
test('el límite del reparto incluye las participaciones pagadas',async()=>{
 const h=setup([{fbKey:'paid',tipo:'comision',ventaId:'V1',estado:'pagado',pct:8,monto:80},{fbKey:'pending',tipo:'comision',ventaId:'V1',estado:'pendiente_aprobacion',pct:2,monto:20}],[{key:'pending',pct:5}]);
 await h.w.abrirDetalleComision('V1');await h.w.guardarDistribucionComision();assert.equal(h.writes,0);assert.ok(h.messages.some(m=>m.includes('máximo global')));
});
test('un pago externo impide guardar el reparto capturado al abrir',async()=>{
 const h=setup([{fbKey:'a',tipo:'comision',ventaId:'V1',estado:'pendiente_aprobacion',pct:5,monto:50}],[{key:'a',pct:6}]);
 await h.w.abrirDetalleComision('V1');h.data.gastos.a.estado='pagado';await h.w.guardarDistribucionComision();assert.equal(h.writes,0);assert.equal(h.data.gastos.a.monto,50);assert.ok(h.messages.some(m=>m.includes('Otro usuario')));
});
test('una nueva participación externa impide exceder el reparto desde un detalle antiguo',async()=>{
 const h=setup([{fbKey:'a',tipo:'comision',ventaId:'V1',estado:'pendiente_aprobacion',pct:5,monto:50}],[{key:'a',pct:8}]);
 await h.w.abrirDetalleComision('V1');h.data.gastos.b={tipo:'comision',ventaId:'V1',pct:5,monto:50};await h.w.guardarDistribucionComision();assert.equal(h.writes,0);
});
