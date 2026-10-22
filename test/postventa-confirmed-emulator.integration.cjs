'use strict';
// Opt-in: SDK real y reglas privadas locales verificadas; nunca Google ni datos reales.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const host=process.env.FIREBASE_DATABASE_EMULATOR_HOST||'';
if(!/^127\.0\.0\.1:\d{2,5}$/.test(host))throw Error('Requiere FIREBASE_DATABASE_EMULATOR_HOST explícito en loopback');
const rulesFile=process.env.SV_RULES_TEST_FILE;
if(!rulesFile||!path.isAbsolute(rulesFile))throw Error('Requiere SV_RULES_TEST_FILE absoluto, privado y local');
const rules=fs.readFileSync(rulesFile,'utf8');
assert.equal(crypto.createHash('sha256').update(JSON.stringify(JSON.parse(rules))).digest('hex'),'978cea4169880cd9b5d2782fbe17b7243a2fea562cb1737cb15292ebaa2e1782','Reglas diferentes de la base local verificada del corte19');
const dependencies=process.env.SV_EMULATOR_DEPENDENCIES;
if(!dependencies||!path.isAbsolute(dependencies))throw Error('Requiere SV_EMULATOR_DEPENDENCIES con package.json local de dependencias del emulador');
const dep=createRequire(dependencies),{initializeTestEnvironment}=dep('@firebase/rules-unit-testing'),sdk=dep('firebase/database');
const {load}=require('./helpers/app-functions.cjs'),{build}=require('../js/core/permission-index.js');
const tick=()=>new Promise(setImmediate),clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-postventa-audit',database:{host:'127.0.0.1',port:Number(host.split(':')[1]),rules}});});
after(async()=>{await env?.cleanup();});
async function seed(p,value){await env.withSecurityRulesDisabled(ctx=>sdk.set(sdk.ref(ctx.database(),p||undefined),value));}
async function peek(p){let value;await env.withSecurityRulesDisabled(async ctx=>{value=(await sdk.get(sdk.ref(ctx.database(),p))).val();});return value;}
const base=()=>({descripcion:'Anterior',fotos:{old:{url:'https://example.invalid/ficticia.jpg'}},intervenciones:{old:{nota:'Conservar'}}});
beforeEach(async()=>seed('',{sv_chat_roles:{admin:{rol:'admin',activo:true}},sv_permisos:build({admin:{bloqueados:[],acciones:{}}}),sisventas:{equipos:{existing:base()}}}));
function fixture({anonymous=false,holdRead=false}={}){
 const db=(anonymous?env.unauthenticatedContext():env.authenticatedContext('admin')).database(),reads=[],transactions=[],listeners=new Map(),retiros=new Set(),timers=new Map();let active=true;
 const c={Promise,Map,Set,console:{warn(){}},document:{addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);}},setTimeout(fn,ms){const id={};timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),fbDB:db,fbRef:sdk.ref,fbPush:sdk.push};
 c.fbOnValue=(ref,next,error)=>{const read={ref,stopped:false,snap:null,deliver(){next(read.snap);}};reads.push(read);const off=sdk.onValue(ref,snap=>{read.snap=snap;if(!holdRead)next(snap);},error);return()=>{if(!read.stopped){read.stopped=true;off();}};};
 c.fbRunTransaction=(ref,transform,options)=>{transactions.push(ref.toString());return sdk.runTransaction(ref,current=>{const next=transform(clone(current));return next===undefined?undefined:clone(next);},options);};
 c.window=c;vm.createContext(c);load(c,['svPostventaPersistir','svTransaccionConEstadoActual','svPostventaEsperar']);
 const state={id:'existing',creada:false,base:base(),operacion:{alRetirar(fn){retiros.add(fn);return()=>retiros.delete(fn);}}};
 return{c,db,reads,transactions,state,timers,save:()=>c.svPostventaPersistir('equipos',state,{descripcion:'Nueva'},()=>active),retire(){for(const fn of [...retiros])fn();},end(){active=false;for(const fn of listeners.get('sisventas:session-ended')||[])fn();},fire(){for(const [id,{fn}]of [...timers]){timers.delete(id);fn();}}};
}
async function firstRead(f){for(let i=0;i<100&&!f.reads[0]?.snap;i++)await new Promise(resolve=>setTimeout(resolve,5));assert.ok(f.reads[0]?.snap,'No llegó el snapshot ficticio local');}
test('edición con SDK frío conserva evidencias y retira su única escucha puntual',async()=>{
 const f=fixture(),result=await f.save();assert.equal(result.fbKey,'existing');assert.equal((await peek('sisventas/equipos/existing')).descripcion,'Nueva');assert.deepEqual((await peek('sisventas/equipos/existing')).fotos,base().fotos);assert.equal(f.reads.length,1);assert.equal(f.reads[0].stopped,true);assert.equal(f.transactions.length,1);assert.equal(f.timers.size,0);
});
for(const change of ['edit','delete'])test('un cambio remoto '+change+' antes del CAS no se sobrescribe ni recrea',async()=>{
 const f=fixture(),real=f.c.fbRunTransaction;f.c.fbRunTransaction=async(...args)=>{await seed('sisventas/equipos/existing',change==='delete'?null:{...base(),descripcion:'Cambio remoto'});return real(...args);};await assert.rejects(f.save(),/Otro usuario/);const record=await peek('sisventas/equipos/existing');assert.equal(record?.descripcion,change==='delete'?undefined:'Cambio remoto');assert.equal(f.reads[0].stopped,true);assert.equal(f.state.base.descripcion,'Anterior');
});
test('anónimo no obtiene datos ni comienza la transacción',async()=>{
 const f=fixture({anonymous:true});await assert.rejects(f.save());assert.equal(f.transactions.length,0);assert.equal(f.reads[0].stopped,true);assert.equal((await peek('sisventas/equipos/existing')).descripcion,'Anterior');
});
test('lectura permitida y escritura denegada conserva el registro y retira la escucha',async()=>{
 await seed('sv_permisos/admin',build({admin:{bloqueados:[],acciones:{equipos:{confirmarInstalacion:false}}}}).admin);const f=fixture();await assert.rejects(f.save());assert.equal(f.reads[0].stopped,true);assert.equal(f.transactions.length,1);assert.equal((await peek('sisventas/equipos/existing')).descripcion,'Anterior');
});
for(const cancel of ['retire','end','fire'])test('espera retirada por '+cancel+' no inicia CAS y descarta snapshot tardío',async()=>{
 const f=fixture({holdRead:true}),task=f.save();await firstRead(f);f[cancel]();await assert.rejects(task);f.reads[0].deliver();await tick();assert.equal(f.transactions.length,0);assert.equal(f.reads[0].stopped,true);assert.equal(f.state.base.descripcion,'Anterior');assert.equal(f.timers.size,0);
});
test('snapshot y retiro en el mismo turno no inician CAS desde una microtarea anterior',async()=>{
 const f=fixture({holdRead:true}),task=f.save();await firstRead(f);f.reads[0].deliver();f.retire();await assert.rejects(task);assert.equal(f.transactions.length,0);assert.equal(f.reads[0].stopped,true);
});
test('timeout de acuse no revierte el commit ni aplica una base tardía al formulario',async()=>{
 const f=fixture(),real=f.c.fbRunTransaction;let release,committed;const reached=new Promise(resolve=>committed=resolve);f.c.fbRunTransaction=async(...args)=>{const result=await real(...args);committed();return new Promise(resolve=>{release=()=>resolve(result);});};const task=f.save();await reached;f.fire();await assert.rejects(task,{code:'SV_ACK_TIMEOUT'});assert.equal(f.reads[0].stopped,true);assert.equal((await peek('sisventas/equipos/existing')).descripcion,'Nueva');assert.equal(f.state.base.descripcion,'Anterior');release();await tick();assert.equal(f.state.base.descripcion,'Anterior');assert.equal(f.timers.size,0);
});
