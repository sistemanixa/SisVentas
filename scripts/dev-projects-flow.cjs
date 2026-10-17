'use strict';
// Explicitly isolated: real Projects service/model + UI, fake identities and RAM only.
// Commercial form/functions are extracted from the active app; persistence is replaced.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {memoryDB}=require('../test/helpers/private-finance-fixtures.cjs');
const {createProjects}=require('../cotizador/projects');
const {readActiveApp}=require('../test/helpers/active-app');
const {functionSource}=require('../test/helpers/app-functions.cjs');
const root=path.resolve(__dirname,'..'),port=Number(process.env.SV_PROJECTS_FLOW_PORT||8764);
const db=memoryDB({sv_chat_roles:{demo:{rol:'admin',activo:true},lucia:{rol:'administrativo',activo:true},mateo:{rol:'tecnico',activo:true}},sv_chat_directorio:{demo:{nombre:'Responsable de ejemplo',activo:true},lucia:{nombre:'Lucía · Ejemplo',activo:true},mateo:{nombre:'Mateo · Ejemplo',activo:true}},sisventas:{clientes:{cliente:{nombre:'Consorcio Mirador · Ejemplo',dir:'Domicilio ficticio · Acceso principal'}},presupuestos:{}}});
const service=createProjects({db,auth:{verifyIdToken:async t=>{if(!['demo','lucia','mateo'].includes(t))throw Error('Solo identidades ficticias');return {uid:t};}},enabled:true});
const {index}=readActiveApp(),start=index.indexOf('<div id="ppto-form-view"'),end=index.indexOf('\n</div>',start);
if(start<0||end<0)throw Error('No se encontró el formulario comercial activo');
const form=index.slice(start,end);
const extracted=['abrirNuevoPresupuesto','guardarPresupuesto','crearFilaProducto','getPpItems','calcRow','calcPpTotales','_calcularResumenPresupuesto','normalizarNumeroExcel','_redondearPrecioActual','calcVencimiento','svTextoLegible','escapeHTML'].map(functionSource).join('\n');
const bootstrap=`
var currentRole='admin',currentUserUid='demo',currentUser='Responsable de ejemplo',currentUserEmail='',isAuthenticated=true;
var permisoModulo=()=>true,tienePermiso=()=>true,svConfirm=async message=>window.confirm(message);
var fbAuth={currentUser:{uid:'demo',getIdToken:async()=> 'demo'}},SISVENTAS_FUNCTIONS={cotizadorProveedor:location.origin};
var prodData={},stockData={},pptoData=[],_pptoConIva=true,_pptoConDetalle=true,APROBACION_CONFIG={montoLimite:99999999,descuentoLimite:100};
var notify=text=>document.getElementById('notice').textContent=text;
var _hide=id=>{var el=document.getElementById(id);if(el)el.style.display='none';},_block=id=>{var el=document.getElementById(id);if(el)el.style.display='block';},_set=(id,text)=>{var el=document.getElementById(id);if(el)el.textContent=text;};
function showPage(name){document.querySelectorAll('.page').forEach(p=>{p.classList.toggle('active',p.id==='page-'+name);p.style.display=p.id==='page-'+name?'block':'none';});document.dispatchEvent(new CustomEvent('sisventas:page-changed',{detail:{page:name}}));}
var toggleImagenComprobante=()=>{},iaMarcarPresupuesto=()=>{},togglePptoDetalle=()=>{},actualizarAccesoVentasClientePpto=()=>{},iniciarMonedaPpto=()=>{},calcTotals=()=>{},actualizarComparacionEditor=()=>{},stockBadgeHTML=()=>'',imagenProductoItemHTML=()=>'',puedeModificarDescripcionItemDocumento=()=>false,obtenerProductoPorCodigoVenta=()=>null,initMoneyInputsEn=()=>{},actualizarStockFila=()=>{},pptoV3Invocar=()=>null;
var importeComprobanteVenta=value=>'$'+Number(value).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
var SVCommercialDocument={dateChoice:async()=>({value:document.getElementById('pp-fecha').value}),auditDate:()=>{}},SVCommercialApproval={discount:()=>({invalid:false,maximum:0}),stamp:()=>null};
var clienteSeleccionadoPpto=()=>({fbKey:document.getElementById('pp-cli-id').value,id:document.getElementById('pp-cli-id').value}),clienteVinculoOperacion=()=>({clientePrincipalKey:'cliente',domicilioFbKey:'',domicilioCategoria:'principal',direccion:'Domicilio ficticio'}),validarProductosActivosDocumento=()=>true,referenciasProductoDesdeFilas=()=>[];
var reservarSiguientePptoId=async()=> 'PP-EJEMPLO-'+String(Date.now()).slice(-6),svCrearProgresoBoton=()=>({actualizar:()=>{},finalizar:()=>{}});
async function fbGuardarPresupuesto(value){const r=await fetch('/fixture/presupuesto',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const saved=await r.json();if(!r.ok)throw Error(saved.mensaje);Object.assign(value,saved);pptoData.unshift(value);}
function addPpRow(){document.getElementById('pp-body').appendChild(crearFilaProducto('','Seleccioná un producto',0,1,0));}
function _pptoAsegurarFilaVacia(){if(!Array.from(document.querySelectorAll('#pp-body .desc-txt')).some(el=>el.textContent==='Seleccioná un producto'))addPpRow();}
function volverListaPpto(){document.getElementById('commercial-result').hidden=false;document.getElementById('commercial-result').textContent='Presupuesto ficticio guardado. Podés volver al proyecto.';}
function delRow(button){button.closest('tr').remove();calcPpTotales();}
document.getElementById('fixture-back').onclick=()=>showPage('proyectos');
`;
const page=`<!doctype html><html lang="es" class="dark-mode sv-v3-preview"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proyectos · Prueba aislada completa</title><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/v3-preview.css"><link rel="stylesheet" href="/css/projects.css"><style>body{display:block!important;padding:12px;overflow:auto!important;height:auto!important}.fixture-banner{position:sticky;top:0;background:#10243a;border:1px solid #426283;border-radius:9px;padding:12px;margin-bottom:14px;z-index:5;font-size:12px}#notice{background:#1c3850;padding:10px;margin-top:12px;position:fixed;bottom:5px;left:10px;right:10px;z-index:100}#notice:empty{display:none}.page{padding:0!important}.px-shell{padding-bottom:60px}</style></head><body class="dark-mode"><div class="fixture-banner">PRUEBA AISLADA · Datos ficticios · No usa Firebase ni envía correos. Recargar conserva el ejemplo mientras el servidor siga encendido.</div><main id="page-proyectos" class="page active" style="display:block"></main><section id="page-presupuesto" class="page" style="display:none"><button class="btn" id="fixture-back">Volver al proyecto</button><p id="commercial-result" hidden></p>${form}</section><div id="notice" role="status"></div><script src="/fixture-bootstrap.js"></script><script src="/fixture-commercial.js"></script><script src="/js/core/projects-model.js"></script><script src="/js/modules/projects.js"></script><script src="/fixture-start.js"></script></body></html>`;
const files=new Set(['css/app.css','css/v3-preview.css','css/projects.css','js/core/projects-model.js','js/modules/projects.js']);
const send=(res,status,type,body)=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-src 'self'; font-src 'self'"});res.end(body);};
const json=(res,status,data)=>send(res,status,'application/json; charset=utf-8',JSON.stringify(data));
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/proyectos'||url.pathname.startsWith('/proyectos/')){
  const actor=await service.authorize(req);let result;
  if(req.method==='GET'&&url.pathname==='/proyectos')result=await service.list(actor);
  else if(req.method==='GET'&&url.pathname==='/proyectos/opciones')result=await service.options(actor,url.searchParams.get('proyecto')||'');
  else if(req.method==='POST'&&url.pathname==='/proyectos/guardar'){let raw='';for await(const c of req){raw+=c;if(raw.length>250000)throw Error('Tamaño inválido');}result=await service.save(actor,JSON.parse(raw));}
  else return json(res,405,{ok:false,mensaje:'Método no permitido'});return json(res,200,{ok:true,...result});
 }
 if(req.method==='POST'&&url.pathname==='/fixture/presupuesto'){let raw='';for await(const c of req){raw+=c;if(raw.length>100000)throw Error('Tamaño inválido');}const value=JSON.parse(raw);if(value.clienteFbKey!=='cliente')throw Error('Solo cliente ficticio');value.fbKey='quote-'+Date.now();db.root.sisventas.presupuestos[value.fbKey]=value;return json(res,200,{fbKey:value.fbKey,id:value.id});}
 if(req.method!=='GET')return json(res,405,{ok:false});
 if(url.pathname==='/')return send(res,200,'text/html; charset=utf-8',page);
 if(url.pathname==='/mobile')return send(res,200,'text/html; charset=utf-8','<!doctype html><meta charset="UTF-8"><title>Proyectos · Celular 390 px</title><style>body{margin:0;background:#060d19;display:flex;justify-content:center}iframe{border:1px solid #405070;width:390px;height:min(844px,calc(100dvh - 4px));max-width:100vw}</style><iframe title="Proyectos en celular" src="/"></iframe>');
 if(url.pathname==='/fixture-bootstrap.js')return send(res,200,'text/javascript; charset=utf-8',bootstrap);
 if(url.pathname==='/fixture-commercial.js')return send(res,200,'text/javascript; charset=utf-8',extracted);
 if(url.pathname==='/fixture-start.js')return send(res,200,'text/javascript','SVProjects.open();');
 const file=url.pathname.slice(1);if(!files.has(file))return send(res,404,'text/plain','No disponible');return send(res,200,file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8',fs.readFileSync(path.join(root,file)));
 }catch(e){json(res,e.statusCode||500,{ok:false,mensaje:e.message});}}).listen(port,'127.0.0.1',()=>console.log('Proyectos con servicio/modelo reales, identidades ficticias y almacenamiento RAM: http://127.0.0.1:'+port+'/mobile'));
