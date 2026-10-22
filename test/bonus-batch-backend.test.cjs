'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createBackend,copy,apply}=require('./helpers/labor-ui-flow.cjs');
const {digest}=require('../cotizador/labor-guard'),Policy=require('../cotizador/labor-bonus-batch'),Model=require('../cotizador/bonus-quantity-model'),Permissions=require('../js/core/permission-index');
const actor={uid:'u',claims:{uid:'u',name:'Titular ficticio',passwordAccessVersion:1}};
function fixture(n=2,{role='admin',permission}={}){
 const empleados=Object.fromEntries(Array.from({length:n},(_,i)=>['e'+i,{nombre:'Persona ficticia '+i,activo:true,sueldoBase:12345,pagos:{historico:{monto:50}}}]));
 const f=createBackend({empleados,ctaemp:{e0:{previo:{tipo:'haber',monto:700,estado:'pagado',pagos:{p:{monto:700}}}}},haberes:{e0:{anterior:{monto:700,pagos:{p:700}}}}});f.state.sv_chat_roles.u.rol=role;
 if(permission)f.state.sv_permisos=Permissions.build({[role]:permission});return f;
}
function command(f,{id='bonus-batch-transport-001',group='bonus-group-ficticio-001',n,unit=2.35,quantity=i=>i?1.125:2}={}){
 const employees=Object.keys(f.state.sisventas.empleados).slice(0,n),plan=Model.plan({empleados:employees.map((empleadoId,i)=>({empleadoId,cantidad:quantity(i)})),valorUnitario:unit}),value={},expectedHashes={};
 for(const item of plan.items){const emp=item.empleadoId,mov=Model.operationKey('bonificacion',[emp,group]),gasto=Model.operationKey('gasto_bonificacion',[emp,group]),meta=Model.metadata(item,group,plan),base={monto:item.monto,fecha:'2026-10-22',periodoComputo:'2026-11',descripcion:'Bonificación · Trabajo terminado',motivo:'Trabajo terminado',estado:'aprobado',operacionId:group,empleadoId:emp,empleadoNombre:f.get('sisventas/empleados/'+emp).nombre,legacyKey:'ctaemp/'+emp+'/'+mov,bonificacionConceptoId:'concepto',bonificacionConceptoNombre:'Productividad',aprobadoPor:'Titular ficticio',aprobadoTs:1792700000000,ts:1792700000000,...meta};
  value['sisventas/ctaemp/'+emp+'/'+mov]={...base,tipo:'bonificacion',fbKey:mov,gastoFbKey:gasto,usuario:'Titular ficticio',origenCarga:'manual_empleados'};
  value['sisventas/gastos/'+gasto]={...base,tipo:'Variable',tipoPagable:'bonificacion',empleadoFbKey:emp,movimientoCtaKey:mov,origen:'bonificacion',categoria:'Personal',medio:'Transferencia',mes:'2026-11',periodoTrabajo:'',fechaTrabajo:'',fechaImputacion:'2026-11-01',semestre:'',mejorSueldo:null,hsExtra:null,origenLegacy:'',migradoDesdeLegacy:false,requiereAprobacion:false};
  for(const p of ['sisventas/ctaemp/'+emp+'/'+mov,'sisventas/gastos/'+gasto,'sisventas/empleados/'+emp])expectedHashes[p]=digest(f.get(p));
 }
 return {id,kind:'atomic',path:'',purpose:Policy.PURPOSE,value,expectedHashes};
}
const write=(f,body)=>f.gateway.write(actor,body);
function unchanged(f,before){assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.equal(f.state.sv_labor_guard??null,null);}
const bodyFor=(f,edit)=>{const body=command(f);edit(body,Object.keys(body.value),Object.keys(body.expectedHashes));return body;};

test('server model is the exact shared frozen source and Docker includes both new dependencies',()=>{
 const root=path.resolve(__dirname,'..');assert.equal(fs.readFileSync(path.join(root,'cotizador/bonus-quantity-model.js'),'utf8'),fs.readFileSync(path.join(root,'js/core/bonus-quantity-model.js'),'utf8'));
 const docker=fs.readFileSync(path.join(root,'cotizador/Dockerfile'),'utf8');assert.match(docker,/COPY labor-bonus-batch\.js bonus-quantity-model\.js \.\//);
});
test('two employees commit one complete batch, per-person rounded cents and group total without changing salaries or historical payments',async()=>{
 const f=fixture(),before=copy(f.state.sisventas),body=command(f),description=Policy.describe(body);assert.equal(description.plan.total,7.34);await write(f,body);
 assert.equal(f.commits.length,1);assert.equal(description.plan.items[1].monto,2.64);
 for(const [p,value]of Object.entries(body.value))assert.deepEqual(f.get(p),value);
 assert.deepEqual(f.state.sisventas.empleados,before.empleados);assert.deepEqual(f.state.sisventas.haberes,before.haberes);assert.deepEqual(f.state.sisventas.ctaemp.e0.previo,before.ctaemp.e0.previo);
 assert.ok(f.commits[0]['sv_labor_receipts/'+body.id]);assert.equal(f.commits[0].sv_labor_guard,null);
 assert.ok(!f.reads.some(([,p])=>['sisventas','sisventas/gastos','sisventas/ctaemp','sisventas/empleados'].includes(p)));
 assert.equal(f.get('sv_labor_receipts/'+body.id).result.committed,true);
});
test('42 employees fit 126 CAS paths and commit together; the 43rd is rejected before committing',async()=>{
 const f=fixture(42),body=command(f);assert.equal(Object.keys(body.expectedHashes).length,126);await write(f,body);assert.equal(f.commits.length,1);
 const larger=fixture(43);assert.throws(()=>command(larger));assert.equal(larger.commits.length,0);
});
for(const mode of ['missing-employee-cas','extra-cas','root-cas','child-cas','missing-expense','extra-target','wrong-movement-key','wrong-crosslink','wrong-employee','wrong-recipients','wrong-count','wrong-total','wrong-quantity','wrong-unit','wrong-amount','date','month','different-month','different-concept','different-motive','string-quantity','new-paid','new-history','child-write'])test('batch rejects '+mode+' with no partial state',async()=>{
 const f=fixture(),before=copy(f.state.sisventas),body=bodyFor(f,(b,paths,expected)=>{
  const move=paths.find(p=>p.includes('/ctaemp/')),expense=paths.find(p=>p.includes('/gastos/'));
  if(mode==='missing-employee-cas')delete b.expectedHashes['sisventas/empleados/e1'];
  if(mode==='extra-cas')b.expectedHashes['sisventas/empleados/extra']=digest(null);
  if(mode==='root-cas'){delete b.expectedHashes['sisventas/empleados/e1'];b.expectedHashes['sisventas/empleados']=digest(f.get('sisventas/empleados'));}
  if(mode==='child-cas'){delete b.expectedHashes['sisventas/empleados/e1'];b.expectedHashes['sisventas/empleados/e1/activo']=digest(true);}
  if(mode==='missing-expense')delete b.value[expense];
  if(mode==='extra-target')b.value['sisventas/empleados/e0/bono']=20;
  if(mode==='wrong-movement-key'){b.value[move+'x']=b.value[move];delete b.value[move];}
  if(mode==='wrong-crosslink')b.value[move].gastoFbKey='otro';
  if(mode==='wrong-employee')b.value[expense].empleadoId='e1';
  if(mode==='wrong-recipients')for(const value of Object.values(b.value))value.bonificacionDestinatarios=['e0'];
  if(mode==='wrong-count')for(const value of Object.values(b.value))value.bonificacionGrupoPersonas=1;
  if(mode==='wrong-total')for(const value of Object.values(b.value))value.bonificacionGrupoTotal=999;
  if(mode==='wrong-quantity')b.value[move].bonificacionCantidad=3;
  if(mode==='wrong-unit')b.value[move].bonificacionValorUnitario=2.351;
  if(mode==='wrong-amount')b.value[move].monto+=0.01;
  if(mode==='date')for(const value of Object.values(b.value))value.fecha='2026-02-30';
  if(mode==='month')for(const value of Object.values(b.value))value.periodoComputo='2026-13';
  if(mode==='different-month')b.value[move].periodoComputo='2026-12';
  if(mode==='different-concept')b.value[move].bonificacionConceptoNombre='Otro';
  if(mode==='different-motive')b.value[move].motivo='Otro';
  if(mode==='string-quantity')b.value[move].bonificacionCantidad='2';
  if(mode==='new-paid')b.value[move].pagos={p:{monto:1}};
  if(mode==='new-history')b.value[expense].adelantosAplicados={p:{monto:1}};
  if(mode==='child-write'){b.value[move+'/monto']=b.value[move].monto;delete b.value[move];}
 });await assert.rejects(write(f,body));unchanged(f,before);
});
for(const mode of ['employee','movement','expense','inactive','legacy-inactive','employee-deleted'])test('CAS and current employee state reject '+mode+' for the entire group',async()=>{
 const f=fixture(),body=command(f);if(mode==='employee')apply(f.state,{'sisventas/empleados/e1/nota':'cambio'});
 if(mode==='movement')apply(f.state,{[Object.keys(body.value).find(p=>p.includes('/ctaemp/'))]:{monto:9}});
 if(mode==='expense')apply(f.state,{[Object.keys(body.value).find(p=>p.includes('/gastos/'))]:{monto:9}});
 if(mode==='inactive'||mode==='legacy-inactive'||mode==='employee-deleted'){apply(f.state,{['sisventas/empleados/e1'+(mode==='inactive'?'/activo':mode==='legacy-inactive'?'/estado':'')]:mode==='inactive'?false:mode==='legacy-inactive'?'inactivo':null});body.expectedHashes['sisventas/empleados/e1']=digest(f.get('sisventas/empleados/e1'));}
 const before=copy(f.state.sisventas);await assert.rejects(write(f,body));unchanged(f,before);
});
for(const mode of ['action','module','role','inactive','claims'])test('fresh backend rejects '+mode+' access even with other admin actions enabled',async()=>{
 const f=fixture(2,{permission:{bloqueados:[],acciones:{empleados:{bonificar:true,registrarHaberes:true,pagarMovimiento:true},gastos:{administrar:true}}}}),body=command(f),before=copy(f.state.sisventas);
 if(mode==='action')f.state.sv_permisos.admin.acciones.empleados.bonificar=false;
 if(mode==='module')f.state.sv_permisos.admin.indiceModulos.empleados=false;
 if(mode==='role')f.state.sv_chat_roles.u.rol='distribuidor';
 if(mode==='inactive')f.state.sv_chat_roles.u.activo=false;
 await assert.rejects(f.gateway.write(mode==='claims'?{...actor,claims:{uid:'otro'}}:actor,body));unchanged(f,before);
});
test('an explicitly granted internal role is allowed while absent action defaults only to admin',async()=>{
 const f=fixture(2,{role:'administrativo',permission:{bloqueados:[],acciones:{empleados:{bonificar:true}}}});await write(f,command(f));assert.equal(f.commits.length,1);
 const denied=fixture(2,{role:'administrativo'}),before=copy(denied.state.sisventas);await assert.rejects(write(denied,command(denied)));unchanged(denied,before);
});
for(const mode of ['role','action','revision','inactive'])test('late '+mode+' change is revalidated immediately before commit',async()=>{
 const f=fixture(2,{permission:{bloqueados:[],acciones:{empleados:{bonificar:true,registrarHaberes:true},gastos:{administrar:true}}}}),body=command(f),before=copy(f.state.sisventas),read=f.store.read,calls={};
 f.store.read=async p=>{calls[p]=(calls[p]||0)+1;if(p==='sv_chat_roles/u'&&calls[p]===2){if(mode==='role')f.state.sv_chat_roles.u.rol='administrativo';if(mode==='inactive')f.state.sv_chat_roles.u.activo=false;}if(p==='sv_permisos/admin'&&calls[p]===2){if(mode==='action')f.state.sv_permisos.admin.acciones.empleados.bonificar=false;if(mode==='revision')f.state.sv_permisos.admin.indiceRevision++;}return read(p);};
 await assert.rejects(write(f,body));unchanged(f,before);
});
test('transport replay is one commit and a mismatching replay ID is rejected',async()=>{
 const f=fixture(),body=command(f);await write(f,body);await write(f,body);assert.equal(f.commits.length,1);
 const modified=copy(body);modified.value[Object.keys(modified.value)[0]].descripcion='cambio';await assert.rejects(write(f,modified));assert.equal(f.commits.length,1);
});
test('full business replay preserves paid and archived historical fields, while partial replay is rejected',async()=>{
 const f=fixture(),body=command(f);await write(f,body);const replay=copy(body);replay.id='bonus-batch-transport-002';for(const p of Object.keys(replay.value)){const record=f.get(p);Object.assign(record,{estado:'pagado',montoPagado:record.monto,pagos:{p:{monto:record.monto}},adjuntos:{a:{nombre:'Conservar'}}});apply(f.state,{[p]:record});replay.value[p]=record;replay.expectedHashes[p]=digest(record);}
 await write(f,replay);assert.equal(f.commits.length,2);for(const [p,value]of Object.entries(replay.value))assert.deepEqual(f.get(p),value);
 const partial=fixture(),b=command(partial),first=Object.keys(b.value)[0];apply(partial.state,{[first]:b.value[first]});b.expectedHashes[first]=digest(b.value[first]);const before=copy(partial.state.sisventas);await assert.rejects(write(partial,b));unchanged(partial,before);
});
for(const mode of ['create','edit','remove','replace-omit','recalculate'])test('generic writer cannot '+mode+' quantity metadata to bypass the batch purpose',async()=>{
 const f=fixture(),batch=command(f);if(mode!=='create')await write(f,batch);const p=Object.keys(batch.value).find(p=>p.includes('/ctaemp/')),body={id:'generic-quantity-bypass-001',kind:'set',path:p,value:copy(batch.value[p])};
 if(mode==='edit')body.value.bonificacionGrupoTotal+=1;
 if(mode==='remove'){body.path+='/bonificacionCantidad';body.value=null;}
 if(mode==='replace-omit')for(const field of Policy.META_FIELDS)delete body.value[field];
 if(mode==='recalculate'){body.value.bonificacionCantidad=3;body.value.monto=7.05;}
 const before=copy(f.state.sisventas),commits=f.commits.length;await assert.rejects(write(f,body));assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,commits);
});
test('regular payment/history updates keep the immutable quantity snapshot and legacy rows remain compatible',async()=>{
 const f=fixture(),batch=command(f);await write(f,batch);const paths=Object.keys(batch.value),value={};for(const p of paths){value[p+'/estado']='pagado_parcial';value[p+'/montoPagado']=1;value[p+'/pagos/p']={monto:1};}await write(f,{id:'generic-payment-update-001',kind:'patch',path:'',value});
 for(const p of paths){assert.equal(f.get(p).montoPagado,1);for(const field of Policy.META_FIELDS)assert.deepEqual(f.get(p)[field],batch.value[p][field]);}
 await write(f,{id:'legacy-bonus-compatible-001',kind:'set',path:'sisventas/ctaemp/e0/legacy',value:{tipo:'bonificacion',monto:5,estado:'aprobado'}});assert.equal(f.get('sisventas/ctaemp/e0/legacy').monto,5);
});
test('denying the authorized read of one employee rejects the entire group before any commit',async()=>{
 const f=fixture(),body=command(f),read=f.store.readAsUser,before=copy(f.state.sisventas);f.store.readAsUser=async(p,a)=>{if(p==='sisventas/empleados/e1')throw Object.assign(Error('denegado'),{statusCode:403});return read(p,a);};await assert.rejects(write(f,body),{statusCode:403});unchanged(f,before);
});
for(const mode of ['gasto','employee-account'])test('whole '+mode+' replacement cannot omit a quantity snapshot',async()=>{
 const f=fixture(),batch=command(f);await write(f,batch);const p=Object.keys(batch.value).find(p=>p.includes(mode==='gasto'?'/gastos/':'/ctaemp/')),record=copy(batch.value[p]);for(const field of Policy.META_FIELDS)delete record[field];
 const target=mode==='gasto'?p:'sisventas/ctaemp/e0',value=mode==='gasto'?record:{...f.get(target),[p.split('/').at(-1)]:record},before=copy(f.state.sisventas),count=f.commits.length;
 await assert.rejects(write(f,{id:'whole-replacement-bypass-001',kind:'set',path:target,value}));assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,count);
});
test('a completed batch cannot be partly replayed into another new employee',async()=>{
 const f=fixture(),first=command(f,{n:1});await write(f,first);const b=command(f,{id:'mixed-replay-batch-001'}),before=copy(f.state.sisventas),count=f.commits.length;await assert.rejects(write(f,b));assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,count);
});
test('a regular server history update preserves quantity metadata and still commits without the new purpose',async()=>{
 const f=fixture(),b=command(f);await write(f,b);const p=Object.keys(b.value)[0];await f.guard.run({uid:'sv-labor-service',mode:'server',operation:'service-write'},scope=>scope.update({[p+'/notaHistorial']:'Conservar atención'}));assert.equal(f.get(p).notaHistorial,'Conservar atención');assert.equal(f.commits.length,2);
});
test('guard rejects an input with the purpose but extra staged writes or an unsigned financial action',async()=>{
 for(const variant of ['extra','unsigned']){const f=fixture(),b=command(f),before=copy(f.state.sisventas),a={...actor,mode:'user',input:b,operation:'legacy-atomic',...(variant==='extra'?{role:'admin',permissionRevision:null,permissionDigest:digest({}),financialAction:'empleados.bonificar'}:{})};
  await assert.rejects(f.guard.run(a,scope=>scope.update({...b.value,...(variant==='extra'?{'sisventas/empleados/e0/nota':'injection'}:{})})));unchanged(f,before);
 }
});
