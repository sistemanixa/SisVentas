const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load}=require('./helpers/app-functions.cjs');
function context(buttons=[],history=['dashboard']){
 const visits=[],page={id:'page-proveedores',querySelectorAll:()=>buttons};
 const c={window:{},document:{getElementById:id=>id.startsWith('page-')?{}:null,querySelectorAll:()=>[],querySelector:sel=>sel==='.page.active'?page:null},_svElementoVisible:n=>!!n,_svEjecutandoRetornoLocal:false,_svHistorialPaginas:history,_svGuardarHistorialPaginas(){},permisoModulo:()=>true,showPage:id=>{visits.push(id);page.id='page-'+id;},notify(){}};
 load(c,['volverAtrasSisVentas']);return {c,visits};
}
test('Proveedores vuelve al origen y consume el historial',()=>{const {c,visits}=context([],['gastos']);assert.equal(c.volverAtrasSisVentas(),true);assert.deepEqual(visits,['gastos']);assert.equal(c._svHistorialPaginas.length,0);});
test('vista interna retorna antes de abandonar el módulo',()=>{let clicks=0;const {c,visits}=context([{textContent:'Volver',click(){clicks++;}}]);c.volverAtrasSisVentas();assert.equal(clicks,1);assert.deepEqual(visits,[]);});
test('retorno local que delega no genera recursión',()=>{const button={textContent:'Volver'};const {c,visits}=context([button]);button.click=()=>c.volverAtrasSisVentas();assert.equal(c.volverAtrasSisVentas(),true);assert.deepEqual(visits,['dashboard']);assert.equal(c._svEjecutandoRetornoLocal,false);});
test('no inventa destino y omite módulos sin acceso',()=>{const {c,visits}=context([],['gastos','usuarios']);c.permisoModulo=id=>id!=='usuarios';c.volverAtrasSisVentas();assert.deepEqual(visits,['gastos']);assert.equal(c.volverAtrasSisVentas(),false);});
test('contenido común incluye un único Volver debajo de la cabecera',()=>{const html=fs.readFileSync('index.html','utf8');assert.equal((html.match(/id="sv-volver-global"/g)||[]).length,1);assert.ok(html.indexOf('id="sv-volver-global"')<html.indexOf('id="page-dashboard"'));assert.ok(html.indexOf('id="sv-volver-global"')>html.indexOf('class="content"'));assert.match(html,/id="sv-volver-global"[^>]+onclick="if\(!volverAtrasSisVentas\(\)\)/);});
