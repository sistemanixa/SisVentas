'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const {prepare}=require('../scripts/lib/ot-lifecycle-missing-primary-rules.cjs');
const Overlay=require('../cotizador/cc-ot-link-overlay/attach.cjs');
const baseline=process.env.SV_OT_LINK_RULES,model=process.env.SV_OT_LINK_MODEL;
test('exact reviewed rule baseline changes only two lifecycle grants',{skip:!baseline},()=>{
 const input=JSON.parse(fs.readFileSync(baseline,'utf8')),before=structuredClone(input),next=prepare(input),sales=next.rules.sisventas.ventas,key=Object.keys(sales).find(k=>k.startsWith('$'));
 for(const field of ['estadoInst','audit']){a.notEqual(sales[key][field]['.write'],input.rules.sisventas.ventas[key][field]['.write']);sales[key][field]['.write']=input.rules.sisventas.ventas[key][field]['.write'];}
 a.deepEqual(next,input);a.deepEqual(input,before);a.throws(()=>prepare(prepare(input)),/already patched/);
});
test('unknown rule shape is refused',()=>{a.throws(()=>prepare({rules:{sisventas:{ventas:{$row:{}}}}}),/Unknown/);});
test('pinned deployed model retains every byte outside one verified-link branch',{skip:!model},()=>{
 const source=fs.readFileSync(model,'utf8'),next=Overlay.apply(source),newline=source.includes('\r\n')?'\r\n':'\n';
 a.equal(next.replace(newline+Overlay.BRANCH,''),source);a.throws(()=>Overlay.apply(source+' '),/Unknown/);a.throws(()=>Overlay.apply(next),/Unknown/);
 a.equal(fs.readFileSync(require.resolve('../cotizador/ot-lifecycle-model'),'utf8').includes(Overlay.BRANCH),true);
});
