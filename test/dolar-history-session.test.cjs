const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/modules/dolar-historico.js', 'utf8');
const snapshot = amount => ({val: () => ({'2026-10-19': {'01': {ts: amount, oficial: amount}}})});
const flush = async () => {for (let i = 0; i < 16; i++) await Promise.resolve();};
function fixture() {
  const listeners = {}, timers = new Map(), reads = [], writes = [], paints = [], notices = [];
  let nextTimer = 0, visible = true;
  const waits = new Set(), state = {textContent: ''}, selector={value:'period'}, page={id:'page-configuracion'},card={getClientRects:()=>visible?[{}]:[],setAttribute(){}};
  const document = {
    body: {classList: {contains: () => false}},
    querySelector:()=>page,
    getElementById: id => id === 'dh-estado' ? state : id==='dh-history-scope'?selector:id==='cfg-dolar-historico-card'?card:null,
    addEventListener(name, callback) {(listeners[name] ||= []).push(callback);}
  };
  const window = {
    currentUserUid: 'user-A', currentRole: 'admin', fbAuth: {currentUser: {uid: 'user-A'}}, fbDB: {},location:{hash:'#/configuracion'},
    SVDollarHistoryScope:require('../js/core/dollar-history-scope.v1'),permisoModulo:()=>true,
    fbQuery:(...query)=>query,fbOrderByKey:()=>({key:true}),fbStartAt:start=>({start}),fbEndAt:end=>({end}),
    fbRef: (_, path) => path,
    fbGet(path) {return new Promise((resolve, reject) => reads.push({path, resolve, reject}));},
    fbUpdate(path, value) {writes.push({path, value}); return Promise.resolve();},
    SisVentasDolarMensual: {update(rows) {paints.push(rows);},getSelection:()=>({anchor:'2026-10-24',mode:'month'}),sourceState(){},bindSource(){}},
    SVForegroundSession: {
      isVisible: () => visible,
      waitVisible({signal} = {}) {
        if (signal?.aborted) return Promise.reject(Object.assign(Error('Cancelado'), {name: 'AbortError'}));
        if (visible) return Promise.resolve();
        return new Promise((resolve, reject) => {
          const waiter = {resolve() {signal?.removeEventListener('abort', abort); waits.delete(waiter); resolve();}};
          const abort = () => {waits.delete(waiter); reject(Object.assign(Error('Cancelado'), {name: 'AbortError'}));};
          signal?.addEventListener('abort', abort, {once: true}); waits.add(waiter);
        });
      }
    }
  };
  const context = {window, document, console, Date, AbortController,isAuthenticated:true, notify: message => notices.push(message),
    setTimeout(callback) {const id = ++nextTimer; timers.set(id, callback); return id;}, clearTimeout(id) {timers.delete(id);}, clearInterval() {}};
  vm.runInNewContext(source, context);
  return {window, reads, writes, paints, notices, timers, waits, state,
    emit(name) {for (const callback of listeners[name] || []) callback({detail: {}});},
    runTimers() {const current = [...timers.values()]; timers.clear(); current.forEach(callback => callback());},
    visible(value) {visible = value; if (visible) for (const waiter of [...waits]) waiter.resolve();}
  };
}

test('lecturas concurrentes comparten un solo GET y conservan el histórico completo', async () => {
  const f = fixture(), first = f.window.dolarHistoricoCargar(), second = f.window.dolarHistoricoCargar();
  await flush(); assert.equal(f.reads.length, 1);
  f.reads[0].resolve(snapshot(100)); await Promise.all([first, second]);
  assert.equal(f.paints.length, 1); assert.equal(f.paints[0][0].oficial, 100);
});

test('salir cancela el inicio demorado sin iniciar consultas después', async () => {
  const f = fixture(); f.emit('sisventas:session-ready'); f.emit('sisventas:session-ended'); f.runTimers();
  await flush(); assert.equal(f.reads.length, 0); assert.equal(f.timers.size, 0);
});

test('oculta no inicia consultas ni programa una consulta al volver a primer plano', async () => {
  const f = fixture(); f.visible(false); const task = f.window.dolarHistoricoCargar();
  await flush(); assert.equal(f.reads.length, 0); assert.equal(f.waits.size, 0);
  f.emit('sisventas:session-ended'); await task; f.visible(true); await flush();
  assert.equal(f.reads.length, 0); assert.equal(f.waits.size, 0);
});

test('la respuesta de otra sesión no modifica gráfico, estado ni avisos', async () => {
  const f = fixture(), task = f.window.dolarHistoricoCargar(); await flush();
  f.emit('sisventas:session-ended'); f.window.fbAuth.currentUser = {uid: 'user-B'}; f.window.currentUserUid = 'user-B';
  f.reads[0].resolve(snapshot(123)); await task;
  assert.equal(f.paints.length, 0); assert.equal(f.notices.length, 0); assert.equal(f.state.textContent, '');
});

test('errores tardíos de rol anterior se descartan y el nuevo rol puede consultar', async () => {
  const f = fixture(), old = f.window.dolarHistoricoCargar(); await flush();
  f.window.currentRole = 'vendedor'; f.emit('sisventas:role-changed');
  f.reads[0].reject(Error('Error anterior')); await old;
  assert.equal(f.notices.length, 0);
  const current = f.window.dolarHistoricoCargar(); await flush();
  assert.equal(f.reads.length, 2); f.reads[1].resolve(snapshot(200)); await current; assert.equal(f.paints.length, 1);
});

test('finalmente antiguo no libera la consulta de nuevo ingreso del mismo UID', async () => {
  const f = fixture(), old = f.window.dolarHistoricoCargar(); await flush();
  f.emit('sisventas:session-ended'); f.emit('sisventas:session-ready');
  const current = f.window.dolarHistoricoCargar(); await flush(); assert.equal(f.reads.length, 2);
  f.reads[0].resolve(snapshot(100)); await old;
  const joined = f.window.dolarHistoricoCargar(); await flush(); assert.equal(f.reads.length, 2);
  f.reads[1].resolve(snapshot(200)); await Promise.all([current, joined]);
  assert.equal(f.paints.length, 1); assert.equal(f.paints[0][0].oficial, 200);
});

test('guardar durante GET conserva la escritura y solicita sólo un refresco posterior', async () => {
  const f = fixture(), old = f.window.dolarHistoricoCargar(); await flush();
  await f.window.SisVentasDolarHistorico.guardarPunto({oficial: 250}, 'manual');
  await flush(); assert.equal(f.writes.length, 1); assert.equal(f.reads.length, 1);
  f.reads[0].resolve(snapshot(100)); await old; f.runTimers(); await flush();
  assert.equal(f.reads.length, 2); f.reads[1].resolve(snapshot(250)); await flush();
  assert.equal(f.paints.at(-1)[0].oficial, 250);
});

test('fallo vigente avisa una vez y permite reintento explícito', async () => {
  const f = fixture(), first = f.window.dolarHistoricoCargar(), joined = f.window.dolarHistoricoCargar(); await flush();
  assert.equal(f.reads.length, 1); f.reads[0].reject(Error('Sin red')); await Promise.all([first, joined]);
  assert.equal(f.notices.length, 1);
  const retry = f.window.dolarHistoricoCargar(); await flush(); assert.equal(f.reads.length, 2);
  f.reads[1].resolve(snapshot(300)); await retry; assert.equal(f.paints.length, 1);
});

test('la respuesta recibida oculta se retira y volver visible no inicia otro GET', async () => {
  const f = fixture(), task = f.window.dolarHistoricoCargar(); await flush();
  f.visible(false); f.reads[0].resolve(snapshot(200)); await flush(); assert.equal(f.paints.length, 0);
  f.visible(true); await task; assert.equal(f.paints.length, 0); assert.equal(f.reads.length, 1);
});

test('logout conserva el guardado iniciado y suprime avisos y refrescos de la sesión vieja', async () => {
  const f = fixture(); let completeWrite;
  f.window.TIPO_CAMBIO_CONFIG = {oficial: 250};
  f.window.fbUpdate = (path, value) => {f.writes.push({path, value}); return new Promise(resolve => {completeWrite = resolve;});};
  const save = f.window.dolarHistoricoGuardarAhora(); await flush();
  assert.equal(f.writes.length, 1);
  f.emit('sisventas:session-ended'); completeWrite(); await save; await flush();
  assert.equal(f.writes.length, 1); assert.equal(f.reads.length, 0); assert.equal(f.notices.length, 0);
});

test('cambiar revisión de permisos invalida respuestas y UID distinto de Auth impide nuevos GET', async () => {
  const f = fixture(); f.window.PERMISOS_ROLES = {admin: {indiceRevision: 1}};
  const old = f.window.dolarHistoricoCargar(); await flush();
  f.window.PERMISOS_ROLES.admin.indiceRevision = 2;
  f.reads[0].resolve(snapshot(123)); await old;
  assert.equal(f.paints.length, 0); assert.equal(f.notices.length, 0);
  f.window.currentUserUid = 'user-B';
  await f.window.dolarHistoricoCargar(); assert.equal(f.reads.length, 1);
});
