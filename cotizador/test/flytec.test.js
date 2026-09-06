const test=require('node:test');
const assert=require('node:assert/strict');
const {precioFlytec,direccionPublica}=require('../proveedor-automatico');
test('Flytec interpreta USD con centavos y rechaza otros importes o múltiples precios',()=>{
 assert.equal(precioFlytec('U$ 67,00'),67);
 assert.equal(precioFlytec('U$ 1.234,50'),1234.5);
 for(const texto of ['$ 67,00','U$ 0,00','U$ 67,00 U$ 80,00','67']) assert.throws(()=>precioFlytec(texto));
});
test('DNS permite IPv6 global sin habilitar redes privadas ni direcciones mapeadas',()=>{
 assert.equal(direccionPublica('2606:4700::1111'),true);
 for(const ip of ['::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::','127.0.0.1','192.168.1.1']) assert.equal(direccionPublica(ip),false,ip);
});
