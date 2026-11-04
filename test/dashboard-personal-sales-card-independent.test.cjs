'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {functionSource}=require('./helpers/app-functions.cjs'),Context=require('../js/core/dashboard-host-context-proposal'),Host=require('../js/modules/dashboard-activity-host.v1'),HTTP=require('../js/core/dashboard-http-ports-proposal'),Aggregate=require('../js/core/dashboard-activity-aggregate-proposal');
const DATA=require('./fixtures/dashboard-http-readers-e24.json');
async function fixture({size=50,capability=true,personalOnly=false}={}){
 const nodes=new Map(['dash-adm-pptos','dash-adm-pptos-sub','dash-adm-ventas','dash-adm-ventas-sub','dash-adm-conv','dash-adm-ultventas'].map(id=>[id,{textContent:'',innerHTML:''}])),responses=structuredClone(DATA.responses),calls=[];
 const actions=new Set(personalOnly?['dashboard.miActividad']:['dashboard.miActividad','dashboard.actividad','interfaz.dashboard_admin_only']);
 const modules=new Set(personalOnly?['dashboard','comisiones']:['dashboard','detalle','cobranzas','presupuesto','ordentrabajo']);
 const r={currentRole:'vendedor',currentUserUid:'u',currentUser:'u',isAuthenticated:true,fbAuth:{currentUser:{uid:'u',getIdToken:async()=> 'fictional-token'}},fbDB:{},fbOnline:true,navigator:{onLine:true},PERMISOS_ROLES:{vendedor:{indiceVersion:2,indiceRevision:7,indiceModulos:Object.fromEntries([...modules].map(k=>[k,true]))}},permisoModulo:m=>modules.has(m),tienePermiso:a=>actions.has(a),SV_DASHBOARD_READS_LOCAL:true,SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://personal.fixture.invalid'},document:{hidden:false,addEventListener(){},removeEventListener(){},querySelector:()=>({id:'page-dashboard'}),getElementById:id=>nodes.get(id)||null},addEventListener(){},removeEventListener(){},SVDashboardActivityAggregateProposal:Aggregate,SVDashboardHTTPPortsProposal:HTTP};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/core/data-readiness'),'utf8'),{window:r,document:r.document,URL,requestAnimationFrame(){}});
 const context=Context.create(r,{now:()=>new Date('2026-11-04T15:00:00Z')});
 if(capability)responses[HTTP.ROUTES.ventas].creatorMonthly={schema:1,complete:true,creator:'u',month:'2026-11',scope:'u_u',generation:'pages-certified',revision:1,count:501};
 else delete responses[HTTP.ROUTES.ventas].creatorMonthly;
 const host=Host.create(r,{context,events:false,fetchImpl:async url=>{calls.push(new URL(url).pathname);return {ok:true,status:200,url,json:async()=>structuredClone(responses[new URL(url).pathname])};}});r.SVDashboardActivityHost=host;
 class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-11-04T15:00:00Z']));}}
 const s={window:r,document:r.document,Date:Clock,currentUser:'u',currentRole:'vendedor',ventasList:Array.from({length:size},(_,i)=>({id:'V-memory-'+i,creadaPor:'u',responsableUid:'another-owner',fecha:'2026-11-04',cliente:'Ficticio',total:1})),escapeHTML:String,nombreClienteVigente:v=>v.cliente,_svTotalVentaCanonico:v=>v.total};
 vm.createContext(s);for(const name of ['ventaResponsableComercialReporte','renderDashAdministrativo'])vm.runInContext(functionSource(name),s);
 return {nodes,r,host,calls,capture:context.capture,paint:()=>s.renderDashAdministrativo()};
}

test('real personal renderer must show certified 501 instead of the 50 rows currently in memory',async()=>{
 const f=await fixture();const packet=await f.host.ensure();assert.equal(packet.salesAuthorMonthlyComplete,true);assert.equal(packet.salesAuthorMonthly.count,501);assert.equal(f.calls.filter(p=>p===HTTP.ROUTES.ventas).length,2);
 f.paint();console.log(JSON.stringify({certified:501,inMemory:50,rendered:f.nodes.get('dash-adm-ventas').textContent,sub:f.nodes.get('dash-adm-ventas-sub').textContent}));
 assert.equal(String(f.nodes.get('dash-adm-ventas').textContent),'501');
});

test('missing creator capability must remain pending rather than publishing a partial 50 as total',async()=>{
 const f=await fixture({capability:false});const packet=await f.host.ensure();assert.equal(packet.salesAuthorMonthlyComplete,false);assert.equal(packet.salesAuthorMonthly,null);
 f.paint();assert.equal(f.nodes.get('dash-adm-ventas').textContent,'—');assert.match(f.nodes.get('dash-adm-ventas-sub').textContent,/pendiente/i);
});

test('certified 501 with no local sales must not announce Sin ventas este mes',async()=>{
 const f=await fixture({size:0});assert.equal((await f.host.ensure()).salesAuthorMonthly.count,501);f.paint();
 assert.doesNotMatch(f.nodes.get('dash-adm-ultventas').innerHTML,/Sin ventas este mes/i);
});

test('miActividad-only role without global activity actions or four grants must show capability pending',async()=>{
 const f=await fixture({personalOnly:true});assert.equal(f.r.tienePermiso('dashboard.miActividad'),true);assert.equal(f.r.tienePermiso('dashboard.actividad'),false);assert.equal(f.r.tienePermiso('interfaz.dashboard_admin_only'),false);
 assert.deepEqual(f.capture().grants,{ventas:'own',pagos:null,ordenes_trabajo:null,presupuestos:null});assert.equal(f.calls.length,0);
 f.paint();console.log(JSON.stringify({personalOnly:true,grants:f.capture().grants,rendered:f.nodes.get('dash-adm-ventas').textContent}));
 assert.equal(f.nodes.get('dash-adm-ventas').textContent,'—');assert.match(f.nodes.get('dash-adm-ventas-sub').textContent,/pendiente/i);
});
