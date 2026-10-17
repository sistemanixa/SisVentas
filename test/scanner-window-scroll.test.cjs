'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(overflow='auto'){
 const events={},origin={isConnected:true,focus(){this.focused=true;}};
 const nodes=new Map();const el=key=>{if(!nodes.has(key))nodes.set(key,{style:{},setAttribute(){},getTracks:()=>[],pause(){},querySelector:el,querySelectorAll:()=>[],addEventListener:(type,fn)=>events[type]=fn,showModal(){this.open=true;},close(){this.open=false;},remove(){this.isConnected=false;}});return nodes.get(key);};
 const document={body:{style:{overflow},append(){}},activeElement:origin,currentScript:{src:'http://localhost/js/modules/serial-camera-scanner.js'},createElement:()=>el('dialog'),addEventListener:(type,fn)=>events[type]=fn};
 const root={document,isSecureContext:true,navigator:{mediaDevices:{getUserMedia:async()=>{throw Object.assign(Error('Simulado'),{name:'NotAllowedError'});},enumerateDevices:async()=>[]}},setTimeout,clearTimeout,addEventListener:(type,fn)=>events[type]=fn};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/modules/serial-camera-scanner'),'utf8'),{window:root,document,URL,console});
 return {ui:root.SVSerialCamera,document,events,origin};
}
test('lector bloquea el scroll al abrir y restaura el estado previo al cerrar',()=>{const f=fixture();f.ui.open({onRead(){}});assert.equal(f.document.body.style.overflow,'hidden');f.ui.close();assert.equal(f.document.body.style.overflow,'auto');f.ui.close();assert.equal(f.document.body.style.overflow,'auto');});
test('lector anidado conserva el bloqueo de la ventana que lo abrió',()=>{const f=fixture('hidden');f.ui.open({onRead(){}});f.ui.close();assert.equal(f.document.body.style.overflow,'hidden');});
test('salir de módulo cierra el lector y no enfoca un control eliminado',()=>{const f=fixture();f.ui.open({onRead(){}});f.origin.isConnected=false;f.events['sisventas:page-changed']();assert.equal(f.document.body.style.overflow,'auto');assert.equal(f.origin.focused,undefined);});
