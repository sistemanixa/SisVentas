'use strict';
// Pure, bounded frontend transform. Never writes the immutable application.
function once(source,before,after){if(source.split(before).length!==2)throw Error('List search overlay anchor changed: '+before.slice(0,90));return source.replace(before,after);}
function section(source,start,end,transform){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(a<0||b<0||source.indexOf(start,a+1)>=0)throw Error('List search section changed: '+start);return source.slice(0,a)+transform(source.slice(a,b))+source.slice(b);}
const helpers=`function _svBusquedaListaEsperar(id, selector) {
  var body = document.getElementById(id);
  if (!body) return;
  body.style.visibility = 'hidden';
  body.setAttribute('inert', '');
  body.setAttribute('aria-busy', 'true');
  if (!body._svBusquedaListaEstado && selector) {
    var status = document.querySelector(selector);
    if (status) body._svBusquedaListaEstado = { node:status, html:status.innerHTML };
  }
  var state = body._svBusquedaListaEstado;
  if (state) {
    state.node.setAttribute('role', 'status');
    state.node.innerHTML = window.SisVentas?.carga?.estado?.('Buscando…') || 'Buscando…';
  }
}
function _svBusquedaListaTerminar(body) {
  if (!body) return;
  body.style.visibility = '';
  body.removeAttribute('inert');
  body.removeAttribute('aria-busy');
  var state = body._svBusquedaListaEstado;
  if (state) { state.node.innerHTML = state.html; state.node.removeAttribute('role'); delete body._svBusquedaListaEstado; }
}
`;
function apply(raw){let source=String(raw).replace(/\r\n/g,'\n');if(source.includes('function _svBusquedaListaEsperar('))throw Error('List search overlay already applied');
 source=once(source,'function programarRenderTablaClientes(filtro, mostrarCarga) {',helpers+'function programarRenderTablaClientes(filtro, mostrarCarga) {');
 source=section(source,'function programarRenderTablaClientes(','function renderTablaClientes(',s=>once(s,"  if (mostrarCarga) mostrarEstadoCargaClientes('Preparando clientes…');","  _svBusquedaListaEsperar('cli-tbody', '#page-clientes .card-title');"));
 source=section(source,'function renderTablaClientes(','function buscarCliente(',s=>{s=once(s,'  reconstruirCacheClientes();',"  if (filtro === undefined || filtro === null) filtro = document.querySelector('#page-clientes input[oninput*=buscarCliente]')?.value || '';\n  reconstruirCacheClientes();");s=once(s,"\n    tbody.removeAttribute('aria-busy');","\n    _svBusquedaListaTerminar(tbody);");return once(s,"\n  tbody.removeAttribute('aria-busy');","\n  _svBusquedaListaTerminar(tbody);");});
 source=section(source,'function renderTablaProductos(','var _prodBusquedaTimer',s=>{s=once(s,"      _estadoBusquedaProductos('0 resultados', 'ok');","      _svBusquedaListaTerminar(tbody);\n      _estadoBusquedaProductos('0 resultados', 'ok');");s=once(s,'    tbody.innerHTML = htmlBusqueda;','    tbody.innerHTML = htmlBusqueda;\n    _svBusquedaListaTerminar(tbody);');return once(s,'  tbody.innerHTML = html;','  tbody.innerHTML = html;\n  _svBusquedaListaTerminar(tbody);');});
 source=section(source,'function buscarProducto(val)','function mostrarMasResultadosProductos(',s=>once(s,"  _estadoBusquedaProductos('<i class=\"ti ti-loader-2 ti-spin\"></i> Buscando...');","  _svBusquedaListaEsperar('prod-tbody');\n  _estadoBusquedaProductos(window.SisVentas?.carga?.estado?.('Buscando…') || 'Buscando…');"));
 source=section(source,'function renderTablaGastos()','function _cargarFiltroEmpleadosGastos(',s=>{s=once(s,'    return;\n  }\n  var kpiActivoRender','    _svBusquedaListaTerminar(tbody);\n    return;\n  }\n  var kpiActivoRender');s=once(s,"    return;\n  }\n\n  var firmaFiltros", "    _svBusquedaListaTerminar(tbody);\n    return;\n  }\n\n  var firmaFiltros");return once(s,"  }).join('');\n}\n", "  }).join('');\n  _svBusquedaListaTerminar(tbody);\n}\n");});
 source=section(source,'function buscarGastos()','function abrirFormGasto(',s=>once(s,'  clearTimeout(_buscarGastosTimer);',"  clearTimeout(_buscarGastosTimer);\n  _svBusquedaListaEsperar('gastos-tbody', '#gasto-list .card-title');"));
 source=section(source,'function fbCargarProveedores()','var APROBACION_CONFIG',s=>once(s,'    actualizarProveedorBaseEnForm();',"    actualizarProveedorBaseEnForm();\n    buscarProveedor(document.querySelector('#page-proveedores input[oninput*=buscarProveedor]')?.value || '');"));
 return source;
}
module.exports=Object.freeze({apply});
