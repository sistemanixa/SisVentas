const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');const src=require('./helpers/active-app').readActiveApp().source;
const ctx={};vm.runInNewContext(src.slice(src.indexOf('function cambiosCreadorComercial('),src.indexOf('function ventaCreadorBadge(')),ctx);
for(const tipo of ['venta','presupuesto'])test('cambiar creador '+tipo+' conserva vendedor, importes e historial previo',()=>{
const r={creadaPor:'Anterior',creadoPor:'Anterior',vendedor:'Vendedor',total:100,audit:[{accion:'Creado'}]};const c=ctx.cambiosCreadorComercial(r,tipo,{nombre:'Nuevo',rol:'admin'},'Operador');assert.equal(c[tipo==='venta'?'creadaPor':'creadoPor'],'Nuevo');assert.equal(c.audit.length,2);assert.equal(c.audit[1].usuario,'Operador');assert.match(c.audit[1].accion,/Anterior → Nuevo/);assert.equal(c.vendedor,undefined);assert.equal(c.total,undefined);assert.equal(r.audit.length,1);
});
