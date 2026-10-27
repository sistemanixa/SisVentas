'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {build, hash} = require('../scripts/prepare-ot-unit-confirmation-rules.cjs');
const {validationFor, leaseValidation, rulesProtectOTUnitConfirmation} = require('../cotizador/ot-unit-confirmation-rules');
const {metadataRules} = require('../cotizador/labor-fence-policy');
function baseline() {
  return {rules:{'.read':false,'.write':false,sisventas:{'.write':false,
    equipos:{'.read':"auth != null",'.write':"auth != null && auth.uid === 'tecnico-ficticio'",'.indexOn':['cliente','serie']},
    garantias:{'.read':"auth != null",'.write':"auth != null && auth.uid === 'administrativo-ficticio'"},
    ot:{'.write':"auth.uid === 'tecnico-ficticio'",'.indexOn':['tecnico','estado']},
    gastos:{'.write':false},ventas:{'.write':false},config:{'.write':false}},
    sv_labor_guard:metadataRules().sv_labor_guard,sv_labor_receipts:{'.write':false},sv_permisos:{'.write':false}}};
}
const candidate = input => build(input,{expectedHash:hash(input)});

test('builder determinista clona la base y requiere hash explícito coincidente', () => {
  const input = baseline(), before = structuredClone(input);
  const output = candidate(input);
  assert.deepEqual(input,before);
  assert.deepEqual(candidate(input),output);
  for (const expectedHash of [undefined,'','A'.repeat(64),'0'.repeat(64),'nohash']) assert.throws(() => build(input,{expectedHash}),/hash/);
});

test('único diff son tres validadores: dos por registro y campo de lease; grants e índices intactos', () => {
  const input = baseline(), output = candidate(input);
  for (const domain of ['equipos','garantias']) {
    assert.deepEqual(output.rules.sisventas[domain].$unidad,{'.validate':validationFor(domain)});
    delete output.rules.sisventas[domain].$unidad;
  }
  assert.deepEqual(output.rules.sv_labor_guard.otUnitPolicy,{'.validate':leaseValidation()});
  delete output.rules.sv_labor_guard.otUnitPolicy;
  assert.deepEqual(output,input);
});

test('inspecta wrapper Admin y objeto rules directo, sin aceptar sólo una rama protegida', () => {
  const output = candidate(baseline());
  assert.equal(rulesProtectOTUnitConfirmation(output),true);
  assert.equal(rulesProtectOTUnitConfirmation(output.rules),true);
  delete output.rules.sisventas.garantias.$unidad;
  assert.equal(rulesProtectOTUnitConfirmation(output),false);
  assert.equal(rulesProtectOTUnitConfirmation(baseline()),false);
});

test('base sin .write raíz usa denegación RTDB por defecto; padre sisventas sigue cerrado', () => {
  const input = baseline();
  delete input.rules['.write'];
  assert.equal(rulesProtectOTUnitConfirmation(candidate(input)),true);
  input.rules.sisventas['.write'] = 'false';
  assert.equal(rulesProtectOTUnitConfirmation(candidate(input)),true);
});

for (const where of ['root','sisventas']) for (const value of [true,'true',"auth != null",{}]) {
  test('rechaza concesión ancestro no revisada: ' + where + '/' + JSON.stringify(value), () => {
    const input = baseline(), target = where === 'root' ? input.rules : input.rules.sisventas;
    target['.write'] = value;
    assert.throws(() => candidate(input),/ancestro/);
    const output = candidate(baseline());
    (where === 'root' ? output.rules : output.rules.sisventas)['.write'] = value;
    assert.equal(rulesProtectOTUnitConfirmation(output),false);
  });
}

for (const domain of ['equipos','garantias']) {
  test('no sustituye validaciones o descendientes existentes en ' + domain, () => {
    for (const extra of [{'.validate':true}, {$equipo:{'.validate':true}}, {literal:{'.read':false}}, {$unidad:{'.validate':validationFor(domain)}}]) {
      const input = baseline();
      Object.assign(input.rules.sisventas[domain],extra);
      assert.throws(() => candidate(input),/Validación|descendiente/);
    }
  });
  test('requiere nodo y .write existente escalar en ' + domain, () => {
    for (const value of [null,[],{}, {'.write':{grant:true}}]) {
      const input = baseline();
      input.rules.sisventas[domain] = value;
      assert.throws(() => candidate(input),/Nodo/);
    }
  });
  test('inspector rechaza validación alterada o permisos agregados al comodín ' + domain, () => {
    for (const alter of [
      node => {node.$unidad['.validate'] += ' || true';},
      node => {node.$unidad['.validate'] = true;},
      node => {node.$unidad['.write'] = true;},
      node => {node.$unidad['.read'] = true;},
      node => {node.literal = {'.validate':true};},
      node => {node['.validate'] = true;}
    ]) {
      const output = candidate(baseline());
      alter(output.rules.sisventas[domain]);
      assert.equal(rulesProtectOTUnitConfirmation(output),false);
    }
  });
  test('expresión conserva flags Auth, no usa una propiedad del body ni igualdad de objetos: ' + domain, () => {
    const expression = validationFor(domain), opposite = domain === 'equipos' ? 'garantias' : 'equipos';
    assert.match(expression,/auth\.token\.svLaborService === true && auth\.token\.svOTUnitConfirmation === true/);
    assert.match(expression,/auth\.token\.mode === 'commit'/);
    assert.match(expression,/root\.child\('sv_labor_guard\/mode'\)\.val\(\) === 'user'/);
    assert.match(expression,/root\.child\('sv_labor_guard\/otUnitPolicy'\)\.val\(\) === 1/);
    assert.match(expression,/!data\.exists\(\)/);
    assert.ok(expression.includes("!root.child('sisventas/"+opposite+"').child($unidad).exists()"));
    assert.ok(expression.includes("!newData.parent().parent().child('"+opposite+"').child($unidad).exists()"));
    assert.match(expression,/\$unidad\.beginsWith\('unidad_'\)/);
    assert.match(expression,/newData\.child\('origen'\)\.val\(\) === 'venta_ot'/);
    assert.match(expression,/newData\.child\('origen'\)\.val\(\) === 'venta_ot_v2'/);
    assert.doesNotMatch(expression,/data\.val\(\)\s*===?\s*newData\.val|newData\.child\('svOTUnitConfirmation'\)/);
  });
}

test('no inventa protección para dominios distintos ni entradas ambiguas', () => {
  for (const input of [null,undefined,[],{rules:[]},{rules:{}},'rules']) assert.equal(rulesProtectOTUnitConfirmation(input),false);
  for (const domain of ['ot','ventas','equipos/otro',undefined]) assert.throws(() => validationFor(domain),/Dominio/);
});

test('capability de lease exige regla nueva exacta y conserva rechazo de otros campos desconocidos', () => {
  const output = candidate(baseline());
  assert.deepEqual(output.rules.sv_labor_guard.$other,{'.validate':false});
  assert.equal(output.rules.sv_labor_guard.otUnitPolicy['.write'],undefined);
  const expression = leaseValidation();
  for (const condition of ["newData.isNumber()", "newData.val() === 1", "auth.uid === 'sv-labor-service'", "auth.token.svLaborService === true", "auth.token.svOTUnitConfirmation === true", "auth.token.mode === 'acquire'", "newData.parent().child('mode').val() === 'user'", "newData.parent().child('actorUid').val() === auth.token.actorUid", "newData.parent().child('opId').val().matches(/^ot_units_[a-f0-9]{64}$/)"]) assert.ok(expression.includes(condition),condition);
  for (const alter of [
    guard => {delete guard.otUnitPolicy;},
    guard => {guard.otUnitPolicy['.validate'] = true;},
    guard => {guard.otUnitPolicy['.write'] = true;},
    guard => {guard.$other['.validate'] = true;},
    guard => {guard['.write'] += ' || true';}
  ]) {
    const bad = structuredClone(output);alter(bad.rules.sv_labor_guard);
    assert.equal(rulesProtectOTUnitConfirmation(bad),false);
  }
});

test('builder no pisa ni adapta una coordinación desconocida o ya candidata', () => {
  for (const alter of [
    rules => {delete rules.sv_labor_guard;},
    rules => {rules.sv_labor_guard.$other['.validate'] = true;},
    rules => {rules.sv_labor_guard.otUnitPolicy = {'.validate':true};},
    rules => {rules.sv_labor_guard['.write'] = true;}
  ]) {
    const input = baseline();alter(input.rules);
    assert.throws(() => candidate(input),/coordinación/);
  }
  const prepared = candidate(baseline());
  assert.throws(() => candidate(prepared),/coordinación/);
});

test('CLI sólo escribe nueva candidata local y rechaza sobrescribir base/destino', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'sv-ot-unit-rules-'));
  const source = path.join(directory,'base.private.json'), target = path.join(directory,'output.candidate.json');
  const script = path.join(__dirname,'../scripts/prepare-ot-unit-confirmation-rules.cjs');
  const input = baseline();
  try {
    fs.writeFileSync(source,JSON.stringify(input));
    const output = execFileSync(process.execPath,[script,source,target,hash(input)],{encoding:'utf8',stdio:'pipe'});
    assert.match(output,/LOCAL sin aplicar/);
    assert.equal(rulesProtectOTUnitConfirmation(JSON.parse(fs.readFileSync(target,'utf8'))),true);
    assert.deepEqual(JSON.parse(fs.readFileSync(source,'utf8')),input);
    assert.throws(() => execFileSync(process.execPath,[script,source,target,hash(input)],{stdio:'pipe'}));
    assert.throws(() => execFileSync(process.execPath,[script,source,source,hash(input)],{stdio:'pipe'}));
    assert.throws(() => execFileSync(process.execPath,[script,source,path.join(directory,'unsafe.json'),hash(input)],{stdio:'pipe'}));
  } finally {
    for (const file of [source,target]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(directory);
  }
});

module.exports = {baseline};
