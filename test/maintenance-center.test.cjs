'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourceRoot = process.env.SV_MAINTENANCE_SOURCE_ROOT || path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(sourceRoot, 'js/modules/maintenance-center.js'), 'utf8');

function fixture() {
  const listeners = new Map(), nodes = new Map(), calls = {reads:0, pages:[], loads:[], audits:[], modal:0, downloads:[], waits:[]};
  let active = 'configuracion', resolveReady;
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {style:{display:''}, textContent:'', hidden:false, disabled:false,appendChild(){},
      classList:{contains: name => name === 'active' && id === 'page-' + active}});
    return nodes.get(id);
  }
  const root = {
    document:{getElementById:node, querySelectorAll:()=>[],
      addEventListener:(name, fn)=>listeners.set(name, fn), body:{appendChild(){}},
      createElement:()=>({hidden:false,appendChild(){},click(){calls.downloads.push(this.download);},remove(){}})},
    fbAuth:{currentUser:{uid:'private-uid',email:'private@email.invalid'}}, currentUserUid:'private-uid',
    currentRole:'admin', fbDB:{}, _svOperacionesSesionEpoch:1, PERMISOS_ROLES:{admin:{indiceRevision:3}},
    permisoModulo:()=>true, tienePermiso:()=>true, navigator:{onLine:true}, SISVENTAS_PWA_VERSION:'3.22.2',
    clientesData:[{nombre:'PRIVATE_CLIENT'}], ventasData:[{token:'PRIVATE_TOKEN'}],
    fbGet(){calls.reads++;throw Error('Forbidden read');}, fetch(){calls.reads++;throw Error('Forbidden fetch');},
    AbortController, Blob, URL:{createObjectURL(blob){calls.blob=blob;return 'blob:fixture';}, revokeObjectURL(){}},
    setTimeout:fn=>fn(), notify(){}, showPage(page){calls.pages.push(page);active=page;},
    svCargarDatosDePaginaActual(page){calls.loads.push(page);},
    SVDataReadiness:{beginSource(){return {ready(){},error(){},cancel(){}};},waitForPage(page, options){calls.waits.push({page,options});return new Promise(resolve=>{resolveReady=resolve;});}},
    async abrirRevisionClientesDuplicados(){calls.modal++;},
    SVMaintenanceExpenses:{create:()=>({run:async()=>{calls.audits.push('expenses');return {kind:'expenses',complete:true,checked:1,total:1,results:[{label:'Registro 1',status:'ok',checks:['Origen comprobado'],issues:[]}]};}})},
    SVMaintenanceSales:{create:()=>({run:async()=>{calls.audits.push('sales');return {kind:'sales',complete:true,checked:0,total:0,results:[]};}})},
    SVCommercialPagesReader:{create:()=>({reset(){}})}
  };
  node('fb-status').textContent='Sincronizado';
  vm.runInNewContext(source,{window:root});
  return {root, api:root.SVMaintenanceCenter, calls, node,
    event(name,detail){listeners.get(name)?.({detail});},
    ready(result={ready:true}){resolveReady(result);}, navigate(page){active=page;}};
}

test('opening Maintenance does not audit; report requires a completed explicit review', async()=>{
  const f=fixture();f.api.initialize();assert.equal(f.api.generate(),false);assert.equal(f.api.download(),false);assert.deepEqual(f.calls.audits,[]);
  assert.equal(await f.api.openExpenses(),true);assert.equal(f.api.generate(),true);assert.equal(f.api.download(),true);
  const text=await f.calls.blob.text();
  assert.match(text,/Fecha:/);assert.match(text,/Versión: 3\.22\.2/);assert.match(text,/Conexión: Conectado/);assert.match(text,/GASTOS/);assert.match(text,/1 de 1 registros revisados/);
  for(const secret of ['private-uid','private@email.invalid','PRIVATE_CLIENT','PRIVATE_TOKEN','indiceRevision']) assert.equal(text.includes(secret),false);
  assert.equal(f.calls.reads,0);assert.equal(f.calls.downloads.length,1);
});

for(const [name,change] of [
  ['permission', f=>{f.root.tienePermiso=()=>false;}],
  ['role',f=>{f.root.currentRole='administrativo';}],
  ['revision',f=>{f.root.PERMISOS_ROLES.admin.indiceRevision++;}],
  ['session',f=>{f.root._svOperacionesSesionEpoch++;}],
  ['user identity',f=>{f.root.fbAuth.currentUser={uid:'private-uid'};}],
  ['impersonation',f=>{f.root._impersonacionOriginal={};}],
  ['hidden panel',f=>{f.node('cfg-mantenimiento').style.display='none';}]
]) test('export is rejected after '+name+' changes',async()=>{
  const f=fixture();assert.equal(await f.api.openExpenses(),true);assert.equal(f.api.generate(),true);change(f);assert.equal(f.api.download(),false);
  assert.equal(f.calls.downloads.length,0);assert.equal(f.node('mnt-diagnostic-output').hidden,true);assert.equal(f.calls.reads,0);
});

test('clients loads normal sources and waits while Maintenance stays active',async()=>{
  const f=fixture(), task=f.api.openClients();assert.deepEqual(f.calls.pages,[]);assert.deepEqual(f.calls.loads,['clientes']);assert.equal(f.calls.modal,0);
  assert.equal(f.calls.waits[0].page,'clientes');assert.equal(f.calls.waits[0].options.isCurrent(),true);
  f.ready();assert.equal(await task,true);assert.equal(f.calls.modal,1);assert.equal(f.calls.reads,0);
});

for(const [name,change] of [
  ['not ready',f=>{}], ['navigation',f=>{f.navigate('gastos');f.event('sisventas:page-changed',{page:'gastos'});}],
  ['cancelled session',f=>{f.event('sisventas:session-ended');}],
  ['late role',f=>{f.root.currentRole='administrativo';}],
  ['late revision',f=>{f.root.PERMISOS_ROLES.admin.indiceRevision++;}],
  ['late session',f=>{f.root._svOperacionesSesionEpoch++;}]
]) test('clients never opens modal after '+name,async()=>{
  const f=fixture(),task=f.api.openClients();change(f);f.ready({ready:name!=='not ready'});
  assert.equal(await task,false);assert.equal(f.calls.modal,0);assert.equal(f.calls.reads,0);
});

test('expense and sales reviews run without navigating away from Maintenance',async()=>{
  const f=fixture();assert.equal(await f.api.openExpenses(),true);assert.equal(await f.api.openSales(),true);
  assert.deepEqual(f.calls.pages,[]);assert.deepEqual(f.calls.audits,['expenses','sales']);assert.equal(f.calls.waits.length,0);assert.equal(f.calls.modal,0);assert.equal(f.calls.reads,0);
});

test('denied permissions block generation and navigation',async()=>{
  const f=fixture();f.root.tienePermiso=()=>false;assert.equal(f.api.generate(),false);assert.equal(await f.api.openClients(),false);
  assert.equal(await f.api.openExpenses(),false);assert.equal(await f.api.openSales(),false);assert.deepEqual(f.calls.pages,[]);assert.equal(f.calls.reads,0);
});

test('audit readers reject original collection roots before any read',async()=>{
 const f=fixture();f.root.SVMaintenanceExpenses.create=ports=>({run:async()=>{await ports.read('sisventas/ventas');throw Error('Unreachable');}});
 assert.equal(await f.api.openExpenses(),false);assert.equal(f.calls.reads,0);assert.equal(f.api.download(),false);
});

test('late audit completion after navigation cannot publish a report',async()=>{
 const f=fixture();let finish;f.root.SVMaintenanceExpenses.create=()=>({run:()=>new Promise(resolve=>{finish=resolve;})});
 const task=f.api.openExpenses();f.navigate('gastos');f.event('sisventas:page-changed',{page:'gastos'});
 finish({kind:'expenses',complete:true,checked:1,total:1,results:[]});assert.equal(await task,false);assert.equal(f.api.download(),false);assert.equal(f.node('mnt-review-progress').textContent,'');
});

test('offline and hidden review contexts cannot read financial originals',async()=>{
 for(const mode of ['offline','hidden']){const f=fixture();if(mode==='offline')f.root.navigator.onLine=false;else f.root.document.hidden=true;f.root.SVMaintenanceExpenses.create=ports=>({run:async()=>{await ports.read('sisventas/gastos/g');}});assert.equal(await f.api.openExpenses(),false);assert.equal(f.calls.reads,0);assert.equal(f.api.download(),false);}
});

for(const domain of ['ctaemp','aguinaldos'])test('payroll point '+domain+' uses account permission without unknown-domain rejection',async()=>{
 const f=fixture();let accessed;
 f.root.svPuedeLeerDominio=()=>false;f.root.fbRef=(_db,path)=>path;
 f.root.fbGet=async path=>{f.calls.reads++;accessed=path;return {val:()=>({tipo:'fixture'})};};
 f.root.SVMaintenanceExpenses.create=ports=>({run:async()=>{await ports.read('sisventas/'+domain+'/employee/record');return {kind:'expenses',complete:true,checked:0,total:0,results:[]};}});
 assert.equal(await f.api.openExpenses(),true);assert.equal(accessed,'sisventas/'+domain+'/employee/record');assert.equal(f.calls.reads,1);
});
for(const gate of ['module','action'])test('payroll point denies missing '+gate+' permission before SDK read',async()=>{
 const f=fixture();f.root.permisoModulo=name=>name!=='ctaemp'||gate!=='module';f.root.tienePermiso=name=>name!=='empleados.verCuentas'||gate!=='action';
 f.root.SVMaintenanceExpenses.create=ports=>({run:async()=>{await assert.rejects(ports.read('sisventas/ctaemp/employee/record'),e=>e.code==='permission-denied');return {kind:'expenses',complete:false,checked:0,total:0,results:[]};}});
 assert.equal(await f.api.openExpenses(),true);assert.equal(f.calls.reads,0);
});

test('explicit cancellation keeps completed findings in a downloadable partial report',async()=>{
 const f=fixture();let finish;const partial={kind:'sales',complete:false,partial:true,checked:12,total:100,results:[{key:'fixture',label:'Venta ficticia',status:'review',issues:['Referencia faltante.'],checks:['Historial comprobado']}],reads:15};
 f.root.SVMaintenanceSales.create=()=>({run:()=>new Promise(resolve=>{finish=resolve;}),snapshot:()=>JSON.parse(JSON.stringify(partial))});
 const task=f.api.openSales();f.api.cancelReview();assert.equal(f.api.download(),true);const text=await f.calls.blob.text();assert.match(text,/INFORME PARCIAL · REVISIÓN CANCELADA/);assert.match(text,/12 de 100 registros revisados/);assert.match(text,/Referencia faltante/);assert.doesNotMatch(text,/Recorrido terminado/);assert.match(f.node('mnt-review-progress').textContent,/12 de 100/);
 finish({...partial,checked:99});assert.equal(await task,false);assert.match(f.node('mnt-diagnostic-output').textContent,/12 de 100/);assert.equal(f.calls.reads,0);
});

test('session revocation discards partial results and prevents cancellation export',async()=>{
 const f=fixture();let finish;f.root.SVMaintenanceSales.create=()=>({run:()=>new Promise(resolve=>{finish=resolve;}),snapshot:()=>({kind:'sales',complete:false,partial:true,checked:1,total:10,results:[],reads:1})});
 const task=f.api.openSales();f.event('sisventas:session-ended');f.api.cancelReview();finish({kind:'sales',complete:false,checked:1,total:10,results:[]});assert.equal(await task,false);assert.equal(f.api.download(),false);assert.equal(f.node('mnt-diagnostic-output').textContent,'');
});
