const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const app = require('./helpers/active-app').readActiveApp().source;
const source = app.slice(app.indexOf('function chatEnviar()'),app.indexOf('function chatAbrirDirectos('));
for (const role of ['admin','administrativo','tecnico']) {
  test('comando limpiar restringido: '+role, () => {
    let clean = 0, sent = 0;
    const input = {value:'Limpiar conversación',style:{}};
    const context = {currentRole:role,currentUser:'Prueba',_chatCanal:'general',_chatReplyMsg:null,
      document:{getElementById:()=>input},window:{fbDB:{},fbRef:()=>({}),fbPush:()=>{sent++;return Promise.resolve();}},
      chatInputCambio:()=>{},chatAdminLimpiar:()=>{clean++;},notify:()=>{}};
    vm.createContext(context); vm.runInContext(source,context); context.chatEnviar();
    assert.equal(clean,role === 'admin' ? 1 : 0);
    assert.equal(sent,role === 'admin' ? 0 : 1);
  });
}
