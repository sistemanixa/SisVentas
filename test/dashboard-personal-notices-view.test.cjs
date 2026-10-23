const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/modules/dashboard-personal-notices.js'), 'utf8');
const view = require('../js/modules/dashboard-personal-notices.js');

class Element {
  constructor(document, tag) {
    this.ownerDocument = document; this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map();
    this.listeners = new Map(); this.parentNode = null; this.hidden = false; this.disabled = false; this._text = ''; this.className = '';
    this.classList = { add: name => { if (!this.className.split(' ').includes(name)) this.className = (this.className + ' ' + name).trim(); },
      remove: name => { this.className = this.className.split(' ').filter(value => value !== name).join(' '); } };
  }
  set innerHTML(_) { assert.fail('La vista debe crear texto y nodos, sin interpretar HTML'); }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } }
  replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; this._text = ''; this.append(...children); }
  addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(listener); }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  click() { if (!this.disabled) for (const listener of [...(this.listeners.get('click') || [])]) listener({ currentTarget:this }); }
  focus(options) { this.ownerDocument.activeElement = this; this.focusOptions = options; }
}
function fixture() {
  const document = { activeElement:null, createElement(tag) { return new Element(this, tag); } };
  const container = document.createElement('div'); container.id = 'dash-personal-notices';
  return { document, container };
}
function all(node, predicate) { return node.children.flatMap(child => [ ...(predicate(child) ? [child] : []), ...all(child, predicate) ]); }
const hasClass = name => node => node.className.split(' ').includes(name);
const nodes = (container, name) => all(container, hasClass(name));
const buttons = container => all(container, node => node.tagName === 'BUTTON');
const item = (extra = {}) => ({ id:'bonus-1', type:'bonificacion', amount:5000, paidAmount:0, remaining:5000, status:'aprobado',
  period:'2026-11', date:'2026-10-22', description:'TAREA DE CARPINTERIA MONTAJE CERRADURA', quantity:5, unitAmount:1000, ...extra });
const ready = items => ({ status:'ready', items, issues:[] });

test('API pura: render y clear no necesitan DOM global ni transporte al instalarse', () => {
  const forbidden = () => assert.fail('La vista no debe consultar, programar ni almacenar');
  const window = {};
  for (const key of ['fetch','XMLHttpRequest','WebSocket','localStorage','sessionStorage','setTimeout','setInterval','document','fbGet','fbOnValue']) Object.defineProperty(window, key, { get:forbidden });
  vm.runInNewContext(source, { window, Intl, WeakMap, Date, Number, Object, String, Array });
  assert.deepEqual(Object.keys(window.SVPersonalNoticesView), ['render','clear']);
  assert.equal(Object.isFrozen(window.SVPersonalNoticesView), true);
  const {container} = fixture();
  window.SVPersonalNoticesView.render(container, ready([item()]), {canOpen:true,onOpen(){}});
  buttons(container)[0].click(); window.SVPersonalNoticesView.render(container, {status:'error'}); window.SVPersonalNoticesView.clear(container);
});
test('rechaza contenedores ausentes sin escribir en el documento', () => {
  assert.equal(view.render(null, ready([])), false); assert.equal(view.clear(null), false); assert.equal(view.render({}, ready([])), false);
});
for (const status of ['loading','error']) test(status + ' comunica estado desconocido sin importes, ceros ni botones', () => {
  const {container} = fixture(); let calls = 0;
  view.render(container, { status, items:[item()] }, { canOpen:true, onOpen(){ calls++; } });
  assert.equal(container.hidden, false); assert.equal(container.getAttribute('aria-busy'), String(status === 'loading'));
  assert.equal(nodes(container, 'personal-notices-card').length, 0); assert.equal(buttons(container).length, 0);
  assert.doesNotMatch(container.textContent, /\$|\b0\b|Sin bonificaciones/); assert.equal(calls, 0);
  assert.equal(all(container, node => node.getAttribute('role') === 'status').length, 1);
});
test('incomplete sin movimientos verificados comunica estado general sin importes, ceros ni acciones', () => {
  const {container} = fixture(); view.render(container, {status:'incomplete',items:[],issues:[{}]}, {canOpen:true,onOpen(){assert.fail();}});
  assert.match(container.textContent, /Información incompleta/); assert.doesNotMatch(container.textContent, /\$|\b0\b|Sin bonificaciones/);
  assert.equal(buttons(container).length, 0); assert.equal(nodes(container, 'personal-notices-card').length, 0);
});
test('incomplete con subconjunto verificado muestra sólo el tipo presente y advierte cobertura parcial', () => {
  const {container} = fixture(); view.render(container, {status:'incomplete',items:[item()],issues:[{message:'detalle privado'}]}, {canOpen:true,onOpen(){}});
  assert.match(container.textContent, /Hay movimientos por confirmar; mostramos sólo los verificados\./);
  assert.equal(nodes(container, 'personal-notices-card').length, 1); assert.equal(nodes(container, 'personal-notices-item').length, 1);
  assert.equal(nodes(container, 'personal-notices-card--comision').length, 0);
  assert.doesNotMatch(container.textContent, /No hay novedades|Sin comisiones recientes|detalle privado/);
  assert.equal(buttons(container).length, 1); assert.equal(container.getAttribute('aria-busy'), 'false');
});
test('un estado inválido queda incompleto y none retira información anterior', () => {
  const {container} = fixture(); view.render(container, {status:'inventado'}); assert.match(container.textContent, /Información incompleta/);
  view.render(container, ready([item()])); view.render(container, {status:'none'});
  assert.equal(container.hidden, true); assert.equal(container.children.length, 0); assert.equal(container.getAttribute('data-personal-notices-state'), 'none');
});
test('vacío confirmado se oculta sin tarjetas, texto, acciones ni total monetario inventado', () => {
  const {container} = fixture(); view.render(container, ready([]), { canOpen:true, onOpen(){ assert.fail('Sin movimiento no hay acción'); } });
  assert.equal(container.hidden, true); assert.equal(container.children.length, 0); assert.equal(container.textContent, '');
  assert.equal(nodes(container, 'personal-notices-card').length, 0); assert.equal(buttons(container).length, 0);
  assert.equal(container.getAttribute('data-personal-notices-state'), 'ready'); assert.equal(container.getAttribute('aria-busy'), 'false');
});
test('cada tipo muestra sólo el primero de la fuente ordenada y cuenta los otros recientes', () => {
  const {container} = fixture(); const data = [1,2,3,4,5].map(id => item({id:'b'+id, description:'B'+id})).concat([1,2,3,4].map(id => item({id:'c'+id,type:'comision',description:'C'+id})));
  view.render(container, ready(data));
  const cards = nodes(container, 'personal-notices-card');
  assert.deepEqual(nodes(cards[0], 'personal-notices-item').map(row => row.getAttribute('data-personal-notice-id')), ['b1']);
  assert.deepEqual(nodes(cards[1], 'personal-notices-item').map(row => row.getAttribute('data-personal-notice-id')), ['c1']);
  assert.match(cards[0].textContent, /4 movimientos recientes más/); assert.match(cards[1].textContent, /3 movimientos recientes más/);
  assert.equal(nodes(cards[0], 'personal-notices-title')[0].textContent, '¡Tenés una nueva bonificación aprobada!');
  assert.equal(nodes(cards[1], 'personal-notices-title')[0].textContent, '¡Tenés una nueva comisión aprobada!');
  assert.equal(nodes(container, 'personal-notices-header').length, 0);
});
test('contador del único movimiento adicional usa singular y no modifica el alcance de los botones', () => {
  const {container} = fixture(); view.render(container, ready([item(),item({id:'second'})]), {canOpen:true,onOpen(){}});
  assert.match(container.textContent, /1 movimiento reciente más/); assert.equal(nodes(container, 'personal-notices-item').length, 1);
  assert.equal(buttons(container)[0].getAttribute('data-personal-notices-open'), 'bonificacion');
});
test('ARS conserva dos decimales y sólo muestra cantidad por valor recibido sin recalcular el importe', () => {
  const {container} = fixture(); const original = item({amount:1234.567,quantity:5,unitAmount:900}); const before = structuredClone(original);
  view.render(container, ready([original])); const text = container.textContent.replace(/\s/g, ' ');
  assert.match(text, /1\.234,57/); assert.match(text, /5 × \$ 900,00 por unidad/); assert.match(text, /ARS/); assert.doesNotMatch(text, /4\.500,00/);
  assert.deepEqual(original, before);
});
test('pendiente no se presenta como monto aprobado, cobrado ni saldo pendiente de pago', () => {
  const {container} = fixture(); view.render(container, ready([item({status:'pendiente',paidAmount:2000,remaining:3000})]));
  assert.match(container.textContent, /Importe informado/); assert.match(container.textContent, /Pendiente de aprobación; el importe todavía no está autorizado/);
  assert.doesNotMatch(container.textContent, /Pendiente de pago:|Pagado:|a cobrar|3\.000,00|2\.000,00/);
});
test('pago manual sin importe confirmado no afirma dinero cobrado ni muestra saldo como cierto', () => {
  const {container} = fixture(); view.render(container, ready([item({status:'pagado',paidAmountUnknown:true,paidAmount:5000,remaining:0})]));
  assert.match(container.textContent, /figura marcada como pagada/); assert.match(container.textContent, /Importe abonado sin confirmar/);
  assert.doesNotMatch(container.textContent, /Pagado:|Pendiente de pago:|Cobraste|Recibiste/);
});
test('pago parcial usa importes provistos y no calcula un neto propio', () => {
  const {container} = fixture(); view.render(container, ready([item({status:'pagado_parcial',paidAmount:1234.56,remaining:3000.12})]));
  const text = container.textContent.replace(/\s/g, ' ');
  assert.match(text, /Pago parcial/); assert.match(text, /Pagado: \$ 1\.234,56/); assert.match(text, /Pendiente de pago: \$ 3\.000,12/);
  assert.doesNotMatch(text, /3\.765,44|Total neto/);
});
test('fecha otorgada y mes de cómputo se muestran separados', () => {
  const {container} = fixture(); view.render(container, ready([item()]));
  assert.match(container.textContent, /Cómputo: noviembre de 2026/); assert.match(container.textContent, /Fecha: 22\/10\/2026/);
});
test('fechas e importes inválidos quedan por confirmar sin rollover ni convertirlos en cero', () => {
  const {container} = fixture(); view.render(container, ready([item({amount:NaN,paidAmount:Infinity,remaining:-1,unitAmount:'100',quantity:5,period:'2026-13',date:'2026-02-31'})]));
  assert.match(container.textContent, /Importe por confirmar/); assert.match(container.textContent, /Mes de cómputo sin confirmar/);
  assert.doesNotMatch(container.textContent, /\$|Fecha:|NaN|Infinity|por unidad/);
});
test('descripciones y claves hostiles son texto sin HTML ejecutable', () => {
  const {container} = fixture(); const description = '<img src=x onerror=alert(1)><script>mal</script>';
  view.render(container, ready([item({id:'" onclick="alert(1)',description})]));
  assert.match(container.textContent, /<img src=x onerror=alert\(1\)>/); assert.equal(all(container, node => ['IMG','SCRIPT'].includes(node.tagName)).length, 0);
  assert.equal(nodes(container, 'personal-notices-item')[0].getAttribute('data-personal-notice-id'), '" onclick="alert(1)');
});
test('botones son acciones nativas y devuelven tipo y nodo al callback autorizado', () => {
  const {container} = fixture(); const calls = [];
  view.render(container, ready([item(),item({id:'c1',type:'comision'})]), {canOpen:true,onOpen:(...args)=>calls.push(args)});
  const actions = buttons(container); assert.equal(actions.length, 2);
  assert.deepEqual(actions.map(button => [button.type,button.getAttribute('data-personal-notices-open')]), [['button','bonificacion'],['button','comision']]);
  actions[0].click(); actions[1].click(); assert.deepEqual(calls, [['bonificacion',actions[0]],['comision',actions[1]]]);
});
test('sin permiso o sin callback no crea un control inoperante', () => {
  const {container} = fixture(); view.render(container, ready([item()]), {canOpen:false,onOpen(){assert.fail();}}); assert.equal(buttons(container).length, 0);
  view.render(container, ready([item()]), {canOpen:true}); assert.equal(buttons(container).length, 0);
});
test('clear retira todos los handlers incluso de botones que quedaron referenciados', () => {
  const {container} = fixture(); let calls = 0;
  view.render(container, ready([item()]), {canOpen:true,onOpen(){calls++;}}); const old = buttons(container)[0];
  assert.equal(view.clear(container), true); old.click(); assert.equal(calls, 0); assert.equal(old.listeners.get('click').size, 0);
  assert.equal(container.hidden, true); assert.equal(container.children.length, 0); assert.equal(container.getAttribute('aria-busy'), null);
});
test('render local preserva foco sin scroll y desconecta el botón anterior', () => {
  const {container,document} = fixture(); let oldCalls = 0, newCalls = 0;
  view.render(container, ready([item()]), {canOpen:true,onOpen(){oldCalls++;}}); const old = buttons(container)[0]; old.focus();
  view.render(container, ready([item({remaining:4000})]), {canOpen:true,onOpen(){newCalls++;}}); const current = buttons(container)[0];
  assert.equal(document.activeElement, current); assert.equal(current.focusOptions.preventScroll, true);
  old.click(); current.click(); assert.equal(oldCalls, 0); assert.equal(newCalls, 1);
});
test('limpiar un contenedor no retira las acciones de otro', () => {
  const first = fixture(), second = fixture(); const calls = [];
  view.render(first.container, ready([item()]), {canOpen:true,onOpen(){calls.push('first');}});
  view.render(second.container, ready([item()]), {canOpen:true,onOpen(){calls.push('second');}});
  view.clear(first.container); buttons(second.container)[0].click(); assert.deepEqual(calls, ['second']);
});
test('una transición a error elimina las acciones y una lista inconsistente no expone tipos ajenos', () => {
  const {container} = fixture(); let calls = 0;
  view.render(container, ready([null,item({type:'sueldo'}),item()]), {canOpen:true,onOpen(){calls++;}}); assert.equal(nodes(container, 'personal-notices-item').length, 1);
  const old = buttons(container)[0]; view.render(container, {status:'error'}); old.click(); assert.equal(calls, 0); assert.equal(buttons(container).length, 0);
});
test('issues presenta un aviso general sin volcar detalles técnicos o datos ajenos', () => {
  const {container} = fixture(); view.render(container, {status:'ready',items:[item()],issues:[{employeeId:'otro',message:'token secreto'}]});
  assert.match(container.textContent, /Hay movimientos por revisar/); assert.doesNotMatch(container.textContent, /token secreto|otro/);
});
test('CSS conserva una lista en todos los anchos, botón a derecha en desktop y distribución móvil acotada', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/dashboard-personal-notices.css'), 'utf8');
  assert.match(css, /\.personal-notices\{[^}]*display:flex;[^}]*flex-direction:column;/);
  assert.match(css, /\.personal-notices-card\{[^}]*display:flex;[^}]*align-items:center;/);
  assert.match(css, /\.personal-notices-content\{[^}]*min-width:0;[^}]*flex:1/);
  assert.match(css, /\.personal-notices-open\{[^}]*flex:0 0 auto;[^}]*max-width:100%/);
  assert.match(css, /\.personal-notices\[hidden\]\{display:none\}/);
  assert.match(css, /@media\(max-width:600px\)\{\.personal-notices-card\{[^}]*display:grid;grid-template-columns:30px minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:600px\).*\.personal-notices-open\{[^}]*grid-column:2;justify-self:end;min-height:40px/);
  assert.doesNotMatch(css, /grid-template-columns:repeat\(2|@media\(min-width:768px\)/);
  assert.match(css, /overflow-wrap:anywhere/); assert.match(css, /:focus-visible/); assert.doesNotMatch(css, /@import|url\(|position:fixed|overflow:hidden/);
});

for (const [type, title, icon] of [['bonificacion','¡Tenés una nueva bonificación aprobada!','🎉'],['comision','¡Tenés una nueva comisión aprobada!','🙌']]) {
  test(type + ' reciente muestra únicamente su aviso alentador y el botón autorizado', () => {
    const {container} = fixture(); view.render(container, ready([item({type})]), {canOpen:true,onOpen(){}});
    assert.equal(container.hidden, false); assert.equal(nodes(container, 'personal-notices-card').length, 1);
    assert.equal(nodes(container, 'personal-notices-card--' + type).length, 1);
    assert.deepEqual(nodes(container, 'personal-notices-title').map(node => node.textContent), [title]);
    assert.deepEqual(nodes(container, 'personal-notices-icon').map(node => [node.textContent,node.getAttribute('aria-hidden')]), [[icon,'true']]);
    assert.equal(buttons(container)[0].getAttribute('data-personal-notices-open'), type);
    assert.doesNotMatch(container.textContent, /Sin (bonificaciones|comisiones)|No hay novedades|Últimos 30 días/);
  });
}

test('ready con issues y sin novedades conserva advertencia neutral sin fingir vacío confirmado', () => {
  const {container} = fixture(); view.render(container, {status:'ready',items:[],issues:[{employeeId:'otra-persona',message:'detalle privado'}]}, {canOpen:true,onOpen(){assert.fail();}});
  assert.equal(container.hidden, false); assert.equal(container.getAttribute('aria-busy'), 'false');
  assert.equal(nodes(container, 'personal-notices-card').length, 0); assert.equal(buttons(container).length, 0);
  assert.equal(all(container, node => node.getAttribute('role') === 'status').length, 1);
  assert.match(container.textContent, /Hay movimientos por revisar/); assert.doesNotMatch(container.textContent, /\$|Sin bonificaciones|Sin comisiones|otra-persona|detalle privado/);
});

for (const [type, subject] of [['bonificacion','bonificación'],['comision','comisión']]) {
  for (const [status, unknown, expected] of [
    ['aprobado',false,'¡Tenés una nueva ' + subject + ' aprobada!'],
    ['pendiente',false,'Tenés una ' + subject + ' pendiente de aprobación'],
    ['pagado_parcial',false,'Tu ' + subject + ' tiene un pago parcial'],
    ['pagado',false,'¡Tu ' + subject + ' ya está pagada!'],
    ['pagado',true,'Tu ' + subject + ' figura marcada como pagada']
  ]) test(type + ': el título distingue ' + status + (unknown ? ' manual sin importe confirmado' : ''), () => {
    const paidAmount = unknown ? null : status === 'pagado' ? 5000 : status === 'pagado_parcial' ? 2000 : 0;
    const remaining = unknown ? null : 5000 - paidAmount;
    const {container} = fixture(); view.render(container, ready([item({type,status,paidAmount,remaining,paidAmountUnknown:unknown})]));
    assert.equal(nodes(container, 'personal-notices-title')[0].textContent, expected);
    assert.equal(nodes(container, 'personal-notices-item')[0].getAttribute('data-personal-notice-status'), status);
    if (status === 'pendiente') {
      assert.equal(nodes(container, 'personal-notices-icon')[0].textContent, '⏳');
      assert.doesNotMatch(container.textContent, /nueva .* aprobada|ya está pagada|Cobraste|Recibiste|Pendiente de pago:/);
      assert.match(container.textContent, /el importe todavía no está autorizado/);
    }
    if (unknown) {
      assert.match(container.textContent, /Importe abonado sin confirmar/);
      assert.doesNotMatch(container.textContent, /ya está pagada|Pagado:|Pendiente de pago:|Cobraste|Recibiste/);
    }
  });
}

test('al desaparecer un tipo retira sus handlers y sólo el botón nuevo conserva el destino vigente', () => {
  const {container} = fixture(), calls = [];
  view.render(container, ready([item(),item({id:'c1',type:'comision'})]), {canOpen:true,onOpen:type=>calls.push('anterior:' + type)});
  const old = buttons(container);
  view.render(container, ready([item({id:'c2',type:'comision'})]), {canOpen:true,onOpen:type=>calls.push('actual:' + type)});
  assert.equal(nodes(container, 'personal-notices-card--bonificacion').length, 0); assert.equal(buttons(container).length, 1);
  for (const button of old) { button.click(); assert.equal(button.listeners.get('click').size, 0); }
  assert.deepEqual(calls, []); buttons(container)[0].click(); assert.deepEqual(calls, ['actual:comision']);
});

for (const next of [{status:'loading'},{status:'error'},{status:'incomplete',items:[],issues:[{}]},ready([]),{status:'none'}]) {
  test('una transición de aviso a ' + next.status + (next.status === 'ready' ? ' vacío' : '') + ' retira datos y acciones anteriores', () => {
    const {container} = fixture(); let calls = 0;
    view.render(container, ready([item()]), {canOpen:true,onOpen(){calls++;}}); const old = buttons(container)[0];
    view.render(container, next, {canOpen:true,onOpen(){calls++;}}); old.click();
    assert.equal(calls, 0); assert.equal(old.listeners.get('click').size, 0); assert.equal(buttons(container).length, 0);
    assert.equal(nodes(container, 'personal-notices-item').length, 0); assert.doesNotMatch(container.textContent, /5\.000,00|TAREA DE CARPINTERIA/);
    assert.equal(container.hidden, ['none','ready'].includes(next.status));
  });
}

test('revocar el permiso de apertura retira el handler previamente autorizado sin ocultar el reconocimiento', () => {
  const {container} = fixture(); let calls = 0;
  view.render(container, ready([item()]), {canOpen:true,onOpen(){calls++;}}); const old = buttons(container)[0];
  view.render(container, ready([item()]), {canOpen:false,onOpen(){calls++;}}); old.click();
  assert.equal(calls, 0); assert.equal(old.listeners.get('click').size, 0); assert.equal(buttons(container).length, 0);
  assert.equal(nodes(container, 'personal-notices-card').length, 1); assert.equal(container.hidden, false);
});

test('cada aviso mantiene icono, contenido y botón como hermanos para la fila desktop', () => {
  const {container} = fixture(); view.render(container, ready([item(),item({id:'c1',type:'comision'})]), {canOpen:true,onOpen(){}});
  assert.equal(nodes(container, 'personal-notices-card').length, 2);
  for (const card of nodes(container, 'personal-notices-card')) {
    assert.deepEqual(card.children.map(node => node.className), ['personal-notices-icon','personal-notices-content','personal-notices-open']);
    assert.equal(nodes(card, 'personal-notices-list').length, 1); assert.equal(nodes(card, 'personal-notices-item').length, 1);
  }
});
