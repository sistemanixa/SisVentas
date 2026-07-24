const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function cargarContexto({ ventas = [], ordenes = [], productos = {}, clientes = [], empleados = {} } = {}) {
  const contexto = {
    ventasList: ventas,
    otData: ordenes,
    prodData: productos,
    clientesData: clientes,
    empData: empleados,
    console: { error() {} }
  };
  contexto.window = contexto;
  vm.createContext(contexto);

  const inicioVentas = appSource.indexOf('function _svTxtClave(');
  const finVentas = appSource.indexOf('function resolverIdClienteVenta(', inicioVentas);
  assert.ok(inicioVentas >= 0 && finVentas > inicioVentas, 'No se encontraron los resolutores de venta');
  vm.runInContext(appSource.slice(inicioVentas, finVentas), contexto);

  const inicioOT = appSource.indexOf('function buscarOTPorRef(');
  const finOT = appSource.indexOf('function verOT(', inicioOT);
  assert.ok(inicioOT >= 0 && finOT > inicioOT, 'No se encontró buscarOTPorRef');
  vm.runInContext(appSource.slice(inicioOT, finOT), contexto);

  const inicioFechaOT = appSource.indexOf('function otFechaISO(');
  const finFechaOT = appSource.indexOf('function otEstadoParaMostrar(', inicioFechaOT);
  assert.ok(inicioFechaOT >= 0 && finFechaOT > inicioFechaOT);
  vm.runInContext(appSource.slice(inicioFechaOT, finFechaOT), contexto);

  const inicioProducto = appSource.indexOf('function normalizarCodigoProducto(');
  const finProducto = appSource.indexOf('function obtenerCostoUnitarioVenta(', inicioProducto);
  assert.ok(inicioProducto >= 0 && finProducto > inicioProducto, 'No se encontró el resolutor de producto');
  vm.runInContext(appSource.slice(inicioProducto, finProducto), contexto);
  return contexto;
}

test('una clave Firebase distingue ventas con el mismo número comercial', () => {
  const ventas = [
    { fbKey: '-venta-esteban', id: '#V-0031', cliente: 'ESTEBAN' },
    { fbKey: '-venta-sandra', id: '#V-0031', cliente: 'SANDRA' }
  ];
  const ctx = cargarContexto({ ventas });

  assert.equal(ctx._svResolverVentaRegistro('-venta-esteban').cliente, 'ESTEBAN');
  assert.equal(ctx._svResolverVentaRegistro('-venta-sandra').cliente, 'SANDRA');
  assert.equal(ctx._svResolverVentaRegistro('#V-0031'), null);
});

test('un vínculo comercial ambiguo no atribuye pagos ni OT a ninguna venta', () => {
  const ventas = [
    { fbKey: '-venta-a', id: '#V-090', cliente: 'A' },
    { fbKey: '-venta-b', id: '#V-090', cliente: 'B' }
  ];
  const ctx = cargarContexto({ ventas });
  const pagoLegacy = { ventaId: '#V-090', monto: 100 };

  assert.equal(ctx._svRegistroPerteneceVenta(pagoLegacy, ventas[0]), false);
  assert.equal(ctx._svRegistroPerteneceVenta(pagoLegacy, ventas[1]), false);
  assert.equal(ctx._svRegistroPerteneceVenta({ ventaFbKey: '-venta-b' }, ventas[1]), true);
});

test('una clave técnica inválida no cae silenciosamente al número visible', () => {
  const ventas = [{ fbKey: '-venta-real', id: '#V-101' }];
  const ctx = cargarContexto({ ventas });

  assert.equal(
    ctx._svResolverVentaRegistro({ ventaFbKey: '-clave-inexistente', ventaId: '#V-101' }),
    null
  );
});

test('el alias numérico histórico se conserva únicamente si es único', () => {
  const ctx = cargarContexto({
    ventas: [{ fbKey: '-venta-unica', id: '#V-000777', idOriginal: 'V-777' }]
  });

  assert.equal(ctx._svResolverVentaRegistro('777').fbKey, '-venta-unica');
});

test('las OT duplicadas sólo se abren mediante su fbKey', () => {
  const ordenes = [
    { fbKey: '-ot-a', id: 'OT-054', cliente: 'A' },
    { fbKey: '-ot-b', id: 'OT-054', cliente: 'B' }
  ];
  const ctx = cargarContexto({ ordenes });

  assert.equal(ctx.buscarOTPorRef('-ot-b').cliente, 'B');
  assert.equal(ctx.buscarOTPorRef('OT-054'), null);
});

test('un producto duplicado por código no se resuelve por posición', () => {
  const productos = {
    a: { fbKey: 'a', codigo: 'P-10', nombre: 'A' },
    b: { fbKey: 'b', codigo: 'P-10', nombre: 'B' }
  };
  const ctx = cargarContexto({ productos });

  assert.equal(ctx.obtenerProductoPorCodigoVenta('P-10', {}), null);
  assert.equal(ctx.obtenerProductoPorCodigoVenta('', { productoFbKey: 'b' }).nombre, 'B');
});

test('los clientes duplicados sólo se resuelven por su clave Firebase', () => {
  const clientes = [
    { fbKey: '-cliente-a', id: '31', nombre: 'CLIENTE A' },
    { fbKey: '-cliente-b', id: '31', nombre: 'CLIENTE B' }
  ];
  const ctx = cargarContexto({ clientes });

  assert.equal(ctx.buscarClientePorRef('-cliente-b').nombre, 'CLIENTE B');
  assert.equal(ctx.buscarClientePorRef('31'), null);
});

test('una clave técnica inválida de cliente no cae al identificador comercial', () => {
  const ctx = cargarContexto({
    clientes: [{ fbKey: '-cliente-real', id: '31', nombre: 'CLIENTE' }]
  });

  assert.equal(
    ctx._svResolverClienteRegistro({ clienteFbKey: '-inexistente', clienteId: '31' }, false),
    null
  );
});

test('un legajo duplicado no selecciona al primer empleado', () => {
  const empleados = {
    a: { fbKey: 'a', legajo: '7', nombre: 'EMPLEADO A' },
    b: { fbKey: 'b', legajo: '7', nombre: 'EMPLEADO B' }
  };
  const ctx = cargarContexto({ empleados });

  assert.equal(ctx.buscarEmpleadoPorRef('b').nombre, 'EMPLEADO B');
  assert.equal(ctx.buscarEmpleadoPorRef('7'), null);
});

test('un nombre de empleado duplicado tampoco se resuelve por posición', () => {
  const empleados = {
    a: { fbKey: 'a', nombre: 'MISMO NOMBRE' },
    b: { fbKey: 'b', nombre: 'MISMO NOMBRE' }
  };
  const ctx = cargarContexto({ empleados });

  assert.equal(ctx.buscarEmpleadoPorNombreUnico('MISMO NOMBRE'), null);
});

test('la tarjeta Para hoy y la tabla usan la misma lista y normalizacion de fecha', () => {
  const ordenes = [
    { fbKey: '-ot-a', id: 'OT-049', fecha: '24/07/2026' },
    { fbKey: '-ot-a', id: 'OT-049', fecha: '24/07/2026' },
    { fbKey: '-ot-b', id: 'OT-054', fecha: '2026-07-24' }
  ];
  const ctx = cargarContexto({ ordenes });
  const canonicas = ctx.otListaCanonica();

  assert.equal(canonicas.length, 2);
  assert.equal(canonicas.filter((ot) => ctx.otCoincidePeriodo(ot, 'hoy', '2026-07-24')).length, 2);
});
