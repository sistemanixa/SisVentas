'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('./helpers/app-functions.cjs');
const {readActiveApp} = require('./helpers/active-app');
const approval = require('../js/modules/commercial-approval.js');
const budgets = require('../js/v3/budget-integration.js');

const copy = value => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(options = {}) {
  const role = options.role || 'admin';
  const discount = options.discount ?? 15;
  const items = [{cod:'DEMO-1',desc:'Producto ficticio',qty:2,punit:options.price ?? 1000,disc:options.itemDiscount ?? 0,sub:0}];
  const config = {descuentoLimite:5,montoLimite:600000};
  const totals = budgets.fields({items,descuentoGeneral:discount,conIva:true});
  const original = options.edit ? {
    fbKey:'budget-ficticio',id:'PP-FAKE',numero:'PP-FAKE',estado:'aprobado_int',
    fecha:'01/09/2026',ts:10,creadoPor:'Autor ficticio',usuario:'Autor ficticio',empleado:'Autor ficticio',
    empleadoUid:'autor-ficticio',empleadoEmail:'autor@example.invalid',
    aprobadoPor:'Aprobador anterior',aprobadoUid:'anterior',aprobadoEn:'2026-09-01T12:00:00.000Z',
    audit:[{fecha:'01/09/2026 09:00',usuario:'Autor ficticio',accion:'Presupuesto creado anteriormente'}],
    ...budgets.fields({items:[{...items[0],punit:900}],descuentoGeneral:0,conIva:true})
  } : null;
  const nodes = {
    'pp-cli':{value:'Cliente ficticio'},
    'pp-descuento':{value:String(discount)},
    'pp-total':{textContent:String(totals.total)},
    'pp-sub':{textContent:String(totals.subtotal)},
    'pp-iva':{textContent:String(totals.iva)},
    'pp-venc':{value:'2026-11-01'},
    'pp-titulo-solucion':{value:'Propuesta ficticia'},
    'ppto-form-view':{dataset:{}},
    'btn-guardar-principal-ppto':{tagName:'BUTTON',isConnected:true}
  };
  const writes = [], notices = [], lifecycle = {complete:0,closed:0,reserved:0,progressFinished:0};
  const c = {
    document:{getElementById:id => nodes[id] || null,querySelector:() => null,querySelectorAll:() => [],activeElement:null},
    currentRole:role,currentUser:'Editor ficticio',currentUserEmail:'editor@example.invalid',currentUserUid:'editor-ficticio',
    APROBACION_CONFIG:config,SVCommercialApproval:approval,
    _pptoEditandoFbKey:original?.fbKey || null,_pptoEditandoId:original?.id || null,_pptoEditorBase:original && copy(original),
    _pptoConIva:true,prodData:[],pptoData:original ? [original] : [],
    clienteSeleccionadoPpto:() => ({fbKey:'cliente-ficticio',id:'C-FAKE'}),
    clienteVinculoOperacion:() => ({clientePrincipalKey:'cliente-ficticio',domicilioFbKey:'domicilio-ficticio',domicilioCategoria:'principal',direccion:'Domicilio ficticio'}),
    normalizarNumeroExcel:value => String(value),
    _redondearPrecioActual:value => Math.round(Number(value) * 100) / 100,
    validarProductosActivosDocumento:() => true,referenciasProductoDesdeFilas:() => [],getPpItems:() => copy(items),
    pptoV3Invocar:(method,args,fallback) => method === 'fields' ? budgets.fields(...args) : fallback,
    buscarPptoPorRef:reference => original && reference === original.fbKey ? original : null,
    tienePermiso:permission => role === 'admin' && ['presupuestos.aprobar','presupuestos.aprobarDentroLimite'].includes(permission)
      || role === 'administrativo' && permission === 'presupuestos.aprobarDentroLimite',
    SVCommercialDocument:{dateChoice:async () => ({value:original?.fecha || '2026-10-20'}),auditDate(){}},
    svDrafts:{complete:kind => {assert.equal(kind,'presupuesto');lifecycle.complete++;}},
    reservarSiguientePptoId:async () => {lifecycle.reserved++;return 'PP-FAKE';},
    fbGuardarPresupuesto:(record,baseline) => {
      writes.push({record:copy(record),baseline:baseline && copy(baseline)});
      if (options.persist) return options.persist(record,baseline);
      return Promise.resolve({...record,fbKey:record.fbKey || 'budget-nuevo-ficticio'});
    },
    volverListaPpto:() => {lifecycle.closed++;},notify:message => notices.push(message),
    svCrearProgresoBoton:() => ({actualizar(){},finalizar(){lifecycle.progressFinished++;}})
  };
  c.window = c;
  load(c,['guardarPresupuesto']);
  return {c,config,original,nodes,writes,notices,lifecycle,async save(mode = 'aprobado_int') {
    await c.guardarPresupuesto(mode);
    await settle();
    return writes[0]?.record;
  }};
}

test('las regresiones ejecutan guardarPresupuesto de la aplicación activa', () => {
  assert.match(readActiveApp().filename,/^app\.v\d+\.\d+\.\d+\.js$/);
  const f = fixture();
  assert.equal(typeof f.c.guardarPresupuesto,'function');
});

for (const edit of [false,true]) {
  for (const price of [1000,2000000]) {
    test('admin ' + (edit ? 'edita' : 'crea') + ' con 15% y ' + (price > 1000 ? 'monto alto' : 'monto normal') + ': guarda y aprueba con sello exacto', async () => {
      const f = fixture({edit,price}), saved = await f.save();
      assert.equal(f.writes.length,1);
      assert.equal(saved.estado,'aprobado_int');
      assert.equal(saved.requiereAprobacion,false);
      assert.equal(saved.motivo,'');
      assert.equal(saved.aprobadoPor,'Editor ficticio');
      assert.equal(saved.aprobadoUid,'editor-ficticio');
      assert.ok(saved.aprobadoEn);
      assert.equal(saved.autorizacionDescuento.firma,approval.signature(saved,'presupuesto'));
      assert.equal(saved.autorizacionDescuento.uid,'editor-ficticio');
      assert.equal(approval.status(saved,'presupuesto',f.config).blocked,false);
      assert.match(saved.audit.at(-1).accion,/aprobado.*administrador/i);
      assert.equal(f.lifecycle.complete,1);
      assert.equal(f.lifecycle.closed,1);
      assert.equal(f.lifecycle.progressFinished,1);
      assert.equal(f.lifecycle.reserved,edit ? 0 : 1);
      if (edit) {
        assert.equal(saved.fbKey,'budget-ficticio');
        assert.equal(saved.id,'PP-FAKE');
        assert.equal(saved.fecha,f.original.fecha);
        assert.equal(saved.ts,10);
        assert.equal(saved.creadoPor,'Autor ficticio');
        assert.equal(saved.empleadoUid,'autor-ficticio');
        assert.deepEqual(saved.audit[0],f.original.audit[0]);
        assert.equal(f.writes[0].baseline.fbKey,'budget-ficticio');
        assert.equal(f.original.aprobadoPor,'Aprobador anterior');
      }
    });
  }
}

for (const options of [{discount:15},{discount:0,price:2000000},{discount:3,itemDiscount:3}]) {
  test('administrativo supera límite ' + JSON.stringify(options) + ': sigue en revisión sin autorización propia', async () => {
    const f = fixture({role:'administrativo',...options}),saved = await f.save();
    assert.equal(saved.estado,'revision');
    assert.equal(saved.requiereAprobacion,true);
    assert.equal(saved.autorizacionDescuento,null);
    assert.equal(saved.aprobadoPor,null);
    assert.equal(saved.aprobadoUid,null);
    assert.equal(approval.status(saved,'presupuesto',f.config).blocked,true);
    assert.equal(f.lifecycle.complete,1);
  });
}

for (const discount of [0,5]) {
  test('administrativo dentro del límite (' + discount + '%) aprueba incluso con la acción antigua revisión', async () => {
    const f = fixture({role:'administrativo',discount}),saved = await f.save('revision');
    assert.equal(saved.estado,'aprobado_int');
    assert.equal(saved.requiereAprobacion,false);
    assert.equal(saved.autorizacionDescuento,null);
    assert.equal(approval.status(saved,'presupuesto',f.config).blocked,false);
  });
}

for (const edit of [false,true]) {
  test('Guardar borrador explícito conserva borrador para admin al ' + (edit ? 'editar' : 'crear'), async () => {
    const f = fixture({edit,price:2000000}),saved = await f.save('borrador');
    assert.equal(saved.estado,'borrador');
    assert.equal(saved.requiereAprobacion,false);
    assert.equal(saved.autorizacionDescuento,null);
    assert.equal(saved.aprobadoPor,null);
    assert.equal(approval.status(saved,'presupuesto',f.config).needsApproval,true);
  });
}

for (const edit of [false,true]) {
  test('fallo de persistencia al ' + (edit ? 'editar' : 'crear') + ' conserva el borrador y formulario sin anunciar aprobación', async () => {
    let reject;
    const pending = new Promise((resolve,rejectPromise) => {reject = rejectPromise;});
    const f = fixture({edit,persist:() => pending});
    const task = f.c.guardarPresupuesto('aprobado_int');
    await settle();
    assert.equal(f.writes.length,1);
    assert.equal(f.c._pptoGuardadoEnCurso,true);
    assert.equal(f.lifecycle.complete,0);
    assert.equal(f.lifecycle.closed,0);
    reject(new Error('Conexión ficticia interrumpida'));
    await task;
    await settle();
    assert.equal(f.c._pptoGuardadoEnCurso,false);
    assert.equal(f.lifecycle.complete,0);
    assert.equal(f.lifecycle.closed,0);
    assert.equal(f.lifecycle.progressFinished,1);
    assert.ok(f.notices.some(message => /Error al guardar presupuesto.*Conexión ficticia interrumpida/.test(message)));
    assert.ok(f.notices.every(message => !/aprobado y guardado/i.test(message)));
    if (edit) {
      assert.equal(f.c._pptoEditandoFbKey,'budget-ficticio');
      assert.equal(f.c._pptoEditorBase.fbKey,'budget-ficticio');
      assert.equal(f.original.aprobadoPor,'Aprobador anterior');
    }
  });
}

test('descuento inválido no se guarda ni se aprueba aunque el usuario sea admin', async () => {
  const f = fixture({discount:101});
  await f.save();
  assert.equal(f.writes.length,0);
  assert.equal(f.lifecycle.complete,0);
  assert.equal(f.lifecycle.closed,0);
  assert.ok(f.notices.some(message => /entre 0% y 100%/.test(message)));
});
