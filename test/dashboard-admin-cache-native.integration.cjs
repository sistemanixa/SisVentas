'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),net=require('node:net'),{createRequire}=require('node:module');
const enabled=process.env.SV_ADMIN_CACHE_NATIVE==='1';
test('Admin get and active UID query reuse retained cache after acknowledged REST update; store REST stays fresh',{skip:!enabled,timeout:30000},async()=>{
 const host='127.0.0.1:9059',base='http://'+host,ns='demo-admin-cache-'+process.pid;assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,host);
 const deps=createRequire(path.join(process.env.SV_ADMIN_CACHE_MODULES||path.resolve('cotizador/node_modules'),'fixture.cjs'));let paused=false,wsWrites=0,app,db;const queued=[],sockets=new Set();let notify,stop,stopQuery;
 const originalWrite=net.Socket.prototype.write,originalEmit=net.Socket.prototype.emit;
 // Admin bundles its WebSocket implementation. Gate only the loopback WS socket,
 // leaving acknowledged REST responses and the real SDK cache algorithm intact.
 net.Socket.prototype.write=function(chunk,...args){if(String(chunk).startsWith('GET /.ws?'))sockets.add(this);if(sockets.has(this))wsWrites++;return originalWrite.call(this,chunk,...args);};
 net.Socket.prototype.emit=function(event,...args){if(paused&&event==='data'&&sockets.has(this)&&this.remotePort===9059){queued.push(()=>originalEmit.call(this,event,...args));notify?.();return true;}return originalEmit.call(this,event,...args);};
 async function owner(method,p,value){const u=new URL(p+'.json',base);u.searchParams.set('ns',ns);const r=await fetch(u,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(5000)});assert.equal(r.status,200);return r.json();}
 try{
  const admin=deps('firebase-admin');app=admin.initializeApp({projectId:ns,databaseURL:base+'/?ns='+ns},ns);db=app.database();
  await owner('PUT','.settings/rules',{rules:{'.read':false,'.write':false,sv_usuarios:{'.indexOn':['uid']}}});await owner('PUT','sv_usuarios/u',{uid:'u',activo:true,revision:1});
  const ref=db.ref('sv_usuarios/u'),query=db.ref('sv_usuarios').orderByChild('uid').equalTo('u').limitToFirst(2);
  await new Promise((resolve,reject)=>{stop=ref.on('value',()=>resolve(),reject);});await new Promise((resolve,reject)=>{stopQuery=query.on('value',()=>resolve(),reject);});
  paused=true;const received=new Promise(r=>{notify=r;});await owner('PATCH','sv_usuarios/u',{activo:false,revision:2});await Promise.race([received,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('No retained listener frame')),5000);t.unref();})]);const writesBefore=wsWrites;
  const cached=(await ref.get()).val(),cachedQuery=(await query.get()).val();assert.equal(cached.revision,1);assert.equal(cachedQuery.u.revision,1);assert.equal(wsWrites,writesBefore,'Cached Admin get sends no WebSocket write');
  const store=require('../cotizador/labor-rtdb-store').createLaborRtdbStore({databaseURL:base+'/?ns='+ns,accessToken:async()=> 'owner'});assert.equal((await store.read('sv_usuarios/u')).revision,2);assert.equal((await store.query('sv_usuarios','uid','u')).u.activo,false);
  const fresh=require('../cotizador/dashboard-rtdb-read-db').create({store});assert.equal((await fresh.ref('sv_usuarios/u').get()).val().revision,2);assert.equal((await fresh.ref('sv_usuarios').orderByChild('uid').equalTo('u').limitToFirst(2).get()).val().u.activo,false);
  await owner('PUT','keys',{a:1,'a ':4,aa:2,b:3});assert.deepEqual((await fresh.ref('keys').orderByKey().startAfter('a').limitToFirst(2).get()).val(),{'a ':4,aa:2});
  console.log('Admin cache evidence '+JSON.stringify({adminVersion:admin.SDK_VERSION,cachedRevision:cached.revision,restRevision:2,cachedQueryRevision:cachedQuery.u.revision,wsWritesDuringGet:wsWrites-writesBefore,heldFrames:queued.length,namespace:ns}));
 }finally{paused=false;net.Socket.prototype.write=originalWrite;net.Socket.prototype.emit=originalEmit;for(const flush of queued)flush();if(db){if(stop)db.ref('sv_usuarios/u').off('value',stop);if(stopQuery)db.ref('sv_usuarios').orderByChild('uid').equalTo('u').limitToFirst(2).off('value',stopQuery);db.goOffline();}if(app)await app.delete();for(const s of sockets)s.destroy();await owner('DELETE','');assert.equal(await owner('GET',''),null);}
});
test('existing budget activity/notices readers keep native REST limits and reject current revocation',{skip:!enabled,timeout:30000},async()=>{
 const base='http://127.0.0.1:9059',ns='demo-admin-fresh-read-'+process.pid;assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9059');
 async function owner(method,p,value){const u=new URL(p+'.json',base);u.searchParams.set('ns',ns);const r=await fetch(u,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(5000)});assert.equal(r.status,200);return r.json();}
 const {activitySeed}=require('./helpers/dashboard-budget-activity-fixture.cjs'),{budget,authFixture,request}=require('./helpers/dashboard-budget-reader-fixture.cjs'),Activity=require('../cotizador/dashboard-budget-activity-reader-proposal'),Notices=require('../cotizador/dashboard-budget-notice-candidates-proposal');
 const data=activitySeed(Object.fromEntries(Array.from({length:101},(_,i)=>['p'+i,budget({vence:'2027-01-01',ts:1000+i})]))),queries=[];
 try{
  await owner('PUT','.settings/rules',{rules:{'.read':false,'.write':false,sv_usuarios:{'.indexOn':['uid']}}});await owner('PUT','',data);
  const store=require('../cotizador/labor-rtdb-store').createLaborRtdbStore({databaseURL:base+'/?ns='+ns,accessToken:async()=> 'owner',fetchImpl:async(url,init)=>{const u=new URL(url);assert(!u.pathname.startsWith('/sisventas/'),'No originals in readers');if(u.searchParams.has('orderBy')){const limit=JSON.parse(u.searchParams.get('limitToFirst'));assert(limit<=50);queries.push({path:u.pathname,limit});}return fetch(url,init);}}),db=require('../cotizador/dashboard-rtdb-read-db').create({store}),auth=authFixture('u');
  const activity=Activity.createActivityReader({auth,db,enabled:true,getAsOfDay:()=> '2026-11-04',getLegacyContext:()=>({timeZone:data.sv_dashboard_budget_proposal.v1.coverage.activityTimeZone,sourceLocale:data.sv_dashboard_budget_proposal.v1.coverage.activitySourceLocale})}),notices=Notices.create({auth,db,enabled:true});
  const result=await activity.read(request({url:Activity.ROUTE}));assert.equal(result.counts.active,101);assert.equal(result.recent.rows.length,5);assert.equal(result.badge.badgeCount,0);assert.equal((await notices.read(request({url:Notices.ROUTE}))).rows.length,101);assert(queries.some(q=>q.path.includes('/noticeBadge/')&&q.limit===50));assert(queries.some(q=>q.path.includes('/noticeCandidates/')&&q.limit===50));
  await owner('PATCH','sv_chat_roles/u',{activo:false});await assert.rejects(activity.read(request({url:Activity.ROUTE})));await assert.rejects(notices.read(request({url:Notices.ROUTE})));
 }finally{await owner('DELETE','');assert.equal(await owner('GET',''),null);}
});
