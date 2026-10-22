'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,copy,apply}=require('./helpers/labor-ui-flow.cjs');
const {readActiveApp}=require('./helpers/active-app');
const source={tipo:'Fijo',esFijoBase:true,categoria:'Servicios',descripcion:'Internet ficticio',proveedor:'Ficticio',fecha:'2026-09-05',monto:100,montoPagado:0,estado:'pendiente'};
function fixture(initial={}){
 const backend=createBackend({gastos:{template:source},gastos_periodicos_emp:{e:{r:{activo:true,monto:80,descripcion:'Movilidad ficticia',tipo:'transporte'}}},...initial}),p=backend.page(),c=p.context,confirmations=[],status=[];
 p.load(['svCapturarContextoOperacion','_gastoFijoMesActual','_gastoFijoFirma','_gastoEsBaseFijaValida','_gastoFijoHash','_gastoFijoDescripcionMes','_gastoFijoFechaMes','generarGastosFijosMesSeguro','confirmarGeneracionGastosMes','_programarTareasSecundariasGastos','fbCargarGastos']);
 c._gastoFijoMesActual=()=> '2026-10';c._gastosFijosMesProcesado='';c._gastosUnsubscribe=null;c._gastosDataReady=false;c._gastosTareasDiferidasTimer=null;c._gastosPagosCache=null;c._gastosFechaImputacionCache=null;c._gastosCargaError='';c.ctaEmpActual=null;c.navigator={onLine:true};c.mesLabel=()=> 'Octubre 2026';
 let allowed=true,confirm=async()=>true;
 c.tienePermiso=permission=>permission!=='gastos.recurrencias'||allowed;
 c.svConfirm=async(message,options)=>{confirmations.push({message,options});return confirm();};
 c._mostrarEstadoGastosFijos=(message,kind)=>status.push({message,kind});p.refresh();
 const modal=p.node('modal-gastos-recurrentes'),button=p.node('gastos-recurrentes-generar'),state=p.node('gastos-recurrentes-generacion-estado');button.innerHTML='Generar gastos del mes';
 return {backend,p,c,modal,button,state,confirmations,status,allow(value){allowed=value;},confirm(fn){confirm=fn;},run:()=>c.confirmarGeneracionGastosMes()};
}
test('snapshot inicial, siguiente snapshot y navegación sólo programan UI: cero generación, lectura de reglas o guardado',async()=>{
 const f=fixture(),timers=[];f.c.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};f.c.clearTimeout=()=>{};f.c.document.getElementById=()=>null;f.c.svPuedeLeerDominio=()=>true;f.c._paginaGastosActiva=()=>false;f.c._svEsPaginaActiva=()=>false;
 for(const name of ['_actualizarBadgeSolicitudesGastos','actualizarTarjetaComisionadosVenta','marcarDashboardDatosSucios','solicitarRenderDashboard'])f.c[name]=()=>{};
 let snapshot;f.c._svSuscribirGastos=callback=>{snapshot=callback;callback({val:()=>f.backend.get('sisventas/gastos')});return()=>{};};
 f.c.fbCargarGastos();snapshot({val:()=>f.backend.get('sisventas/gastos')});f.c.fbCargarGastos();for(const timer of timers)timer.fn();await Promise.resolve();
 assert.equal(f.backend.commands.length,0);assert.equal(f.backend.commits.length,0);assert.equal(f.backend.reads.length,0);assert.equal(Object.keys(f.backend.state.sisventas.gastos).length,1);assert.equal(f.confirmations.length,0);
});
test('acción explícita prepara sin escribir y confirma mes, cantidad e importe antes de un único commit',async()=>{
 const f=fixture(),before=copy(f.backend.state.sisventas);f.confirm(async()=>{assert.equal(f.backend.commands.length,0);assert.equal(f.button.disabled,true);assert.match(f.state.textContent,/2026-10.*2 gastos nuevos.*180,00/);return true;});await f.run();
 assert.match(f.confirmations[0].message,/2026-10: 2 gastos nuevos por \$180,00/);assert.equal(f.backend.commits.length,1);assert.equal(f.backend.commands.length,1);assert.equal(Object.keys(f.backend.state.sisventas.gastos).length,3);assert.deepEqual(f.backend.get('sisventas/gastos/template'),before.gastos.template);assert.deepEqual(f.backend.get('sisventas/gastos_periodicos_emp'),before.gastos_periodicos_emp);assert.deepEqual(f.backend.get('sisventas/ventas'),before.ventas);assert.deepEqual(f.backend.get('sisventas/ctaemp'),before.ctaemp);assert.equal(f.backend.direct.length,0);assert.equal(f.button.disabled,false);assert.match(f.state.textContent,/Se generaron 2/);
});
test('cancelar mantiene reglas, gastos y pagos: ninguna escritura ni solicitud al gateway',async()=>{
 const f=fixture(),before=copy(f.backend.state);f.confirm(async()=>false);await f.run();assert.deepEqual(f.backend.state,before);assert.equal(f.backend.commands.length,0);assert.equal(f.backend.commits.length,0);assert.match(f.state.textContent,/cancelada/);assert.equal(f.button.disabled,false);
});
test('sin permiso, offline o modal cerrado no inicia lecturas ni envíos',async()=>{
 for(const mode of ['permission','offline','closed','view']){const f=fixture();if(mode==='permission')f.allow(false);if(mode==='offline')f.c.navigator.onLine=false;if(mode==='closed')f.modal.isConnected=false;if(mode==='view')f.c._impersonacionOriginal={uid:'otro'};await f.run();assert.equal(f.backend.reads.length,0);assert.equal(f.backend.commands.length,0);assert.equal(f.confirmations.length,0);}
});
test('cambiar UID, Auth, rol, revisión o Ver como mientras se lee no presenta confirmación ni guarda',async()=>{
 for(const change of [c=>c.currentUserUid='otro',c=>c.fbAuth.currentUser={uid:'u'},c=>c.currentRole='administrativo',c=>c.PERMISOS_ROLES.admin.indiceRevision++,c=>c._impersonacionOriginal={uid:'otro'}]){const f=fixture(),get=f.c.fbGet;f.c.fbGet=async ref=>{const snap=await get(ref);change(f.c);return snap;};await f.run();assert.equal(f.backend.commits.length,0);assert.equal(f.backend.commands.length,0);assert.equal(f.confirmations.length,0);assert.equal(f.button.disabled,false);}
});
test('revocar permiso, cerrar modal, cerrar sesión o cambiar mes durante confirmación impide el envío',async()=>{
 for(const mode of ['permission','closed','session','month']){const f=fixture();f.confirm(async()=>{if(mode==='permission')f.allow(false);if(mode==='closed')f.modal.isConnected=false;if(mode==='session')f.c.currentUserUid='otro';if(mode==='month')f.c._gastoFijoMesActual=()=> '2026-11';return true;});await f.run();assert.equal(f.backend.commits.length,0);assert.equal(f.backend.commands.length,0);}
});
test('doble clic comparte bloqueo de UI; repetir la acción después no duplica y no depende de gastosData antiguo',async()=>{
 const f=fixture();let resolve,entered;const gate=new Promise(r=>resolve=r),ready=new Promise(r=>entered=r);f.confirm(async()=>{entered();return gate;});const first=f.run();await ready;await f.run();assert.equal(f.confirmations.length,1);resolve(true);await first;assert.equal(f.backend.commits.length,1);const commands=f.backend.commands.length;f.confirm(async()=>true);await f.run();assert.equal(f.backend.commands.length,commands);assert.equal(f.backend.commits.length,1);assert.match(f.state.textContent,/No hay gastos nuevos/);
});
test('fallo de lectura muestra error recuperable, libera botón y un reintento explícito funciona',async()=>{
 const f=fixture(),get=f.c.fbGet;f.c.fbGet=async()=>{throw Error('Lectura ficticia fallida');};await f.run();assert.match(f.state.textContent,/No se pudo completar.*Lectura ficticia fallida/);assert.equal(f.button.disabled,false);assert.equal(f.backend.commits.length,0);f.c.fbGet=get;await f.run();assert.equal(f.backend.commits.length,1);
});

test('un fallo visual después del acuse conserva el éxito y no vuelve a generar al reintentar',async()=>{
 for(const mode of ['status','month-label']){const f=fixture();if(mode==='status')f.c._mostrarEstadoGastosFijos=()=>{throw Error('Aviso ficticio roto');};else f.c.mesLabel=()=>{throw Error('Etiqueta ficticia rota');};await f.run();assert.equal(f.backend.commits.length,1);assert.equal(f.backend.commands.length,1);assert.equal(f.c._gastosFijosMesProcesado,'2026-10');assert.match(f.state.textContent,/Se generaron 2 gastos/);assert.equal(f.button.disabled,false);await f.run();assert.equal(f.backend.commits.length,1);assert.equal(f.backend.commands.length,1);assert.match(f.state.textContent,/No hay gastos nuevos/);}
});

test('fallar el aviso no oculta un rechazo real del comando ni informa un guardado inexistente',async()=>{
 const f=fixture();f.c._mostrarEstadoGastosFijos=()=>{throw Error('Aviso ficticio roto');};f.backend.setRejectPatch(()=>{throw Error('Comando ficticio rechazado');});await f.run();assert.equal(f.backend.commands.length,1);assert.equal(f.backend.commits.length,0);assert.equal(f.c._gastosFijosMesProcesado,'');assert.match(f.state.textContent,/No se pudo completar.*Comando ficticio rechazado/);assert.equal(f.button.disabled,false);assert.equal(Object.keys(f.backend.state.sisventas.gastos).length,1);
});
test('cambiar importe o pausar regla tras preview obliga a revisar; nunca guarda el importe nuevo sin confirmarlo',async()=>{
 for(const change of [{monto:175},{recurrenciaActiva:false}]){const f=fixture();f.confirm(async()=>{apply(f.backend.state,{'sisventas/gastos/template':{...source,...change}});return true;});await f.run();assert.equal(f.backend.commits.length,0);assert.match(f.state.textContent,/Cambió una regla/);assert.deepEqual(f.backend.get('sisventas/gastos/template'),{...source,...change});}
});
test('CAS detecta regla cambiada entre lectura y commit y conserva el origen y pagos existentes',async()=>{
 const f=fixture();let changed=false;f.backend.setHook(()=>{if(changed)return;changed=true;apply(f.backend.state,{'sisventas/gastos_periodicos_emp/e/r/monto':300});});await f.run();assert.equal(f.backend.commits.length,0);assert.equal(f.backend.commands.length,1);assert.match(f.state.textContent,/Cambió una regla/);assert.equal(f.backend.get('sisventas/gastos_periodicos_emp/e/r/monto'),300);
});
test('ocupación concurrente del destino conserva su importe y pagos, y sólo genera el otro destino',async()=>{
 const f=fixture();let destination,paid;f.confirm(async()=>{destination='fijo_'+f.c._gastoFijoHash(f.c._gastoFijoFirma(source))+'_2026_10';paid={descripcion:'Otro gasto ya pagado',monto:999,montoPagado:999,estado:'pagado',pagos:{p:{monto:999}}};apply(f.backend.state,{['sisventas/gastos/'+destination]:paid});return true;});await f.run();assert.deepEqual(f.backend.get('sisventas/gastos/'+destination),paid);assert.equal(f.backend.commits.length,1);assert.match(f.state.textContent,/Se generaron 1/);
});
test('un gasto mensual legacy con clave aleatoria evita proponer y crear otra copia',async()=>{
 const f=fixture({gastos:{template:source,random:{...source,fecha:'2026-10-05',esFijoBase:false,monto:100,montoPagado:100,estado:'pagado',pagos:{p:{monto:100}}}},gastos_periodicos_emp:{}});await f.run();assert.equal(f.confirmations.length,0);assert.equal(f.backend.commits.length,0);assert.equal(f.backend.commands.length,0);assert.equal(Object.keys(f.backend.state.sisventas.gastos).length,2);
});
test('no inventa un total para reglas con importe inválido',async()=>{
 const f=fixture({gastos:{template:{...source,monto:'no es importe'}},gastos_periodicos_emp:{}});await f.run();assert.equal(f.confirmations.length,0);assert.equal(f.backend.commits.length,0);assert.match(f.state.textContent,/importe inválido/);
});
test('el gestor ofrece acción y texto de generación explícita sin modificar permisos ni programación del resto',()=>{
 const source=readActiveApp().source;assert.match(source,/id="gastos-recurrentes-generar"[^>]*onclick="confirmarGeneracionGastosMes\(\)"/);assert.match(source,/Abrir el sistema o consultar este listado no genera gastos/);const scheduler=source.slice(source.indexOf('function _programarTareasSecundariasGastos('),source.indexOf('function _svSuscribirGastos('));assert.doesNotMatch(scheduler,/generarGastosFijosMesSeguro\s*\(/);assert.match(scheduler,/renderModuloComisiones/);assert.match(scheduler,/generarNotificaciones/);
});
