const {test}=require('node:test'),assert=require('node:assert/strict');
const {planMigration,applyPlan}=require('../scripts/control-access-migration.cjs');
function fixture(){return {sisventas:{usuarios:{u:{nombre:'Ficticio',rol:'admin',activo:true}},config:{permisos:{personalizado:{valor:false}},version:'igual'},ventas:{v:{total:100.55}}},sv_chat_roles:{auth1:{rol:'admin',activo:true}},sv_chat_directorio:{auth1:{usuarioKey:'u'}}};}
test('migración conserva configuración completa y agrega solo UID verificado',()=>{
 const root=fixture(),plan=planMigration(root),next=applyPlan(root,plan);
 assert.deepEqual(next.sv_usuarios,{u:{...root.sisventas.usuarios.u,uid:'auth1'}});
 assert.deepEqual(next.sv_permisos,root.sisventas.config.permisos);
 assert.deepEqual(next.sisventas.ventas,root.sisventas.ventas);
 assert.equal(next.sisventas.config.version,'igual');
 assert.equal(next.sisventas.usuarios,undefined);assert.equal(next.sisventas.config.permisos,undefined);
 assert.ok(root.sisventas.usuarios); // no muta la entrada de revisión
});
test('cambio comercial concurrente se conserva; cambio en Roles aborta',()=>{
 const root=fixture(),plan=planMigration(root);
 root.sisventas.ventas.v.total=500.75;
 assert.equal(applyPlan(root,plan).sisventas.ventas.v.total,500.75);
 root.sisventas.config.permisos.nuevo=true;
 assert.throws(()=>applyPlan(root,plan),/origen cambió/);
});
test('no pisa destinos existentes ni identidades inconsistentes',()=>{
 const root=fixture(),plan=planMigration(root);root.sv_usuarios={otro:{}};
 assert.throws(()=>applyPlan(root,plan),/destino/);
 const other=fixture();other.sv_chat_roles.auth1.rol='tecnico';
 assert.throws(()=>planMigration(other),/inconsistente/);
});
test('sin identidad o con UID duplicado se rechaza',()=>{
 const missing=fixture();missing.sv_chat_directorio={};assert.throws(()=>planMigration(missing),/ausente/);
 const duplicate=fixture();duplicate.sisventas.usuarios.segundo={uid:'auth1',rol:'admin',activo:true};assert.throws(()=>planMigration(duplicate),/duplicada/);
});
