'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../js/core/provider-writes'),R=require('../scripts/lib/provider-projection-rules.cjs');
test('provider changes and public fields form one patch without credentials or other branches',async()=>{
 const calls=[],root={fbDB:{},fbRef:(_,p)=>p||'/',fbUpdate:async(p,v)=>calls.push([p,v])};
 await M.update(root,'p',{nombre:'Ficticio',usuario:'privado',password:'secreto ficticio',activo:false});
 assert.equal(calls.length,1);assert.equal(calls[0][0],'/');const patch=calls[0][1];
 assert.equal(patch['sv_catalogo_proveedores/p/nombre'],'Ficticio');assert.equal(patch['sisventas/proveedores/p/password'],'secreto ficticio');
 assert.ok(!Object.keys(patch).some(p=>p.startsWith('sv_catalogo_proveedores/')&&/password|usuario/.test(p)));
 assert.ok(Object.keys(patch).every(p=>p.startsWith('sisventas/proveedores/')||p.startsWith('sv_catalogo_proveedores/')));
});
test('batch is atomic, a private-only change does not rewrite public data, delete removes both rows',async()=>{
 const calls=[],root={fbDB:{},fbRef:()=> '/',fbUpdate:async(_,patch)=>calls.push(patch)};
 await M.batch(root,[{fbKey:'p',changes:{base:true}},{fbKey:'q',changes:{base:false}}]);assert.equal(calls.length,1);assert.equal(Object.keys(calls[0]).length,4);
 assert.deepEqual(M.plan([{fbKey:'p',changes:{usuario:'ficticio'}}]),{'sisventas/proveedores/p/usuario':'ficticio'});
 await M.remove(root,'p');assert.deepEqual(calls[1],{'sisventas/proveedores/p':null,'sv_catalogo_proveedores/p':null});
});
for(const entries of [[{fbKey:'../x',changes:{nombre:'x'}}],[{fbKey:'p',changes:{'nombre/private':'x'}}],[{fbKey:'p',changes:{nombre:{secret:'x'}}}],[{fbKey:'p',changes:{nombre:'a'}},{fbKey:'p',remove:true}]])test('invalid provider plan is rejected before a write: '+JSON.stringify(entries),()=>assert.throws(()=>M.plan(entries)));
test('rules preserve the original provider authority and read policies; change only two domains',()=>{
 const input={rules:{sisventas:{proveedores:{'.read':'PRIVATE_READ','.write':'PRIVATE_WRITE'},pagos:{'.write':false}},sv_catalogo_proveedores:{'.read':'PUBLIC_READ','.write':'OLD_ADMIN'}}};
 const out=R.build(input);assert.equal(input.rules.sisventas.proveedores['.write'],'PRIVATE_WRITE');assert.equal(out.rules.sisventas.proveedores['.read'],'PRIVATE_READ');assert.equal(out.rules.sv_catalogo_proveedores['.read'],'PUBLIC_READ');assert.deepEqual(out.rules.sisventas.pagos,input.rules.sisventas.pagos);assert.match(out.rules.sisventas.proveedores.$provider['.write'],/PRIVATE_WRITE/);
});

test('provider subscriptions update the view without any write, even for private-only snapshots',()=>{const vm=require('node:vm'),app=require('./helpers/active-app').readActiveApp().source;let writeCalls=0,receive;const c={window:{fbDB:{},SVDistribuidora:{syncProviders(){writeCalls++;}}},svEscucharProveedores:cb=>{receive=cb;},proveedoresConReferenciaDeValor:x=>x,proveedoresData:[],renderResumenPreciosProveedores(){},proveedorVisibleEnProducto:()=>true,_svEsPaginaActiva:()=>false,document:{getElementById:()=>null,querySelector:()=>null}};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function fbCargarProveedores()'),app.indexOf('var APROBACION_CONFIG =')),c);c.fbCargarProveedores();for(let i=0;i<8;i++)receive({val:()=>({p:{nombre:'Ficticio',usuario:'privado'+i}})});assert.equal(writeCalls,0);assert.equal(c.proveedoresData[0].nombre,'FICTICIO');});
