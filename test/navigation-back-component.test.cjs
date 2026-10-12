const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('componente compartido deja un solo volver al cambiar entre módulo, ficha y editor',()=>{
 const bar={hidden:false};let buttons=[],runs=0,scheduled;
 const page={id:'page-clientes',querySelectorAll:()=>buttons};
 const c={window:{_svHistorialPaginas:['ventas'],permisoModulo:()=>true},document:{readyState:'loading',addEventListener(){},getElementById:()=>({}),querySelector:s=>s==='.sv-retorno-modulo'?bar:page},_svElementoVisible:b=>b.visible,requestAnimationFrame:fn=>{runs++;scheduled=fn;}};
 vm.runInNewContext(fs.readFileSync('js/modules/navigation-back.js','utf8'),c);
 for(const label of ['Volver','← Volver','\ueb19 Volver','Atrás']){buttons=[{visible:true,textContent:label}];c.window.SVBackNavigation.sync();assert.equal(bar.hidden,true);}
 buttons=[{visible:false,textContent:'Volver'}];c.window.SVBackNavigation.sync();assert.equal(bar.hidden,false);
 buttons=[];c.window.SVBackNavigation.schedule();c.window.SVBackNavigation.schedule();assert.equal(runs,1);scheduled();assert.equal(bar.hidden,false);
 page.id='page-dashboard';c.window.SVBackNavigation.sync();assert.equal(bar.hidden,true);page.id='page-clientes';
 c.window._svHistorialPaginas=[];c.window.SVBackNavigation.sync();assert.equal(bar.hidden,true);
 c.window._svHistorialPaginas=['clientes'];c.window.SVBackNavigation.sync();assert.equal(bar.hidden,true);
 c.window._svHistorialPaginas=['ventas'];c.window.permisoModulo=()=>false;c.window.SVBackNavigation.sync();assert.equal(bar.hidden,true);
 c.window.permisoModulo=()=>true;c.document.getElementById=()=>null;c.window.SVBackNavigation.sync();assert.equal(bar.hidden,true);
});
