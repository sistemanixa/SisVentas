const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { extraerFichaPagina } = require('../ficha-producto');

// DOM real, sin consultar proveedores ni ejecutar scripts externos.
// PLAYWRIGHT_CHANNEL=chrome permite usar Chrome instalado en Windows.
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
});
after(async () => { if (browser) await browser.close(); });

async function leer(url, html) {
  const page = await browser.newPage();
  try {
    await page.route('**/*', route => route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
    await page.goto(url);
    return await extraerFichaPagina(page);
  } finally { await page.close(); }
}

const urlFlytec = 'https://www.flytec.com.py/produto/ezviz-aspirador-de-p-210w-26v-240v-umido-seco-sem-fio-rh2/8604';
const galeriaFlytec = '<header><img src="/logo.png"></header>' +
  '<div class="imagem-principal-container"><img src="/produtos/8604.JPG?v=1700493384" alt="TÍTULO DO PRODUTO" class="imagem-principal" id="imagem-principal"></div>' +
  '<section class="product-info"><h1>EZVIZ ASPIRADOR RH2</h1></section>' +
  '<aside><img src="/produtos/otro-producto.jpg"></aside>';

test('Flytec importa su foto principal sin og:image, aunque esté fuera de la información del producto', async () => {
  const ficha = await leer(urlFlytec, galeriaFlytec);
  assert.equal(ficha.nombre, 'EZVIZ ASPIRADOR RH2');
  assert.equal(ficha.imagenUrl, 'https://www.flytec.com.py/produtos/8604.JPG?v=1700493384');
  assert.ok(!ficha.faltantes.includes('imagenUrl'));
});

test('Flytec sin foto principal no importa el logo ni imágenes de productos relacionados', async () => {
  const ficha = await leer(urlFlytec, '<h1>EZVIZ ASPIRADOR RH2</h1><img src="/logo.png"><aside><img src="/produtos/otro.jpg"></aside>');
  assert.equal(ficha.imagenUrl, '');
  assert.ok(ficha.faltantes.includes('imagenUrl'));
});

test('el selector de Flytec se limita a sus fichas y a su dominio', async () => {
  for (const url of ['https://www.flytec.com.py/', 'https://flytec.com.py.ejemplo.com/produto/aspirador/8604']) {
    assert.equal((await leer(url, galeriaFlytec)).imagenUrl, '');
  }
});

test('otros proveedores conservan la foto estructurada del producto consultado', async () => {
  const url = 'https://www.biosegur.com.ar/producto--det--P2822';
  const ficha = await leer(url, '<h1>Cerradura F-102T</h1><script type="application/ld+json">' + JSON.stringify({
    '@type': 'Product', name: 'Cerradura F-102T', url, image: '/images/P2822.jpg'
  }) + '</script><img id="imagem-principal" src="/imagen-ajena.jpg">');
  assert.equal(ficha.imagenUrl, 'https://www.biosegur.com.ar/images/P2822.jpg');
});
