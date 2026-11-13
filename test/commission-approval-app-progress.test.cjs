'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend}=require('./helpers/labor-ui-flow.cjs');

function fixture(){
 const gasto={tipoPagable:'comision',estado:'pendiente_aprobacion',requiereAprobacion:true,monto:100,montoPagado:0,gananciaBase:1000,pct:10,empleadoId:'e',empleadoFbKey:'e',legacyKey:'ctaemp/e/m',audit:[{accion:'Conservar'}]},movement={tipo:'comision',estado:'pendiente',monto:100,pct:10,gananciaBase:1000,gastoFbKey:'g'};
 const backend=createBackend({gastos:{g:gasto},ctaemp:{e:{m:movement}},inventario_operativo:{p:{general:22}},pagos:{keep:{monto:77}}}),page=backend.page();page.refresh();page.load(['aprobarComisionDesdeGasto']);
 const trace={confirm:0,refreshExpenses:0,refreshAccounts:0,stages:[]};
 page.context.svConfirm=async()=>{trace.confirm++;assert.equal(trace.stages.at(-1),'confirming');return true;};
 page.context.fbCargarGastos=()=>trace.refreshExpenses++;page.context.cargarCtaEmp=()=>trace.refreshAccounts++;
 const originalAtomic=page.context.SVLaborWrites.atomic;page.context.SVLaborWrites.atomic=async options=>{assert.equal(trace.stages.at(-1),'saving');return originalAtomic(options);};
 return {...backend,page,trace,options:{quietRefresh:true,quietNotify:true,throwOnError:true,onProgress:stage=>trace.stages.push(stage)}};
}

test('the real approval returns its guarded ACK and reports confirming/saving without global refreshes or duplicate notifications for a modal caller',async()=>{
 const f=fixture(),before=structuredClone(f.state.sisventas),result=await f.page.context.aprobarComisionDesdeGasto('g',f.options);
 assert.equal(result.committed,true);assert.deepEqual(f.trace,{confirm:1,refreshExpenses:0,refreshAccounts:0,stages:['confirming','saving']});assert.deepEqual(f.page.messages,[]);
 assert.equal(f.commands.length,1);assert.equal(f.commits.length,1);assert.equal(f.commands[0].kind,'atomic');assert.equal(f.commands[0].purpose,undefined);
 assert.deepEqual(Object.keys(f.commands[0].value).sort(),['sisventas/ctaemp/e/m','sisventas/gastos/g']);
 for(const path of ['gastos/g','ctaemp/e/m']){const old=path.split('/').reduce((v,k)=>v[k],before),actual=f.get('sisventas/'+path);for(const field of ['monto','montoPagado','pct','gananciaBase','audit'])assert.deepEqual(actual[field],old[field]);}
 assert.equal(f.get('sisventas/gastos/g/estado'),'pendiente_pago');assert.equal(f.get('sisventas/ctaemp/e/m/estado'),'aprobado');
 for(const domain of ['ventas','pagos','inventario_operativo'])assert.deepEqual(f.get('sisventas/'+domain),before[domain]);
 assert(!f.reads.some(([,p])=>['sisventas/gastos','sisventas/ctaemp','sisventas/ventas','sisventas/pagos'].includes(p)));assert.deepEqual(f.direct,[]);
});

test('cancel keeps confirmation mandatory and returns an explicit cancelled result without any read, write, refresh or toast',async()=>{
 const f=fixture();f.page.context.svConfirm=async()=>{f.trace.confirm++;return false;};const reads=f.reads.length,before=structuredClone(f.state.sisventas);
 const result=await f.page.context.aprobarComisionDesdeGasto('g',f.options);
 assert.equal(result.committed,false);assert.equal(result.cancelled,true);assert.deepEqual(f.trace.stages,['confirming']);assert.equal(f.trace.confirm,1);assert.equal(f.reads.length,reads);assert.equal(f.commands.length+f.commits.length,0);assert.deepEqual(f.state.sisventas,before);assert.deepEqual(f.page.messages,[]);assert.equal(f.trace.refreshExpenses+f.trace.refreshAccounts,0);
});

test('throwOnError propagates a rejected guarded commit and quiet caller receives neither success nor duplicate error notification',async()=>{
 const f=fixture(),before=structuredClone(f.state.sisventas);f.setRejectPatch(()=>{throw Object.assign(Error('Cuenta ficticia rechazada'),{statusCode:403});});
 await assert.rejects(f.page.context.aprobarComisionDesdeGasto('g',f.options),error=>error.statusCode===403&&/Cuenta ficticia rechazada/.test(error.message));
 assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.equal(f.commands.length,1);assert.deepEqual(f.trace.stages,['confirming','saving']);assert.deepEqual(f.page.messages,[]);assert.equal(f.trace.refreshExpenses+f.trace.refreshAccounts,0);
});

test('legacy callers retain permission checks, confirmation, success notification and both refreshes',async()=>{
 const f=fixture();f.page.context.svConfirm=async()=>{f.trace.confirm++;return true;};const real=f.page.context.SVLaborWrites.atomic;f.page.context.SVLaborWrites.atomic=options=>{f.trace.stages.push('saving');return real(options);};
 const result=await f.page.context.aprobarComisionDesdeGasto('g');assert.equal(result.committed,true);assert.equal(f.trace.confirm,1);assert.equal(f.trace.refreshExpenses,1);assert.equal(f.trace.refreshAccounts,1);assert.equal(f.page.messages.length,1);assert.match(f.page.messages[0],/Comisión aprobada/);
});

test('permission denial cannot be bypassed by silent/progress options and never reaches confirmation or the gateway',async()=>{
 const f=fixture();f.page.context.tienePermiso=()=>false;
 await assert.rejects(f.page.context.aprobarComisionDesdeGasto('g',f.options),/Solo el administrador/);assert.equal(f.trace.confirm,0);assert.deepEqual(f.trace.stages,[]);assert.equal(f.commands.length+f.commits.length,0);assert.deepEqual(f.page.messages,[]);
 const result=await f.page.context.aprobarComisionDesdeGasto('g');assert.equal(result.committed,false);assert.match(f.page.messages[0],/Solo el administrador/);assert.equal(f.trace.confirm,0);
});

test('a noncommitted helper response cannot produce a success ACK, refresh or success toast',async()=>{
 const f=fixture(),answer={committed:false,localNoop:true};f.page.context.SVLaborWrites.atomic=async()=>answer;
 const result=await f.page.context.aprobarComisionDesdeGasto('g',f.options);assert.equal(result,answer);assert.equal(result.committed,false);assert.equal(f.trace.confirm,1);assert.deepEqual(f.trace.stages,['confirming','saving']);assert.equal(f.trace.refreshExpenses+f.trace.refreshAccounts,0);assert.deepEqual(f.page.messages,[]);assert.equal(f.commands.length+f.commits.length,0);
});

test('legacy failure remains notified and swallowed without confirming or refreshing a rejected write',async()=>{
 const f=fixture();f.page.context.svConfirm=async()=>true;f.page.context.SVLaborWrites.atomic=async()=>{throw Error('Fallo ficticio');};
 const result=await f.page.context.aprobarComisionDesdeGasto('g');assert.equal(result.committed,false);assert.match(f.page.messages[0],/Error aprobando comisión: Fallo ficticio/);assert.equal(f.trace.refreshExpenses+f.trace.refreshAccounts,0);assert.equal(f.commands.length+f.commits.length,0);
});

for(const [name,change,code]of [
 ['UID',c=>{c.currentUserUid='other';},'SV_LABOR_SESSION'],
 ['Auth object',c=>{c.fbAuth.currentUser={uid:'u'};},'SV_LABOR_SESSION'],
 ['Auth revoked',c=>{c.fbAuth.currentUser=null;},'SV_LABOR_SESSION'],
 ['role',c=>{c.currentRole='vendedor';},'SV_LABOR_SESSION'],
 ['permission revision',c=>{c.PERMISOS_ROLES.admin.indiceRevision=2;},'SV_LABOR_AUTH_CHANGED'],
 ['permission fields without revision',c=>{c.PERMISOS_ROLES.admin.acciones={comisiones:{aprobar:false}};},'SV_LABOR_AUTH_CHANGED'],
 ['live approval permission',c=>{c.tienePermiso=()=>false;},'SV_LABOR_AUTH_CHANGED'],
 ['operation epoch',c=>{c._svOperacionesSesionEpoch=1;},'SV_LABOR_SESSION'],
 ['data epoch',c=>{c._svDataEpoch=1;},'SV_LABOR_SESSION'],
 ['Ver como',c=>{c._impersonacionOriginal={uid:'u'};},'SV_LABOR_SESSION']
])test('a changed '+name+' while confirmation is open rejects the ORIGINAL approval context before any helper or gateway call',async()=>{
 const f=fixture(),before=structuredClone(f.state.sisventas),reads=f.reads.length;let release;
 f.page.context.svConfirm=async()=>{f.trace.confirm++;return new Promise(resolve=>{release=resolve;});};
 const pending=f.page.context.aprobarComisionDesdeGasto('g',f.options);assert.equal(typeof release,'function');change(f.page.context);release(true);
 await assert.rejects(pending,error=>error.code===code&&error.svLaborAttempted===false);
 assert.equal(f.trace.confirm,1);assert.deepEqual(f.trace.stages,['confirming']);assert.equal(f.commands.length+f.commits.length,0);assert.equal(f.reads.length,reads);assert.deepEqual(f.state.sisventas,before);assert.deepEqual(f.page.messages,[]);assert.equal(f.trace.refreshExpenses+f.trace.refreshAccounts,0);
});

test('a throwing saving progress callback cannot conceal revocation or bypass the original approval context check',async()=>{
 const f=fixture();f.options.onProgress=stage=>{f.trace.stages.push(stage);if(stage==='saving'){f.page.context.currentRole='vendedor';throw Error('Callback ficticio');}};
 await assert.rejects(f.page.context.aprobarComisionDesdeGasto('g',f.options),error=>error.code==='SV_LABOR_SESSION'&&error.svLaborAttempted===false);
 assert.deepEqual(f.trace.stages,['confirming','saving']);assert.equal(f.commands.length+f.commits.length,0);assert.equal(f.trace.refreshExpenses+f.trace.refreshAccounts,0);assert.deepEqual(f.page.messages,[]);
});
