const {test}=require('node:test'),assert=require('node:assert/strict');
const {ofertaNissei}=require('../nissei');
const {recursoVerificacionNissei}=require('../nissei');
const url='https://nissei.com/py/hidrolavadora-karcher-k-4-py-1800-w-amarillo-negro';
const datos=()=>({url,titulo:'Hidrolavadora Kärcher K4 PY',sku:'FPS-K4*PY',moneda:'PYG',precioMeta:'2562999.725001',precios:[{texto:'Gs. \u00a02.563.000',importe:'2562999.725001'}],stock:'En stock'});
test('lee PYG con el redondeo visible y conserva identidad y disponibilidad',()=>{const r=ofertaNissei(datos(),url);assert.equal(r.precioOriginal,2563000);assert.equal(r.moneda,'PYG');assert.equal(r.codigoProveedor,'FPS-K4*PY');assert.equal(r.requiereConversion,true);assert.equal(r.disponibilidadProveedor,'disponible');});
test('verifica los otros dos importes observados y el estado sin stock',()=>{for(const [texto,importe,precio] of [['Gs. 256.385','256384.612001',256385],['Gs. 1.153.000','1153000',1153000]]){const d=datos();Object.assign(d,{precioMeta:importe,precios:[{texto,importe}],stock:'Fuera de stock'});const r=ofertaNissei(d,url);assert.equal(r.precioOriginal,precio);assert.equal(r.disponibilidadProveedor,'sin_stock');}});
test('rechaza otra ficha, monedas, ofertas ambiguas y precios que no coinciden',()=>{for(const cambiar of [d=>d.url='https://otro.example/py/hidrolavadora-karcher-k-4-py-1800-w-amarillo-negro',d=>d.url='https://nissei.com/py/otro-producto',d=>d.moneda='USD',d=>d.sku='',d=>d.precios.push(d.precios[0]),d=>d.precios[0].texto='Gs. 123.000',d=>d.precioMeta=null,d=>d.precios[0].texto='12 cuotas de Gs. 213.583']){const d=datos();cambiar(d);assert.throws(()=>ofertaNissei(d,url));}});
test('permite solo recursos públicos del verificador, sin abrir navegación ni credenciales a terceros',()=>{
 const script='https://challenges.cloudflare.com/turnstile/v0/api.js';
 assert.equal(recursoVerificacionNissei(script,'GET','script',false),true);
 assert.equal(recursoVerificacionNissei('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/iframe','GET','document',false),true);
 assert.equal(recursoVerificacionNissei('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/flow','POST','xhr',false,'https://challenges.cloudflare.com'),true);
 assert.equal(recursoVerificacionNissei('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/flow','POST','xhr',false,'https://nissei.com'),false);
 assert.equal(recursoVerificacionNissei('https://brunhild.challenges.cloudflare.com/cdn-cgi/challenge-platform/data','GET','fetch',false,'https://challenges.cloudflare.com'),true);
 assert.equal(recursoVerificacionNissei('https://brunhild.challenges.cloudflare.com/cdn-cgi/challenge-platform/data','POST','fetch',false,'https://nissei.com'),false);
 for(const args of [[script,'GET','document',true],[script,'POST','xhr',false],['https://challenges.cloudflare.com.evil.test/turnstile/v0/api.js','GET','script',false],['https://user:secret@challenges.cloudflare.com/turnstile/v0/api.js','GET','script',false],['https://challenges.cloudflare.com/private','GET','fetch',false]])assert.equal(recursoVerificacionNissei(...args),false);
});
