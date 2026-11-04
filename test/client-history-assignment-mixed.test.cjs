'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const {apply}=require('./helpers/labor-ui-flow.cjs');
const Access=require('../cotizador/client-history-access'),Query=require('../cotizador/client-history-query'),Account=require('../cotizador/client-account-projection');
async function fixture({mixed=false,denyOwn=false}={}){
 const records={own:{id:'OT-OWN',clienteFbKey:'c',tecnicoFbKey:'e',responsableUid:'u',fecha:'2026-11-01'}};
 if(mixed)records.foreign={id:'OT-FOREIGN',clienteFbKey:'c',tecnicoFbKey:'other',responsableUid:'other',fecha:'2026-11-02'};
 const backend=await createCoordinatedBackend({ordenes_trabajo:records}),userReads=[];
 apply(backend.state,{'sv_empleado_uid/u':{perfilFbKey:'profile'}});
 apply(backend.state,{'sv_chat_roles/u':{rol:'vendedor',activo:true},'sv_permisos/vendedor':{indiceVersion:2,indiceRevision:1,indiceModulos:{clientes:true,ordentrabajo:true},acciones:{ot:{verTodas:false}}},'sv_usuarios/profile':{uid:'u',rol:'vendedor',activo:true,empleadoFbKey:'e'},'sisventas/empleados/e':{uid:'u',activo:true}});
 const db={ref:path=>({get:async()=>({val:()=>backend.get(path)}),orderByChild:field=>({equalTo:value=>({get:async()=>({val:()=>Object.fromEntries(Object.entries(backend.get(path)||{}).filter(([,row])=>row[field]===value))})})})})};
 const access=Access.create({auth:{verifyIdToken:async(_,revoked)=>{assert.equal(revoked,true);return {uid:'u'};}},db,readAsUser:async path=>{userReads.push(path);if(path.endsWith('/foreign')||denyOwn&&path.endsWith('/own'))throw Object.assign(Error('Fixture original access denied'),{statusCode:403});return backend.get(path);}});
 const request={headers:{authorization:'Bearer fixture'}};
 const reader=Query.create({trustedAuthorize:()=>access.authorize(request),readOriginal:access.readOriginal,readHistoryOriginal:access.readHistoryOriginal,verifyHistoryOriginal:access.verifyHistoryOriginal,read:async path=>backend.get(path),query:async(path,{after,limit})=>Object.fromEntries(Object.entries(backend.get(path)||{}).filter(([key])=>!after||key>after).sort(([left],[right])=>left.localeCompare(right)).slice(0,limit))});
 return {backend,userReads,reader,input:{accountId:Account.hash('client:c'),domain:'ordenes_trabajo'}};
}
test('real Access and Query show a key-assigned own OT',async()=>{const f=await fixture(),result=await f.reader.page(f.input);assert.equal(result.totalRows,1);assert.deepEqual(result.rows.map(row=>row.key),['own']);assert.equal(f.backend.commits.length,0);});
test('mixed client excludes foreign assignment before user original read and retains own totals',async()=>{const f=await fixture({mixed:true}),result=await f.reader.page(f.input);assert.equal(result.totalRows,1);assert.equal(result.totals.rows,1);assert.deepEqual(result.rows.map(row=>row.key),['own']);assert(!f.userReads.some(path=>path.endsWith('/foreign')));assert.equal(f.backend.commits.length,0);});
test('denied own original remains an error rather than a complete zero',async()=>{const f=await fixture({denyOwn:true});await assert.rejects(f.reader.page(f.input),{statusCode:403});assert.equal(f.backend.commits.length,0);});
