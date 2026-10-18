const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const {source}=require('./helpers/active-app').readActiveApp();
function setup(online,confirmed){
 const nodes=Object.fromEntries(['fb-status','fb-status-cfg'].map(id=>[id,{innerHTML:'',style:{},title:'',setAttribute(){}}]));
 const c=load({navigator:{onLine:online},fbOnline:confirmed,document:{getElementById:id=>nodes[id]}},['fbMostrarEstadoConexion']);return {c,nodes};
}
test('sin red tiene prioridad sobre el último conectado de Firebase, en ambas etiquetas',()=>{
 const {c,nodes}=setup(false,true);c.fbMostrarEstadoConexion();
 for(const n of Object.values(nodes)){assert.match(n.innerHTML,/Sin conexión/);assert.doesNotMatch(n.innerHTML,/Sincronizado/);assert.equal(n.style.color,'var(--amber)');}
});
test('red disponible sin confirmación Firebase se muestra reconectando',()=>{
 const {c,nodes}=setup(true,false);c.fbMostrarEstadoConexion();assert.match(nodes['fb-status'].innerHTML,/Reconectando/);
});
test('sólo la confirmación Firebase junto con red disponible muestra sincronizado',()=>{
 const {c,nodes}=setup(true,true);c.fbMostrarEstadoConexion();assert.match(nodes['fb-status'].innerHTML,/Sincronizado/);assert.equal(nodes['fb-status'].style.color,'var(--green)');
 c.navigator.onLine=false;c.fbMostrarEstadoConexion();assert.doesNotMatch(nodes['fb-status'].innerHTML,/Sincronizado/);
 c.fbOnline=false;c.navigator.onLine=true;c.fbMostrarEstadoConexion();assert.match(nodes['fb-status'].innerHTML,/Reconectando/);
 c.fbOnline=true;c.fbMostrarEstadoConexion();assert.match(nodes['fb-status'].innerHTML,/Sincronizado/);
});
test('firebase-ready no convierte disponibilidad de red en confirmación de conexión',()=>{
 let ready,started=0;const c={fbConectado:false,fbOnline:false,navigator:{onLine:true},fbEsperandoReady:[],iniciarMonitorConexionFirebase(){started++;},document:{addEventListener:(_,fn)=>ready=fn}};
 const start=source.indexOf("document.addEventListener('firebase-ready', function() {\n  fbConectado = true;");
 assert.ok(start>=0);vm.runInNewContext(source.slice(start,source.indexOf('var FB_PATHS =',start)),c);ready();assert.equal(c.fbOnline,false);assert.equal(c.fbConectado,true);assert.equal(started,1);
});
