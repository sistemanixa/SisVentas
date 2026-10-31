'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const {readActiveApp}=require('./helpers/active-app');
const source=fs.readFileSync('js/modules/ot-data-sync.js','utf8');
function setup(){
 const timers=[],writes=[],handlers={},input={value:'',placeholder:'',isConnected:true},maps={style:{}},detail={style:{display:'block'},isConnected:true},page={id:'page-ordentrabajo'};
 const nodes={'ot-det-dir':input,'ot-det-dir-maps-btn':maps,'ot-detalle-view':detail,'ot-list-view':{style:{display:'none'}}};
 const c={console,Date,setTimeout:fn=>{timers.push(fn);},currentUserUid:'a',currentRole:'admin',currentUser:'Persona A',fbAuth:{currentUser:{uid:'a'}},fbDB:{},
  document:{addEventListener:(name,fn)=>handlers[name]=fn,getElementById:id=>nodes[id]||null,querySelector:()=>page},
  otActualId:'A',otData:[{fbKey:'A'},{fbKey:'B'}],fbRef:(_db,path)=>path,fbUpdate:(path,value)=>{writes.push({path,value});return Promise.resolve();},
  _otResolverDireccionCliente:ot=>ot?('Dirección '+ot.fbKey):'',completarOT:()=>{writes.push({action:'completar',uid:c.currentUserUid});},volverListaOT:()=>writes.push({action:'volver'})};
 c.window=c;load(c,['svCapturarContextoOperacion']);vm.runInContext(source,c);
 return {c,timers,writes,input,maps,detail,nodes,page,open:id=>{c.otActualId=id;handlers['sisventas:ot-opened']({detail:{id}});}};
}

test('abrir A y después B descarta el timer A; cada dirección pertenece a la OT vigente sin escrituras',()=>{
 const f=setup();f.open('A');f.open('B');f.timers[0]();assert.equal(f.input.value,'');assert.equal(f.writes.length,0);
 f.timers[1]();assert.equal(f.input.value,'Dirección B');assert.equal(f.c._otDireccionActual,'Dirección B');assert.equal(f.writes.length,0);
 assert.equal(f.c.otData[0].dir,undefined);assert.equal(f.c.otData[1].dir,undefined);
});

test('timer OT no modifica otra sesión, rol, revisión, Ver como, página o detalle cerrado/reemplazado',()=>{
 const changes=[f=>{f.c.currentUserUid='b';f.c.fbAuth.currentUser={uid:'b'};},f=>{f.c.currentRole='vendedor';},f=>{f.c._svOperacionesSesionEpoch=1;},f=>{f.c.PERMISOS_ROLES={admin:{indiceRevision:1}};},f=>{f.c._impersonacionOriginal={uid:'a'};},f=>{f.c.document.querySelector=()=>({id:'page-dashboard'});},f=>{f.detail.style.display='none';},f=>{f.detail.isConnected=false;},f=>{f.nodes['ot-det-dir']={value:'Otra vista',isConnected:true};}];
 for(const change of changes){const f=setup();f.open('A');change(f);f.timers[0]();assert.equal(f.input.value,'');assert.equal(f.writes.length,0);assert.equal(f.c._otDireccionActual,undefined);}
});

test('no sustituye una dirección editada y el cierre explícito ya iniciado no se repite ni cierra otra OT',()=>{
 const f=setup();f.input.value='Dirección elegida';f.open('A');f.timers[0]();assert.equal(f.input.value,'Dirección elegida');assert.equal(f.writes.length,0);
 f.c.completarOT();assert.deepEqual(f.writes,[{action:'completar',uid:'a'}]);f.c.otData[1].estado='completada';f.open('B');f.timers[1]();assert.equal(f.writes.length,1);
});

test('el regreso diferido de un cierre explícito vigente conserva el comportamiento',()=>{
 const f=setup();f.c.otData[0].estado='completada';f.c.completarOT();f.timers[0]();assert.deepEqual(f.writes,[{action:'completar',uid:'a'},{action:'volver'}]);
});

test('abrir OT legada resuelve cliente/dirección en memoria sin persistir; vincular explícitamente sigue guardando',async()=>{
 const app=readActiveApp().source,start=app.indexOf('  // Las OT manuales antiguas guardaban sólo el nombre.'),end=app.indexOf('  // Mostrar/ocultar botón de Maps según si hay dirección',start);
 assert.ok(start>0&&end>start);const writes=[],input={value:'',dataset:{},style:{}};
 const c={console,Date,Promise,ot:{fbKey:'legacy',cliente:'Cliente ficticio'},esOTManual:true,document:{getElementById:()=>input},
  _svResolverClienteRegistro:()=>({fbKey:'client',id:'C-DEMO',nombre:'Cliente ficticio',dir:'Domicilio verificado'}),
  _otResolverDireccionCliente:ot=>ot.dir||'Domicilio verificado',clienteVinculoOperacion:()=>({clientePrincipalKey:'client',domicilioFbKey:'address',domicilioCategoria:'principal'}),
  fbGuardarOT:async ot=>{writes.push(JSON.parse(JSON.stringify(ot)));}};
 c.window=c;c.CHECKLISTS={};load(c,['normalizarChecklistOT','otHuellaDetalle','_otAplicarClienteVinculado']);vm.runInContext(app.slice(start,end),c);await Promise.resolve();
 assert.equal(writes.length,0);assert.equal(c.ot.dir,'Domicilio verificado');assert.equal(c.ot.clienteFbKey,'client');assert.equal(input.value,'Domicilio verificado');
 await c._otAplicarClienteVinculado(c.ot,{fbKey:'client',nombre:'Cliente ficticio',dir:'Cambio explícito'},true);
 assert.equal(writes.length,1);assert.equal(writes[0].dir,'Cambio explícito');
});

test('una OT ambigua no recibe vínculo ni domicilio inventado al abrir',()=>{
 const app=readActiveApp().source,start=app.indexOf('  // Las OT manuales antiguas guardaban sólo el nombre.'),end=app.indexOf('  // Mostrar/ocultar botón de Maps según si hay dirección',start);
 const input={value:''},c={ot:{fbKey:'ambiguous',cliente:'Nombre compartido'},esOTManual:true,document:{getElementById:()=>input},_svResolverClienteRegistro:()=>null,_otResolverDireccionCliente:()=>'',_otAplicarClienteVinculado:assert.fail,fbGuardarOT:assert.fail};
 vm.runInNewContext(app.slice(start,end),c);assert.equal(input.value,'');assert.equal(c.ot.clienteFbKey,undefined);assert.equal(c.ot.dir,undefined);
});
