'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {load}=require('./helpers/app-functions.cjs');
const scope=require('../js/core/ot-personal-scope.js');
const permissions=fs.readFileSync(path.join(__dirname,'../js/modules/action-permissions.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

function setup(role='tecnico'){
  const nodes={},calls={calendar:0,saves:[],messages:[],network:0,formReads:0};
  const employee={fbKey:'employee-demo',nombre:'Técnico ficticio'};
  const button={disabled:false,innerHTML:'Enviar para aprobación',isConnected:true};
  function element(){return {id:'',innerHTML:'',className:'',style:{},dataset:{},isConnected:false,addEventListener(){},removeEventListener(){},setAttribute(){},focus(){c.document.activeElement=this;},querySelector:selector=>selector==='.btn-primary'?button:null,remove(){this.isConnected=false;delete nodes[this.id];if(c.document.activeElement===this)c.document.activeElement=c.document.body;}};}
  const row={dataset:{fecha:'2026-10-19'},querySelector:selector=>({value:selector==='.hsex-horas-input'?'2':'Cliente ficticio'})};
  nodes['hsex-desc']={value:'Trabajo ficticio'};nodes['hsex-mes']={value:'2026-10'};
  const page={id:'page-dashboard'};
  const c={window:null,Date,Math,console,isAuthenticated:true,fbAuth:{currentUser:{uid:'user-demo'}},location:{hash:'#/dashboard'},addEventListener(){},removeEventListener(){},currentRole:role,currentUserUid:'user-demo',empData:{employee},usuariosData:[{uid:'user-demo',empleadoFbKey:'employee-demo'}],otData:[],SVOTPersonalScope:scope,
    PERMISOS_ROLES:Object.fromEntries(['tecnico','tecnico_vendedor','admin','administrativo','vendedor'].map(name=>[name,{bloqueados:[],acciones:{}}])),
    document:{hidden:false,visibilityState:'visible',addEventListener(){},removeEventListener(){},querySelector:selector=>selector==='.page.active'?page:null,getElementById:id=>nodes[id]||null,createElement:element,body:{appendChild(node){node.isConnected=true;nodes[node.id]=node;}},querySelectorAll:selector=>{assert.equal(selector,'#hsex-calendar-body .hsex-day-row');calls.formReads++;return [row];}},
    svFechaLocalISO:date=>date?[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-'):'2026-10-20',
    escapeHTML:value=>String(value||''),renderHsExtraCalendarGrid:()=>calls.calendar++,notify:message=>calls.messages.push(message),
    _hsexGuardarSolicitudUnificada:async(...args)=>{calls.saves.push(plain(args));return {committed:true};},
    fetch:()=>{calls.network++;assert.fail('No consultar la red');},fbGet:()=>{calls.network++;assert.fail('No leer datos reales');},fbUpdate:()=>{calls.network++;assert.fail('No modificar datos reales');}};
  c.window=c;vm.createContext(c);
  vm.runInContext(permissions.slice(0,permissions.indexOf('  function proteger('))+'})();',c);
  load(c,['svEmpleadoPropio','_hsexEmpleadoActual','otOrdenesEmpleado','otEstadoNormalizado','otEstaCerrada','_hsexFechaProgramadaOT','_hsexOTPendientesVencidas','cerrarBloqueoOTPendientesHsExtra','_hsexActivarDialogoBloqueoOT','abrirFormCargaHsExtra','enviarSolicitudHsExtra']);
  return {c,calls,nodes,employee,get html(){return nodes['modal-hsextra']?.innerHTML||'';},submit:()=>c.enviarSolicitudHsExtra(employee.fbKey,employee.nombre),override(value){c.PERMISOS_ROLES[role].acciones.empleados={horasConOTPendiente:value};}};
}
const order=(extra={})=>({id:'OT-DEMO',estado:'en_progreso',tecnicoFbKey:'employee-demo',fecha:'2026-10-09',...extra});

test('abrir horas con OT sin programar permite el formulario aunque su creación sea antigua',()=>{
  const f=setup();f.c.otData=[order({fecha:'',createdAt:'2020-01-01',ts:1,fechaProgramada:'2020-01-01'})];const before=JSON.stringify(f.c.otData);
  f.c.abrirFormCargaHsExtra();assert.match(f.html,/Cargar horas extra/);assert.doesNotMatch(f.html,/Primero completá tus OT/);assert.equal(f.calls.calendar,1);assert.equal(f.calls.saves.length,0);assert.equal(f.calls.network,0);assert.equal(JSON.stringify(f.c.otData),before);
});

for(const role of ['tecnico','tecnico_vendedor'])test(role+' con programación vencida bloquea antes de leer o guardar el formulario',async()=>{
  const f=setup(role);f.c.otData=[order()];f.c.abrirFormCargaHsExtra();assert.match(f.html,/Primero completá tus OT/);assert.match(f.html,/fecha programada vencida hace más de 10 días/);assert.match(f.html,/OT-DEMO/);assert.equal(f.calls.calendar,0);
  await f.submit();assert.equal(f.calls.saves.length,0);assert.equal(f.calls.formReads,0);assert.match(f.calls.messages[0],/OT vencida/);assert.equal(f.calls.network,0);
});

for(const role of ['admin','administrativo','vendedor'])test('la excepción predeterminada de '+role+' conserva apertura y presentación',async()=>{
  const f=setup(role);f.c.otData=[order()];f.c.abrirFormCargaHsExtra();assert.match(f.html,/Cargar horas extra/);assert.doesNotMatch(f.html,/Primero completá tus OT/);
  await f.submit();assert.equal(f.calls.saves.length,1);assert.equal(f.calls.saves[0][0],'employee-demo');assert.equal(f.calls.saves[0][2],'2026-10');assert.deepEqual(f.calls.saves[0][3],[{fecha:'2026-10-19',horas:2,lugar:'Cliente ficticio'}]);assert.equal(f.calls.network,0);assert.equal(f.c._hsexEnvioEnCurso,false);
});

test('la excepción configurable del técnico se revalida al enviar y su revocación bloquea el guardado',async()=>{
  const f=setup();f.c.otData=[order()];f.override(true);f.c.abrirFormCargaHsExtra();assert.match(f.html,/Cargar horas extra/);
  f.override(false);await f.submit();assert.equal(f.calls.saves.length,0);assert.match(f.html,/Primero completá tus OT/);assert.equal(f.calls.network,0);
});

test('una OT programada vencida después de abrir el formulario impide presentar las horas',async()=>{
  const f=setup(),ot=order({fecha:''});f.c.otData=[ot];f.c.abrirFormCargaHsExtra();assert.match(f.html,/Cargar horas extra/);
  ot.fecha='2026-10-09';await f.submit();assert.equal(f.calls.saves.length,0);assert.equal(f.calls.formReads,0);assert.match(f.html,/Primero completá tus OT/);assert.equal(f.calls.network,0);
});

for(const [label,change]of [['cierre',ot=>{ot.estado='Con observaciones';}],['desprogramación',ot=>{ot.fecha='';ot.fechaProgramada='2020-01-01';}],['reasignación',ot=>{ot.tecnicoFbKey='other-employee';}]])test('el envío usa la OT actual tras '+label+' y permite presentar sin alterar la orden',async()=>{
  const f=setup(),ot=order({fecha:'2026-10-20'});f.c.otData=[ot];f.c.abrirFormCargaHsExtra();assert.match(f.html,/Cargar horas extra/);
  ot.fecha='2026-10-09';change(ot);const before=JSON.stringify(f.c.otData);await f.submit();assert.equal(f.calls.saves.length,1);assert.equal(JSON.stringify(f.c.otData),before);assert.equal(f.calls.network,0);assert.equal(f.c._hsexEnvioEnCurso,false);
});

test('una fecha dentro del límite permite presentar y no elimina la aprobación posterior',async()=>{
  const f=setup();f.c.otData=[order({fecha:'2026-10-10'})];f.c.abrirFormCargaHsExtra();assert.match(f.html,/Enviar para aprobación/);await f.submit();assert.equal(f.calls.saves.length,1);assert.match(f.calls.messages.at(-1),/solicitud pendiente/);assert.equal(f.calls.network,0);
});
