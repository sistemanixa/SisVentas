'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{create}=require('../cotizador/dashboard-rtdb-read-db');
test('point reads and ordered/UID queries always fetch REST and preserve bounds',async()=>{
 const calls=[];let revision=1;const store=createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=> 'fixture-only',fetchImpl:async(url,init)=>{assert.equal(init.method,'GET');calls.push(new URL(url));return new Response(JSON.stringify(calls.at(-1).searchParams.has('orderBy')?{a:{revision}}:{revision}));}}),db=create({store});
 assert.equal((await db.ref('metadata').get()).val().revision,1);revision=2;assert.equal((await db.ref('metadata').get()).val().revision,2);
 await db.ref('sv_usuarios').orderByChild('uid').equalTo('u').limitToFirst(2).get();assert.equal(calls[2].searchParams.get('equalTo'),'"u"');assert.equal(calls[2].searchParams.get('limitToFirst'),'2');
 await db.ref('index').orderByKey().startAfter('a').limitToFirst(50).get();assert.equal(JSON.parse(calls[3].searchParams.get('startAt')),'a ');assert.equal(calls[3].searchParams.get('limitToFirst'),'50');assert.equal(calls.length,4);assert.equal(db.ref('metadata').set,undefined);
});
test('unbounded, foreign-field and oversized queries reject before credentials or network',async()=>{
 const store=createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=>assert.fail('No credentials'),fetchImpl:()=>assert.fail('No network')}),db=create({store});
 for(const query of [db.ref('index').orderByKey(),db.ref('index').orderByKey().limitToFirst(51),db.ref('sv_usuarios').orderByChild('uid').equalTo('u').limitToFirst(3),db.ref('sv_usuarios').orderByChild('rol').equalTo('admin').limitToFirst(2)])await assert.rejects(query.get(),{statusCode:400});
});
