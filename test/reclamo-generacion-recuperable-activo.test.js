const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.v3.7.4.js', 'utf8');

function funcion(firma) {
  const inicio = app.indexOf(firma);
  assert.notEqual(inicio, -1, `No se encontró ${firma}`);
  const llave = app.indexOf('{', inicio);
  let profundidad = 0;
  for (let i = llave; i < app.length; i++) {
    if (app[i] === '{') profundidad++;
    if (app[i] === '}' && --profundidad === 0) return app.slice(inicio, i + 1);
  }
  throw new Error(`No se pudo extraer ${firma}`);
}

function contexto(opciones = {}) {
  const actualizaciones = [];
  let ventasCreadas = 0;
  let intentosOT = 0;
  let prompt = opciones.prompt === undefined ? '0' : opciones.prompt;
  const ctx = {
    window: {}, SP_MODAL_KEY:'reclamo-afianza', _spOTGeneracionPorReclamo:{},
    SP_DATA:{
      'reclamo-afianza':{
        fbKey:'reclamo-afianza', cliente:'AFIANZA PLAZA', clienteFbKey:'cli_50386',
        estado:'nuevo', historial:[], descripcion:'SE ESTA TRABANDO EL PERNO DE LA PUERTA'
      }
    },
    SP_ESTADOS:{nuevo:{label:'Nuevo'},visita:{label:'Visita requerida'},ot_activa:{label:'OT activa'}},
    otData:[], ventasList:[],
    prodData:{visita:{fbKey:'prod-visita',codigo:'P-VIS',nombre:'Visita técnica',venta:1000,activo:true}},
    empData:{osmar:{fbKey:'emp-osmar',nombre:'Osmar Tello',cargo:'Técnico B',activo:true}},
    CHECKLISTS:{preparacion:['a'],instalacion:['b'],verificacion:['c']},
    FB_PATHS:{ordenesTrabajo:'sisventas/ordenes_trabajo'},
    currentUser:'Prueba', console, Promise, Date, Number, String, Object, Array, parseInt,
    document:{activeElement:null,getElementById:()=>null,querySelector:()=>null},
    notify:()=>{}, spRenderLista:()=>{}, spActualizarMetricas:()=>{}, spAbrirModal:()=>{},
    svCrearProgresoBoton:()=>({actualizar:()=>{},finalizar:()=>{}}),
    spMostrarProcesoCreacionOT:()=>({actualizar:()=>{},finalizar:()=>{}}),
    requestAnimationFrame:fn=>fn(),
    svPrompt:()=>Promise.resolve(prompt),
    svFechaLocalISO:()=> '2026-09-24', fechaVentaOrdenISO:f=>f,
    _redondearPrecioActual:n=>Number(n), precioVentaCanonicoProducto:p=>({precioARS:p.venta}),
    ventaComisionadoPrincipalIdentidad:()=>({fbKey:'',nombre:''}),
    ventaComisionadoSecundarioIdentidad:()=>({fbKey:'',nombre:''}),
    spProductoVisitaTecnicaConfigurado:()=>ctx.prodData.visita,
    spEmpleadoEsTecnico:e=>e.activo !== false && /tecnico|técnico/i.test(e.cargo || ''),
    _svResolverClienteRegistro:()=>({id:'50386',fbKey:'cli_50386'}),
    ventasPagosPersistirGuardarVenta:async venta=>{
      ventasCreadas++;
      const guardada={...venta,fbKey:`venta-${ventasCreadas}`};
      ctx.ventasList.push(guardada);
      return guardada;
    },
    crearRegistroOTSeguro:async ot=>{
      intentosOT++;
      if (opciones.fallarPrimerOT && intentosOT === 1) throw new Error('Falla simulada al crear OT');
      return {key:`ot-${intentosOT}`,fbKey:`ot-${intentosOT}`,id:`OT-${100+intentosOT}`,record:{...ot,fbKey:`ot-${intentosOT}`,id:`OT-${100+intentosOT}`}};
    }
  };
  ctx.window=ctx;
  ctx.window._svResolverClienteRegistro=ctx._svResolverClienteRegistro;
  ctx.window.fbDB={};
  ctx.window.fbRef=(_db,path)=>path || '';
  ctx.window.crearRegistroOTSeguro=ctx.crearRegistroOTSeguro;
  ctx.window.fbUpdate=async (path, cambios)=>{
    actualizaciones.push({path,cambios});
    const base='sisventas/reclamos/reclamo-afianza';
    if (path === base) Object.assign(ctx.SP_DATA['reclamo-afianza'], cambios);
    if (path === '') Object.entries(cambios).forEach(([clave,valor])=>{
      if (clave.startsWith(base+'/')) ctx.SP_DATA['reclamo-afianza'][clave.slice(base.length+1)]=valor;
    });
  };
  const firmas=[
    'function _buscarOTCanonicaPorClave(otKey, otId)',
    'function _buscarVentaCanonicaReclamo(reclamo, ot)',
    'function _coincideReclamoExacto(registro, reclamo)',
    'function _candidatasOTReclamo(reclamo)',
    'function _candidatasVentaReclamo(reclamo, ot)',
    'function _elegirCandidataVinculo(titulo, candidatas, etiqueta)',
    'function _guardarVinculoReclamoExistente(reclamo, ot, venta, opciones)',
    'function spCambiarEstado(nuevoEstado, extraDatos, reclamoKey)',
    'function spRegistrarFalloGeneracionOT(reclamoKey, error)',
    'function spPasarAVisitaYGenerarOT(reclamoKey)',
    'async function spGenerarOT(reclamoKey)'
  ];
  vm.createContext(ctx);
  vm.runInContext(firmas.map(funcion).join('\n\n'),ctx);
  return {ctx,actualizaciones,get ventasCreadas(){return ventasCreadas;},get intentosOT(){return intentosOT;},setPrompt:v=>{prompt=v;}};
}

test('cancelar la selección de técnico no cambia estado ni agrega historial falso', async () => {
  const escenario=contexto({prompt:null});
  const reclamo=escenario.ctx.SP_DATA['reclamo-afianza'];
  await escenario.ctx.spPasarAVisitaYGenerarOT('reclamo-afianza');
  assert.equal(reclamo.estado,'nuevo');
  assert.deepEqual(reclamo.historial,[]);
  assert.equal(escenario.ventasCreadas,0);
  assert.equal(escenario.intentosOT,0);
});

test('si falla la OT, el reintento reutiliza la venta y termina el vínculo bilateral', async () => {
  const escenario=contexto({fallarPrimerOT:true});
  await escenario.ctx.spPasarAVisitaYGenerarOT('reclamo-afianza');
  let reclamo=escenario.ctx.SP_DATA['reclamo-afianza'];
  assert.equal(reclamo.estado,'visita');
  assert.equal(reclamo.ventaKey,'venta-1');
  assert.match(reclamo.generacionOTError,/Falla simulada/);
  assert.equal(escenario.ventasCreadas,1);

  await escenario.ctx.spPasarAVisitaYGenerarOT('reclamo-afianza');
  reclamo=escenario.ctx.SP_DATA['reclamo-afianza'];
  assert.equal(escenario.ventasCreadas,1,'no crea una segunda venta');
  assert.equal(escenario.intentosOT,2);
  assert.equal(reclamo.estado,'ot_activa');
  assert.equal(reclamo.otId,'OT-102');
  assert.equal(reclamo.generacionOTPendiente,false);

  const multipath=escenario.actualizaciones.filter(x=>x.path==='').map(x=>x.cambios);
  assert.ok(multipath.some(x=>x['sisventas/ventas/venta-1/otNumero']==='OT-102'));
  assert.ok(multipath.some(x=>x['sisventas/ordenes_trabajo/ot-2/ventaFbKey']==='venta-1'));
});

test('una OT existente con referencia exacta se recupera sin crear registros', async () => {
  const escenario=contexto();
  escenario.ctx.otData.push({fbKey:'ot-existente',id:'OT-070',reclamoKey:'reclamo-afianza',tecnico:'Osmar Tello'});
  await escenario.ctx.spPasarAVisitaYGenerarOT('reclamo-afianza');
  const reclamo=escenario.ctx.SP_DATA['reclamo-afianza'];
  assert.equal(reclamo.otKey,'ot-existente');
  assert.equal(reclamo.estado,'ot_activa');
  assert.equal(escenario.ventasCreadas,0);
  assert.equal(escenario.intentosOT,0);
});
