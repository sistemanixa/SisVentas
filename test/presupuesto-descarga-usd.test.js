const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=require('./helpers/active-app').readActiveApp().source;
test('descargar PDF entrega los bytes sin una ruta temporal del servidor',async()=>{
 let anchor,clicked=false;const c={window:{},FileReader:class{readAsDataURL(blob){this.result='data:application/pdf;base64,'+Buffer.from(blob.bytes).toString('base64');this.onload();}},document:{createElement(){anchor={style:{},click(){clicked=true;},remove(){}};return anchor;},body:{appendChild(){}}}};
 const a=source.indexOf('window._svDescargarBlobPresupuesto ='),b=source.indexOf('\nfunction ',a+10);vm.runInNewContext(source.slice(a,b),c);await c.window._svDescargarBlobPresupuesto({size:8,bytes:'%PDF-1.4'},'Presupuesto.pdf');assert.ok(clicked);assert.equal(anchor.download,'Presupuesto.pdf');assert.equal(Buffer.from(anchor.href.split(',')[1],'base64').toString(),'%PDF-1.4');await assert.rejects(()=>c.window._svDescargarBlobPresupuesto({size:0}),/vacío/);
});
test('equivalente usa la cotización elegida y no divide cuando falta',()=>{
 const c={obtenerDolarReferenciaProducto:()=>({valor:1530,tipo:'oficial'})};const a=source.indexOf('function referenciaUsdPresupuesto('),b=source.indexOf('\nfunction ',a+10);vm.runInNewContext(source.slice(a,b),c);assert.equal(c.referenciaUsdPresupuesto(153000).importe,100);assert.equal(c.referenciaUsdPresupuesto(1000).importe,.65);c.obtenerDolarReferenciaProducto=()=>({valor:0});assert.equal(c.referenciaUsdPresupuesto(1000),null);
});
