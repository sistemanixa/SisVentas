'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLaborGuard,child,put,parts,digest}=require('../cotizador/labor-guard');
const Index=require('../cotizador/payment-membership-index');
const generation='guard-test-generation';
function fixture({coverage=true,payments={p:{ventaId:'V-0001',monto:25.01}}}={}){
 let clock=1000,sequence=0,operation=0;const data={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{user:{activo:true,rol:'admin'}},sv_permisos:{admin:{}},sisventas:{pagos:structuredClone(payments),ventas:{v:{id:'V-0001',total:100,totalPagado:25.01,estadoPago:'seniado'}},comisiones:{existing:{monto:5,estado:'aprobada'}}}},calls={reads:[],userReads:[],commits:[],aborts:[],acquires:[]};
 function set(path,value){const next=JSON.parse(JSON.stringify(Index.normalizeRtdb(put(data,parts(path),value))));for(const key of Object.keys(data))delete data[key];Object.assign(data,next);}
 if(coverage)for(const [path,value]of Object.entries(Index.buildIndex(payments,{generation,ready:true}).patch))set(path,value);
 const store={read:async path=>{calls.reads.push(path);return child(data,parts(path));},readAsUser:async(path,actor)=>{calls.userReads.push({path,actor:structuredClone(actor)});return child(data,parts(path));},acquire:async lease=>{calls.acquires.push({...lease});data.sv_labor_guard={...lease};},commit:async(patch,lease)=>{assert.equal(data.sv_labor_guard.fence,lease.fence);assert.ok(patch['sv_labor_receipts/'+lease.opId]);assert.equal(patch.sv_labor_guard,null);calls.commits.push(structuredClone(patch));for(const [path,value]of Object.entries(patch))set(path,value);},abort:async lease=>{calls.aborts.push(lease.fence);if(data.sv_labor_guard?.fence===lease.fence)delete data.sv_labor_guard;},query:async()=>{throw Error('No root/query needed');}};
 const guard=createLaborGuard({store,now:()=>clock,uuid:()=> 'internal-operation-'+(++sequence),delay:async()=>{}});
 const actor=extra=>({uid:'user',claims:{uid:'user',svAccessVersion:'fictitious'},mode:'user',operation:'payment-registrar',opId:'client-operation-'+(++operation),...extra});
 const read=path=>child(data,parts(path));
 function assertIndex(){const cfg=read(Index.COVERAGE_PATH),expected=Index.buildIndex(data.sisventas.pagos,{generation,ready:true,sequence:cfg.sequence}),target={};for(const [path,value]of Object.entries(expected.patch))Object.assign(target,put(target,parts(path),value));assert.equal(Index.canonical(Index.normalizeRtdb(read(Index.INDEX_ROOT))),Index.canonical(Index.normalizeRtdb(child(target,parts(Index.INDEX_ROOT)))));}
 return{data,calls,store,guard,actor,set,read,assertIndex,advance(ms){clock+=ms;}};
}
test('pago, resumen, grupo, comprobante, índice, cobertura, recibo y liberación se confirman en un PATCH',async()=>{
 const f=fixture(),commissions=structuredClone(f.data.sisventas.comisiones);await f.guard.run(f.actor(),async scope=>{await scope.update({'sisventas/pagos/new':{ventaFbKey:'v',monto:10.25},'sisventas/ventas/v/totalPagado':35.26,'sisventas/ventas/v/estadoPago':'seniado','sisventas/cobros_grupos/group':{pagos:['new']},'sisventas/cobros_adjuntos/group':{nombre:'ficticio.pdf'}});return{ok:true};});assert.equal(f.calls.commits.length,1);const patch=f.calls.commits[0];assert.ok(patch[Index.reversePath('new')]);assert.equal(patch[Index.COVERAGE_PATH].sequence,1);assert.deepEqual(f.data.sisventas.comisiones,commissions);f.assertIndex();assert.ok(f.calls.reads.every(path=>path!=='sisventas/pagos'&&path!=='sisventas'));
});
test('cambio por hijos retira buckets comerciales y agrega técnicos en el mismo acuse',async()=>{
 const f=fixture(),old=f.read(Index.reversePath('p'));await f.guard.run(f.actor({operation:'legacy-compare',input:{purpose:'relationship-normalization',kind:'compare',path:'sisventas/pagos/p',expectedHash:digest(f.data.sisventas.pagos.p)}}),scope=>scope.update({'sisventas/pagos/p/ventaFbKey':'v'}));for(const relative of old.tokenPaths)assert.equal(f.read(Index.INDEX_ROOT+'/'+relative+'/p'),null);assert.equal(f.read(Index.reversePath('p')).hasTechnicalRefs,true);f.assertIndex();assert.equal(f.calls.commits.length,1);
});
for(const action of ['annul','attachment','delete','deleteLastField'])test('delta '+action+' conserva cobertura completa sin scan',async()=>{
 const payments=action==='deleteLastField'?{p:{monto:1}}:undefined,f=fixture({payments});const patch=action==='annul'?{'sisventas/pagos/p/anulado':true}:action==='attachment'?{'sisventas/pagos/p/comprobante':{nombre:'ficticio.pdf'}}:action==='delete'?{'sisventas/pagos/p':null}:{'sisventas/pagos/p/monto':null};await f.guard.run(f.actor({operation:action==='annul'?'payment-anular':'legacy-patch'}),scope=>scope.update(patch));f.assertIndex();assert.equal(f.read(Index.COVERAGE_PATH).sequence,1);assert.equal(f.read(Index.COVERAGE_PATH).paymentCount,action.startsWith('delete')?0:1);assert.ok(!f.calls.reads.includes('sisventas/pagos'));
});
test('lote toca cada registro una vez y secuencia una vez, conservando todos los cambios staged',async()=>{
 const f=fixture();await f.guard.run(f.actor(),async scope=>{await scope.update({'sisventas/pagos/p/monto':30});await scope.update({'sisventas/pagos/p/comprobante/nombre':'uno.pdf','sisventas/pagos/q':{ventaId:'V-0002',monto:2}});await scope.update({'sisventas/pagos/q/estado':'anulado'});});f.assertIndex();assert.equal(f.read(Index.COVERAGE_PATH).sequence,1);assert.equal(f.calls.reads.filter(path=>path==='sisventas/pagos/p').length,1);assert.equal(f.calls.reads.filter(path=>path==='sisventas/pagos/q').length,1);
});
test('sin cobertura sólo mantiene contrato histórico y no afirma haber mantenido el índice',async()=>{
 const f=fixture({coverage:false});await f.guard.run(f.actor({operation:'legacy-patch'}),scope=>scope.update({'sisventas/pagos/new':{ventaId:'V-0001',monto:2},'sisventas/ventas/v/totalPagado':27.01}));assert.equal(f.calls.commits.length,1);assert.equal(f.read(Index.COVERAGE_PATH),null);assert.ok(!Object.keys(f.calls.commits[0]).some(path=>path.startsWith(Index.INDEX_ROOT)));
});
for(const corrupt of ['notReady','matcher','metadataMissing','metadataChanged'])test('índice '+corrupt+' falla cerrado antes de cualquier commit',async()=>{
 const f=fixture();if(corrupt==='notReady')f.set(Index.COVERAGE_PATH,{...f.read(Index.COVERAGE_PATH),ready:false});if(corrupt==='matcher')f.set(Index.COVERAGE_PATH,{...f.read(Index.COVERAGE_PATH),matcherHash:'0'.repeat(64)});if(corrupt==='metadataMissing')f.set(Index.reversePath('p'),null);if(corrupt==='metadataChanged')f.set(Index.reversePath('p'),{...f.read(Index.reversePath('p')),tokenPaths:[]});const before=structuredClone(f.data.sisventas);await assert.rejects(f.guard.run(f.actor(),scope=>scope.update({'sisventas/pagos/p/monto':50,'sisventas/ventas/v/totalPagado':50})),{code:'SV_PAYMENT_INDEX_INVALID'});assert.equal(f.calls.commits.length,0);assert.deepEqual(f.data.sisventas,before);assert.equal(f.data.sv_labor_guard,undefined);
});
for(const path of ['sisventas','sisventas/pagos',Index.COVERAGE_PATH,Index.INDEX_ROOT+'/technical/forged/p'])test('no acepta sustitución por raíz ni pertenencia fabricada: '+path,async()=>{
 const f=fixture();await assert.rejects(f.guard.run(f.actor(),scope=>scope.update({[path]:{forged:true}})),{statusCode:400});assert.equal(f.calls.commits.length,0);f.assertIndex();
});
for(const action of ['new','amount','state','relation'])test('escritor antiguo '+action+' no confirma cobro/saldo obsoleto con cobertura activa',async()=>{
 const f=fixture(),patch={'sisventas/ventas/v/totalPagado':99};if(action==='new')patch['sisventas/pagos/new']={ventaFbKey:'v',monto:99};if(action==='amount')patch['sisventas/pagos/p/monto']=99;if(action==='state')patch['sisventas/pagos/p/anulado']=true;if(action==='relation')patch['sisventas/pagos/p/ventaFbKey']='other';await assert.rejects(f.guard.run(f.actor({operation:'legacy-patch'}),scope=>scope.update(patch)),{code:'SV_PAYMENT_WRITER_VERSION'});assert.equal(f.calls.commits.length,0);f.assertIndex();
});
for(const field of ['monto','importe','montoOriginal','montoUSD','tipoCambio','moneda','anulado','estado'])test('escritor antiguo no altera '+field+' aun sin tocar resumen Venta',async()=>{
 const f=fixture();await assert.rejects(f.guard.run(f.actor({operation:'legacy-patch'}),scope=>scope.update({['sisventas/pagos/p/'+field]:field==='estado'?'anulado':field==='moneda'?'USD':99})),{code:'SV_PAYMENT_WRITER_VERSION'});assert.equal(f.calls.commits.length,0);f.assertIndex();
});
for(const condition of ['noCAS','wrongHash','childCAS','notAdmin','overrideDenied','noPurpose'])test('normalización legacy exige administrador y CAS completo: '+condition,async()=>{
 const f=fixture(),input={purpose:'relationship-normalization',kind:'atomic',expectedHashes:{'sisventas/pagos/p':digest(f.data.sisventas.pagos.p)}};if(condition==='noCAS')delete input.expectedHashes;if(condition==='wrongHash')input.expectedHashes['sisventas/pagos/p']='0'.repeat(64);if(condition==='childCAS')input.expectedHashes={'sisventas/pagos/p/ventaId':digest('V-0001')};if(condition==='notAdmin')f.set('sv_chat_roles/user',{activo:true,rol:'administrativo'});if(condition==='overrideDenied')f.set('sv_permisos/admin',{acciones:{mantenimiento:{normalizar:false}}});if(condition==='noPurpose')delete input.purpose;await assert.rejects(f.guard.run(f.actor({operation:'legacy-atomic',input}),scope=>scope.update({'sisventas/pagos/p/ventaFbKey':'v'})),{code:'SV_PAYMENT_RELATION_MAINTENANCE_REQUIRED'});assert.equal(f.calls.commits.length,0);f.assertIndex();
});
test('borrado de huérfano y adjunto legacy no exigen leer una venta que ya no existe',async()=>{
 const f=fixture();delete f.data.sisventas.ventas;await f.guard.run(f.actor({operation:'legacy-patch'}),scope=>scope.update({'sisventas/pagos/p/comprobante/nombre':'doc.pdf'}));await f.guard.run(f.actor({operation:'legacy-set'}),scope=>scope.update({'sisventas/pagos/p':null}));assert.ok(!f.calls.reads.some(path=>path.startsWith('sisventas/ventas')));assert.equal(f.calls.commits.length,2);f.assertIndex();
});
test('fallo del commit conserva negocio/índice y acuse perdido confirmado se recupera sin duplicar',async()=>{
 const f=fixture(),original=f.store.commit;f.store.commit=async()=>{throw Error('Fallo ficticio antes del commit');};await assert.rejects(f.guard.run(f.actor(),scope=>scope.update({'sisventas/pagos/p/monto':35})),/Fallo ficticio/);assert.equal(f.data.sisventas.pagos.p.monto,25.01);f.assertIndex();const actor=f.actor();let work=0;f.store.commit=async(...args)=>{await original(...args);throw Error('Acuse perdido ficticio');};const callback=async scope=>{work++;await scope.update({'sisventas/pagos/q':{ventaId:'V-2',monto:2}});return{ok:true};};await assert.rejects(f.guard.run(actor,callback),/Acuse perdido/);assert.deepEqual(await f.guard.run(actor,callback),{ok:true});assert.equal(work,1);assert.equal(f.read(Index.COVERAGE_PATH).sequence,1);f.assertIndex();
});
test('dos guardados seriales reutilizan la nueva cobertura sin perder miembros',async()=>{
 const f=fixture();await Promise.all(['a','b'].map(key=>f.guard.run(f.actor(),scope=>scope.update({['sisventas/pagos/'+key]:{ventaKey:'v',monto:1}}))));assert.equal(f.calls.commits.length,2);assert.equal(f.read(Index.COVERAGE_PATH).sequence,2);assert.equal(f.read(Index.COVERAGE_PATH).paymentCount,3);f.assertIndex();
});
test('getAsUser usa autorización real una vez y reusa imagen en delta, sin GET de servicio duplicado',async()=>{
 const f=fixture();await f.guard.run(f.actor(),async scope=>{const current=await scope.getAsUser('sisventas/pagos/p');current.monto=999;assert.equal((await scope.getAsUser('sisventas/pagos/p')).monto,25.01);await scope.update({'sisventas/pagos/p/monto':30});assert.equal((await scope.getAsUser('sisventas/pagos/p')).monto,30);});assert.equal(f.calls.userReads.length,1);assert.equal(f.calls.userReads[0].actor.uid,'user');assert.equal(f.calls.userReads[0].actor.claims.uid,'user');assert.equal(f.calls.reads.filter(path=>path==='sisventas/pagos/p').length,0);f.assertIndex();
});
for(const previous of ['exact','ancestor','child'])test('getAsUser compara raw '+previous+' sólo después de autorizar y rechaza divergencia',async()=>{
 const f=fixture();await assert.rejects(f.guard.run(f.actor(),async scope=>{await scope.get(previous==='exact'?'sisventas/pagos/p':previous==='ancestor'?'sisventas/pagos':'sisventas/pagos/p/monto');f.set('sisventas/pagos/p/monto',40);await scope.getAsUser('sisventas/pagos/p');}),{code:'SV_CAS_CONFLICT'});assert.equal(f.calls.userReads.length,1);assert.equal(f.calls.commits.length,0);
});
test('GET Admin previo no sustituye permiso de lectura y la denegación no se convierte en null',async()=>{
 const f=fixture();f.store.readAsUser=async()=>{throw Object.assign(Error('Acceso ficticio denegado'),{statusCode:403});};await assert.rejects(f.guard.run(f.actor(),async scope=>{await scope.get('sisventas/pagos/p');await scope.getAsUser('sisventas/pagos/p');}),{statusCode:403});assert.equal(f.calls.commits.length,0);
});
test('la caché autenticada vive sólo dentro de una solicitud y otro intento vuelve a autorizar',async()=>{
 const f=fixture();await f.guard.run(f.actor(),scope=>scope.getAsUser('sisventas/pagos/p'));f.store.readAsUser=async()=>{throw Object.assign(Error('Revocado'),{statusCode:403});};await assert.rejects(f.guard.run(f.actor(),scope=>scope.getAsUser('sisventas/pagos/p')),{statusCode:403});assert.equal(f.calls.commits.length,1);
});
test('lectura autenticada que vence el fence no se reutiliza ni confirma',async()=>{
 const f=fixture(),original=f.store.readAsUser;f.store.readAsUser=async(...args)=>{const result=await original(...args);f.advance(30001);return result;};await assert.rejects(f.guard.run(f.actor(),scope=>scope.getAsUser('sisventas/pagos/p')),{code:'SV_LABOR_LEASE_EXPIRED'});assert.equal(f.calls.commits.length,0);
});
for(const actor of [{mode:'server',uid:'user',claims:{uid:'user'}},{mode:'user',uid:'user',claims:{uid:'other'}},{mode:'user',uid:'user',claims:null}])test('getAsUser rechaza identidad no verificada '+JSON.stringify(actor),async()=>{
 const f=fixture();await assert.rejects(f.guard.run(f.actor(actor),scope=>scope.getAsUser('sisventas/pagos/p')),{statusCode:403});assert.equal(f.calls.userReads.length,0);assert.equal(f.calls.commits.length,0);
});
