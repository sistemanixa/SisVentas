'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('formulario real integrado conserva intento incierto y no cierra otro formulario',async()=>{
 const stored=new Map();let sequence=0,lost=true,closed=0;
 const buttons=[{disabled:false}],modal={_svFormToken:{},classList:{contains:()=>true},querySelectorAll:()=>buttons};
 const context={Date,Promise,notify(){},currentUser:'Ficticio',currentUserUid:'fiction',currentRole:'admin',fbDB:{},fbAuth:{currentUser:{uid:'fiction'}},permisoModulo:()=>true,document:{getElementById:()=>modal},cerrarModalNuevoGenerico(){closed++;},_modalTipo:'remito',fbRef:(_,path)=>path,fbPush:()=>({key:'key-'+(++sequence)}),fbRunTransaction:async(path,fn)=>{const next=fn(stored.get(path)??null);if(next!==undefined)stored.set(path,next);if(lost){lost=false;throw Error('ACK perdido');}return {snapshot:{val:()=>stored.get(path)}};}};
 context.window=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync('js/core/manual-delivery-writer.v1.js','utf8'),context);
 const app=require('./helpers/active-app').readActiveApp().source;
 const source=app.slice(app.indexOf('var _svEscritorRemitoManual = null;'),app.indexOf('function guardarEvento(datos)'));
 vm.runInContext(source,context);
 assert.equal(await vm.runInContext('guardarRemitoDesdeModal({numero:"R"})',context),false);assert.equal(closed,0);assert.equal(stored.size,1);
 assert.equal(await vm.runInContext('guardarRemitoDesdeModal({numero:"R"})',context),true);assert.equal(closed,1);assert.equal(stored.size,1);
 modal._svFormToken={};const pending=vm.runInContext('guardarRemitoDesdeModal({numero:"R"})',context);modal._svFormToken={};context._modalTipo='cliente';await pending;assert.equal(closed,1);assert.equal(stored.size,2);
});
