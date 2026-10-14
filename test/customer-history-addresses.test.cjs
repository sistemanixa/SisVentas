const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function setup(sede=''){
 const group=[{fbKey:'r',id:'r',nombre:'Cliente',dir:'Principal 1'},{fbKey:'b',id:'b',nombre:'Cliente',dir:'Sucursal 2'}];
 const ventas=[{fbKey:'vr',id:'V-R',clienteFbKey:'r',total:100,fecha:'2026-10-01',pagos:[]},{fbKey:'vb',id:'V-B',clienteFbKey:'b',total:200,fecha:'2026-10-01',pagos:[]}];
 const pagos=[{fbKey:'p',ventaFbKey:'vb',monto:80,fecha:'2026-10-02',medio:'Efectivo'},{fbKey:'cancelado',ventaFbKey:'vb',monto:30,anulado:true}];
 const nodes={};const button={classList:{add(){},remove(){}},getAttribute:()=>"switchHistTab('pagos',this)"};
 const c={window:{_histDomicilioRaiz:'r',_histDomicilioSeleccionado:sede,_pagosListaActual:pagos,_historialTickets:[{clienteFbKey:'b',numero:'T-B',descripcion:'Ticket sucursal',estado:'Abierto'}]},clientesData:group,ventasList:ventas,pptoData:[{clienteFbKey:'r',id:'P-R',total:10},{clienteFbKey:'b',id:'P-B',total:20}],equiposData:[{clienteFbKey:'b',descripcion:'Equipo sucursal',estado:'Instalado',serie:'S',fechaInstalacion:'2026-10-01'}],clienteActualId:'r',esAdmin:()=>true,esAdminOAdministrativo:()=>true,showPage(){},notify(){},clienteRaizRegistro:()=>group[0],clientesDelGrupo:()=>group,_clienteCategoriaSede:()=>'',_svClienteClaves:c=>[c.fbKey,c.id],_svRegistroPerteneceCliente:(r,c,n)=>r.clienteFbKey?r.clienteFbKey===c.fbKey:!!n&&r.cliente===c.nombre,_svRegistroPerteneceVenta:(r,v)=>r.ventaFbKey===v.fbKey,_svTotalVentaCanonico:v=>v.total,_svSaldoPendienteVenta:v=>v.total,_svPagoValido:p=>!p.anulado,_svPagosCanonicosVenta:v=>pagos.filter(p=>p.ventaFbKey===v.fbKey&&!p.anulado),credSetCliente(){},credSetGrupo:g=>{c.owners=g;},renderClienteTimeline:(cli,v,p,pa)=>{c.timeline={ventas:v,pptos:p,pagos:pa};},huellaHistorialCliente:(g,v)=>v.length,escapeHTML:v=>String(v||''),_set:(id,v)=>{c.document.getElementById(id).textContent=v;},_mostrarFecha:v=>v,ventaEstadoBadge:()=>'',estadoPagoEfectivoVenta:()=>'',ventaEstadoInstBadge:()=>'',pptoStateBadge:()=>'',document:{getElementById:id=>nodes[id]||(nodes[id]={style:{},classList:{add(){},remove(){}}}),querySelector:()=>button,querySelectorAll:()=>[]}};
 c.window.tienePermiso=()=>true;load(c,['historialRegistroEnDomicilio','verHistorialCliente','switchHistTab','seleccionarDomicilioHistorial']);return {c,nodes,group};
}
test('seleccionar sucursal filtra ventas, pagos vinculados sin cliente, presupuestos, equipos, tickets, timeline y credenciales',()=>{
 const {c,nodes}=setup('b');c.verHistorialCliente('r');assert.equal(nodes['hc-total'].textContent,'$200');
 assert.match(nodes['hc-ventas-body'].innerHTML,/V-B/);assert.doesNotMatch(nodes['hc-ventas-body'].innerHTML,/V-R/);
 assert.match(nodes['hc-pagos-body'].innerHTML,/80/);assert.doesNotMatch(nodes['hc-pagos-body'].innerHTML,/30/);assert.equal((nodes['hc-pagos-body'].innerHTML.match(/<tr>/g)||[]).length,1);
 assert.match(nodes['hc-pagos-body'].innerHTML,/>—<\/td>/);
 assert.match(nodes['hc-ppto-body'].innerHTML,/P-B/);assert.doesNotMatch(nodes['hc-ppto-body'].innerHTML,/P-R/);
 assert.match(nodes['hc-eq-body'].innerHTML,/Equipo sucursal/);assert.match(nodes['hc-eq-body'].innerHTML,/Instalado/);assert.match(nodes['hc-tickets-body'].innerHTML,/T-B/);
 assert.equal(c.owners.length,1);assert.equal(c.owners[0].fbKey,'b');assert.equal(c.timeline.ventas.length,1);assert.equal(c.timeline.pagos.length,1);assert.equal(c.window._histClienteHuella,2);
});
test('Todas conserva el historial consolidado y cambiar de domicilio conserva la pestaña',()=>{
 const {c,nodes}=setup();c.verHistorialCliente('r');assert.equal(nodes['hc-total'].textContent,'$300');assert.equal(c.owners.length,2);
 c.seleccionarDomicilioHistorial('b');assert.equal(nodes['hc-total'].textContent,'$200');assert.equal(c.window._histDomicilioSeleccionado,'b');
 c.seleccionarDomicilioHistorial('');assert.equal(nodes['hc-total'].textContent,'$300');
});
test('no distribuye registros por nombre; respeta dirección explícita y no mezcla un cliente ajeno',()=>{
 const {c,group}=setup();assert.equal(c.historialRegistroEnDomicilio({cliente:'Cliente'},group[1],group),false);
 assert.equal(c.historialRegistroEnDomicilio({clienteFbKey:'r',direccion:'Sucursal 2'},group[1],group),true);
 assert.equal(c.historialRegistroEnDomicilio({clienteFbKey:'r',direccion:'Sucursal 2'},group[0],group),false);
 assert.equal(c.historialRegistroEnDomicilio({clienteFbKey:'ajeno',direccion:'Sucursal 2'},group[1],group),false);
});
test('Tickets incorpora reclamos reales de Soporte y no los expone sin permiso',()=>{
 const {c,nodes}=setup('b');c.SP_DATA={r:{clienteFbKey:'b',numero:'R-B',descripcion:'Reclamo real',estado:'nuevo'}};c.svPuedeLeerDominio=()=>true;
 c.verHistorialCliente('r');assert.match(nodes['hc-tickets-body'].innerHTML,/R-B/);
 c.svPuedeLeerDominio=()=>false;c.verHistorialCliente('r');assert.doesNotMatch(nodes['hc-tickets-body'].innerHTML,/R-B/);
});
