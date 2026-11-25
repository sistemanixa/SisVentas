'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),Overlay=require('../../scripts/lib/list-search-feedback-overlay.cjs');
function source(){const configured=process.env.SV_LIST_SEARCH_APP_SOURCE;const raw=configured?fs.readFileSync(configured,'utf8'):require('./active-app').readActiveApp().source;return raw.replace(/\r\n/g,'\n');}
function between(s,start,end){const a=s.indexOf(start),b=s.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Fixture source missing '+start);return s.slice(a,b);}
function snippets(s){return between(s,'function _svBusquedaListaEsperar(','function programarRenderTablaClientes(')+between(s,'function programarRenderTablaClientes(','function verClienteById(')+between(s,'function renderTablaProductos(','var _prodBusquedaTimer')+between(s,'function _estadoBusquedaProductos(','function mostrarMasResultadosProductos(')+between(s,'function renderTablaGastos()','function _cargarFiltroEmpleadosGastos(')+between(s,'function buscarGastos()','function abrirFormGasto(')+between(s,'function buscarProveedor(val)','function guardarGarantia(')+between(s,'function fbCargarProveedores()','var APROBACION_CONFIG');}
module.exports={source,between,snippets,patched(){const s=source();return s.includes('function _svBusquedaListaEsperar(')?s:Overlay.apply(s);}};
