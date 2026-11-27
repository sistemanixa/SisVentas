'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {classify}=require('../js/modules/client-review-status');
function fixture(){return {group:{miembros:[{fbKey:'a',id:'A'},{fbKey:'b',id:'B'}]},index:{a:{clienteKey:'c',sedeKey:'s1'},b:{clienteKey:'c',sedeKey:'s2'}},structures:{c:{esquema:1,legacyFbKeys:['a','b'],sedes:{s1:{legacyFbKey:'a',legacyId:'A'},s2:{legacyFbKey:'b',legacyId:'B'}}}}};}
const run=f=>classify(f.group,f.index,f.structures,f.decision);
test('all members need explicit index, structure and sede evidence; input untouched',()=>{const f=fixture(),before=JSON.stringify(f);a.deepEqual(run(f),{status:'unified',clienteKey:'c'});a.equal(JSON.stringify(f),before);});
test('id-only legacy identity is supported with explicit backlink',()=>{const f=fixture();delete f.group.miembros[0].fbKey;f.index.A=f.index.a;delete f.index.a;f.structures.c.legacyFbKeys[0]='A';a.equal(run(f).status,'unified');});
test('no trace is pending, never inferred from equal names',()=>{const f=fixture();f.index={};f.structures={};f.group.miembros.forEach(m=>m.nombre='Equal');a.deepEqual(run(f),{status:'pending'});});
test('manual independence is preserved only without conflicting structural traces',()=>{const f=fixture();f.decision={estado:'independientes',confirmadaManualmente:true};a.equal(run(f).status,'review');f.index={};f.structures={};a.equal(run(f).status,'independent');f.decision.confirmadaManualmente=false;a.equal(run(f).status,'pending');});
for(const [name,mutate] of [
 ['partial index',f=>delete f.index.b],['missing structure',f=>delete f.structures.c],
 ['wrong id',f=>f.structures.c.sedes.s2.legacyId='other'],['wrong key',f=>f.structures.c.sedes.s2.legacyFbKey='other'],
 ['missing sede',f=>delete f.structures.c.sedes.s2],['missing legacy key',f=>f.structures.c.legacyFbKeys.pop()],
 ['conflicting alias',f=>f.index.A={clienteKey:'else',sedeKey:'s1'}],
 ['duplicate identity',f=>f.group.miembros[1]=f.group.miembros[0]],
 ['two targets',f=>{f.structures.d=structuredClone(f.structures.c);f.index.b.clienteKey='d';}],
 ['backlink without index',f=>f.index={}],['malformed index',f=>f.index.a=null],
 ['missing original identity',f=>f.group.miembros[0]={nombre:'Equal'}],
 ['missing legacy id backlink',f=>delete f.structures.c.sedes.s1.legacyId]
])test(name+' stays review',()=>{const f=fixture();mutate(f);a.equal(run(f).status,'review');});
test('manual unification decision is not proof',()=>{a.equal(classify(fixture().group,{}, {},{estado:'unificar',confirmadaManualmente:true}).status,'pending');});
