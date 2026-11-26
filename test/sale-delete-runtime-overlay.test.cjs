'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const O=require('../scripts/lib/sale-delete-runtime-overlay.cjs'),HF=require('../scripts/lib/sale-delete-history-financial-runtime-overlay.cjs');
const native=process.env.SV_SALE_DELETE_NATIVE20_ROOT,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function input(){const sources=Object.fromEntries(O.SOURCES.map(n=>[n,fs.readFileSync(path.join(__dirname,'../cotizador',n))]));return {baselines:Object.fromEntries(HF.NAMES.map(n=>[n,fs.readFileSync(path.join(native,n))])),sources,expectedBaseHashes:HF.BASE_HASHES,expectedSourceHashes:Object.fromEntries(Object.entries(sources).map(([n,b])=>[n,sha(b)]))};}
test('delete overlay requires an exact reviewed source set',()=>a.throws(()=>O.derive({sources:{}}),{code:'SV_SALE_DELETE_RUNTIME_OVERLAY'}));
test('delete extension reverses to the H/Financial native derivation and mounts only its route',{skip:!native},()=>{
 const args=input(),result=O.derive(args),select=v=>Object.fromEntries(HF.SOURCES.map(n=>[n,v[n]]));
 const original=HF.derive({...args,sources:select(args.sources),expectedSourceHashes:select(args.expectedSourceHashes)});
 for(const[n,hs]of Object.entries(result.hunks)){let text=result.files[n].toString();for(const h of [...hs].reverse()){a.equal(text.split(h.after).length,2);text=text.replace(h.after,h.before);}a.equal(text,original.files[n].toString().replace(/\r\n/g,'\n'));}
 for(const n of O.MODULES)a.deepEqual(result.files[n],args.sources[n]);
 const index=result.files['index.js'].toString();a(index.includes("pathname==='/comerciales/ventas/eliminar'"));a(index.includes("saleDelete:{version:1,enabled:saleDeleteService.capability()}"));a(!index.includes('purchaseDeleteService'));a(!index.includes('clientHistoryService'));
 a.equal(result.manifest.activation,false);a.equal(Object.keys(result.files).length,17);
 a(result.files['labor-guard.js'].toString().includes("'stock.ajustar':['stockoficina'"));
});
for(const fault of ['hash','extra','dependency','dynamic'])test('delete overlay rejects '+fault,{skip:!native},()=>{
 const args=input();if(fault==='hash')args.expectedSourceHashes['sale-delete-command.js']='0'.repeat(64);
 if(fault==='extra')args.sources['unknown.js']=Buffer.from('');
 if(['dependency','dynamic'].includes(fault)){const n='sale-delete-command.js';args.sources[n]=Buffer.concat([args.sources[n],Buffer.from(fault==='dependency'?"\nrequire('./unknown');":"\nrequire(input.name);")]);args.expectedSourceHashes[n]=sha(args.sources[n]);}
 a.throws(()=>O.derive(args),{code:'SV_SALE_DELETE_RUNTIME_OVERLAY'});
});
