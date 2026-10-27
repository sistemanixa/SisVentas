'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createOTUnitConfirmation}=require('../cotizador/ot-unit-confirmation');
const {createLaborGuard,child,put}=require('../cotizador/labor-guard');
const Permissions=require('../js/core/permission-index');
const {metadataRules}=require('../cotizador/labor-fence-policy');
const Rules=require('../scripts/prepare-ot-unit-confirmation-rules.cjs');
const clone=structuredClone;
const today='2026-10-27',clock=()=>Date.parse(today+'T15:00:00Z');
function fixture({role='admin',known=false}={}){
 let state={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{actor:{activo:true,rol:role}},sv_permisos:Permissions.build({[role]:{bloqueados:[],acciones:{ot:{editarDatosAdministrativos:role==='admin'},equipos:{confirmarInstalacion:true}}}}),
 sv_empleado_uid:{actor:{perfilFbKey:'profile'}},sv_usuarios:{profile:{uid:'actor',rol:role,activo:true,empleadoFbKey:'employee'}},
 sisventas:{empleados:{employee:{id:'EMP-F',activo:true}},ordenes_trabajo:{ot:{id:'OT-FICTICIA',estado:'en_curso',ventaFbKey:'sale',tecnicoFbKey:'employee',materiales:{locks:{cod:'P-FICTICIO',ventaItemKey:'locks',vendida:5,entregada:0}}}},
 ventas:{sale:{id:'V-FICTICIA',cliente:'Cliente ficticio',total:100,totalPagado:100,items:{locks:{desc:'Cerradura ficticia',cod:'P-FICTICIO',qty:5,unidad:'Unidad',...(known?{garantiaLinea:'locks',garantiaConfig:{estado:'si',meses:12,inicio:'instalacion',serie:true,equipo:true}}:{})},labor:{desc:'Montaje',qty:5,esManoDeObra:true}}}},
 pagos:{retain:{monto:100}},gastos:{retain:{monto:10}},comisiones_generacion:{retain:{estado:'pendiente'}},productos:{retain:{nombre:'Original',garantiaConfig:{estado:'si',meses:24}}},equipos:{},garantias:{}}};
 const original=clone(state),commits=[],reads=[],leases=[];let ruleReads=0,hook=null,rulesMissing=false,revoked=false;
 const base={rules:{'.read':false,'.write':false,sisventas:{'.write':false,equipos:{'.write':"auth != null"},garantias:{'.write':"auth != null"}},sv_labor_guard:metadataRules().sv_labor_guard}};
 const unitRules=Rules.build(base,{expectedHash:Rules.hash(base)}),CustodyRules=require('../cotizador/ot-unit-custody-rules'),rules=CustodyRules.build(unitRules,{expectedHash:Rules.hash(unitRules)});
 const get=path=>child(state,path.split('/'));
 const store={read:async path=>{reads.push(path);return get(path);},readAsUser:async path=>get(path),query:async()=>{throw Error('Unexpected collection query');},
 acquire:async lease=>{assert.equal(lease.otUnitPolicy,1);leases.push(clone(lease));},abort:async()=>{},
 commit:async(patch,lease,actor)=>{assert.equal(actor.claims.svOTUnitConfirmation,true);assert.equal(lease.otUnitPolicy,1);for(const path of Object.keys(patch))assert.match(path,/^(sisventas\/(ordenes_trabajo|inventario_operativo)\/|sv_ot_unit_custody\/|sv_labor_receipts\/|sv_labor_guard$)/);commits.push(clone(patch));for(const [path,value]of Object.entries(patch))state=put(state,path.split('/'),value);}};
 const guard=createLaborGuard({store,now:clock});
 const db={ref:path=>({get:async()=>({val:()=>get(path)})}),getRulesJSON:async()=>{ruleReads++;return rulesMissing?{}:rules;}};
 const service=createOTUnitConfirmation({db,auth:{verifyIdToken:async(token,check)=>{assert.equal(token,'fictitious');assert.equal(check,true);if(revoked)throw Error('revoked');return {uid:'actor'};}},guard:{run:async(actor,work)=>guard.run(actor,async scope=>{await hook?.();return work(scope);})},enabled:true,custodyEnabled:true,now:clock});
 const req=action=>({method:'POST',url:'/ot/custodia/'+action,headers:{authorization:'Bearer fictitious'}});
 const manual={confirmado:true,estado:'si',meses:12,inicio:'instalacion',serie:true,fecha:today};
 const prepare=(otKey='ot')=>service.custodyPrepare(req('preparar'),{otKey});
 const body=(prepared,accion='entregar')=>({otKey:'ot',revision:prepared.revision,accion,units:prepared.units.map((u,n)=>({key:u.key,serie:'FAKE-'+n}))});
 const confirm=value=>service.custodyConfirm(req('confirmar'),value);
 function untouched(){for(const branch of ['ventas','pagos','gastos','comisiones_generacion','productos'])assert.deepEqual(state.sisventas[branch],original.sisventas[branch],branch+' untouched');}
 return {prepare,confirm,body,untouched,commits,reads,leases,get,state:()=>clone(state),set:(path,value)=>{state=put(state,path.split('/'),value);},get ruleReads(){return ruleReads;},set rulesMissing(value){rulesMissing=value;},set revoked(value){revoked=value;},set hook(value){hook=value;}};
}

test('entrega de cinco series conserva venta, pagos y garantías; replay no duplica',async()=>{const f=fixture({known:true}),p=await f.prepare();assert.equal(p.units.length,5);const b=f.body(p),r=await f.confirm(b);assert.equal(r.changed,true);assert.equal(f.commits.length,1);const after=f.state();assert.equal(Object.keys(after.sv_ot_unit_custody.ot.units).length,5);assert.equal(after.sisventas.ordenes_trabajo.ot.materiales.locks.entregada,5);assert.equal(after.sisventas.ordenes_trabajo.ot.materiales.locks.enTecnico,5);assert.deepEqual(after.sisventas.equipos,{});assert.deepEqual(after.sisventas.garantias,{});assert.deepEqual(await f.confirm(b),r);assert.equal(f.commits.length,1);f.untouched();});
test('devolver y recibir una serie mueve sólo esa unidad y conserva las demás',async()=>{const f=fixture({known:true});await f.confirm(f.body(await f.prepare()));let p=await f.prepare(),b=f.body(p,'devolver');b.units=b.units.slice(0,1);await f.confirm(b);let m=f.get('sisventas/ordenes_trabajo/ot/materiales/locks');assert.equal(m.devueltaPendiente,1);assert.equal(m.enTecnico,4);p=await f.prepare();b=f.body(p,'recibir');b.units=b.units.slice(0,1);await f.confirm(b);m=f.get('sisventas/ordenes_trabajo/ot/materiales/locks');assert.equal(m.devuelta,1);assert.equal(m.devueltaPendiente,0);assert.equal(m.enTecnico,4);assert.equal(f.get('sv_ot_unit_custody/ot/units/'+b.units[0].key+'/historial').length,3);f.untouched();});
for(const kind of ['duplicate','wrong-material','stale','missing-rules','revoked','permission','asset'])test('custodia rechaza '+kind+' sin confirmar escrituras',async()=>{const f=fixture({known:true}),p=await f.prepare(),b=f.body(p);if(kind==='duplicate')b.units[1].serie=b.units[0].serie;if(kind==='wrong-material')b.units[0].materialKey='unknown';if(kind==='stale')f.set('sisventas/ordenes_trabajo/ot/materiales/locks/vendida',6);if(kind==='missing-rules')f.rulesMissing=true;if(kind==='revoked')f.revoked=true;if(kind==='permission')f.hook=()=>f.set('sv_permisos/admin/acciones/ot/entregarMateriales',false);if(kind==='asset')f.set('sisventas/equipos/'+b.units[0].key,{serie:'EXISTENTE'});await assert.rejects(f.confirm(b));assert.equal(f.commits.length,0);f.untouched();});
test('el técnico asignado puede rendir pero no entregar ni recibir',async()=>{const f=fixture({role:'tecnico',known:true}),p=await f.prepare();assert.equal(p.capabilities.entregar,false);assert.equal(p.capabilities.devolver,true);await assert.rejects(f.confirm(f.body(p)),e=>e.statusCode===403);await assert.rejects(f.confirm(f.body(p,'recibir')),e=>e.statusCode===403);assert.equal(f.commits.length,0);});
test('DTO no entrega campos arbitrarios de historial ni finanzas de venta',async()=>{const f=fixture({known:true});await f.confirm(f.body(await f.prepare()));const key=Object.keys(f.get('sv_ot_unit_custody/ot/units'))[0];f.set('sv_ot_unit_custody/ot/units/'+key+'/historial/0/private',{salary:100});const p=await f.prepare();assert.equal(JSON.stringify(p).includes('salary'),false);assert.equal(JSON.stringify(p).includes('totalPagado'),false);assert.equal(JSON.stringify(p).includes('sourceCounters'),false);});
