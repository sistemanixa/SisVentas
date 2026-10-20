'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,apply,copy}=require('./helpers/labor-ui-flow.cjs');
const Index=require('../cotizador/labor-index'),Calcs=require('../cotizador/commission-calculations');
const base=extra=>({tipo:'Fijo',esFijoBase:true,categoria:'Servicios',descripcion:'Internet',proveedor:'Ficticio',fecha:'2026-09-05',monto:100,montoPagado:0,estado:'pendiente',...extra});
function page(initial){
 const backend=createBackend(initial),p=backend.page();p.load(['_gastoFijoMesActual','_gastoFijoFirma','_gastoEsBaseFijaValida','_gastoFijoHash','_gastoFijoDescripcionMes','_gastoFijoFechaMes','generarGastosFijosMesSeguro']);p.refresh();
 p.context._gastoFijoMesActual=()=> '2026-10';p.context._gastosFijosMesProcesado='';p.context.mesLabel=()=> 'Octubre 2026';const status=[];p.context._mostrarEstadoGastosFijos=(message,kind)=>status.push({message,kind});
 const fixedKey='fijo_'+p.context._gastoFijoHash(p.context._gastoFijoFirma(base()))+'_2026_10';
 const ruleKey='periodico_emp_'+p.context._gastoFijoHash('e|r')+'_2026_10';
 function setGasto(key,value){const before=backend.get('sisventas/gastos/'+key);apply(backend.state,{['sisventas/gastos/'+key]:value});apply(backend.state,Index.planIndexDelta([{domain:'gastos',key,before,after:value}]));}
 function holdRules(){const get=p.context.fbGet;let release,entered;const gate=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{entered=resolve;});p.context.fbGet=async ref=>{const snapshot=await get(ref);if(new URL(ref.toString()).pathname==='/sisventas/gastos_periodicos_emp'){entered();await gate;}return snapshot;};return {release,ready};}
 return {backend,p,status,fixedKey,ruleKey,setGasto,holdRules};
}
test('recurrencia no reemplaza destino creado y pagado por otra sesión mientras carga reglas',async()=>{
 const f=page({gastos:{template:base()}}),gate=f.holdRules(),pending=f.p.context.generarGastosFijosMesSeguro();await gate.ready;
 const paid={descripcion:'Destino real conservado',fecha:'2026-10-05',monto:100,montoPagado:100,estado:'pagado',pagos:{p:{monto:100,fecha:'2026-10-05'}}};f.setGasto(f.fixedKey,paid);gate.release();await pending;
 assert.deepEqual(f.backend.get('sisventas/gastos/'+f.fixedKey),paid);assert.equal(f.backend.commits.length,0);assert.equal(f.status.at(-1).kind,'ok');
});
test('ocupación concurrente entre snapshot y commit provoca CAS y conserva el destino completo',async()=>{
 const f=page({gastos:{template:base()}});let changed=false;const occupied={descripcion:'Otro destino',monto:500,montoPagado:20,pagos:{p:{monto:20}},estado:'pagado_parcial'};
 f.backend.setHook(()=>{if(!changed){changed=true;f.setGasto(f.fixedKey,occupied);}});await f.p.context.generarGastosFijosMesSeguro();
 assert.deepEqual(f.backend.get('sisventas/gastos/'+f.fixedKey),occupied);assert.equal(f.backend.commits.length,0);assert.equal(f.backend.commands.length,1);assert.equal(f.backend.commands[0].kind,'atomic');
});
test('copia mensual usa base vigente y excluye su saldo legacy sin alterar origen ni pagos',async()=>{
 const original=base({montoPagado:50,saldoPagadoLegacy:40,pagos:{old:{monto:10}}}),f=page({gastos:{template:original}}),gate=f.holdRules(),pending=f.p.context.generarGastosFijosMesSeguro();await gate.ready;
 const fresh={...original,monto:175};f.setGasto('template',fresh);gate.release();await pending;
 const created=f.backend.get('sisventas/gastos/'+f.fixedKey);assert.equal(created.monto,175);assert.equal(created.montoPagado,0);assert.equal(created.saldoPagadoLegacy,undefined);assert.equal(created.pagos,undefined);assert.equal(Calcs.totalPagadoGasto({...created,pagos:{next:{monto:20}}}),20);assert.deepEqual(f.backend.get('sisventas/gastos/template'),fresh);
 assert.ok(f.backend.commands[0].expectedHashes['sisventas/gastos/template']);assert.ok(f.backend.commands[0].expectedHashes['sisventas/gastos/'+f.fixedKey]);
});
test('desactivar la base durante la espera impide crear el mes, sin borrar la plantilla',async()=>{
 const f=page({gastos:{template:base()}}),gate=f.holdRules(),pending=f.p.context.generarGastosFijosMesSeguro();await gate.ready;f.setGasto('template',base({recurrenciaActiva:false}));gate.release();await pending;
 assert.equal(f.backend.get('sisventas/gastos/'+f.fixedKey),null);assert.equal(f.backend.get('sisventas/gastos/template').recurrenciaActiva,false);assert.equal(f.backend.commits.length,0);
});
test('regla de empleado se compara al commit: usa importe vigente y no pierde pago del destino ocupado',async()=>{
 for(const occupied of [false,true]){
  const f=page({gastos_periodicos_emp:{e:{r:{activo:true,monto:100,descripcion:'Movilidad',tipo:'transporte'}}}});let changed=false;
  f.backend.setHook(()=>{if(changed)return;changed=true;apply(f.backend.state,{'sisventas/gastos_periodicos_emp/e/r/monto':175});if(occupied)f.setGasto(f.ruleKey,{monto:999,montoPagado:99,pagos:{p:{monto:99}},estado:'pagado_parcial'});});
  await f.p.context.generarGastosFijosMesSeguro();const created=f.backend.get('sisventas/gastos/'+f.ruleKey);assert.equal(created.monto,occupied?999:175);assert.equal(created.montoPagado,occupied?99:0);
  assert.ok(f.backend.commands[0].expectedHashes['sisventas/gastos_periodicos_emp/e/r']);assert.equal(f.backend.commands.every(command=>command.kind==='atomic'),true);
 }
});
test('fallar lectura de reglas no crea medio mes ni lo marca procesado para siempre',async()=>{
 const f=page({gastos:{template:base()}});f.p.context.fbGet=async()=>{throw Error('Reglas ficticias no disponibles');};await f.p.context.generarGastosFijosMesSeguro();
 assert.equal(f.backend.commits.length,0);assert.equal(f.p.context._gastosFijosMesProcesado,'');assert.equal(f.status.at(-1).kind,'error');assert.equal(f.backend.get('sisventas/gastos/'+f.fixedKey),null);
});
