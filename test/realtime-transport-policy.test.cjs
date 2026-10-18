const {test}=require('node:test');
const assert=require('node:assert/strict');
const {config}=require('../scripts/deploy-secure-hosting.cjs');
const policy=config.headers[0].headers['Content-Security-Policy'];
const scripts=policy.split(';').map(s=>s.trim()).find(s=>s.startsWith('script-src ')).split(/\s+/).slice(1);
// Evalúa los sources externos relevantes según sus límites de esquema/host/path.
function allows(value){const u=new URL(value);return scripts.some(source=>{if(!source.startsWith('https://'))return false;const s=new URL(source.replace('*.','wildcard.'));const host=s.hostname.startsWith('wildcard.')?u.hostname.endsWith('.'+s.hostname.slice(9)):s.hostname===u.hostname;return u.protocol===s.protocol&&host&&(s.pathname==='/'||s.pathname===u.pathname);});}
test('política permite el transporte RTDB tras un fallo de WebSocket, incluidos shards dinámicos',()=>{
 for(const host of ['nixa-sisventas-default-rtdb.firebaseio.com','s-usc1c-nss-123.firebaseio.com'])assert.equal(allows('https://'+host+'/.lp?start=t&ser=1'),true);
});
test('excepción RTDB se limita al endpoint del transporte y conserva las protecciones',()=>{
 for(const url of ['https://evil.example/.lp','https://nixa-sisventas-default-rtdb.firebaseio.com/untrusted.js','http://nixa-sisventas-default-rtdb.firebaseio.com/.lp'])assert.equal(allows(url),false);
 for(const directive of ["object-src 'none'","frame-ancestors 'self'","base-uri 'self'"])assert.ok(policy.includes(directive));
 assert.ok(!scripts.includes('https:')&&!scripts.includes('*'));
});
