const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function fixture(width){
 const classes=new Set(['open']);const sidebar={classList:{remove:n=>classes.delete(n)}};
 const overlay={style:{display:'block'}},body={style:{overflow:'hidden'}};
 const page={id:'page-demo',classList:{add(){},remove(){}}};
 const c=load({window:{innerWidth:width,matchMedia:()=>({matches:width>=1101}),location:{hash:'#/demo'}},document:{body,getElementById:id=>id==='page-demo'?page:id==='mob-overlay'?overlay:null,querySelector:sel=>sel==='.sidebar'?sidebar:null,querySelectorAll:()=>[]},isAuthenticated:true,permisoModulo:()=>true,_svNavegandoAtras:false,_svHistorialPaginas:[],_svGuardarHistorialPaginas(){},_svActualizarRuta(){},_svProgramarDescargaVista(){},titles:{demo:'Prueba'},setTimeout(){},svActualizarMasUsados(){},notify(){}},['sidebarDesktopActivo','closeSidebarMobile','svActualizarLecturasPorAccion','showPage']);
 return {c,classes,overlay,body};
}
test('elegir un módulo cierra el menú y libera el fondo en celular y tablet hasta1100px',()=>{
 for(const width of [390,768,820,1024,1100]){
  const f=fixture(width);f.c.showPage('demo');assert.equal(f.classes.has('open'),false,'ancho '+width);assert.equal(f.overlay.style.display,'none');assert.equal(f.body.style.overflow,'');
 }
});
test('navegar en escritorio conserva el menú',()=>{
 const f=fixture(1136);f.c.showPage('demo');assert.equal(f.classes.has('open'),true);assert.equal(f.body.style.overflow,'hidden');
});
test('una navegación bloqueada o sin permiso no cierra el menú',()=>{
 const f=fixture(820);f.c.permisoModulo=()=>false;f.c.showPage('demo');assert.equal(f.classes.has('open'),true);
 f.c.permisoModulo=()=>true;f.c.window.svBloquearSalidaCotizacion=()=>true;f.c.showPage('demo');assert.equal(f.classes.has('open'),true);
});
test('Distribuidora cierra el menú al abrir el portal, conservando validación de sesión y permisos',async()=>{
 const f=fixture(820);let finish,opened=0;f.c.currentUserUid='ficticio';f.c.currentUser={uid:'ficticio'};
 f.c.window.SVSessionAssets={load:()=>new Promise(resolve=>finish=resolve)};
 f.c.window.SVParaguayPortal={isProductSheetOpen:()=>false,open:()=>{assert.equal(f.classes.has('open'),false);opened++;}};
 f.c.showPage('distribuidora');assert.equal(f.classes.has('open'),true);finish();await new Promise(setImmediate);assert.equal(opened,1);
 const denied=fixture(820);denied.c.currentUserUid='ficticio';denied.c.window.SVSessionAssets={load:()=>Promise.resolve()};denied.c.window.SVParaguayPortal={isProductSheetOpen:()=>false,open:assert.fail};
 denied.c.showPage('distribuidora');denied.c.permisoModulo=()=>false;await new Promise(setImmediate);assert.equal(denied.classes.has('open'),true);
});
