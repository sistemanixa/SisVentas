'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createBackend,copy,apply}=require('./helpers/labor-ui-flow.cjs');
const {load,functionSource}=require('./helpers/app-functions.cjs');
const Permissions=require('../js/core/permission-index'),Index=require('../cotizador/labor-index');
const permissionsSource=fs.readFileSync(require.resolve('../js/modules/action-permissions.js'),'utf8');
const expense=extra=>({fecha:'2026-10-20',tipo:'Variable',categoria:'Otro',descripcion:'Gasto pagado ficticio',monto:100,montoPagado:20,estado:'pagado_parcial',medio:'Efectivo',empleadoId:'e',empleadoNombre:'Persona ficticia',pagos:{p1:{monto:20,medio:'Efectivo',ts:1,comprobante:{nombre:'Ficticio'}}},nota:'Historial a conservar',...extra});
const movement=(g,extra)=>({tipo:'gasto_empresa',monto:g.monto,montoPagado:g.montoPagado,estado:g.estado,gastoFbKey:'g',pagos:copy(g.pagos),...extra});
const required=['rolActualNormalizado','esAdmin','svCapturarContextoOperacion','_gastoTieneHistoriaLiquidada','_gastoEstaRetirado','_gastoBaseEdicion','_gastoEmpleadosVinculados','_gastoMovimientosDesdeValores','_eliminarGastoAtomico','eliminarRegistro'];
function fixture({g=expense(),account,role='admin',override,blocked=[],initial={}}={}){
 const f=createBackend({gastos:{g},ctaemp:account||{e:{m:movement(g)}},haberes:{e:{'2026_10':{sueldoBase:500,sueldoBruto:500,total:470,pagos:{salario:{monto:470}},adelantosAplicados:{m:{monto:30}}}}},pagos:{cliente:{ventaFbKey:'v',monto:80}},...initial});
 f.state.sv_chat_roles.u.rol=role;f.state.sv_permisos=Permissions.build(Object.fromEntries(['admin','administrativo','vendedor','tecnico'].map(r=>[r,{bloqueados:r===role?blocked:[],acciones:r===role&&override!==undefined?{gastos:{eliminar:override}}:{}}])));
 const page=f.page(),c=page.context;load(c,required);c.currentRole=role;c.PERMISOS_ROLES=copy(f.state.sv_permisos);c.isAuthenticated=true;c.gastosData=Object.entries(f.state.sisventas.gastos).map(([fbKey,x])=>({...copy(x),fbKey}));
 // Install the real action decisions without timers or unrelated UI wrappers.
 vm.runInContext(permissionsSource.slice(0,permissionsSource.indexOf('  function proteger('))+'})();',c);
 const confirmations=[],activities=[];let renders=0;
 c.svConfirm=async(message,options)=>{confirmations.push({message,options});return true;};c.renderTablaGastos=()=>{renders++;};c.actualizarMetricasGastos=()=>{};c.registrarActividad=(...args)=>activities.push(args);
 return {...f,page,c,confirmations,activities,get renders(){return renders;},original:copy(g),financialBefore:copy(f.state.sisventas),async remove(){return c.eliminarRegistro('gastos','g');}};
}
function retired(f){
 const saved=f.get('sisventas/gastos/g'),marker=saved?.bajaAdministrativa;assert.ok(marker,'The same expense retains its administrative retirement marker');assert.deepEqual(Object.keys(marker).sort(),['auditKey','ts','uid','usuario']);assert.equal(marker.uid,'u');assert.equal(marker.usuario,'Titular ficticio');assert.ok(Number.isFinite(marker.ts)&&marker.ts>0);assert.equal(typeof marker.auditKey,'string');assert.ok(marker.auditKey);
 const economic=copy(saved);delete economic.bajaAdministrativa;assert.deepEqual(economic,f.original,'Retirement cannot alter paid amounts, state, attachments or payment history');
 const audit=f.get('sisventas/auditoria_pagos/'+marker.auditKey);assert.equal(audit.accion,'baja_administrativa_gasto');assert.equal(audit.gastoFbKey,'g');assert.equal(audit.uid,'u');assert.equal(audit.usuario,marker.usuario);assert.equal(audit.ts,marker.ts);assert.deepEqual(audit.gastoAnterior,f.original);assert.ok(Array.isArray(audit.movimientosAnteriores));
 for(const branch of ['ctaemp','haberes','pagos','ventas'])assert.deepEqual(f.get('sisventas/'+branch),f.financialBefore[branch]??null,branch+' must remain byte-equivalent');
 assert.equal(f.commits.length,1);assert.equal(f.commands[0].purpose,'expense-removal');assert.ok(Object.keys(f.commits[0]).some(p=>p.startsWith('sv_labor_receipts/')));assert.equal(f.commits[0].sv_labor_guard,null);assert.deepEqual(f.direct,[]);
 for(const [p,v]of Object.entries(Index.buildIndex(f.state.sisventas)))assert.equal(f.get(p),v,p);
 return {saved,marker,audit};
}

for(const [label,change]of [['partial',{}],['complete',{montoPagado:100,estado:'pagado',pagos:{p1:{monto:100,medio:'Efectivo'}}}],['legacy state',{montoPagado:0,estado:'Pagado',pagos:{}}],['legacy balance',{montoPagado:0,estado:'pendiente',pagos:{},saldoPagadoLegacy:20}]])test('admin confirms administrative retirement of '+label+' expense with a visible paid-history warning',async()=>{
 const f=fixture({g:expense(change)});await f.remove();retired(f);assert.equal(f.confirmations.length,1);assert.match(f.confirmations[0].message,/pag|liquidad/i);assert.match(f.confirmations[0].message,/conserv|historial|no.*anul/i);
});

for(const kind of ['bonificacion','adelanto'])test('paid '+kind+' keeps its linked account, prior salary and compensations unchanged',async()=>{
 const g=expense({tipoPagable:kind,legacyKey:'ctaemp/e/m',movimientoCtaKey:'m'}),mov=movement(g,{tipo:kind,montoCompensado:kind==='adelanto'?15:0,compensaciones:kind==='adelanto'?{'2026_10':15}:{},periodoComputo:'2026-10'}),f=fixture({g,account:{e:{m:mov}}});await f.remove();const {audit}=retired(f);assert.deepEqual(audit.movimientosAnteriores,[{empKey:'e',key:'m',mov}]);
});

test('an expense whose summary is unpaid but whose linked account is paid is retired rather than physically deleted',async()=>{
 const g=expense({montoPagado:0,pagos:{},estado:'pendiente',tipoPagable:'bonificacion',movimientoCtaKey:'m'}),mov=movement(g,{tipo:'bonificacion',montoPagado:20,pagos:{paid:{monto:20}}}),f=fixture({g,account:{e:{m:mov}}});await f.remove();const {audit}=retired(f);assert.deepEqual(audit.movimientosAnteriores,[{empKey:'e',key:'m',mov}]);
});

test('the full-history audit orders every exact linked account reference by ASCII employee and key',async()=>{
 const g=expense({empleadoId:'z',empleadoFbKey:'e'}),f=fixture({g,account:{z:{b:movement(g),Z:movement(g)},e:{a:movement(g)}}});await f.remove();const {audit}=retired(f);assert.deepEqual(audit.movimientosAnteriores.map(r=>r.empKey+'/'+r.key),['e/a','z/Z','z/b']);
});

test('an unpaid expense and account without paid history still use one physical deletion and an audit',async()=>{
 const g=expense({montoPagado:0,pagos:{},estado:'pendiente'}),f=fixture({g});await f.remove();assert.equal(f.get('sisventas/gastos/g'),null);assert.equal(f.get('sisventas/ctaemp/e/m'),null);assert.equal(f.commits.length,1);assert.equal(f.commands[0].purpose,'expense-removal');const audit=Object.values(f.get('sisventas/auditoria_pagos'))[0];assert.equal(audit.accion,'eliminar_gasto');assert.deepEqual(audit.gastoAnterior,g);assert.deepEqual(f.get('sisventas/haberes'),f.financialBefore.haberes);
});

test('cancelling the paid warning performs no command, audit, cache update or financial change',async()=>{
 const f=fixture(),before=copy(f.state),cache=copy(f.c.gastosData);f.c.svConfirm=async message=>{f.confirmations.push({message});return false;};await f.remove();assert.deepEqual(f.state,before);assert.deepEqual(f.c.gastosData,cache);assert.equal(f.commands.length,0);assert.equal(f.renders,0);
});

for(const [label,opts]of [['nonadmin override',{role:'administrativo',override:true}],['technician override',{role:'tecnico',override:true}],['admin denied',{override:false}],['module denied',{blocked:['gastos']}]])test(label+' cannot retire even through the direct expense deletion function',async()=>{
 const f=fixture(opts),before=copy(f.state.sisventas);await assert.rejects(f.c._eliminarGastoAtomico({...copy(f.original),fbKey:'g'},'g'));assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);
});

for(const changed of ['uid','auth object','role','revision','preview'])test('changing '+changed+' during confirmation prevents sending the old retirement',async()=>{
 const f=fixture();let accept;f.c.svConfirm=()=>new Promise(resolve=>{accept=resolve;});const pending=f.remove();assert.equal(typeof accept,'function');if(changed==='uid')f.c.currentUserUid='other';if(changed==='auth object')f.c.fbAuth.currentUser={uid:'u'};if(changed==='role')f.c.currentRole='administrativo';if(changed==='revision')f.c.PERMISOS_ROLES.admin.indiceRevision++;if(changed==='preview')f.c._impersonacionOriginal={uid:'u'};accept(true);await pending;assert.equal(f.commands.length,0);assert.deepEqual(f.state.sisventas,f.financialBefore);
});

test('a payment arriving during confirmation rejects the stale expense instead of retiring its new history',async()=>{
 const f=fixture();let accept;f.c.svConfirm=()=>new Promise(resolve=>{accept=resolve;});const pending=f.remove();apply(f.state,{'sisventas/gastos/g/pagos/late':{monto:5},'sisventas/gastos/g/montoPagado':25});accept(true);await pending;assert.equal(f.get('sisventas/gastos/g/pagos/late/monto'),5);assert.equal(f.get('sisventas/gastos/g/bajaAdministrativa'),null);assert.equal(f.commits.length,0);
});

test('an account compensation changed after atomic reads is preserved; CAS retries with the new exact account snapshot',async()=>{
 const f=fixture({g:expense({tipoPagable:'adelanto',legacyKey:'ctaemp/e/m'})});let changed=false;f.setHook(()=>{if(!changed){changed=true;apply(f.state,{'sisventas/ctaemp/e/m/montoCompensado':15,'sisventas/ctaemp/e/m/compensaciones/2026_10':15});f.financialBefore.ctaemp=copy(f.get('sisventas/ctaemp'));}});await f.remove();assert.equal(f.get('sisventas/ctaemp/e/m/montoCompensado'),15);const {audit}=retired(f);assert.equal(audit.movimientosAnteriores[0].mov.montoCompensado,15);assert.equal(f.commands.length,2,'The stale CAS must be rejected before the one confirmed retry');assert.notEqual(f.commands[0].expectedHashes['sisventas/ctaemp/e'],f.commands[1].expectedHashes['sisventas/ctaemp/e']);
});

test('rejection of the final PATCH cannot leave a marker, audit, removed movement or changed cache',async()=>{
 const f=fixture(),before=copy(f.state.sisventas),cache=copy(f.c.gastosData);f.setRejectPatch(()=>{throw Object.assign(Error('Fictitious final denial'),{statusCode:403});});await f.remove();assert.deepEqual(f.state.sisventas,before);assert.deepEqual(f.c.gastosData,cache);assert.equal(f.commits.length,0);assert.match(f.page.messages.join(' '),/Fictitious final denial/);
});

test('a double click during confirmation or transmission creates one warning and one retirement audit',async()=>{
 const f=fixture();let accept;f.c.svConfirm=message=>{f.confirmations.push({message});return new Promise(resolve=>{accept=resolve;});};const first=f.remove(),second=f.remove();assert.equal(f.confirmations.length,1);accept(true);await Promise.all([first,second]);retired(f);assert.equal(Object.keys(f.get('sisventas/auditoria_pagos')).length,1);
});

test('only a confirmed retirement updates the retained cache and redraws the operative list',async()=>{
 const f=fixture();let release;const waiting=new Promise(resolve=>{release=resolve;});f.setHook(()=>waiting);const pending=f.remove();for(let i=0;i<50&&!f.commands.length;i++)await new Promise(setImmediate);assert.equal(f.commands.length,1);assert.equal(f.c.gastosData[0].bajaAdministrativa,undefined);assert.equal(f.renders,0);release();await pending;const {marker}=retired(f),cached=f.c.gastosData.find(g=>g.fbKey==='g');assert.ok(cached,'The canonical cache remains available to KPI/history');assert.deepEqual(copy(cached.bajaAdministrativa),marker);assert.ok(f.renders>0);
});

test('operative filters and saved KPI list rendering hide retirement while the canonical KPI eligibility and paid total remain unchanged',async()=>{
 const f=fixture(),paid=f.c.totalPagadoGasto(f.c.gastosData[0]);await f.remove();retired(f);load(f.c,['normalizarTipoGasto','_normFechaGasto','_gastoCorrespondeEmpleado','gastoVisibleEnModuloGastos','gastosFiltradosActuales','_claveGastoKpi','svGastoCoincideCategoria','renderTablaGastos']);
 f.c.fechaImputacionGasto=g=>g.fecha;assert.equal(f.c.gastoVisibleEnModuloGastos(f.c.gastosData[0]),true,'Do not globally remove the expense from KPI/history sources');assert.equal(f.c.totalPagadoGasto(f.c.gastosData[0]),paid);assert.equal(f.c.gastosFiltradosActuales().length,0);
 f.c._gastosDataReady=true;f.c._gastosPagoMultipleActivo=false;f.c._gastosSeleccionadosPago={};f.c.actualizarResumenPagoMultiple=()=>{};f.page.node('gas-bulk-head').setAttribute=()=>{};f.c._filtroGastosKpiActivo='pagados';f.c._gastosKpiDetalleKeys={pagados:new Set([f.c._claveGastoKpi(f.c.gastosData[0])])};f.c.renderTablaGastos();assert.equal(f.page.node('gastos-tbody').dataset.cantidadFiltrada,'0');assert.match(f.page.node('gastos-tbody').innerHTML,/Sin gastos registrados/);assert.equal(f.c.gastosData.length,1,'Retained canonical history must not be spliced out of cache');
});

test('a visual refresh failure after acknowledgement reports confirmed retirement without reverting or duplicating it',async()=>{
 const f=fixture();f.c.renderTablaGastos=()=>{throw Error('Fictitious repaint failure');};await f.remove();retired(f);assert.ok(!f.page.messages.some(m=>/^Error al eliminar:/i.test(m)));const before=copy(f.state.sisventas);await f.remove();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,1);
});

test('an identical server receipt replay cannot duplicate the marker or full-history audit',async()=>{
 const f=fixture();await f.remove();retired(f);const command=copy(f.commands[0]),actor=await f.gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer fixture-token'}}),before=copy(f.state.sisventas);await f.gateway.write(actor,command);assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,1);assert.equal(Object.keys(f.get('sisventas/auditoria_pagos')).length,1);
});

test('a lost HTTP acknowledgement preserves the real retirement and an exact receipt replay adds no second audit',async()=>{
 const f=fixture(),send=f.c.fetch;let lost=false;f.c.fetch=async(...args)=>{const response=await send(...args);if(response.ok&&!lost){lost=true;throw Error('Fictitious HTTP acknowledgement lost after commit');}return response;};await f.remove();retired(f);assert.equal(f.c.gastosData[0].bajaAdministrativa,undefined,'An uncertain UI cannot announce or cache a confirmed removal');const actor=await f.gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer fixture-token'}}),before=copy(f.state.sisventas);await f.gateway.write(actor,copy(f.commands[0]));assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,1);assert.equal(Object.keys(f.get('sisventas/auditoria_pagos')).length,1);
});

test('later explicit account linkage retains the retired expense and its financial history without recreating it',async()=>{
 const f=fixture();await f.remove();retired(f);const before=copy(f.state.sisventas);await f.c._crearGastoEmpresaDesdeMovimiento('e','m',f.get('sisventas/ctaemp/e/m'));assert.deepEqual(f.get('sisventas/gastos'),before.gastos);assert.deepEqual(f.get('sisventas/haberes'),before.haberes);assert.deepEqual(f.get('sisventas/pagos'),before.pagos);const account=f.get('sisventas/ctaemp');assert.equal(account.e.m.migradoAGastos,true);delete account.e.m.migradoAGastos;assert.deepEqual(account,before.ctaemp);assert.equal(Object.keys(f.get('sisventas/auditoria_pagos')).length,1);assert.ok(!Object.keys(f.commits.at(-1)).some(p=>p.startsWith('sisventas/gastos/')),'Account metadata cannot rewrite or recreate the retained expense');
});

for(const origin of ['fresh','stale'])for(const action of ['edit','pay','approve'])test(origin+' '+action+' from the expense interface cannot change a retired expense',async()=>{
 const g=expense({montoPagado:0,pagos:{},estado:'aprobado'}),f=fixture({g,account:{e:{m:movement(g,{montoPagado:20,pagos:{p1:{monto:20}}})}}}),oldCache=copy(f.c.gastosData);await f.remove();retired(f);load(f.c,['_guardarGastoCompletoAtomico']);const before=copy(f.state.sisventas),commands=f.commands.length;if(origin==='stale')f.c.gastosData=oldCache;const selected=f.c.gastosData[0];
 const task=action==='edit'?f.c._guardarGastoCompletoAtomico(copy(selected),'g',{...copy(g),descripcion:'Edición que no debe guardarse'},null):action==='pay'?f.c._registrarPagoGastoUnitario('g',10,'Efectivo',null,null):f.c._cambiarEstadoGastoVinculadoAtomico('g',{estado:'aprobado'},{estado:'aprobado'},false);
 await assert.rejects(task,/retirad|cambiaron/i);assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,1);assert.equal(f.commands.length,commands);
});

test('a legitimate account correction may update old payment media while preserving the retirement marker',async()=>{
 const f=fixture();await f.remove();retired(f);const marker=copy(f.get('sisventas/gastos/g/bajaAdministrativa')),salary=copy(f.get('sisventas/haberes')),mov=f.get('sisventas/ctaemp/e/m');await f.c._guardarMovimientoVinculadoAtomico('e','m',mov,{corregirMedio:{medio:'Transferencia',pago:copy(mov.pagos.p1),pagoIdx:'p1'}});assert.deepEqual(f.get('sisventas/gastos/g/bajaAdministrativa'),marker);assert.equal(f.get('sisventas/gastos/g/pagos/p1/medio'),'Transferencia');assert.equal(f.get('sisventas/ctaemp/e/m/pagos/p1/medio'),'Transferencia');assert.equal(f.get('sisventas/gastos/g/pagos/p1/monto'),20);assert.deepEqual(f.get('sisventas/haberes'),salary);assert.equal(f.commits.length,2);
});
