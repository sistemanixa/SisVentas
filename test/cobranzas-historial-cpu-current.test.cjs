'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,functionSource}=require('./helpers/app-functions.cjs');
function fixture(sales){
 const c=load({window:{},ventasList:sales,_svModeloVentasCanonico:()=>null,ventasPagosV3Invocar:()=>null},['_svTxtClave','_svVentaClaves','_svRegistroPerteneceVenta','_svResolverVentaRegistro','_svPagoValido','_svResumenVentaCanonico','_svTotalVentaCanonico','_cobroPrepararSaldosHistorial','_cobroSaldoRestanteHistorial','_cobroSaldoRestanteHistorialHTML']);
 return c;
}
function reference(c,p,list,index){
 if(!p)return null;
 for(const key of ['saldoRestante','saldo_restante','nuevoSaldo','saldoPosterior'])if(Object.hasOwn(p,key)&&p[key]!==''&&p[key]!=null){const n=parseFloat(p[key]);if(Number.isFinite(n))return Math.max(0,n);}
 if(!c._svPagoValido(p))return null;
 const sale=c._svResolverVentaRegistro(p),total=parseFloat(p.totalVenta)||(sale?c._svTotalVentaCanonico(sale):0);
 if(!sale||total<=0)return null;
 let sum=0;
 (list||[]).slice(index).forEach(other=>{if(c._svPagoValido(other)&&c._svRegistroPerteneceVenta(other,sale))sum+=parseFloat(other.monto)||0;});
 return Math.max(0,total-sum);
}
function parity(sales,list,visible=list){const c=fixture(sales),prepared=c._cobroPrepararSaldosHistorial(list,visible);for(const p of visible){const i=list.indexOf(p),before=reference(c,p,list,i);assert.ok(Object.is(c._cobroSaldoRestanteHistorial(p,list,i,prepared),before),JSON.stringify({p,before}));assert.equal(prepared.indice(p),i);assert.equal(c._cobroSaldoRestanteHistorialHTML(p,list,i,prepared),c._cobroSaldoRestanteHistorialHTML(p,list,i));}return {c,prepared};}
test('alias técnicos tienen prioridad y no unen ventas distintas por su número',()=>{
 const sales=[{fbKey:'a',id:'V-42',total:100},{fbKey:'b',id:'V-42',total:200}],list=[{ventaFbKey:'a',monto:10},{ventaFbKey:'b',monto:20},{venta:'V-42',monto:3}];
 const {c,prepared}=parity(sales,list);assert.equal(c._cobroSaldoRestanteHistorial(list[0],list,0,prepared),87);assert.equal(c._cobroSaldoRestanteHistorial(list[1],list,1,prepared),177);
});
test('el resolvedor canónico conserva la prioridad del fbKey del pago',()=>{
 const sales=[{fbKey:'a',id:'V-1',total:100},{fbKey:'p',id:'V-2',total:200}],list=[{fbKey:'p',venta:'V-1',monto:5},{venta:'V-2',monto:7}];const {c,prepared}=parity(sales,list);assert.equal(c._cobroSaldoRestanteHistorial(list[0],list,0,prepared),193);
});
test('históricos con alias originales y ceros conservan pertenencia',()=>parity([{fbKey:'a',id:'V-0042',idOriginal:'ANT/42',total:100}],[{venta:'ANT/42',monto:'0.10'},{ventaId:'0042',monto:'0.20'},{ventaNumero:'42',monto:1},{venta:'0043',monto:99}]));
test('se preserva el orden IEEE sin sumas inversas ni redondeos nuevos',()=>{
 const sales=[{fbKey:'a',id:'V-1',total:100}],list=[{venta:'V-1',monto:1e16},{venta:'V-1',monto:-1e16},{venta:'V-1',monto:0.01}];const {c,prepared}=parity(sales,list);assert.equal(c._cobroSaldoRestanteHistorial(list[0],list,0,prepared),99.99);
});
test('saldos persistidos y anulaciones conservan sus guardas',()=>{
 const list=[{venta:'V-1',saldoRestante:'25.15',monto:99},{venta:'V-1',saldo_restante:-5,monto:99},{venta:'V-1',anulado:true,monto:99},{venta:'V-1',estado:'ANULADO',monto:99},{venta:'V-1',monto:5}];parity([{id:'V-1',total:100}],list);
});
test('no finitos, huecos y posiciones repetidas mantienen cada suma original',()=>{
 const p={venta:'V-1',monto:0.1},list=[p,,p,{venta:'V-1',monto:'Infinity'},{venta:'V-1',monto:'-Infinity'},null];parity([{id:'V-1',total:100}],list,list.filter(Boolean));
});
test('filtrar o paginar conserva todos los pagos anteriores para el saldo',()=>{
 const list=Array.from({length:151},(_,i)=>({venta:'V-1',monto:i%2?0.01:0.2,fbKey:'p'+i}));parity([{id:'V-1',total:100}],list,list.slice(100,120));
});
test('índice ajeno o atípico conserva el fallback original',()=>{
 const c=fixture([{id:'V-1',total:100}]),list=[{venta:'V-1',monto:10},{venta:'V-1',monto:20}],prepared=c._cobroPrepararSaldosHistorial([...list],list);
 for(const i of [-1,0,0.5,1,'1',undefined,9])assert.equal(c._cobroSaldoRestanteHistorial(list[0],list,i,prepared),reference(c,list[0],list,i));
});
test('una referencia histórica malformada fuera del sufijo no pierde pagos',()=>{
 const c=fixture([{id:'V-1',total:100}]),list=[{venta:{toString:null},monto:99},{venta:'V-1',monto:5}],prepared=c._cobroPrepararSaldosHistorial(list,[list[1]]);assert.equal(c._cobroSaldoRestanteHistorial(list[1],list,1,prepared),95);
});
test('cada render usa la instantánea nueva sin reutilizar importes viejos',()=>{
 const c=fixture([{id:'V-1',total:100}]),list=[{venta:'V-1',monto:10}];let prepared=c._cobroPrepararSaldosHistorial(list,list);assert.equal(c._cobroSaldoRestanteHistorial(list[0],list,0,prepared),90);list[0].monto=25;prepared=c._cobroPrepararSaldosHistorial(list,list);assert.equal(c._cobroSaldoRestanteHistorial(list[0],list,0,prepared),75);
});
test('matriz determinista de aliases ambiguos conserva saldo y HTML exactamente',()=>{
 const sales=Array.from({length:15},(_,i)=>({fbKey:'s'+i,id:'V-'+i%5,idOriginal:'OLD/'+i,total:100000.01+i/100}));let seed=1701;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
 const list=Array.from({length:600},(_,i)=>{const sale=sales[Math.floor(random()*sales.length)],p={fbKey:i<15?sale.fbKey:'p'+i,monto:[0.01,0.1,10.005,1e5,-1e5][i%5]};if(i%3)p.ventaFbKey=sale.fbKey;else p.venta=i%2?sale.id:sale.idOriginal;if(i%13===0)p.anulado=true;return p;});parity(sales,list);
});
test('el plan síncrono no incorpora red, escrituras, relojes ni estado entre renders',()=>{
 assert.doesNotMatch(functionSource('_cobroPrepararSaldosHistorial'),/fbGet|fbSet|fbUpdate|fbRemove|fetch\(|setInterval|setTimeout|localStorage|sessionStorage/);
});
