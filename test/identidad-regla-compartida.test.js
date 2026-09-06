const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/app.v3.3.15.js','utf8');
const ctx={urlsProveedorEquivalentes:(a,b)=>!!a&&a===b,parsePrecioProveedorARS:x=>Number(x)||0};
for(const nombre of ['identidadProveedorConfirmadaParaUrl','evaluarIdentidadCotizacionProveedor']){const a=source.indexOf('function '+nombre+'('),b=source.indexOf('\nfunction ',a+1);vm.runInNewContext(source.slice(a,b),ctx);}
test('misma regla ofrece confirmación ante identidad dudosa y reutiliza la decisión para esa URL',()=>{
 const p={url:'https://proveedor/producto',precio:100};
 const r={precioArs:120,identidad:{ok:false},requiereConfirmacionIdentidad:true};
 assert.equal(ctx.evaluarIdentidadCotizacionProveedor(p,p.url,r).requiereConfirmacion,true);
 const guardado={...p,identidadConfirmadaManualmente:true,identidadConfirmadaUrl:p.url};
 assert.equal(ctx.evaluarIdentidadCotizacionProveedor(guardado,p.url,r).requiereConfirmacion,false);
 assert.equal(ctx.evaluarIdentidadCotizacionProveedor({...guardado,url:'https://proveedor/otro'},'https://proveedor/otro',r).requiereConfirmacion,true);
});
test('errores de lectura no se transforman en confirmación y los precios ya validados no requieren título adicional',()=>{
 const p={url:'https://proveedor/producto',precio:100};
 assert.equal(ctx.evaluarIdentidadCotizacionProveedor(p,p.url,{mensaje:'Timeout al cargar la página'}).requiereConfirmacion,false);
 assert.equal(ctx.evaluarIdentidadCotizacionProveedor(p,p.url,{precioArs:120,identidad:{ok:true}}).requiereConfirmacion,false);
 const r=ctx.evaluarIdentidadCotizacionProveedor(p,p.url,{mensaje:'El modelo no coincide'});
 assert.equal(r.requiereConfirmacion,true);assert.equal(r.sobrePrecioAnterior,true);assert.equal(r.precioCandidato,100);
});
