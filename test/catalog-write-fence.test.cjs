'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{prepare}=require('../scripts/lib/catalog-write-fence-rules.cjs');
test('candidate gates parent, children and overlapping wildcards without mutating originals',()=>{
 const input={rules:{'.write':false,sisventas:{'.write':false,productos:{'.write':'auth != null',alias:{'.write':'auth != null'},'$product':{'.write':'auth != null',codigo:{'.write':'auth != null'}}},'$domain':{'.write':'auth != null','$record':{'.write':'auth != null'}}}}};
 const before=structuredClone(input),out=prepare(input);assert.deepEqual(input,before);assert.deepEqual(prepare(out),out);
 for(const n of [out.rules.sisventas.productos,out.rules.sisventas.productos.alias,out.rules.sisventas.productos.$product,out.rules.sisventas.productos.$product.codigo,out.rules.sisventas.$domain,out.rules.sisventas.$domain.$record])assert.match(n['.write'],/sv_labor_guard/);
 assert.match(out.rules.sisventas.$domain['.write'],/^\(\$domain === 'productos'\) \?/);
 assert.equal(out.rules.sisventas.productos['.write'].includes('auth != null'),true);
});
test('candidate refuses open ancestors including overlapping wildcard ancestors',()=>{
 for(const input of [{rules:{'.write':true}},{rules:{sisventas:{'.write':'auth != null'}}},{rules:{$root:{'.write':'auth != null'}}}])assert.throws(()=>prepare(input),/ancestro/);
});
