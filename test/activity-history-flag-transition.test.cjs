'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const actual=fs.readFileSync(require.resolve('../js/modules/activity-history.js'),'utf8'),legacy=fs.readFileSync(require.resolve('./fixtures/activity-history-render-legacy.js'),'utf8');
function render(source,flag,{empty=false,allowed=true}={}){
 const list={innerHTML:'existing',setAttribute(){}},card={style:{display:''}},root={SV_DASHBOARD_READS_LOCAL:flag,document:{getElementById:id=>id==='dash-actividad-card'?card:list},tienePermiso:()=>allowed,ventasList:empty?[]:[{id:'VENTA',cliente:'Cliente & ficticio',fecha:'04/11/2026',ts:5000,total:12.34}],_pagosListaActual:empty?[]:[{venta:'V-C',cliente:'Ficticio',ts:6000,monto:4.56},{venta:'ANULADO',ts:99999,anulado:true}],otData:empty?[]:[{id:'OT-A',fechaCierre:'2026-11-04',ts:4000,estado:'completada'}],pptoData:empty?[]:[{id:'PP-A',ts:3000,estado:'enviado'}]};root.window=root;Object.defineProperty(root,'SVDashboardActivityHost',{get(){throw Error('OFF must not inspect the slot');}});vm.runInNewContext(source,root);root.dashRenderActividadReciente();return {html:list.innerHTML,display:card.style.display};
}
for(const flag of [undefined,false,'true',1])test('OFF/nonboolean '+String(flag)+' preserves exact legacy markup and never touches the host',()=>{
 for(const options of [{},{empty:true},{allowed:false}])assert.deepEqual(render(actual,flag,options),render(legacy,flag,options));
});
test('ON missing/error slot cannot fall back to legacy arrays',()=>{
 const list={innerHTML:'',setAttribute(){}},root={SV_DASHBOARD_READS_LOCAL:true,document:{getElementById:()=>list},tienePermiso:()=>true,SVDashboardActivityHost:{peek:()=>({status:'error',authority:'current',data:null})}};root.window=root;let touched=0;for(const name of ['ventasList','_pagosListaActual','_historialPagosCompleto','otData','pptoData'])Object.defineProperty(root,name,{get(){touched++;throw Error('Forbidden ON fallback');}});vm.runInNewContext(actual,root);root.dashRenderActividadReciente();assert.match(list.innerHTML,/No se pudo cargar/);delete root.SVDashboardActivityHost;root.dashRenderActividadReciente();assert.match(list.innerHTML,/pendiente de carga/);assert.equal(touched,0);
});
