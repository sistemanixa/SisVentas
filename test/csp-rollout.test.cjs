const test=require('node:test'),assert=require('node:assert/strict');
const {config}=require('../scripts/deploy-secure-hosting.cjs');
test('CSP efectiva bloquea eval sin activar informes externos ni retirar aún compatibilidad inline',()=>{
 const headers=config.headers[0].headers,current=headers['Content-Security-Policy'];
 assert.doesNotMatch(current,/unsafe-eval|report-uri|report-to|report-sample/);
 for(const name of ['object-src','base-uri','frame-ancestors','worker-src'])assert.match(current,new RegExp(name));
 assert.match(current,/'unsafe-inline'/);
 assert.match(current,/script-src 'self' 'unsafe-inline' https:\/\/www.gstatic.com/);
});
