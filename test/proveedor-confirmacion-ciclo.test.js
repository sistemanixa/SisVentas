const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const file=fs.readFileSync('index.html','utf8').match(/src="\.\/(js\/app\.v[\d.]+\.js)"/)[1];
const source=fs.readFileSync(file,'utf8');
function fn(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\n}',start)+2;return (source.slice(start-6,start)==='async '?'async ':'')+source.slice(start,end);}
test('confirmar, guardar la ficha y recargar conserva identidad y URL; otra publicación requiere revisión',async()=>{
 let persisted;
 const url='https://proveedor/producto';
 const c={prodProveedoresActuales:[{url,precio:100,identidadConfirmadaManualmente:true}],prodData:[{fbKey:'p1',proveedores:[{url,precio:100}]}],editingProdId:'p1',currentUser:'Usuario',currentUserEmail:'',FB_PATHS:{productos:'productos'},urlsProveedorEquivalentes:(a,b)=>!!a&&a===b,window:{fbDB:{},fbRef:(_,p)=>p,fbUpdate:async(p,data)=>{persisted=JSON.parse(JSON.stringify(data));}}};
 vm.createContext(c);vm.runInContext(fn('persistirConfirmacionIdentidadProveedor')+'\n'+fn('identidadProveedorConfirmadaParaUrl'),c);
 assert.equal(await c.persistirConfirmacionIdentidadProveedor(0),true);
 const saved=JSON.parse(JSON.stringify(c.prodProveedoresActuales[0]));
 assert.equal(saved.identidadConfirmadaUrl,persisted.identidadConfirmadaUrl);
 assert.equal(c.identidadProveedorConfirmadaParaUrl(saved,url),true);
 assert.equal(c.identidadProveedorConfirmadaParaUrl(c.prodData[0].proveedores[0],url),true);
 assert.equal(c.identidadProveedorConfirmadaParaUrl(saved,'https://proveedor/otro'),false);
});
test('fallo al guardar no presenta una autorización persistida',async()=>{
 const c={prodProveedoresActuales:[{url:'https://proveedor/producto'}],editingProdId:'p1',currentUser:'Usuario',currentUserEmail:'',FB_PATHS:{productos:'productos'},window:{fbDB:{},fbRef:(_,p)=>p,fbUpdate:async()=>{throw Error('sin conexión');}}};
 vm.createContext(c);vm.runInContext(fn('persistirConfirmacionIdentidadProveedor'),c);
 await assert.rejects(c.persistirConfirmacionIdentidadProveedor(0),/sin conexión/);
 assert.equal(c.prodProveedoresActuales[0].identidadConfirmadaUrl,undefined);
});
