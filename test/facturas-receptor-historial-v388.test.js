const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function funcion(nombre) {
  const inicio = app.indexOf(`function ${nombre}(`);
  assert.notEqual(inicio, -1, `falta ${nombre}`);
  let profundidad = 0, abrio = false;
  for (let i = inicio; i < app.length; i++) {
    if (app[i] === '{') { profundidad++; abrio = true; }
    if (app[i] === '}') {
      profundidad--;
      if (abrio && profundidad === 0) return app.slice(inicio, i + 1);
    }
  }
  throw new Error(`función incompleta: ${nombre}`);
}

function contexto(ventas) {
  const ctx = {
    ventasList: ventas,
    fvConIvaDiscriminado: tipo => ['1', '2', '3', '51', '81', '201'].includes(String(tipo)),
    fvDatosFacturaVenta: venta => venta.datosFactura || {},
    resolverClienteDeVenta: venta => venta.clienteRegistro || null,
    normalizarIdentidadCliente: valor => String(valor || '').trim().toLowerCase().replace(/\s+/g, ' ')
  };
  vm.createContext(ctx);
  vm.runInContext([
    funcion('fvTextoReceptorValido'),
    funcion('fvVentaDelComprobante'),
    funcion('fvIdentidadReceptor')
  ].join('\n'), ctx);
  return ctx;
}

test('Factura B con CUIT 0 recupera el nombre desde la venta por CAE', () => {
  const ctx = contexto([{ fbKey:'venta-1', cliente:'NURIA MARTINEZ', factura:{ cae:'86349160167382' } }]);
  const identidad = ctx.fvIdentidadReceptor({ fbKey:'comp-1', tipo:'6', cuitReceptor:'0', nombre:'0', cae:'86349160167382' });
  assert.equal(identidad.nombre, 'NURIA MARTINEZ');
  assert.equal(identidad.cuit, '');
  assert.equal(identidad.clave, 'CF_nuria martinez');
});

test('Facturas B de clientes distintos no vuelven a agruparse bajo CUIT 0', () => {
  const ctx = contexto([
    { cliente:'NURIA MARTINEZ', factura:{ cae:'1' } },
    { cliente:'MAURO BECHIR', factura:{ cae:'2' } }
  ]);
  const a = ctx.fvIdentidadReceptor({ tipo:'6', cuitReceptor:'0', nombre:'0', cae:'1' });
  const b = ctx.fvIdentidadReceptor({ tipo:'6', cuitReceptor:'0', nombre:'0', cae:'2' });
  assert.notEqual(a.clave, b.clave);
});

test('Factura A prioriza la razón social fiscal sobre el nombre comercial', () => {
  const ctx = contexto([{ cliente:'Nombre común', clienteRazonSocial:'EMPRESA FISCAL SA', factura:{ cae:'3' } }]);
  const identidad = ctx.fvIdentidadReceptor({ tipo:'1', cuitReceptor:'30712345678', nombre:'RAZON SOCIAL ARCA SA', cae:'3' });
  assert.equal(identidad.nombre, 'RAZON SOCIAL ARCA SA');
  assert.equal(identidad.cuit, '30712345678');
  assert.equal(identidad.clave, 'CUIT_30712345678');
});

