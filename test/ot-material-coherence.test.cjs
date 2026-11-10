'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{fixture}=require('./helpers/ot-material-coherence-fixture.cjs'),{readActiveApp}=require('./helpers/active-app'),vm=require('node:vm');
for(const shape of ['inconsistent','legacy'])test('delivery and row status request review without inferring a delivery: '+shape,async()=>{
 const f=fixture();if(shape==='legacy'){f.ot.items=f.ot.materiales;f.ot.materiales=[];}const before=JSON.stringify(f.ot);f.render();
 a.match(f.nodes['ot-custodia-estado'].textContent,/revis|confirm/i);a.match(f.nodes['ot-materiales'].innerHTML,/Revisar/);a.equal(f.nodes['ot-btn-todo-instalado'].style.display,'none');
 await f.w.otCustodiaEntregar();a.match(f.notes.at(-1),/revis|confirm/i);a.doesNotMatch(f.notes.at(-1),/No hay materiales pendientes/);a.equal(JSON.stringify(f.ot),before);a.deepEqual(f.writes,[]);
});
test('partial delivery retains exact pending quantities and installation of delivered material only',()=>{const f=fixture();Object.assign(f.ot,{custodiaIniciada:true});Object.assign(f.ot.materiales[0],{vendida:2.75,entregada:0.25,custodiaActiva:true});f.render();a.equal(f.nodes['ot-btn-entregar-materiales'].style.display,'');a.equal(f.nodes['ot-btn-todo-instalado'].style.display,'');a.equal(f.ot.materiales[0].entregada,0.25);a.equal(f.w.otCustodiaValidarCierre(f.ot).ok,false);});

for(const aggregate of [undefined,false])test('legacy row custody is evidence only when aggregate flag is absent: '+aggregate,()=>{
 const f=fixture();f.ot.custodiaIniciada=aggregate;Object.assign(f.ot.materiales[0],{vendida:2.75,entregada:0.25,custodiaActiva:true});const before=JSON.stringify(f.ot);f.render();
 if(aggregate===false)a.match(f.nodes['ot-custodia-estado'].textContent,/revis/i);
 else a.doesNotMatch(f.nodes['ot-custodia-estado'].textContent,/no coinciden/i);
 a.equal(JSON.stringify(f.ot),before);a.deepEqual(f.writes,[]);a.equal(f.w.otCustodiaValidarCierre(f.ot).ok,false);
});
test('confirmed partial bulk installation never installs or delivers the missing quantity',async()=>{const f=fixture();
 f.ot.ventaFbKey='sale';let inventory=null;
 f.w.SisVentasCompras.syncOTConsumption=()=>a.fail('No client stock transaction');
 f.w.SVOTLifecycle={prepare:async()=>({atomicStock:true}),save:async(before,draft)=>{
  const next=structuredClone(draft),old=before.materiales[0],row=next.materiales[0];f.targets.push(row.instalada);
  const result=require('../cotizador/ot-physical-confirmation-model').confirm({inventory,kind:'installation',otKey:'ot-fiction',rowKey:'0',productKey:'p',allocation:'sale',operationId:'fixture-command-1',at:1,actor:{uid:'fiction',role:'admin',allowed:true},beforeDelivered:old.entregada,targetDelivered:row.entregada,beforeInstalled:old.instalada,targetInstalled:row.instalada,heldByOthers:0});inventory=result.inventory;row.stockRegistro=result.receipt;row.stockRevision=result.revision;f.drafts.push(next);f.writes.push('save');return{confirmed:true,ot:next};
 }};Object.assign(f.ot,{custodiaIniciada:true});Object.assign(f.ot.materiales[0],{vendida:2.75,entregada:0.25,custodiaActiva:true});await f.w.otCustodiaTodoInstalado();a.deepEqual(f.targets,[0.25]);a.equal(f.drafts.length,1);a.equal(f.ot.materiales[0].vendida,2.75);a.equal(f.ot.materiales[0].entregada,0.25);a.equal(f.ot.materiales[0].instalada,0.25);a.equal(f.ot.custodiaRendida,false);});
for(const kind of ['permission','session','record','quantity','role','revision'])test('bulk confirmation discards stale or revoked intent: '+kind,async()=>{
 const f=fixture();f.ot.custodiaIniciada=true;f.ot.materiales[0].custodiaActiva=true;
 f.w.PERMISOS_ROLES={admin:{indiceRevision:1}};
 f.w.svConfirm=async()=>{if(kind==='permission')f.w.tienePermiso=()=>false;if(kind==='session')f.w.currentUserUid='other';if(kind==='record')f.w.otActualId='other';if(kind==='quantity')f.ot.materiales[0].entregada=1;if(kind==='role')f.w.currentRole='administrativo';if(kind==='revision')f.w.PERMISOS_ROLES.admin.indiceRevision++;return true;};
 await f.w.otCustodiaTodoInstalado();a.deepEqual(f.writes,[]);a.equal(f.ot.materiales[0].instalada,0);a.match(f.notes.at(-1),/cambi|permiso|sesión/i);
});
test('impersonation cannot start a material rendition',async()=>{const f=fixture();f.ot.custodiaIniciada=true;f.ot.materiales[0].custodiaActiva=true;f.w._impersonacionOriginal={uid:'another'};await f.w.otCustodiaTodoInstalado();a.deepEqual(f.writes,[]);});
test('progress100 never claims ready while material rendition is blocked',()=>{
 const f=fixture(),source=readActiveApp().source,start=source.indexOf('function otEstadoParaMostrar('),end=source.indexOf('window.otEstadoParaMostrar',start),c={window:f.w,otEstadoNormalizado:o=>o.estado,otEstaCerrada:()=>false};vm.createContext(c);vm.runInContext(source.slice(start,end),c);a.notEqual(c.otEstadoParaMostrar(f.ot),'lista_finalizar');
 Object.assign(f.ot,{custodiaIniciada:true,custodiaRendida:true});Object.assign(f.ot.materiales[0],{custodiaActiva:true,instalada:2});a.equal(c.otEstadoParaMostrar(f.ot),'lista_finalizar');
});
