'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../cotizador/sale-delete-target-index'),D=require('../cotizador/sale-delete-target-index-delta'),F=require('../cotizador/sale-financial-dependencies-model'),Provider=require('../cotizador/sale-financial-dependencies-provider'),P=require('../cotizador/payment-membership-index');
const clone=structuredClone;
function get(tree,path){let v=tree;for(const p of path.split('/')){if(v==null||!Object.hasOwn(v,p))return null;v=v[p];}return clone(v);}
function put(tree,path,value){const keys=path.split('/');let v=tree;for(const k of keys.slice(0,-1)){if(!v[k])v[k]={};v=v[k];}if(value===null)delete v[keys.at(-1)];else Object.defineProperty(v,keys.at(-1),{value:clone(value),writable:true,enumerable:true,configurable:true});}
function apply(tree,patch){for(const[p,v]of Object.entries(patch))put(tree,p,v);return P.normalizeRtdb(tree)||{};}
function sources(){return Object.fromEntries(M.roots.map(path=>[path,null]));}
function seed(){return {...sources(),'sisventas/ventas':{a:{id:'V-01',total:10},b:{id:'V-02',total:20}},'sisventas/pagos':{pay:{ventaFbKey:'a',ventaId:'V-02',monto:2}},'sisventas/ordenes_trabajo':{ot:{ventaFbKey:'a',id:'OT-4',materiales:[]}},'sisventas/presupuestos':{budget:{numero:'P-5',ventaGeneradaFbKey:'a'}},'sisventas/reclamos':{claim:{otId:'OT-4'}},'sisventas/agenda':{meet:{ventaId:'V-02'}},'sisventas/gastos':{g:{ventaFbKey:'b',monto:7}},'sisventas/ctaemp':{employee:{m:{ventaFbKey:'b',monto:4}}},'sv_commission_generation':{b:{id:'batch',monto:3}}};}
function treeFromSources(s){const t={};for(const[p,v]of Object.entries(s))put(t,p,v);return P.normalizeRtdb(t)||{};}
async function prepared(s=seed()){let tree=treeFromSources(s);const p=await M.prepare(s,{generation:'test-target-generation'});tree=apply(tree,p.patch);return {tree,p};}
const evidence=(tree,saleKey)=>Provider.create()({saleKey,read:path=>Promise.resolve(get(tree,path===F.ROOT||path.startsWith(F.ROOT+'/')?M.financialPath(path):path))});
function withoutRevisions(tree){tree=clone(tree);const coverage=get(tree,M.ROOT+'/coverage');coverage.revision=1;put(tree,M.ROOT+'/coverage',coverage);const financial=get(tree,M.FINANCIAL_ROOT+'/coverage');financial.revision=1;put(tree,M.FINANCIAL_ROOT+'/coverage',financial);return tree;}
test('bootstrap is one closed namespace, never PaymentIndex, History or financial installation',async()=>{
 const {tree,p}=await prepared();assert(Object.keys(p.patch).every(path=>path===M.CONFIG||path.startsWith(M.ROOT+'/')));assert.equal(get(tree,F.ROOT),null);assert.equal(get(tree,'sv_client_history'),null);assert.equal(get(tree,P.INDEX_ROOT),null);M.validateConfig(get(tree,M.CONFIG),get(tree,M.ROOT+'/coverage'));
 for(const [path,rows]of Object.entries(seed()))for(const[id,row]of Object.entries(rows||{})){if(path==='sisventas/ctaemp'){for(const[m,v]of Object.entries(row))M.validateRecord(path+'/'+id+'/'+m,v,get(tree,M.recordPath(path+'/'+id+'/'+m)));}else M.validateRecord(path+'/'+id,row,get(tree,M.recordPath(path+'/'+id)));}
 assert.equal((await evidence(tree,'a')).dependencies.length,0);assert((await evidence(tree,'b')).dependencies.length>=3);
});
test('technical references preserve priority and significant zero aliases',()=>{
 const image=M.image('sisventas/pagos/p',{ventaFbKey:'a',ventaId:'V-2',monto:1});assert.equal(image.tokens.length,1);assert.match(image.tokens[0],/^technical\//);const a=M.image('sisventas/ventas/a',{id:'V-01'}),b=M.image('sisventas/ventas/b',{id:'V-1'});assert.notDeepEqual(a.aliases,b.aliases);assert(a.aliases.includes('businessDigits/'+F.digest('01')));assert(b.aliases.includes('businessDigits/'+F.digest('1')));
});
test('candidate superset covers budget forward/reverse, claim identity and indirect OT activity',async()=>{
 const s=seed();s['sisventas/ventas'].a.presupuestoId='p-5';s['sisventas/ventas'].a.reclamoId='R-7';s['sisventas/reclamos'].claim.id='R-7';s['sisventas/tickets']={ticket:{ordenTrabajoFbKey:'ot'}};const {tree}=await prepared(s),paths=M.bucketPathsForSale({...s['sisventas/ventas'].a,fbKey:'a'}),ids=new Set();for(const p of paths)for(const id of Object.keys(get(tree,p)||{}))ids.add(id);
 for(const p of ['sisventas/pagos/pay','sisventas/ordenes_trabajo/ot','sisventas/presupuestos/budget','sisventas/reclamos/claim'])assert(ids.has(F.digest(p)),p);
 const otPaths=M.bucketPathsForOTs({ot:s['sisventas/ordenes_trabajo'].ot}),indirect=new Set();for(const p of otPaths)for(const id of Object.keys(get(tree,p)||{}))indirect.add(id);assert(indirect.has(F.digest('sisventas/reclamos/claim')));assert(indirect.has(F.digest('sisventas/tickets/ticket')));
});
test('sale alias ownership preserves collisions instead of selecting one owner',async()=>{
 const s=seed();s['sisventas/ventas'].b.id='V-01';s['sisventas/pagos'].pay={ventaId:'V-01',monto:1};const {tree}=await prepared(s),entry=M.image('sisventas/pagos/pay',s['sisventas/pagos'].pay);for(const p of M.saleOwnerBucketPaths(entry))assert.deepEqual(Object.keys(get(tree,p)||{}).sort(),['a','b']);
});
test('incremental relink, edits and removals equal a fresh preparation in every indexed value',async()=>{
 const s=seed(),initial=await prepared(s);let tree=initial.tree;const changes=[{path:'sisventas/pagos/pay',before:s['sisventas/pagos'].pay,after:{ventaFbKey:'b',monto:2}},{path:'sisventas/ordenes_trabajo/ot',before:s['sisventas/ordenes_trabajo'].ot,after:{ventaFbKey:'b',id:'OT-4',materiales:[]}},{path:'sisventas/gastos/g',before:s['sisventas/gastos'].g,after:null},{path:'sisventas/ventas/a',before:s['sisventas/ventas'].a,after:{id:'V-100',total:10}},{path:'sisventas/ctaemp/employee/new',before:null,after:{ventaFbKey:'a',monto:9}}];
 const readPaths=[];const patch=await D.delta({changes,read:async path=>{readPaths.push(path);assert(path.startsWith(M.ROOT+'/'));return get(tree,path);}});tree=apply(tree,patch);for(const c of changes){put(tree,c.path,c.after);const kind=M.classify(c.path);if(kind.domain==='ctaemp'){s[kind.root]??={};s[kind.root].employee??={};s[kind.root].employee[kind.key]=c.after;}else if(c.after===null)delete s[kind.root][kind.key];else s[kind.root][kind.key]=c.after;}
 const rebuilt=await prepared(s);assert.deepEqual(withoutRevisions(get(tree,M.ROOT)?{sv_sale_delete_relations:get(tree,'sv_sale_delete_relations')}:{ }),withoutRevisions({sv_sale_delete_relations:get(rebuilt.tree,'sv_sale_delete_relations')}));assert(readPaths.length>0);
});
test('each affected commit advances coverage even when its original is byte-identical',async()=>{
 const {tree}=await prepared(),before=get(tree,M.ROOT+'/coverage'),row=get(tree,'sisventas/ventas/a'),patch=await D.delta({changes:[{path:'sisventas/ventas/a',before:row,after:clone(row)}],read:p=>Promise.resolve(get(tree,p))});assert.equal(patch[M.ROOT+'/coverage'].revision,before.revision+1);assert.equal(patch[M.ROOT+'/coverage'].sourceAccumulator,before.sourceAccumulator);const next=await D.delta({changes:[],read:p=>Promise.resolve(get(tree,p))});assert.equal(next[M.ROOT+'/coverage'].revision,before.revision+1);
});
test('global unresolved financial source uses real Model/Provider veto',async()=>{
 const s=seed();s['sisventas/gastos'].unknown={tipo:'comision',monto:100};const {tree}=await prepared(s);await assert.rejects(evidence(tree,'a'),{code:'SV_SALE_FINANCIAL_INCOMPLETE'});
});
test('stale original, duplicate change and corrupt coordinates never create an applicable index delta',async()=>{
 const {tree}=await prepared();const change={path:'sisventas/pagos/pay',before:{ventaFbKey:'other',monto:1},after:null};await assert.rejects(D.delta({changes:[change],read:p=>Promise.resolve(get(tree,p))}),{code:'SV_SALE_DELETE_TARGET_INDEX'});const row=get(tree,'sisventas/pagos/pay'),same={...change,before:row};await assert.rejects(D.delta({changes:[same,same],read:p=>Promise.resolve(get(tree,p))}),{code:'SV_SALE_DELETE_TARGET_INDEX'});assert.throws(()=>M.validateRecord('sisventas/pagos/pay',row,{...M.image('sisventas/pagos/pay',row),key:'foreign'}),{code:'SV_SALE_DELETE_TARGET_INDEX'});
});
for(const value of [false,0,'',[],undefined])test('malformed complete source is never treated as empty: '+String(value),async()=>{const s=sources();s['sisventas/gastos']=value;await assert.rejects(M.prepare(s,{generation:'test-generation'}),{code:'SV_SALE_DELETE_TARGET_INDEX'});});
test('numeric-map/array wire normalization leaves nonempty token metadata exact and empty lists absent',async()=>{
 const s=sources();s['sisventas/ventas']={a:{id:'V-1'}};s['sisventas/agenda']={none:{titulo:'unrelated'}};const {tree}=await prepared(s),meta=get(tree,M.recordPath('sisventas/agenda/none'));assert(!Object.hasOwn(meta,'tokens'));M.validateRecord('sisventas/agenda/none',s['sisventas/agenda'].none,meta);M.validateRecord('sisventas/ventas/a',s['sisventas/ventas'].a,get(tree,M.recordPath('sisventas/ventas/a')));
});
test('financial and primary index paths are closed and bulk replacement is denied',()=>{assert.equal(M.originalPath('sisventas/pagos/a/monto'),'sisventas/pagos/a');assert.equal(M.originalPath('sisventas/ctaemp/e/m/monto'),'sisventas/ctaemp/e/m');assert.equal(M.originalPath('unrelated/a'),null);for(const p of ['sisventas','sisventas/pagos','sisventas/ctaemp/e','sv_commission_generation'])assert.throws(()=>M.originalPath(p),{code:'SV_SALE_DELETE_TARGET_INDEX'});assert.throws(()=>M.financialPath('sisventas/ventas/a'),{code:'SV_SALE_DELETE_TARGET_INDEX'});});
