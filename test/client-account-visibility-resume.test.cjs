'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),Host=require('../js/modules/client-account-host.v1'),Metadata=require('./helpers/client-account-mode-metadata.cjs');
const flush=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const events=new Map(),watches=[],counts={browse:0,reset:0,invalidate:0},ready={value:false};let revision=1,gate=null;
 const doc={hidden:false,getElementById:()=>null,addEventListener(n,fn){const list=events.get(n)||[];list.push(fn);events.set(n,list);}};
 const root={document:doc,SV_CLIENT_ACCOUNTS_ROLLOUT:{schema:1,enabled:true},currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},fbDB:{},PERMISOS_ROLES:{admin:{indiceRevision:1}},navigator:{onLine:true},_svPaginaDesdeRuta:()=> 'cuentacorriente',permisoModulo:()=>true,svPuedeLeerDominio:()=>true,fbRef:(_,p)=>p,
  fbGet:async p=>({val:()=>Metadata.value(p,{schema:1,ready:true,generation:'g',writerMode:'coordinated-v1'})}),
  fbOnValue(p,fn){const watch={p,fn,stopped:false};watches.push(watch);return()=>watch.stopped=true;},
  SVDataReadiness:{status:()=>({ready:ready.value}),invalidate(){counts.invalidate++;ready.value=false;},beginSource(){return {ready(){ready.value=true;},cancel(){ready.value=false;},error(){ready.value=false;}};}},
  SVClientAccountReader:{create:()=>({reset(){counts.reset++;},async browse(){counts.browse++;if(gate)await gate;return {generation:'g',revision,totals:{accounts:0,debtors:0,balanceCents:0},rows:[],cursor:null,hasMore:false};}})}
 };
 const host=Host.install(root);const emit=name=>(events.get(name)||[]).forEach(fn=>fn());
 return {root,host,counts,ready,watches,hide(){doc.hidden=true;emit('visibilitychange');},show(){doc.hidden=false;emit('visibilitychange');},emit,revision(v){revision=v;},gate(p){gate=p;},coverage(w=watches.at(-1),v=revision){w.fn({val:()=>({generation:'g',revision:v})});}};
}
test('warm hide/show preserves verified readiness without business reload and resumes coverage',async()=>{
 const f=fixture();await f.host.ensure();a.equal(f.counts.browse,1);a.equal(f.ready.value,true);
 const old=f.watches.at(-1);f.hide();a.equal(old.stopped,true);a.equal(f.ready.value,true);f.show();await flush();
 a.equal(f.counts.browse,1);a.equal(f.ready.value,true);a.equal(f.watches.length,2);f.coverage();await flush();a.equal(f.counts.browse,1);
 f.coverage(old,9);await flush();a.equal(f.counts.browse,1,'retired watch cannot refresh');
});
test('changed coverage refreshes once after resume',async()=>{const f=fixture();await f.host.ensure();f.hide();f.revision(2);f.show();f.coverage();await flush();a.equal(f.counts.browse,2);});
for(const [name,change]of [['Auth',f=>f.root.fbAuth.currentUser={uid:'u'}],['database',f=>f.root.fbDB={}],['permission revision',f=>f.root.PERMISOS_ROLES.admin.indiceRevision++]])test(name+' change invalidates instead of accepting retained data',async()=>{const f=fixture();await f.host.ensure();f.hide();change(f);f.show();await flush();a.equal(f.counts.invalidate,1);a.equal(f.counts.browse,2);});
test('revocation while hidden resets and performs no replacement read',async()=>{const f=fixture();await f.host.ensure();f.hide();f.root.permisoModulo=()=>false;f.emit('sisventas:role-changed');a.equal(f.ready.value,false);f.show();await flush();a.equal(f.counts.browse,1);a.equal(f.host.claimed,false);});
test('cold in-flight hide/show requires real reload and rejects late previous response',async()=>{const f=fixture();let release;f.gate(new Promise(r=>release=r));const old=f.host.ensure();await flush();f.hide();f.gate(null);f.show();await flush();a.equal(f.counts.browse,2);release();await old;await flush();a.equal(f.counts.browse,2);a.equal(f.ready.value,true);});
test('write confirmed while hidden forces actual refresh',async()=>{const f=fixture();await f.host.ensure();f.hide();f.emit('sisventas:commercial-write-confirmed');f.show();await flush();a.equal(f.counts.browse,2);});
