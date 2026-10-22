'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,copy,apply}=require('./helpers/labor-ui-flow.cjs');
const {digest}=require('../cotizador/labor-guard'),Index=require('../cotizador/payment-membership-index');
const Permissions=require('../js/core/permission-index');
function fixture(){
 const f=createBackend({productos:{p:{nombre:'Producto ficticio',categoria:'Categoria ficticia'}},categorias:{c:{nombre:'Categoria ficticia'}},presupuestos:{b:{cliente:'Cliente ficticio'}},pagos:{p:{ventaId:'V-FICTICIA',monto:20}}});
 f.state.sv_permisos=Permissions.build({admin:{bloqueados:[],acciones:{}}});apply(f.state,Index.buildIndex(f.state.sisventas.pagos,{generation:'normalization-fictitious',ready:true}).patch);
 const actor={uid:'u',claims:{uid:'u'}},body={id:'synthetic-normalize-001',kind:'atomic',purpose:'relationship-normalization',path:'',value:{'sisventas/productos/p/categoriaFbKey':'c','sisventas/productos/p/categoriaKey':'c','sisventas/mantenimiento/normalizaciones/demo':{usuario:'Ficticio',totalCambios:2}},expectedHashes:{'sisventas/productos/p':digest(f.get('sisventas/productos/p')),'sisventas/categorias/c':digest(f.get('sisventas/categorias/c')),'sisventas/mantenimiento/normalizaciones/demo':digest(null)}};
 return {...f,actor,body};
}
test('plan sin destinos financieros mantiene comparación y un commit con reglas del usuario',async()=>{
 const f=fixture(),before=copy(f.state.sisventas.pagos);await f.gateway.write(f.actor,f.body);assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/productos/p/categoriaFbKey'),'c');assert.deepEqual(f.state.sisventas.pagos,before);
});
test('normalización de relación de pago usa CAS completo y delta central sin cambiar importe',async()=>{
 const f=fixture();f.body.value={'sisventas/pagos/p/ventaFbKey':'v'};f.body.expectedHashes={'sisventas/pagos/p':digest(f.get('sisventas/pagos/p')),'sisventas/ventas/v':digest(f.get('sisventas/ventas/v'))};
 await f.gateway.write(f.actor,f.body);assert.equal(f.get('sisventas/pagos/p/monto'),20);assert.equal(f.get(Index.reversePath('p')).hasTechnicalRefs,true);assert.equal(f.commits.length,1);assert.ok(f.commits[0][Index.COVERAGE_PATH]);
});
test('no admite raíz, dato financiero, campo desconocido ni referencia sin comparación',async()=>{
 for(const variant of ['root','amount','unknown','uncovered','expected-root','other-purpose','wrong-kind']){
  const f=fixture();if(variant==='root')f.body.value={'sisventas/productos':{p:{categoriaFbKey:'c'}}};if(variant==='amount')f.body.value={'sisventas/pagos/p/monto':999};if(variant==='unknown')f.body.value={'sisventas/productos/p/precio':1};if(variant==='uncovered')delete f.body.expectedHashes['sisventas/productos/p'];if(variant==='expected-root')f.body.expectedHashes={'sisventas/productos':digest(f.get('sisventas/productos'))};if(variant==='other-purpose')f.body.purpose='anything';if(variant==='wrong-kind'){f.body.kind='patch';delete f.body.expectedHashes;}
  await assert.rejects(f.gateway.write(f.actor,f.body),{statusCode:400});assert.equal(f.commits.length,0);
 }
});
test('otro rol, acción revocada o configuración bloqueada no aplican ni recuperan normalizaciones',async()=>{
 for(const variant of ['role','override','module']){
  const f=fixture();await f.gateway.write(f.actor,f.body);if(variant==='role')f.state.sv_chat_roles.u.rol='administrativo';if(variant==='override')f.state.sv_permisos.admin.acciones.mantenimiento={normalizar:false};if(variant==='module')f.state.sv_permisos.admin.indiceModulos.configuracion=false;
  await assert.rejects(f.gateway.write(f.actor,f.body),{statusCode:403});assert.equal(f.commits.length,1);
 }
});
test('cambio remoto y referencia ya ocupada conservan los registros y no dejan evidencia de éxito',async()=>{
 for(const stale of [true,false]){
  const f=fixture();f.state.sisventas.productos.p.categoriaFbKey='other';if(!stale)f.body.expectedHashes['sisventas/productos/p']=digest(f.get('sisventas/productos/p'));
  await assert.rejects(f.gateway.write(f.actor,f.body),{code:'SV_CAS_CONFLICT'});assert.equal(f.commits.length,0);assert.equal(f.get('sisventas/productos/p/categoriaFbKey'),'other');assert.equal(f.get('sisventas/mantenimiento/normalizaciones/demo'),null);
 }
});
