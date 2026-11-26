'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readActiveApp}=require('./helpers/active-app');
const {_hsexValorHoraParaMes:servidor}=require('../cotizador/labor-calculations');

test('horas extra usan el mes trabajado y el aumento toma vigencia el mes siguiente en Buenos Aires',()=>{
 const {source}=readActiveApp();
 const interfaz=vm.runInNewContext('('+source.slice(source.indexOf('function _hsexValorHoraParaMes('),source.indexOf('function _cargoValorHoraParaMes(')).trim()+')');
 const cambio=(timestamp,anterior,nuevo)=>({campo:'valorHoraExtra',ts:Date.parse(timestamp),anterior,nuevo});
 const cargo={valorHoraExtra:9000,historialCambios:{
   enero:cambio('2026-12-15T13:00:00Z',8500,9000),
   diciembre:cambio('2026-12-01T02:00:00Z',7500,8500)
 }};
 for(const tarifa of [interfaz,servidor]){
   assert.equal(tarifa(cargo,'2026-11'),7500);
   assert.equal(tarifa(cargo,'2026-12'),8500);
   assert.equal(tarifa(cargo,'2027-01'),9000);
   assert.equal(tarifa({valorHoraExtra:8900},'2026-10'),8900);
 }
});
