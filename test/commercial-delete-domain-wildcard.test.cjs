'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../scripts/lib/commercial-delete-domain-wildcard.cjs'),Parent=require('../scripts/lib/commercial-delete-sales-parent.cjs'),Atomic=require('../scripts/lib/commercial-delete-atomic-rules.cjs'),F=require('./helpers/commercial-delete-atomic-fixture.cjs');
function baseline(){const b=F.baseline();b.rules.sisventas.$dominio={'.read':"auth != null && auth.uid === 'u'",'.write':"auth != null && (auth.uid === 'u' || auth.token.svLaborService === true) && (!data.child('locked').exists())"};return b;}
function allowed(rule,domain,uid,service,lease,locked=false){const before={sisventas:{[domain]:locked?{locked:true}:{}},...(lease?{sv_labor_guard:{expiresAt:Date.now()+60000}}:{})};return new Function('root','data','newData','auth','now','$dominio','return ('+rule+');')(new F.Snapshot(before),new F.Snapshot(before,['sisventas',domain]),new F.Snapshot(before,['sisventas',domain]),{uid,token:{svLaborService:service}},Date.now(),domain);}
for(const domain of ['ventas','ordenes','ordenes_trabajo','equipos','tickets','agenda','gastos','configuracion','unrelated'])for(const service of [false,true])for(const lease of [false,true])test('leaf wildcard narrows only destructive roots: '+domain+' service='+service+' lease='+lease,()=>{
 const b=baseline(),copy=structuredClone(b),out=W.prepare(b);assert.deepEqual(b,copy);assert.equal(out.rules.sisventas.$dominio['.read'],b.rules.sisventas.$dominio['.read']);
 for(const uid of ['u','other'])for(const locked of [false,true]){const original=allowed(b.rules.sisventas.$dominio['.write'],domain,uid,service,lease,locked),after=allowed(out.rules.sisventas.$dominio['.write'],domain,uid,service,lease,locked);assert.equal(after,['ventas','ordenes','ordenes_trabajo'].some(name=>name===domain)?false:original);}
 assert.equal(W.recognized('$dominio',out.rules.sisventas.$dominio),true);assert.deepEqual(W.prepare(out),out);
});
for(const variation of ['name','children','validate','index','boolean','array','root','parent','unwrapped'])test('unknown wildcard authority remains rejected: '+variation,()=>{
 const b=baseline();if(variation==='name'){b.rules.sisventas.$other=b.rules.sisventas.$dominio;delete b.rules.sisventas.$dominio;}if(variation==='children')b.rules.sisventas.$dominio.$id={'.write':'true'};if(variation==='validate')b.rules.sisventas.$dominio['.validate']='true';if(variation==='index')b.rules.sisventas.$dominio['.indexOn']=['id'];if(variation==='boolean')b.rules.sisventas.$dominio['.write']=true;if(variation==='array')b.rules.sisventas.$dominio=[];if(variation==='root')b.rules['.write']='true';if(variation==='parent')b.rules.sisventas['.write']='true';
 if(variation==='unwrapped')assert.throws(()=>Atomic.prepare(b));else assert.throws(()=>W.prepare(b));
});
test('Atomic accepts only exact restricted leaf; helper must run after intermediate envelopes',()=>{
 const b=W.prepare(baseline());assert.doesNotThrow(()=>Atomic.prepare(b));b.rules.sisventas.$dominio['.write']='('+b.rules.sisventas.$dominio['.write']+') && true';assert.throws(()=>Atomic.prepare(b));assert.doesNotThrow(()=>Atomic.prepare(W.prepare(b)));
});
test('forged outer wrapper cannot place OR true outside the original operand',()=>{
 const b=baseline(),injected='false) || true || (false';
 b.rules.sisventas.$dominio['.write']='('+injected+") && ($dominio !== 'ventas' && $dominio !== 'ordenes' && $dominio !== 'ordenes_trabajo')";
 assert.equal(W.recognized('$dominio',b.rules.sisventas.$dominio),false);assert.throws(()=>Atomic.prepare(b));
 const raw=baseline();raw.rules.sisventas.$dominio['.write']=injected;assert.throws(()=>W.prepare(raw));
});
for(const expression of ["auth.uid === 'a) || true || (b'",'auth.uid === "a) || true || (b"',String.raw`auth.uid === 'a\'b)('`,String.raw`auth.uid === "a\"b)("`,"(auth != null && (auth.uid === 'u'))"])test('balanced original keeps parentheses inside quoted strings: '+expression,()=>{
 const b=baseline();b.rules.sisventas.$dominio['.write']=expression;const out=W.prepare(b);assert(W.recognized('$dominio',out.rules.sisventas.$dominio));assert.doesNotThrow(()=>Atomic.prepare(out));
});
for(const expression of ['false)', '(false',"auth.uid === 'unterminated",String.raw`auth.uid === 'escaped\'`,String.raw`false /* ( */ ) || true || (false /* ) */`,'/[(]/.test(auth.uid) || false) || true || (false','`false) || true`'])test('unsupported or unbalanced original fails closed: '+expression,()=>{
 const b=baseline();b.rules.sisventas.$dominio['.write']=expression;assert.throws(()=>W.prepare(b));
});
test('retained exact baseline composes without writing rules or exposing its contents',{skip:!process.env.SV_DELETE_RETAINED_RULES_FILE},()=>{
 const fs=require('node:fs'),crypto=require('node:crypto'),bytes=fs.readFileSync(process.env.SV_DELETE_RETAINED_RULES_FILE),sha=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(sha,process.env.SV_DELETE_RETAINED_RULES_SHA256);
 const baseline=JSON.parse(bytes),copy=structuredClone(baseline),candidate=require('../scripts/lib/commercial-delete-full-cut-rules.cjs').prepare(baseline);assert.deepEqual(baseline,copy);
 const original=baseline.rules.sisventas.$dominio['.write'],restricted=W.prepare(baseline).rules.sisventas.$dominio['.write'];let allowedControls=0;
 for(const domain of ['custom','other_public','_private','ventas','ordenes','ordenes_trabajo','agenda'])for(const uid of ['u','other','sv-labor-service'])for(const live of [false,true]){
  const root={sv_chat_roles:{[uid]:{activo:true,rol:uid==='other'?'tecnico':'admin'}},sv_permisos:{admin:{indiceVersion:2,indiceModulos:{configuracion:true}}},...(live?{sv_labor_guard:{expiresAt:Date.now()+60000}}:{})},auth={uid,token:{svLaborService:uid==='sv-labor-service',svPasswordChangeRequired:false}};
  const evaluate=rule=>new Function('root','auth','$dominio','return ('+rule.replaceAll('.beginsWith(','.startsWith(')+');')(new F.Snapshot(root),auth,domain);
  const before=evaluate(original),after=evaluate(restricted);assert.equal(after,['ventas','ordenes','ordenes_trabajo'].some(name=>name===domain)?false:before,domain+'/'+uid+'/'+live);if(before&&domain==='custom')allowedControls++;
 }
 assert(allowedControls>0,'actual retained wildcard comparison must include non-vacuous authorized controls');
 assert.equal(candidate.rules.sisventas.ventas['.write'],false);assert(W.recognized('$dominio',candidate.rules.sisventas.$dominio));console.log(JSON.stringify({baselineSha256:sha,candidateSha256:crypto.createHash('sha256').update(JSON.stringify(candidate)).digest('hex'),offlineOnly:true}));
});
