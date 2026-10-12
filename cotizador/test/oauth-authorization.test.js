const test = require('node:test');
const assert = require('node:assert/strict');
const {createOAuthAuthorization} = require('../oauth-authorization');
function setup() {
  const records = new Map([['sv_chat_roles/admin', {activo:true, rol:'admin'}], ['sv_chat_roles/vendor', {activo:true, rol:'vendedor'}]]);
  const db = {ref:path => ({get:async()=>({val:()=>records.get(path)}), set:async v=>records.set(path,v), transaction:async fn=>{const next=fn(records.get(path));if(next===undefined)return {committed:false};records.set(path,next);return {committed:true};}})};
  const auth = {verifyIdToken:async token=>{if(token==='bad')throw Error();return {uid:token};}};
  return {guard:createOAuthAuthorization({auth,db,now:()=>1000}), records};
}
test('OAuth rechaza anónimo, token falso y rol inferior', async()=>{
  const {guard}=setup();
  for(const [token,status] of [['',401],['bad',401],['vendor',403]]) {
    await assert.rejects(guard.authorize({headers:{authorization:token?'Bearer '+token:''}}), e=>e.statusCode===status);
  }
  assert.equal(await guard.authorize({headers:{authorization:'Bearer admin'}}),'admin');
});
test('OAuth vincula estado al administrador y permite usarlo una sola vez',async()=>{
  const {guard}=setup();await guard.register('signed-state','admin');
  assert.equal(await guard.consume('signed-state'),'admin');
  await assert.rejects(guard.consume('signed-state'), e=>e.statusCode===400);
  await assert.rejects(guard.consume('unknown'), e=>e.statusCode===400);
});
test('OAuth vuelve a comprobar permisos del administrador en callback',async()=>{
  const {guard,records}=setup();await guard.register('state','admin');
  records.set('sv_chat_roles/admin',{activo:false,rol:'admin'});
  await assert.rejects(guard.consume('state'), e=>e.statusCode===403);
  records.set('sv_chat_roles/admin',{activo:true,rol:'admin'});records.set('sv_permisos/admin',{bloqueados:['configuracion']});
  await assert.rejects(guard.consume('state'), e=>e.statusCode===403);
});
test('OAuth vence el estado y resuelve dos callbacks concurrentes sin duplicar',async()=>{
  const {guard,records}=setup();await guard.register('expired','admin');
  const expired=[...records.keys()].find(k=>k.startsWith('sv_server_oauth_states/'));records.get(expired).expiresAt=999;
  await assert.rejects(guard.consume('expired'),e=>e.statusCode===400);
  await guard.register('concurrent','admin');
  const result=await Promise.allSettled([guard.consume('concurrent'),guard.consume('concurrent')]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
});
