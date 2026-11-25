'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Rule=require('../scripts/lib/office-stock-precondition-rules.cjs');
test('stock presence overlay narrows every existing grant including ancestors and OR grants',()=>{
  const base={rules:{'.read':true,'.write':true,sisventas:{'.write':'auth != null',inventario_operativo:{'.write':false,$key:{'.write':'auth.token.svOfficeStockVersion === 1 || auth.token.other === true','.validate':'newData.hasChildren()'}},$domain:{'.write':'auth != null'}},private:{'.write':'auth.token.mode === "commit"'}}},saved=structuredClone(base),result=Rule.prepare(base);
  assert.deepEqual(base,saved);
  assert.deepEqual(result.manifest.changed,['.write','sisventas/.write','sisventas/inventario_operativo/$key/.write','sisventas/$domain/.write','private/.write']);
  for(const p of result.manifest.changed){const parts=p.split('/');let before=base.rules,after=result.rules.rules;for(const k of parts){before=before[k];after=after[k];}assert.equal(after,'('+Rule.predicate+') && ('+String(before)+')');}
  assert.equal(result.rules.rules['.read'],true);assert.equal(result.rules.rules.sisventas.inventario_operativo['.write'],false);assert.equal(result.rules.rules.sisventas.inventario_operativo.$key['.validate'],saved.rules.sisventas.inventario_operativo.$key['.validate']);
  assert.equal(result.manifest.grantsAdded,false);assert.equal(result.manifest.applyLast,true);
});
test('stock presence proof uses current root before atomic patch, strict typed claims and no newData/hash assumption',()=>{
  assert.match(Rule.predicate,/svOfficeStockVersion !== 1/);assert.match(Rule.predicate,/svOfficeStockPreconditionVersion === 1/);assert.match(Rule.predicate,/svOfficeStockSourcePresent === true/);assert.match(Rule.predicate,/svOfficeStockSourcePresent === false/);assert.match(Rule.predicate,/root\.child\('sisventas\/inventario_operativo'\)\.child\(auth.token.svOfficeStockInventoryKey\)\.exists\(\) === auth.token.svOfficeStockSourcePresent/);assert.doesNotMatch(Rule.predicate,/newData|[Hh]ash/);
  assert.throws(()=>Rule.prepare({rules:{'.write':1}}),/Grant no revisable/);
});
