'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{functionSource}=require('./helpers/app-functions.cjs');
const order='raw-locale-desc_loader-time-desc_ts-desc_js-index-first-asc_other-codepoint-asc_v1';
function fixture(){
 const nodes=new Map(['dash-adm-pptos','dash-adm-pptos-sub','dash-adm-ventas','dash-adm-ventas-sub','dash-adm-conv','dash-adm-ultventas'].map(k=>[k,{attrs:{},textContent:'',innerHTML:'',setAttribute(k,v){this.attrs[k]=v;}}]));let view;
 class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-11-04T15:00:00Z']));}}
 const s={window:null,Date:Clock,currentUser:'u',document:{getElementById:id=>nodes.get(id)||null},SV_DASHBOARD_READS_LOCAL:true,currentRole:'vendedor',currentUserUid:'u',SVDashboardActivityHost:{peek:()=>view},nombreClienteVigente:(row,alt)=>row.clienteFbKey==='c0'?'Nombre vigente':row.cliente||alt};s.window=s;
 for(const name of ['ventasList','pptoData','fetch'])Object.defineProperty(s,name,{get(){throw Error('Forbidden partial original or network: '+name);}});
 vm.createContext(s);for(const fn of ['svTextoLegible','escapeHTML','renderDashAdministrativo'])vm.runInContext(functionSource(fn),s);
 const count={schema:1,complete:true,creator:'u',month:'2026-11',scope:'u_u',generation:'prepared',revision:1,count:501};
 const latest={...count,locale:'es-AR',orderContract:order,rows:[1,123456,0,-99,Number.MAX_SAFE_INTEGER].map((totalCents,i)=>({key:'k'+i,number:'V-'+i,client:i===1?'<script>fiction</script>':'Cliente '+i,clientRecordKey:'c'+i,rawDate:'2026-11-04T12:34',totalCents}))};
 return {nodes,count,latest,paint:(changes={})=>{view={status:'ready',authority:'current',data:{salesAuthorMonthlyComplete:true,salesAuthorMonthly:count,salesAuthorLatestComplete:true,salesAuthorLatest:latest},...changes};s.renderDashAdministrativo();return nodes.get('dash-adm-ultventas');}};
}
test('actual personal renderer keeps five certified rows in delivered order and preserves every cent',()=>{
 const f=fixture(),node=f.paint(),html=node.innerHTML;assert.equal(f.nodes.get('dash-adm-ventas').textContent,501);assert.equal((html.match(/padding:8px 10px/g)||[]).length,5);assert.match(html,/Nombre vigente/);assert.match(html,/&lt;script&gt;fiction&lt;\/script&gt;/);assert(!html.includes('<script>'));for(const amount of ['$ 0,01','$ 1.234,56','$ 0,00','-$ 0,99','$ 90.071.992.547.409,91'])assert(html.includes(amount),amount);assert(html.indexOf('$ 0,01')<html.indexOf('$ 1.234,56'));assert(html.includes('2026-11-04T12:34'));assert(!html.includes('NaN'));
});
test('latest evidence mismatch is pending, never a local/global substitute',()=>{
 for(const change of [m=>m.creator='otro',m=>m.scope='all',m=>m.count=500,m=>m.orderContract='unknown',m=>m.rows[0].rawDate='2026-10-04',m=>m.rows[1].key=m.rows[0].key]){const f=fixture();change(f.latest);const node=f.paint();assert.match(node.innerHTML,/pendiente/i);assert(!node.innerHTML.includes('Sin ventas'));assert(!node.innerHTML.includes('Nombre vigente'));}
});
test('same authority refresh/error retains rows with visible state and retirement removes them',()=>{
 const f=fixture();let node=f.paint({status:'loading',revalidating:true});assert.match(node.innerHTML,/Actualizando/);assert.equal(node.attrs['aria-busy'],'true');node=f.paint({status:'error'});assert.match(node.innerHTML,/No se pudo actualizar/);assert.equal((node.innerHTML.match(/padding:8px 10px/g)||[]).length,5);node=f.paint({authority:'retired'});assert.match(node.innerHTML,/pendiente/i);assert(!node.innerHTML.includes('Nombre vigente'));
});
test('only certified empty evidence can display no personal sales',()=>{const f=fixture();f.count.count=0;f.latest.count=0;f.latest.rows=[];assert.match(f.paint().innerHTML,/Sin ventas este mes/);});
