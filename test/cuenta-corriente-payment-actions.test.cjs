const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
test('las acciones del extracto están en la última columna y no dentro del concepto',()=>{
 const nodes={};const node=id=>nodes[id]||(nodes[id]={style:{},innerHTML:''});
 const payment={tipo:'Pago',concepto:'Pago de prueba',fecha:'2026-10-17',haber:40,saldo:60,comprobantes:[]};
 const statement={movimientos:[payment]};let movements=[payment];
 const c=load({window:{_ccExtractoActual:statement},document:{getElementById:node},_ccVistaExtractoFiltrada:()=>({valido:true,movimientos:movements,filtrado:true,desdeValor:'2026-10-01',desdeLabel:'01/10/2026',saldoAnterior:100,saldoFinal:60}),escapeHTML:s=>String(s),_ccFormatoImporteExtracto:()=>'$60',_ccBotonAbrirCobro:()=>'<button>Ver cobro</button>',_ccBotonesComprobantes:()=>'<button>Ver comprobante</button>',asegurarDesplazamientoTablas(){},inicializarGrillasEn(){}},['aplicarFiltroExtractoCuentaCorriente']);
 c.aplicarFiltroExtractoCuentaCorriente();const html=nodes['cc-movimientos'].innerHTML;
 assert.match(html,/<th class="cc-mov-actions">Acciones<\/th><\/tr><\/thead>/);
 const rows=[...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(td=>td[1])).filter(row=>row.length);
 assert.equal(rows[0].length,6);assert.equal(rows[1].length,6);assert.equal(rows[1][1],'Pago de prueba');assert.match(rows[1][5],/Ver cobro/);assert.match(rows[1][5],/Ver comprobante/);
 movements=[];c.aplicarFiltroExtractoCuentaCorriente();assert.match(nodes['cc-movimientos'].innerHTML,/colspan="6"/);
});
function statement(){
 const nodes={};const element=id=>nodes[id]||(nodes[id]={style:{},value:'',textContent:'',innerHTML:''});
 const pagos=[{fbKey:'p1',clienteFbKey:'c',venta:'V-DEMO',fecha:'2026-10-17',medio:'Transferencia',monto:40,comprobanteRef:'doc1'}];
 const window={_ccMapActual:{c:{key:'c',clienteFbKey:'c',nombre:'Cliente ficticio',total:100,cobrado:40}},_pagosListaActual:pagos,_historialPagosCompleto:pagos};
 const c=load({window,document:{getElementById:element,querySelector:()=>element('card')},ventasList:[{id:'V-DEMO',fbKey:'v1',clienteFbKey:'c',fecha:'2026-10-16',total:100}],_set(){},_block(){},notify:assert.fail,_svClaveClientePrincipalRegistro:p=>p.clienteFbKey,_svTxtNombre:s=>s,_svPagosCanonicosVenta:()=>pagos,_svRegistroPerteneceVenta:()=>true,_svTotalVentaCanonico:v=>v.total,_svResumenPagoLegacyVenta:()=>0,_cobroTieneComprobante:p=>!!p.comprobanteRef,aplicarFiltroExtractoCuentaCorriente(){}},['verCuentaClienteReal']);
 return {c,window,pagos};
}
test('el extracto conserva las referencias del cobro y del comprobante sin alterar el saldo',()=>{
 const f=statement();f.c.verCuentaClienteReal('c');const movements=f.window._ccExtractoActual.movimientos,payment=movements.find(m=>m.tipo==='Pago');
 assert.equal(payment.haber,40);assert.equal(payment.saldo,60);assert.equal(payment.comprobantes.length,1);assert.deepEqual(Array.from(payment.pagos),['p1']);assert.equal(payment.comprobantes[0].ref,'p1');
});

test('agrupar pagos mantiene todos sus vínculos y un único comprobante compartido',()=>{
 const f=statement();f.pagos.push({...f.pagos[0],fbKey:'p2',monto:10});f.window._ccMapActual.c.cobrado=50;
 f.c.verCuentaClienteReal('c');const payment=f.window._ccExtractoActual.movimientos.find(m=>m.tipo==='Pago');
 assert.equal(payment.haber,50);assert.equal(payment.saldo,50);assert.deepEqual(Array.from(payment.pagos),['p1','p2']);assert.equal(payment.comprobantes.length,1);
 assert.equal(payment.comprobantes[0].monto,50);
});

test('comprobantes muestra importes individuales y suma monetaria sin duplicar referencias',()=>{
 let menu;const pagos={p1:{monto:65000,comprobanteAdjunto:{nombre:'Primero.jpeg'}},p2:{monto:81400,comprobanteAdjunto:{nombre:'Segundo.jpeg'}}};
 const c=load({_cobroPagoPorKey:key=>pagos[key],_svCrearDialogoSistema:opts=>menu=opts},['verComprobantesCuentaCorriente','_ccFormatoImporteExtracto']);
 c.verComprobantesCuentaCorriente('["p1","p2","p1"]');
 assert.deepEqual(Array.from(menu.enlaces,e=>e.importe),['$ 65.000','$ 81.400']);assert.equal(menu.resumen,'$ 146.400');assert.equal(menu.enlaces[0].texto,'Primero.jpeg');
});

test('comprobante compartido usa su importe agrupado y suma centavos sin error binario',()=>{
 let menu;const c=load({_cobroPagoPorKey:()=>({monto:999}),_svCrearDialogoSistema:opts=>menu=opts},['verComprobantesCuentaCorriente','_ccFormatoImporteExtracto']);
 c.verComprobantesCuentaCorriente(JSON.stringify([{ref:'p1',monto:0.1},{ref:'p2',monto:0.2}]));
 assert.equal(menu.enlaces[0].importe,'$ 0,10');assert.equal(menu.resumen,'$ 0,30');
});

test('importe faltante no se presenta como cero ni como total definitivo',()=>{
 let menu;const c=load({_cobroPagoPorKey:key=>key==='p1'?{monto:10}:null,_svCrearDialogoSistema:opts=>menu=opts},['verComprobantesCuentaCorriente','_ccFormatoImporteExtracto']);
 c.verComprobantesCuentaCorriente('["p1","p2"]');assert.equal(menu.enlaces[1].importe,'Importe no disponible');assert.equal(menu.resumen,'No disponible');
});

function navigation(allowed=true){
 let page='cuentacorriente',restored;const frames=[],content={scrollTop:325},nodes={};
 const node=id=>nodes[id]||(nodes[id]={value:'',style:{},dataset:{},scrollIntoView(){}});
 for(const [id,value]of Object.entries({'cc-extracto-desde':'2026-10-01','cc-extracto-hasta':'2026-10-17','cc-buscador':'Cliente','cob-buscador':'otro','cob-filtro-medio':'Efectivo'}))node(id).value=value;
 const window={_ccCuentaKeyActual:'c',_ccMapActual:{c:{}},_ccExtractoActual:{clienteKey:'c',movimientos:[{tipo:'Pago',pagos:['p1']}]},_historialPagosCompleto:[{fbKey:'p1'}]};
 const c=load({window,document:{scrollingElement:{scrollTop:450},getElementById:node,querySelector:()=>content},notify(){},permisoModulo:()=>allowed,_svEsPaginaActiva:id=>id===page,_svNavegandoAtras:false,_ccFiltroActual:'todos',_cobFiltroActual:'mes',_cobPaginaActual:3,showPage:id=>page=id,requestAnimationFrame:fn=>frames.push(fn),setFiltroCob(){},setFiltroCC:f=>c._ccFiltroActual=f,verCuentaClienteReal:key=>restored=key,volverListaCuentaCorriente:assert.fail,svNavegarDirecto(id,fn){assert.equal(c._svNavegandoAtras,true);page=id;fn();content.scrollTop=0;}},['_cobroPagoPorKey','_ccLimpiarCobroSeleccionado','abrirCobroDesdeCuentaCorriente','volverACuentaDesdeCobro']);
 return {c,window,nodes,content,frames,get page(){return page;},get restored(){return restored;}};
}
test('Ver cobro selecciona por identidad y vuelve al cliente, período, búsqueda y scroll originales',()=>{
 const f=navigation();f.c.abrirCobroDesdeCuentaCorriente(0);assert.equal(f.page,'cobranzas');assert.deepEqual(Array.from(f.window._ccCobrosSeleccionados),['p1']);assert.equal(f.nodes['cob-buscador'].value,'');
 f.nodes['cc-extracto-desde'].value='';f.c.volverACuentaDesdeCobro();f.frames.forEach(fn=>fn());
 assert.equal(f.page,'cuentacorriente');assert.equal(f.restored,'c');assert.equal(f.nodes['cc-extracto-desde'].value,'2026-10-01');assert.equal(f.nodes['cc-extracto-hasta'].value,'2026-10-17');assert.equal(f.nodes['cc-buscador'].value,'Cliente');assert.equal(f.content.scrollTop,325);assert.equal(f.c.document.scrollingElement.scrollTop,450);assert.equal(f.window._ccCobrosSeleccionados,null);assert.equal(f.nodes['cob-buscador'].value,'otro');assert.equal(f.c._cobPaginaActual,3);assert.equal(f.nodes['page-cobranzas'].dataset.ccConsulta,undefined);
});
test('sin permiso de Cobranzas o sin vínculo no navega ni amplía acceso',()=>{
 const f=navigation(false);f.c.abrirCobroDesdeCuentaCorriente(0);assert.equal(f.page,'cuentacorriente');assert.equal(f.window._ccRetornoCobro,undefined);
 const legacy=navigation();legacy.window._ccExtractoActual.movimientos[0].pagos=[];legacy.c.abrirCobroDesdeCuentaCorriente(0);assert.equal(legacy.page,'cuentacorriente');
});
test('Ver comprobante abre en sitio, nunca habilita adjuntar y conserva compatibilidad embebida',()=>{
 const calls=[];const c=load({_cobroPagoPorKey:key=>key==='embedded'?{comprobanteAdjunto:{nombre:'ficticio.png',data:'data:image/png;base64,AA=='}}:null,abrirVisorComprobanteSistema:doc=>calls.push(doc.nombre),verOAdjuntarDocumentoCobro:(key,attached)=>calls.push([key,attached]),_svCrearDialogoSistema:opts=>calls.push(opts)},['verComprobantesCuentaCorriente']);
 c.verComprobantesCuentaCorriente('["p1"]');assert.deepEqual(calls.pop(),['p1',true]);c.verComprobantesCuentaCorriente('["embedded"]');assert.equal(calls.pop(),'ficticio.png');
 c.verComprobantesCuentaCorriente('["p1","p2"]');const menu=calls.pop();assert.equal(menu.enlaces.length,2);menu.enlaces[1].abrir();assert.deepEqual(calls.pop(),['p2',true]);
 c.verComprobantesCuentaCorriente('no-json');c.verComprobantesCuentaCorriente('[]');assert.equal(calls.length,0);
});

test('seleccionar un cobro en el historial no cambia el universo usado para calcular su saldo',()=>{
 const nodes={};const node=id=>nodes[id]||(nodes[id]={value:'',style:{},innerHTML:''});const payments=[{fbKey:'p1',venta:'V1',fecha:'2026-10-16',monto:40},{fbKey:'p2',venta:'V1',fecha:'2026-10-17',monto:10}];
 const c=load({window:{_historialPagosCompleto:payments,_ccCobrosSeleccionados:['p2']},document:{getElementById:node},_svEsPaginaActiva:()=>true,_cobFiltroActual:'todos',_cobUltimaConsulta:'',_cobPaginaActual:1,_cobPorPagina:50,escapeHTML:s=>String(s),_mostrarFecha:s=>s,formatoMedioPago:s=>s,nombreClienteVigente:()=>'',_cobroMontoHistorialHTML:()=>'',_cobroTieneComprobante:()=>false,_cobroSaldoRestanteHistorialHTML:(_,full)=>{assert.equal(full,payments);return 'Saldo correcto';}},['_cobFiltrarHistorial','renderHistorialCobranzas']);
 c.renderHistorialCobranzas();assert.equal(c.window._historialPagosActual.length,1);assert.equal(c.window._historialPagosActual[0].fbKey,'p2');assert.match(nodes['pagos-tbody'].innerHTML,/Saldo correcto/);
});
