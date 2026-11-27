'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sourceRoot = process.env.SV_MAINTENANCE_SOURCE_ROOT || path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(sourceRoot, 'js/modules/maintenance-center.js'), 'utf8');

function fixture() {
  const listeners = new Map(), nodes = new Map(), calls = {reads:0, pages:[], modal:0, downloads:[], waits:[]};
  let active = 'configuracion', resolveReady;
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {style:{display:''}, textContent:'', hidden:false, disabled:false,
      classList:{contains: name => name === 'active' && id === 'page-' + active}});
    return nodes.get(id);
  }
  const root = {
    document:{getElementById:node, querySelectorAll:()=>[],
      addEventListener:(name, fn)=>listeners.set(name, fn), body:{appendChild(){}},
      createElement:()=>({click(){calls.downloads.push(this.download);},remove(){}})},
    fbAuth:{currentUser:{uid:'private-uid',email:'private@email.invalid'}}, currentUserUid:'private-uid',
    currentRole:'admin', fbDB:{}, _svOperacionesSesionEpoch:1, PERMISOS_ROLES:{admin:{indiceRevision:3}},
    permisoModulo:()=>true, tienePermiso:()=>true, navigator:{onLine:true}, SISVENTAS_PWA_VERSION:'3.22.2',
    clientesData:[{nombre:'PRIVATE_CLIENT'}], ventasData:[{token:'PRIVATE_TOKEN'}],
    fbGet(){calls.reads++;throw Error('Forbidden read');}, fetch(){calls.reads++;throw Error('Forbidden fetch');},
    AbortController, Blob, URL:{createObjectURL(blob){calls.blob=blob;return 'blob:fixture';}, revokeObjectURL(){}},
    setTimeout:fn=>fn(), notify(){}, showPage(page){calls.pages.push(page);active=page;},
    SVDataReadiness:{waitForPage(page, options){calls.waits.push({page,options});return new Promise(resolve=>{resolveReady=resolve;});}},
    async abrirRevisionClientesDuplicados(){calls.modal++;}
  };
  node('fb-status').textContent='Sincronizado';
  vm.runInNewContext(source,{window:root});
  return {root, api:root.SVMaintenanceCenter, calls, node,
    event(name,detail){listeners.get(name)?.({detail});},
    ready(result={ready:true}){resolveReady(result);}, navigate(page){active=page;}};
}

test('initialize and diagnostic export never fetch business data and disclose only session summary', async()=>{
  const f=fixture();f.api.initialize();assert.equal(f.api.generate(),true);assert.equal(f.api.download(),true);
  const text=await f.calls.blob.text();
  assert.match(text,/Fecha:/);assert.match(text,/Versión: 3\.22\.2/);assert.match(text,/Conexión: Conectado/);assert.match(text,/Sesión: Administrador/);
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
]) test('export is rejected after '+name+' changes',()=>{
  const f=fixture();assert.equal(f.api.generate(),true);change(f);assert.equal(f.api.download(),false);
  assert.equal(f.calls.downloads.length,0);assert.equal(f.node('mnt-diagnostic-output').hidden,true);assert.equal(f.calls.reads,0);
});

test('clients waits for readiness before opening review',async()=>{
  const f=fixture(), task=f.api.openClients();assert.deepEqual(f.calls.pages,['clientes']);assert.equal(f.calls.modal,0);
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

test('normal expense and sales navigation only calls showPage',async()=>{
  const f=fixture();assert.equal(await f.api.openExpenses(),true);assert.equal(await f.api.openSales(),true);
  assert.deepEqual(f.calls.pages,['gastos','detalle']);assert.equal(f.calls.waits.length,0);assert.equal(f.calls.modal,0);assert.equal(f.calls.reads,0);
});

test('denied permissions block generation and navigation',async()=>{
  const f=fixture();f.root.tienePermiso=()=>false;assert.equal(f.api.generate(),false);assert.equal(await f.api.openClients(),false);
  assert.equal(await f.api.openExpenses(),false);assert.equal(await f.api.openSales(),false);assert.deepEqual(f.calls.pages,[]);assert.equal(f.calls.reads,0);
});
