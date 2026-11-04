'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Writer=require('../cotizador/dashboard-budget-writer-proposal'),B=require('../cotizador/dashboard-budget-projection-proposal'),Bootstrap=require('../cotizador/dashboard-budget-activity-bootstrap-proposal'),DTO=require('../cotizador/dashboard-budget-sdk-dto-proposal'),Index=require('../cotizador/dashboard-budget-incremental-plan-proposal'),Commercial=require('../cotizador/dashboard-commercial-activity-proposal');
const {fixture,legacy}=require('./helpers/dashboard-commercial-activity-fixture.cjs'),{budget}=require('./helpers/dashboard-budget-reader-fixture.cjs');
async function combined(){
 const f=await fixture(2,2,{dashboardBudgets:Writer.create({enabled:true,allowPolicyRenewal:true})});
 for(const role of ['admin','vendedor','administrativo','tecnico'])f.set('sv_permisos/'+role+'/indiceModulos/presupuesto',true);
 f.set('sisventas/presupuestos',{p:budget()});const authority={users:f.read('sv_usuarios'),identities:f.read('sv_chat_roles'),permissions:f.read('sv_permisos')},records=f.read('sisventas/presupuestos'),model=B.build({records,complete:true,...authority,generation:'mixed-budgets',revision:1,offsetMinutes:-180}),tree=Bootstrap.buildActivitySnapshot({model,records,...legacy}).patch[Index.ROOT];
 f.set(Index.ROOT,tree);f.apply(DTO.projectReadViews({tree,...authority}).patch);return f;
}
test('budget and commercial activity projections share one original commit without replacing either pipeline',async()=>{
 const f=await combined(),before={stock:f.read('sisventas/stock'),commissions:f.read('sisventas/comisiones'),employees:f.read('sisventas/ctaemp'),product:f.read('sisventas/productos')},pagesRevision=f.read('sv_commercial_pages/v1/coverage/revision');
 await f.mutate({'sisventas/presupuestos/p/estado':'aprobado_int','sisventas/ventas/s0000/observaciones':'cambio ficticio'});
 assert.equal(f.calls.commits.length,1);const commit=f.calls.commits[0];for(const path of ['sisventas/presupuestos/p/estado','sisventas/ventas/s0000/observaciones',Index.ROOT+'/coverage',Index.ROOT+'/read/u',Commercial.ROOT+'/coverage','sv_commercial_pages/v1/coverage'])assert(Object.hasOwn(commit,path),path);
 assert.equal(f.read(Index.ROOT+'/read/u/revision'),f.read(Index.ROOT+'/coverage/revision'));assert.equal(f.read(Commercial.ROOT+'/coverage/pagesRevision'),pagesRevision+1);assert.equal(f.read(Index.ROOT+'/read/u/active'),1);assert.equal(f.read(Index.ROOT+'/stats/u_u/noticeEligible'),1);
 for(const domain of ['ventas','pagos','ordenes_trabajo'])assert.equal((await(await f.reader('a')).read(domain)).recent.rows.length,2);
 assert.deepEqual({stock:f.read('sisventas/stock'),commissions:f.read('sisventas/comisiones'),employees:f.read('sisventas/ctaemp'),product:f.read('sisventas/productos')},before);
});
test('a failed budget proof prevents the simultaneous sale change and all commercial activity projections',async()=>{
 const f=await combined(),before=f.read(Commercial.ROOT);f.set(Index.ROOT+'/scopeProof/all','not-certified');await assert.rejects(f.mutate({'sisventas/presupuestos/p/estado':'convertido','sisventas/ventas/s0000/observaciones':'must not commit'}));assert.equal(f.calls.commits.length,0);assert.equal(f.read('sisventas/ventas/s0000/observaciones'),null);assert.equal(f.read('sisventas/presupuestos/p/estado'),'enviado');assert.deepEqual(f.read(Commercial.ROOT),before);
});
