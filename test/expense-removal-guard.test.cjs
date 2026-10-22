'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,copy,apply}=require('./helpers/labor-ui-flow.cjs');
const {digest}=require('../cotizador/labor-guard');
const Policy=require('../cotizador/expense-removal-policy');
const Permissions=require('../js/core/permission-index');
const paid=extra=>({monto:100,montoPagado:20,estado:'pagado_parcial',empleadoId:'e',pagos:{p:{monto:20,medio:'Efectivo',comprobante:{nombre:'Conservar'}}},adjuntos:{a:{url:'https://example.invalid/a'}},...extra});
const linked=(g,extra)=>({gastoFbKey:'g',monto:g.monto,montoPagado:g.montoPagado,estado:g.estado,pagos:copy(g.pagos),...extra});
function fixture({g=paid(),account,permission,role='admin'}={}){
 const f=createBackend({gastos:{g},ctaemp:account??{e:{m:linked(g)}},haberes:{e:{octubre:{monto:500,pagos:{salario:500}}}},gastos_adjuntos:{g:{a:{nombre:'Conservar'}}}});
 f.state.sv_chat_roles.u.rol=role;
 if(permission)f.state.sv_permisos=Permissions.build({admin:permission});
 return f;
}
function command(f,{id='expense-removal-fixture-001',auditKey='audit-ficticio'}={}){
 const g=f.get('sisventas/gastos/g'),accounts=Policy.employeeKeys(g),path='sisventas/gastos/g',auditPath='sisventas/auditoria_pagos/'+auditKey;
 const values=Object.fromEntries([path,...accounts.map(e=>'sisventas/ctaemp/'+e),auditPath].map(p=>[p,f.get(p)]));
 const refs=Policy.linkedMovements(values,accounts,g,'g'),logical=Policy.hasEconomicHistory(g)||refs.some(ref=>Policy.hasEconomicHistory(ref.mov));
 const audit={accion:logical?'baja_administrativa_gasto':g.tipoPagable==='adelanto'?'eliminar_adelanto_vinculado':'eliminar_gasto',gastoFbKey:'g',gastoAnterior:g,movimientosAnteriores:refs,uid:'u',usuario:'Titular ficticio',ts:1792620000000};
 const value={[auditPath]:audit};
 if(logical)value[path+'/bajaAdministrativa']={uid:'u',usuario:audit.usuario,ts:audit.ts,auditKey};
 else{value[path]=null;for(const ref of refs)value['sisventas/ctaemp/'+ref.empKey+'/'+ref.key]=null;}
 return {id,kind:'atomic',purpose:'expense-removal',path:'',value,expectedHashes:Object.fromEntries(Object.entries(values).map(([p,v])=>[p,digest(v)]))};
}
const actor={uid:'u',claims:{uid:'u',passwordAccessVersion:1}};
async function write(f,body){return f.gateway.write(actor,body);}
function unchanged(f,before){assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.equal(f.state.sv_labor_guard??null,null);}

for(const kind of ['normal','bonificacion','adelanto','haber','comision'])test('backend archives paid '+kind+' without altering payments, balances, attachments or commissions',async()=>{
 const g=paid(kind==='normal'?{}:{tipoPagable:kind,legacyKey:'ctaemp/e/m',movimientoCtaKey:'m'}),f=fixture({g}),before=copy(f.state.sisventas),body=command(f);
 await write(f,body);const saved=f.get('sisventas/gastos/g');delete saved.bajaAdministrativa;assert.deepEqual(saved,g);
 for(const branch of ['ctaemp','haberes','ventas','pagos','gastos_adjuntos'])assert.deepEqual(f.get('sisventas/'+branch),before[branch]??null);
 assert.equal(f.get('sisventas/auditoria_pagos/audit-ficticio').accion,'baja_administrativa_gasto');assert.equal(f.commits.length,1);
 assert.equal(Object.keys(f.commits[0]).filter(p=>p.startsWith('sisventas/')).length,2);assert.equal(f.commits[0].sv_labor_guard,null);
 assert.equal(f.reads.filter(([,p])=>p==='sisventas/ctaemp/e').length,1,'Authenticated CAS snapshot is reused by policy');
 assert.ok(!f.reads.some(([,p])=>['sisventas','sisventas/gastos','sisventas/ctaemp','sisventas/ventas','sisventas/pagos'].includes(p)));
});

test('admin with eliminar true and administrar false passes backend business authorization',async()=>{
 const f=fixture({permission:{bloqueados:[],acciones:{gastos:{eliminar:true,administrar:false}}}});await write(f,command(f));assert.equal(f.commits.length,1);
});

for(const mode of ['administrativo','tecnico','inactive','blocked','deny','revision'])test('backend rejects '+mode+' before a retirement commit',async()=>{
 const f=fixture(),body=command(f);if(['administrativo','tecnico'].includes(mode))f.state.sv_chat_roles.u.rol=mode;
 if(mode==='inactive')f.state.sv_chat_roles.u.activo=false;
 if(['blocked','deny','revision'].includes(mode))f.state.sv_permisos=Permissions.build({admin:{bloqueados:mode==='blocked'?['gastos']:[],acciones:{gastos:{eliminar:mode!=='deny'}}}});
 if(mode==='revision'){const original=f.store.acquire;f.store.acquire=async lease=>{await original(lease);f.state.sv_permisos.admin.indiceRevision++;};}
 const before=copy(f.state.sisventas);await assert.rejects(write(f,body));unchanged(f,before);
});

for(const mode of ['expense','account','new-linked-reference','audit'])test('CAS includes the full '+mode+' snapshot and rejects changes without a partial archive',async()=>{
 const f=fixture(),body=command(f);
 if(mode==='expense')apply(f.state,{'sisventas/gastos/g/nota':'new'});
 if(mode==='account')apply(f.state,{'sisventas/ctaemp/e/m/compensaciones/octubre':5});
 if(mode==='new-linked-reference')apply(f.state,{'sisventas/ctaemp/e/other':linked(paid())});
 if(mode==='audit')apply(f.state,{'sisventas/auditoria_pagos/audit-ficticio':{previo:true}});
 const before=copy(f.state.sisventas);await assert.rejects(write(f,body),{code:'SV_CAS_CONFLICT'});unchanged(f,before);
});

for(const mode of ['role','inactive','action','revision'])test('the final pre-commit permission check rejects a late '+mode+' change',async()=>{
 const f=fixture({permission:{bloqueados:[],acciones:{gastos:{eliminar:true,administrar:false}}}}),body=command(f),before=copy(f.state.sisventas),read=f.store.read;const calls={};
 f.store.read=async path=>{
  calls[path]=(calls[path]||0)+1;
  if(path==='sv_chat_roles/u'&&calls[path]===2){if(mode==='role')f.state.sv_chat_roles.u.rol='administrativo';if(mode==='inactive')f.state.sv_chat_roles.u.activo=false;}
  if(path==='sv_permisos/admin'&&calls[path]===2){if(mode==='action')f.state.sv_permisos.admin.acciones.gastos.eliminar=false;if(mode==='revision')f.state.sv_permisos.admin.indiceRevision++;}
  return read(path);
 };
 await assert.rejects(write(f,body));unchanged(f,before);
});

for(const mode of ['missing-account','extra-account','root-source','child-source','amount-injection','delete-paid','whole-replacement','foreign-audit','wrong-actor','wrong-history'])test('backend rejects removal plan '+mode+' without side effects',async()=>{
 const f=fixture(),body=command(f);
 if(mode==='missing-account')delete body.expectedHashes['sisventas/ctaemp/e'];
 if(mode==='extra-account')body.expectedHashes['sisventas/ctaemp/other']=digest(null);
 if(mode==='root-source')body.expectedHashes['sisventas/ctaemp']=digest(f.get('sisventas/ctaemp'));
 if(mode==='child-source'){delete body.expectedHashes['sisventas/ctaemp/e'];body.expectedHashes['sisventas/ctaemp/e/m']=digest(f.get('sisventas/ctaemp/e/m'));}
 if(mode==='amount-injection')body.value['sisventas/gastos/g/monto']=999;
 if(mode==='delete-paid'){delete body.value['sisventas/gastos/g/bajaAdministrativa'];body.value['sisventas/gastos/g']=null;}
 if(mode==='whole-replacement'){const marker=body.value['sisventas/gastos/g/bajaAdministrativa'];delete body.value['sisventas/gastos/g/bajaAdministrativa'];body.value['sisventas/gastos/g']={...f.get('sisventas/gastos/g'),bajaAdministrativa:marker};}
 if(mode==='foreign-audit')body.value['sisventas/auditoria_pagos/audit-ficticio'].gastoFbKey='other';
 if(mode==='wrong-actor')body.value['sisventas/auditoria_pagos/audit-ficticio'].uid='other';
 if(mode==='wrong-history')body.value['sisventas/auditoria_pagos/audit-ficticio'].gastoAnterior.pagos.p.monto=999;
 const before=copy(f.state.sisventas);await assert.rejects(write(f,body));unchanged(f,before);
});

for(const mode of ['record','collection','children','compensated','linked-paid','archived'])test('legacy '+mode+' purge cannot bypass paid-history protection',async()=>{
 const g=mode==='compensated'?paid({montoPagado:0,pagos:{},estado:'pendiente',montoCompensado:10}):mode==='linked-paid'?paid({montoPagado:0,pagos:{},estado:'pendiente'}):paid(),f=fixture({g});
 if(mode==='linked-paid')apply(f.state,{'sisventas/ctaemp/e/m':linked(paid())});
 if(mode==='archived')apply(f.state,{'sisventas/gastos/g/bajaAdministrativa':{uid:'u',usuario:'u',ts:1,auditKey:'a'}});
 const before=copy(f.state.sisventas);let body={id:'legacy-expense-purge-fixture',kind:'set',path:'sisventas/gastos/g',value:null};
 if(mode==='collection')body={...body,path:'sisventas/gastos',value:null};
 if(mode==='children')body={...body,kind:'patch',path:'',value:Object.fromEntries(Object.keys(f.get('sisventas/gastos/g')).map(k=>['sisventas/gastos/g/'+k,null]))};
 await assert.rejects(write(f,body),{code:'SV_EXPENSE_REMOVAL_REQUIRED'});unchanged(f,before);
});

for(const mode of ['create','change','remove','replace-omit'])test('legacy cannot '+mode+' the retirement marker',async()=>{
 const f=fixture(),marker={uid:'u',usuario:'u',ts:1,auditKey:'a'};
 if(mode!=='create')apply(f.state,{'sisventas/gastos/g/bajaAdministrativa':marker});
 const before=copy(f.state.sisventas),body={id:'legacy-marker-fixture-001',kind:'set',path:'sisventas/gastos/g/bajaAdministrativa',value:mode==='remove'?null:{...marker,ts:2}};
 if(mode==='replace-omit'){body.path='sisventas/gastos/g';body.value=paid();}
 await assert.rejects(write(f,body),{code:'SV_EXPENSE_REMOVAL_REQUIRED'});unchanged(f,before);
});

test('a delivered archived advance can still be compensated by a legitimate coordinated historical operation',async()=>{
 const g=paid({tipoPagable:'adelanto',legacyKey:'ctaemp/e/m'}),f=fixture({g});await write(f,command(f));const marker=f.get('sisventas/gastos/g/bajaAdministrativa'),audit=f.get('sisventas/auditoria_pagos/audit-ficticio');
 await f.guard.run({uid:'sv-labor-service',mode:'server',operation:'compensar-adelanto-fixture'},scope=>scope.update({'sisventas/gastos/g/montoCompensado':15,'sisventas/gastos/g/compensaciones/2026_10':15,'sisventas/ctaemp/e/m/montoCompensado':15,'sisventas/ctaemp/e/m/compensaciones/2026_10':15}));
 assert.equal(f.get('sisventas/gastos/g/montoCompensado'),15);assert.deepEqual(f.get('sisventas/gastos/g/bajaAdministrativa'),marker);assert.deepEqual(f.get('sisventas/auditoria_pagos/audit-ficticio'),audit);assert.equal(f.commits.length,2);
 const before=copy(f.state.sisventas);await assert.rejects(f.guard.run({uid:'sv-labor-service',mode:'server',operation:'omit-marker-fixture'},scope=>scope.update({'sisventas/gastos/g':g})),{code:'SV_EXPENSE_REMOVAL_REQUIRED'});assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,2);
});

test('unpaid physical removal preserves the former joint deletion contract',async()=>{
 const g=paid({montoPagado:0,pagos:{},estado:'pendiente'}),f=fixture({g});await write(f,command(f));assert.equal(f.get('sisventas/gastos/g'),null);assert.equal(f.get('sisventas/ctaemp/e/m'),null);assert.equal(f.get('sisventas/auditoria_pagos/audit-ficticio').accion,'eliminar_gasto');assert.equal(f.commits.length,1);
 const legacy=fixture({g});await write(legacy,{id:'legacy-unpaid-delete-fixture',kind:'set',path:'sisventas/gastos/g',value:null});assert.equal(legacy.get('sisventas/gastos/g'),null);assert.equal(legacy.commits.length,1);
});

test('confirmed request replay returns its receipt without duplicating an audit or retirement',async()=>{
 const f=fixture(),body=command(f);await write(f,body);const before=copy(f.state);await write(f,body);assert.deepEqual(f.state,before);assert.equal(f.commits.length,1);
 const altered=copy(body);altered.value['sisventas/auditoria_pagos/audit-ficticio'].ts++;await assert.rejects(write(f,altered),{statusCode:409});assert.equal(f.commits.length,1);
});

test('final store denial leaves neither marker nor audit nor changed account',async()=>{
 const f=fixture(),body=command(f),before=copy(f.state.sisventas);f.setRejectPatch(()=>{throw Object.assign(Error('Synthetic commit rejection'),{statusCode:403});});await assert.rejects(write(f,body),{statusCode:403});unchanged(f,before);
});

test('browser atomic accepts only the closed removal purpose and retains session protections',async()=>{
 const f=fixture(),p=f.page(),body=command(f),paths=Object.keys(body.expectedHashes);
 await assert.rejects(p.context.SVLaborWrites.atomic({paths,purpose:'expense-removal-anything',build:()=>body.value}),{code:'SV_LABOR_ATOMIC'});assert.equal(f.commands.length,0);
 await p.context.SVLaborWrites.atomic({paths,purpose:'expense-removal',build:()=>copy(body.value)});assert.equal(f.commands.length,1);assert.equal(f.commands[0].purpose,'expense-removal');assert.equal(f.commits.length,1);assert.equal(p.holds,0);
});
