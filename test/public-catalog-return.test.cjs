'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=require('./helpers/active-app').readActiveApp().source;
const start=source.indexOf('function _svPaginaDesdeRuta('),end=source.indexOf('\n}',start)+2;
function route(hash){const context={window:{location:{hash}},document:{getElementById:id=>['page-dashboard','page-configuracion'].includes(id)?{}:null}};vm.runInNewContext(source.slice(start,end),context);return context._svPaginaDesdeRuta();}
test('regresar del catálogo a Ofertas reconoce el portal sin una página estática',()=>assert.equal(route('#/distribuidora'),'distribuidora'));
test('se conservan rutas de módulos existentes y se rechazan rutas desconocidas',()=>{assert.equal(route('#/configuracion'),'configuracion');assert.equal(route('#/dashboard'),'dashboard');for(const hash of ['','#/inexistente','#/https%3A%2F%2Fejemplo.com'])assert.equal(route(hash),'');});
