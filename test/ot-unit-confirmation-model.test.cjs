'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const modelPath = path.resolve(__dirname, '../js/core/ot-unit-confirmation.v1.js');
const model = require(modelPath);

const config = change => ({estado:'si', meses:12, inicio:'instalacion', serie:true, equipo:true, ...change});
const item = change => ({desc:'Cámara ficticia', qty:1, unidad:'Unidad', garantiaLinea:'linea-1', garantiaConfig:config(), ...change});
const sale = items => ({fbKey:'venta-ficticia', items:items || {renglon:item()}});
const unit = change => model.build(sale({renglon:item(change)})).units[0];
const installed = change => ({decision:'instalado', serie:' SERIE FICTICIA ', ubicacion:' Acceso ficticio ', ...change});
function fails(reason, fn) { assert.throws(fn, error => error.reason === reason); }

test('exporta el mismo contrato UMD en navegador sin consultar un entorno externo', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(modelPath, 'utf8'), {window});
  assert.deepEqual(Object.keys(window.SVOTUnitConfirmation), ['build', 'date', 'expiry', 'decision', 'key', 'MAX_UNITS', 'canReviewManually', 'manualUnit']);
  assert.equal(typeof window.SVOTUnitConfirmation.build, 'function');
  assert.equal(Object.isFrozen(window.SVOTUnitConfirmation), true);
});

test('conserva itemKey, línea, índices y clave estable de cada unidad', () => {
  const result = model.build(sale({renglon:item({qty:3})}));
  assert.equal(result.canCreate, true);
  assert.equal(result.units.length, 3);
  assert.deepEqual(result.units.map(u => [u.itemKey, u.linea, u.n, u.key]), [
    ['renglon', 'linea-1', 0, 'unidad_venta-ficticia_linea-1_0'],
    ['renglon', 'linea-1', 1, 'unidad_venta-ficticia_linea-1_1'],
    ['renglon', 'linea-1', 2, 'unidad_venta-ficticia_linea-1_2']
  ]);
});

test('items de array conservan sus claves numéricas reales', () => {
  const values = [];
  values[2] = item();
  assert.equal(model.build(sale(values)).units[0].itemKey, '2');
});

test('clona los snapshots y las unidades sin mutar ni compartir el histórico', () => {
  const original = sale({renglon:item({qty:2, extras:{texto:'original'}})});
  const before = JSON.stringify(original);
  const result = model.build(original);
  result.units[0].item.extras.texto = 'edición local';
  result.units[0].item.garantiaConfig.meses = 24;
  result.units[0].config.meses = 36;
  assert.equal(JSON.stringify(original), before);
  assert.equal(result.units[1].config.meses, 12);
  assert.equal(result.units[1].item.garantiaConfig.meses, 12);
});

test('no consulta ni toma términos del catálogo actual', () => {
  let catalogReads = 0;
  const snapshot = config({meses:6});
  const options = {get catalog() { catalogReads++; throw new Error('No leer catálogo'); }};
  const result = model.build(sale({renglon:item({garantiaConfig:snapshot})}), options);
  assert.equal(catalogReads, 0);
  assert.deepEqual(result.units[0].config, snapshot);
  assert.equal(model.decision(result.units[0], installed(), '2026-01-31', '2026-02-01').fechaVenc, '2026-07-31');
});

test('la cantidad por defecto es uno sólo cuando ambos campos son nullish', () => {
  for (const change of [{qty:undefined}, {qty:null, cantidad:undefined}, {qty:undefined, cantidad:null}]) {
    assert.equal(model.build(sale({renglon:item(change)})).units.length, 1);
  }
  assert.equal(model.build(sale({renglon:item({qty:null, cantidad:5})})).units.length, 5);
  assert.equal(model.build(sale({renglon:item({qty:2, cantidad:5})})).units.length, 2);
});

for (const amount of [0, '0', -1, NaN, Infinity, '', '   ', 'nada', '0x10', '1e3', false, {}, []]) {
  test('cantidad inválida no inventa una unidad: ' + String(amount), () => {
    const result = model.build(sale({renglon:item({qty:amount})}));
    assert.equal(result.units.length, 0);
    assert.equal(result.canCreate, false);
    assert.equal(result.issues[0].reason, 'invalid-quantity');
  });
}

test('cantidad decimal de un producto por unidad queda en resumen sin equipos', () => {
  const result = model.build(sale({renglon:item({qty:1.5})}));
  assert.equal(result.units.length, 0);
  assert.equal(result.summaries[0].quantity, 1.5);
  assert.equal(result.summaries[0].reason, 'fractional');
});

test('cantidad numérica decimal en texto se lee sin cambiar su significado', () => {
  for (const amount of ['5', ' 5 ', '+5', '5.0']) assert.equal(model.build(sale({renglon:item({qty:amount})})).units.length, 5);
  assert.equal(model.build(sale({renglon:item({qty:undefined, cantidad:0})})).units.length, 0);
});

test('snapshot circular o con funciones se rechaza sin producir identidad persistible', () => {
  const circular = item();
  circular.extra = circular;
  for (const original of [circular, item({accion:() => { throw new Error('No ejecutar'); }})]) {
    const result = model.build(sale({renglon:original}));
    assert.equal(result.units.length, 0);
    assert.equal(result.issues[0].reason, 'invalid-item');
  }
});

test('clonar claves propias especiales no contamina prototipos', () => {
  const original = item({extra:JSON.parse('{"__proto__":{"pruebaFicticia":true}}')});
  const result = model.build(sale({renglon:original}));
  assert.equal(Object.hasOwn(result.units[0].item.extra, '__proto__'), true);
  assert.equal({}.pruebaFicticia, undefined);
  assert.equal(Object.getPrototypeOf(result.units[0].item.extra), Object.prototype);
});

for (const measure of ['m', 'MT', 'metro', 'metros', 'metres', 'rollo', 'litros', 'kg', 'm²']) {
  test('no expande medidas aunque el snapshot marque equipo y serie: ' + measure, () => {
    const result = model.build(sale({renglon:item({qty:8, unidad:measure})}));
    assert.equal(result.units.length, 0);
    assert.equal(result.summaries[0].reason, 'measured');
  });
}

for (const discrete of ['', 'Unidad', 'unidades', 'u', 'un', 'ud', 'uds']) {
  test('reconoce unidad discreta: ' + discrete, () => assert.equal(model.build(sale({renglon:item({qty:2, unidad:discrete})})).units.length, 2));
}

test('usa clasificación canónica inyectada y excluye mano de obra antes de expandir', () => {
  const input = sale({servicio:item({qty:30, clase:'manoobra'}), equipo:item({garantiaLinea:'otra-linea'})});
  const result = model.build(input, {isLabor:i => i.clase === 'manoobra'});
  assert.equal(result.units.length, 1);
  assert.equal(result.units[0].itemKey, 'equipo');
  assert.equal(result.summaries[0].reason, 'labor');
});

test('unitOf define clasificación pero no agrega garantías ni cambia snapshot', () => {
  const result = model.build(sale({renglon:item({tipoUnidad:'m', unidad:'Unidad'})}), {unitOf:i => i.tipoUnidad});
  assert.equal(result.units.length, 0);
  assert.equal(result.summaries[0].item.unidad, 'Unidad');
});

test('unidad legacy desconocida sin evidencia discreta exige revisión sin expansión', () => {
  const result = model.build(sale({renglon:item({unidad:'caja especial', garantiaConfig:config({equipo:false, serie:false})})}));
  assert.equal(result.units.length, 0);
  assert.equal(result.summaries[0].reason, 'unknown-unit');
  assert.equal(result.issues[0].reason, 'unknown-unit');
});

test('equipo o serie permiten clasificar legacy discreto pero nunca confirmar cobertura por inferencia', () => {
  for (const evidence of [{equipo:true, serie:false}, {equipo:false, serie:true}]) {
    const result = model.build(sale({renglon:item({qty:2, unidad:'legacy', garantiaConfig:config(evidence)})}));
    assert.equal(result.units.length, 2);
    assert.equal(result.units[0].needsReview, true);
    assert.equal(result.units[0].reason, 'unknown-unit');
    assert.equal(model.decision(result.units[0], installed(), '2026-01-01', '2026-01-01').cobertura, false);
  }
});

for (const change of [
  {garantiaConfig:undefined}, {garantiaConfig:null}, {garantiaConfig:[]},
  {garantiaConfig:{estado:'sin_definir'}}, {garantiaConfig:config({estado:'otro'})},
  {garantiaConfig:config({meses:0})}, {garantiaConfig:config({meses:121})},
  {garantiaConfig:config({meses:1.5})}, {garantiaConfig:config({meses:'12'})},
  {garantiaConfig:config({inicio:'hoy'})}, {garantiaConfig:config({serie:'false'})},
  {garantiaConfig:config({equipo:'true'})}, {garantiaLinea:undefined},
  {garantiaLinea:''}, {garantiaLinea:'linea/ajena'}
]) {
  test('snapshot o identidad incompletos no reciben cobertura ni clave automática: ' + JSON.stringify(change), () => {
    const value = unit(change);
    assert.equal(value.needsReview, true);
    assert.equal(value.key, null);
    assert.equal(model.decision(value, installed(), '2026-01-01', '2026-01-01').cobertura, false);
  });
}

test('estado no registra información técnica sin inventar cobertura', () => {
  const value = unit({garantiaConfig:config({estado:'no', meses:12})});
  assert.equal(value.needsReview, false);
  const result = model.decision(value, installed(), '2026-01-01', '2026-01-01');
  assert.equal(result.fechaInstalacion, '2026-01-01');
  assert.equal(result.cobertura, false);
  assert.equal(result.fechaVenc, '');
  assert.equal(result.meses, 0);
});

test('líneas duplicadas quedan ambas sin clave y no se confunden por código de producto', () => {
  const result = model.build(sale({primera:item({cod:'igual'}), segunda:item({cod:'igual'})}));
  assert.equal(result.units.length, 2);
  assert.equal(result.canCreate, false);
  assert.equal(result.units.every(u => u.key === null && u.reason === 'duplicate-line'), true);
  const valid = model.build(sale({primera:item({cod:'igual'}), segunda:item({cod:'igual', garantiaLinea:'diferente'})}));
  assert.equal(valid.units.every(u => !u.needsReview), true);
});

test('venta e itemKey inseguros invalidan la identidad de la unidad', () => {
  for (const source of [{...sale(), fbKey:'venta/ajena'}, sale({'item.invalido':item()})]) {
    const result = model.build(source);
    assert.equal(result.units[0].key, null);
    assert.equal(result.units[0].reason, 'invalid-identity');
  }
});

for (const invalid of ['', 'a/b', 'a.b', 'a$b', 'a#b', 'a[b', 'a]b', 'a\nb', 'a\u007fb', '\ud800', '\udc00']) {
  test('clave RTDB rechaza caracteres inválidos: ' + JSON.stringify(invalid), () => assert.equal(model.key(invalid), false));
}

test('límite RTDB es por bytes UTF8 e incluye el prefijo y los componentes', () => {
  assert.equal(model.key('a'.repeat(768)), true);
  assert.equal(model.key('a'.repeat(769)), false);
  assert.equal(model.key('á'.repeat(384)), true);
  assert.equal(model.key('á'.repeat(385)), false);
  assert.equal(model.key('😀'.repeat(192)), true);
  assert.equal(model.key('😀'.repeat(193)), false);
  const result = model.build(sale({renglon:item({garantiaLinea:'a'.repeat(768)})}));
  assert.equal(result.units[0].key, null);
  assert.equal(result.units[0].reason, 'invalid-identity');
});

test('hasta doscientas unidades se expanden; excedente explícito bloquea creación sin truncar silenciosamente', () => {
  const result = model.build(sale({primera:item({qty:199}), segunda:item({qty:3, garantiaLinea:'linea-2'})}));
  assert.equal(result.units.length, 200);
  assert.equal(result.canCreate, false);
  assert.deepEqual(result.issues.find(i => i.reason === 'too-many-units'), {reason:'too-many-units', itemKey:'segunda', omitted:2, blocking:true});
  assert.equal(result.units.every(u => u.creationBlocked), true);
  const technical = model.decision(result.units[0], installed(), '2026-01-01', '2026-01-01');
  assert.equal(technical.fechaInstalacion, '2026-01-01');
  assert.equal(technical.needsReview, true);
  assert.equal(technical.cobertura, false);
  assert.equal(model.build(sale({renglon:item({qty:200})})).canCreate, true);
});

test('cantidades gigantes no generan un bucle o DOM sin límite', () => {
  const result = model.build(sale({renglon:item({qty:Number.MAX_SAFE_INTEGER})}));
  assert.equal(result.units.length, model.MAX_UNITS);
  assert.equal(result.issues[0].omitted, Number.MAX_SAFE_INTEGER - model.MAX_UNITS);
});

test('entrada inválida informa un problema y no produce unidades', () => {
  for (const value of [null, undefined, [], 'venta', {items:'incompleto'}]) {
    const result = model.build(value);
    assert.equal(result.units.length, 0);
    assert.equal(result.canCreate, false);
  }
  const result = model.build(sale({renglon:null}));
  assert.equal(result.issues[0].reason, 'invalid-item');
});

for (const value of ['1900-01-01', '2000-02-29', '2024-02-29', '2026-10-23', '9999-12-31']) {
  test('fecha calendario válida: ' + value, () => assert.equal(model.date(value), value));
}
for (const value of ['1899-12-31', '10000-01-01', '1900-02-29', '2026-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-01-00', '2026-1-01', '2026-01-1', ' 2026-01-01', '2026-01-01T00:00:00Z', '', null, new Date('2026-01-01')]) {
  test('fecha calendario inválida: ' + String(value), () => assert.equal(model.date(value), null));
}

for (const [start, months, end] of [
  ['2026-01-31', 1, '2026-02-28'], ['2024-01-31', 1, '2024-02-29'],
  ['2024-02-29', 12, '2025-02-28'], ['2026-08-31', 6, '2027-02-28'],
  ['2026-12-31', 1, '2027-01-31'], ['2026-01-30', 120, '2036-01-30']
]) {
  test('vencimiento con fin de mes: ' + start + '+' + months, () => assert.equal(model.expiry(start, months), end));
}

test('vencimiento rechaza meses fuera de términos o fechas fuera de rango', () => {
  for (const months of [0, -1, 121, 1.5, '12', null, NaN]) assert.equal(model.expiry('2026-01-01', months), null);
  assert.equal(model.expiry('2026-02-29', 1), null);
  assert.equal(model.expiry('9999-12-01', 1), null);
});

test('fechas y vencimientos no dependen de UTC, DST ni huso del equipo', () => {
  const code = 'const m=require(' + JSON.stringify(modelPath) + ');process.stdout.write(JSON.stringify([m.date("2026-10-23"),m.expiry("2024-02-29",12),m.expiry("2026-01-31",1)]));';
  const results = ['UTC', 'America/Argentina/Buenos_Aires', 'America/Los_Angeles', 'Pacific/Kiritimati'].map(TZ => execFileSync(process.execPath, ['-e', code], {env:{...process.env, TZ}, encoding:'utf8'}));
  assert.equal(new Set(results).size, 1);
});

test('no existe decisión por defecto ni inferencia instalado desde producto', () => {
  for (const value of [{}, {decision:''}, {decision:'si'}, {decision:true}]) fails('missing-decision', () => model.decision(unit(), value, '2026-01-01', '2026-01-01'));
});

test('instalado exige ubicación, serie y fecha efectiva no futura', () => {
  fails('required-location', () => model.decision(unit(), installed({ubicacion:' '}), '2026-01-01', '2026-01-01'));
  fails('required-series', () => model.decision(unit(), installed({serie:' '}), '2026-01-01', '2026-01-01'));
  for (const [effective, today] of [['2026-02-30', '2026-03-01'], ['2026-01-02', '2026-01-01'], ['2026-01-01', 'ayer']]) {
    fails('invalid-date', () => model.decision(unit(), installed(), effective, today));
  }
});

test('instalación explícita inicia garantía del snapshot una sola fecha calendario', () => {
  const result = model.decision(unit(), installed(), '2026-01-31', '2026-02-01');
  assert.deepEqual(result, {decision:'instalado', serie:'SERIE FICTICIA', ubicacion:'Acceso ficticio', fecha:'2026-01-31', fechaInstalacion:'2026-01-31', fechaEntrega:'', cobertura:true, fechaInicioGarantia:'2026-01-31', fechaVenc:'2027-01-31', meses:12, needsReview:false, reason:''});
});

test('entregado sin instalar no inicia cobertura de instalación ni inventa fechaInstalacion', () => {
  const result = model.decision(unit(), {decision:'entregado', serie:'S1'}, '2026-01-01', '2026-01-01');
  assert.equal(result.fechaInstalacion, '');
  assert.equal(result.fechaEntrega, '2026-01-01');
  assert.equal(result.fechaInicioGarantia, '');
  assert.equal(result.fechaVenc, '');
  assert.equal(result.cobertura, false);
});

test('entrega explícita sólo comienza cobertura configurada desde entrega', () => {
  const result = model.decision(unit({garantiaConfig:config({inicio:'entrega', meses:1})}), {decision:'entregado', serie:'S1'}, '2026-01-31', '2026-01-31');
  assert.equal(result.cobertura, true);
  assert.equal(result.fechaInstalacion, '');
  assert.equal(result.fechaVenc, '2026-02-28');
});

test('pendiente conserva información técnica sin exigir serie, ubicación ni fechas', () => {
  const result = model.decision(unit(), {decision:'pendiente'}, 'fecha mala', 'mañana');
  for (const field of ['fecha', 'fechaInstalacion', 'fechaEntrega', 'fechaInicioGarantia', 'fechaVenc']) assert.equal(result[field], '');
  assert.equal(result.cobertura, false);
  assert.equal(result.meses, 0);
});

test('entrega requiere serie cuando el snapshot lo exige y no exige ubicación de instalación', () => {
  fails('required-series', () => model.decision(unit(), {decision:'entregado'}, '2026-01-01', '2026-01-01'));
  assert.equal(model.decision(unit({garantiaConfig:config({serie:false})}), {decision:'entregado'}, '2026-01-01', '2026-01-01').ubicacion, '');
});

test('decisiones parciales no modifican otras unidades y repetirlas es determinista', () => {
  const result = model.build(sale({renglon:item({qty:3})}));
  const before = JSON.stringify(result);
  const selections = result.units.map((u, i) => model.decision(u, i === 0 ? installed() : {decision:'pendiente'}, '2026-01-01', '2026-01-01'));
  assert.equal(selections.filter(s => s.cobertura).length, 1);
  assert.equal(JSON.stringify(result), before);
  assert.deepEqual(model.decision(result.units[0], installed(), '2026-01-01', '2026-01-01'), selections[0]);
});

test('tipo de campos inválido no se convierte en serie o ubicación aparente', () => {
  fails('invalid-series', () => model.decision(unit(), installed({serie:123}), '2026-01-01', '2026-01-01'));
  fails('invalid-location', () => model.decision(unit(), installed({ubicacion:{}}), '2026-01-01', '2026-01-01'));
  fails('invalid-unit', () => model.decision(null, installed(), '2026-01-01', '2026-01-01'));
});

test('cobertura no puede salir del rango calendario soportado', () => {
  fails('invalid-expiry', () => model.decision(unit(), installed(), '9999-01-01', '9999-12-31'));
});

const manual = change => ({confirmado:true,estado:'si',meses:12,inicio:'instalacion',serie:true,fecha:'2026-01-31',...change});
function legacy(change = {}) {
  const value = model.build(sale({renglon:item({garantiaConfig:undefined,garantiaLinea:undefined,...change})})).units[0];
  return value && {...value,manualKey:'unidad_manual_ficticia_0'};
}

test('la revisión manual admite legado discreto y términos incompletos sin rellenar el maestro', () => {
  for (const change of [{}, {garantiaConfig:config({estado:'sin_definir'})}, {garantiaConfig:config(),garantiaLinea:null}, {garantiaConfig:config({meses:0})}, {garantiaConfig:config({inicio:'desconocido'})}]) {
    const original = legacy(change), before = structuredClone(original);
    assert.equal(model.canReviewManually(original),true);
    const next = model.manualUnit(original,manual(),'2026-02-01');
    assert.equal(next.key,original.manualKey);assert.equal(next.needsReview,false);assert.equal(next.reason,'');
    assert.deepEqual(next.config,{estado:'si',meses:12,inicio:'instalacion',serie:true,...(typeof original.config?.equipo==='boolean'?{equipo:original.config.equipo}:{})});assert.deepEqual(next.manualReview,manual());
    assert.deepEqual(original,before);assert.deepEqual(next.item,original.item);assert.notEqual(next.item,original.item);assert.notEqual(next.config,next.manualReview);
    next.item.desc='Texto local';next.manualReview.meses=24;assert.deepEqual(original,before);assert.equal(next.config.meses,12);
  }
});

test('meses, fecha e inicio manuales son explícitos y la decisión usa esa fecha sin desplazar el calendario', () => {
  const value=model.manualUnit(legacy(),manual({meses:1}),'2026-02-01');
  const result=model.decision(value,installed(),value.manualReview.fecha,'2026-02-01');
  assert.equal(result.fechaInstalacion,'2026-01-31');assert.equal(result.fechaInicioGarantia,'2026-01-31');assert.equal(result.fechaVenc,'2026-02-28');assert.equal(result.meses,1);assert.equal(result.cobertura,true);assert.equal(result.needsReview,false);
  assert.equal(model.decision(legacy(),installed(),'2026-01-31','2026-02-01').cobertura,false,'El legado original sigue sin cobertura');
});

test('entrega manual conserva el comienzo elegido y nunca inventa instalación', () => {
  const installStart=model.manualUnit(legacy(),manual(),'2026-02-01');
  const delivered=model.decision(installStart,{decision:'entregado',serie:'SERIE FICTICIA'},installStart.manualReview.fecha,'2026-02-01');
  assert.equal(delivered.fechaInstalacion,'');assert.equal(delivered.fechaEntrega,'2026-01-31');assert.equal(delivered.cobertura,false);assert.equal(delivered.fechaVenc,'');
  const deliveryStart=model.manualUnit(legacy(),manual({inicio:'entrega'}),'2026-02-01');
  const covered=model.decision(deliveryStart,{decision:'entregado',serie:'SERIE FICTICIA'},deliveryStart.manualReview.fecha,'2026-02-01');
  assert.equal(covered.fechaInstalacion,'');assert.equal(covered.cobertura,true);assert.equal(covered.fechaVenc,'2027-01-31');
});

test('sin garantía manual conserva estado explícito y las validaciones técnicas de instalación', () => {
  const value=model.manualUnit(legacy(),manual({estado:'no',meses:0,inicio:'',serie:false}),'2026-02-01');
  assert.deepEqual(value.config,{estado:'no',meses:0,inicio:'',serie:false});
  const result=model.decision(value,installed({serie:''}),value.manualReview.fecha,'2026-02-01');
  assert.equal(result.cobertura,false);assert.equal(result.fechaVenc,'');assert.equal(result.meses,0);assert.equal(result.fechaInstalacion,'2026-01-31');
  fails('required-location',()=>model.decision(value,installed({ubicacion:''}),value.manualReview.fecha,'2026-02-01'));
  fails('required-series',()=>model.decision(model.manualUnit(legacy(),manual(),'2026-02-01'),installed({serie:''}),'2026-01-31','2026-02-01'));
});

test('la revisión manual no admite duplicados ocultos por un snapshot faltante', () => {
  const missing={garantiaConfig:undefined,garantiaLinea:'duplicada'};
  const plan=model.build(sale({first:item(missing),second:item(missing)}));
  for(const value of plan.units){assert.equal(value.reason,'missing-snapshot');assert.equal(value.duplicateLine,true);assert.equal(model.canReviewManually(value),false);fails('manual-ineligible',()=>model.manualUnit({...value,manualKey:'unidad_ficticia'},manual(),'2026-02-01'));}
  const valid=model.build(sale({first:item({garantiaLinea:'duplicada'}),second:item({garantiaLinea:'duplicada'})}));
  assert.ok(valid.units.every(value=>value.reason==='duplicate-line'&&!model.canReviewManually(value)));
});

test('renglones por medida, fracciones, mano de obra y unidades desconocidas nunca admiten revisión manual por equipo', () => {
  for(const change of [{unidad:'metro'}, {qty:1.5}, {unidad:'caja',garantiaConfig:config({equipo:true})}]) {
    const plan=model.build(sale({renglon:item({...change,garantiaLinea:undefined})}));
    for(const value of [...plan.units,...plan.summaries])assert.equal(model.canReviewManually(value),false);
  }
  const labor=model.build(sale({renglon:item({garantiaConfig:undefined})}),{isLabor:()=>true});assert.equal(labor.units.length,0);assert.ok(labor.summaries.every(value=>!model.canReviewManually(value)));
  assert.equal(model.canReviewManually(legacy({esManoDeObra:true})),false);assert.equal(model.canReviewManually(legacy({esManoObra:true})),false);
});

test('exceso global, cantidades e índices inválidos y unidades completas no reciben una identidad manual', () => {
  const overflow=model.build(sale({renglon:item({qty:201,garantiaConfig:undefined})}));
  assert.equal(overflow.units.length,200);assert.ok(overflow.units.every(value=>!model.canReviewManually(value)));
  for(const value of [null,{},unit(),{...legacy(),n:null},{...legacy(),n:-1},{...legacy(),n:0.5},{...legacy(),n:1},{...legacy(),itemKey:'invalido/'},{...legacy(),creationBlocked:true},{...legacy(),summary:true},legacy({qty:0})])assert.equal(model.canReviewManually(value),false);
});

for(const keyValue of [undefined,'','invalid/key','invalid.key','bad\nkey','x'.repeat(769)])test('la revisión manual requiere una clave segura preparada por servidor: '+String(keyValue).slice(0,20),()=>{
  fails('manual-identity',()=>model.manualUnit({...legacy(),manualKey:keyValue},manual(),'2026-02-01'));
});

for(const name of ['confirmado','estado','meses','inicio','serie','fecha'])test('la revisión manual no completa el campo omitido '+name,()=>{
  const value=manual();delete value[name];fails('manual-confirmation',()=>model.manualUnit(legacy(),value,'2026-02-01'));
});

for(const value of [false,1,'true',undefined])test('confirmación manual exige booleano true explícito: '+String(value),()=>{
  fails('manual-confirmation',()=>model.manualUnit(legacy(),manual({confirmado:value}),'2026-02-01'));
});

test('revisión manual rechaza campos extra e identidades del cliente en vez de copiar configuración',()=>{
  for(const field of ['key','manualKey','garantiaLinea','equipo','precio','snapshot','admin'])fails('manual-confirmation',()=>model.manualUnit(legacy(),{...manual(),[field]:'no confiable'},'2026-02-01'));
  const hidden=manual();Object.defineProperty(hidden,'extra',{value:1});fails('manual-confirmation',()=>model.manualUnit(legacy(),hidden,'2026-02-01'));
  const symbol=manual();symbol[Symbol('extra')]=true;fails('manual-confirmation',()=>model.manualUnit(legacy(),symbol,'2026-02-01'));
});

for(const value of ['','sin_definir','Si',true])test('estado manual sólo permite si o no: '+String(value),()=>{
  fails('manual-terms',()=>model.manualUnit(legacy(),manual({estado:value}),'2026-02-01'));
});

for(const value of [0,-1,1.5,121,'12',NaN,Infinity,null])test('meses manuales no se coercionan ni exceden el rango: '+String(value),()=>{
  fails('manual-months',()=>model.manualUnit(legacy(),manual({meses:value}),'2026-02-01'));
});

for(const value of ['','hoy','instalación',null])test('inicio manual con garantía debe ser explícito: '+String(value),()=>{
  fails('manual-start',()=>model.manualUnit(legacy(),manual({inicio:value}),'2026-02-01'));
});

test('sin garantía manual rechaza meses e inicio contradictorios',()=>{
  fails('manual-months',()=>model.manualUnit(legacy(),manual({estado:'no',meses:12,inicio:''}),'2026-02-01'));
  fails('manual-start',()=>model.manualUnit(legacy(),manual({estado:'no',meses:0,inicio:'instalacion'}),'2026-02-01'));
});

for(const value of ['true',1,null,undefined])test('la regla de serie manual no se infiere: '+String(value),()=>{
  fails('manual-series-rule',()=>model.manualUnit(legacy(),manual({serie:value}),'2026-02-01'));
});

for(const value of ['',null,'2026-02-30','2026-1-31','2026-02-02','1899-12-31','2026-01-31T00:00:00Z'])test('fecha manual estricta, explícita y no futura: '+String(value),()=>{
  fails('manual-date',()=>model.manualUnit(legacy(),manual({fecha:value}),'2026-02-01'));
});

test('hoy inválido no permite establecer una cobertura manual y las copias UMD/servidor son idénticas',()=>{
  fails('manual-date',()=>model.manualUnit(legacy(),manual(),''));
  assert.deepEqual(fs.readFileSync(modelPath),fs.readFileSync(path.resolve(__dirname,'../cotizador/ot-unit-confirmation-model.js')));
});

for(const change of [{estado:'no',meses:0,inicio:''},{meses:24},{inicio:'entrega'},{serie:false}])test('reparar identidad no permite alterar términos originales '+JSON.stringify(change),()=>{
  const original=legacy({garantiaConfig:config(),garantiaLinea:null});
  fails('manual-preserve-terms',()=>model.manualUnit(original,manual(change),'2026-02-01'));
});

test('sin definir permite confirmar sin garantía sin conservar una duración que nunca se confirmó',()=>{const value=model.manualUnit(legacy({garantiaConfig:config({estado:'sin_definir'})}),manual({estado:'no',meses:0,inicio:''}),'2026-02-01');assert.equal(value.config.estado,'no');assert.equal(value.config.meses,0);});
