const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
function funcion(nombre, siguiente, contexto) {
  vm.runInNewContext(source.slice(source.indexOf('async function '+nombre+'('), source.indexOf('\n'+siguiente, source.indexOf('async function '+nombre+'('))), contexto);
  return contexto[nombre];
}
test('verificación de seguridad detiene la lectura sin repetir con otro agente', async () => {
  let consultas = 0;
  const c = {AbortController,setTimeout,clearTimeout,normalizarUrl:x=>x,fetch:async()=>{
    consultas++; return {ok:true,text:async()=>'<h1>Comprobemos que eres humano</h1>'};
  }};
  const consultar = funcion('extraerProductoMercadoLibreSeo', 'async function extraerProductoMercadoLibre(', c);
  await assert.rejects(consultar('https://articulo.mercadolibre.com.ar/MLA-1579043686-_JM'), {codigo:'ML_VERIFICACION_SEGURIDAD'});
  assert.equal(consultas, 1);
});
test('cotización no abre el navegador tras un bloqueo de seguridad confirmado', async () => {
  let navegadores = 0;
  const c = {normalizarUrl:x=>x,esUrlMercadoLibre:()=>true,
    extraerProductoMercadoLibreApi:async()=>{throw new Error('403');},
    extraerProductoMercadoLibreSeo:async()=>{const e=new Error('Verificación de seguridad');e.codigo='ML_VERIFICACION_SEGURIDAD';throw e;},
    chromium:{launch:async()=>{navegadores++;throw new Error('No debe abrirse');}}
  };
  const consultar = funcion('cotizarMercadoLibre', 'function parsePrecioArs(', c);
  await assert.rejects(consultar({proveedor:{nombre:'MERCADO LIBRE'},url:'https://articulo.mercadolibre.com.ar/MLA-1579043686-_JM'}), {codigo:'ML_VERIFICACION_SEGURIDAD',message:'Verificación de seguridad'});
  assert.equal(navegadores, 0);
});
