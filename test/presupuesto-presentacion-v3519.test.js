const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const index=fs.readFileSync('index.html','utf8'),source=fs.readFileSync(index.match(/src="\.\/(js\/app\.v[\d.]+\.js)"/)[1],'utf8');
test('persistencia no sobrescribe creador pero permite cambiar comisionado',async()=>{
 let saved;
 const adapter=require('../js/v3/firebase-record-adapter.js').create({fbDB:{},fbRef:(_db,path)=>path,fbUpdate:async(path,data)=>{saved=data;}});
 await adapter.update('ventas','venta-1',{creadaPor:'EDITOR',creadaPorRol:'admin',fecha:'hoy',ts:999,empleado:'VENDEDOR',empleadoFbKey:'emp-2',editadaPor:'EDITOR'});
 assert.equal(saved.creadaPor,undefined);assert.equal(saved.ts,undefined);assert.equal(saved.empleadoFbKey,'emp-2');assert.equal(saved.editadaPor,'EDITOR');
});
test('comprobante sin detalle elimina columnas y conserva estructura con y sin imagen',async()=>{
 const a=source.indexOf('async function imprimirPresupuesto('),b=source.indexOf('\nfunction asegurarOTVentaConPago',a);
 for(const image of [false,true])for(const detail of [false,true]){
  let html='';const win={document:{write:s=>{html=s},close(){},getElementById:()=>true},location:{},addEventListener(){}};
  const model={v3Ready:true,numero:'PP-TEST',cliente:'CONSUMIDOR FINAL',items:[{cod:'P-1',desc:'Equipo',qty:1,punit:100,sub:100}],subtotal:100,descuento:0,iva:21,total:121,conIva:true,observaciones:'',fecha:'12/09/2026',vence:'30/09/2026'};
  const ctx={window:{open:()=>win},document:{getElementById:()=>null},_pptoModeloImpresion:()=>model,_pptoConDetalle:detail,_comprobanteConImagen:{ppto:image},productoDesdeItem:()=>null,logoImpresionActualUrl:()=>'',escapeHTML:s=>String(s).replaceAll('<','&lt;'),formatearFechaComprobante:s=>s,referenciaUsdPresupuesto:()=>null,location:{href:'http://localhost/index.html'},setTimeout(){},URL:{createObjectURL:()=>''},Blob,notify:s=>{throw Error(s)}};
  vm.createContext(ctx);vm.runInContext(source.slice(a,b),ctx);
  await ctx.imprimirPresupuesto({id:'PP-TEST',tituloSolucion:'SOLUCIÓN <segura>'});
  assert(html.includes('SOLUCIÓN &lt;segura>'));
  assert.equal(html.includes('P. unit.'),detail);
  const header=html.match(/<thead><tr>(.*?)<\/tr><\/thead>/s)[1];
  const count=(header.match(/<th[ >]/g)||[]).length;
  assert.equal(count,3+(image?1:0)+(detail?2:0));
  for(const row of html.match(/<tfoot>(.*?)<\/tfoot>/s)[1].matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)){
   const cols=[...row[1].matchAll(/<td(?:\s[^>]*)?>/g)].reduce((sum,m)=>sum+Number((m[0].match(/colspan="(\d+)"/)||[])[1]||1),0);
   assert.equal(cols,count);
  }
 }
});
test('editar conserva origen y deja evidencia del cambio de comisión',()=>{
 const chunk=source.slice(source.indexOf('if (ventaEditandoFbKey) {\n    var ventaOriginalEdit'),source.indexOf('if (!ventaEditandoFbKey) {\n    procesoPantallaVenta'));
 const original={id:'V-1',creadaPor:'ORIGINAL',creadaPorRol:'vendedor',fecha:'01/01/2020',ts:10,empleado:'A',empleadoFbKey:'a',audit:[]};
 const ctx={ventaEditandoFbKey:'key',ventaOriginalEditar:original,nuevaVenta:{creadaPor:'EDITOR',empleado:'B',empleadoFbKey:'b',comisionado2FbKey:'',total:100},currentUser:'EDITOR',fechaHoy:'12/09/2026',ventaEsSinCargo:()=>false,ventaPorcentajeDescuentoEfectivo:()=>0};
 vm.runInNewContext(chunk,ctx);
 assert.equal(ctx.nuevaVenta.creadaPor,'ORIGINAL');assert.equal(ctx.nuevaVenta.ts,10);assert.equal(ctx.nuevaVenta.empleadoFbKey,'b');assert.equal(ctx.nuevaVenta.audit.length,2);
});
