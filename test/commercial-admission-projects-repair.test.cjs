'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Admission=require('../cotizador/commercial-admission'),{createProjects}=require('../cotizador/projects'),{createProjectListStore}=require('../cotizador/projects-list-store'),{createBusinessAuth}=require('../cotizador/user-access'),{memoryDB}=require('./helpers/private-finance-fixtures.cjs');
const source=fs.readFileSync(require.resolve('../cotizador/index.js'),'utf8'),start=source.indexOf('http.createServer(')+'http.createServer('.length,end=source.indexOf('\n});',start)+2;
function fixture(flag,{active=true,blocked=false,enabled=true,listReady=true}={}){
 if(arguments.length===0)flag='true';
 const project={id:'project',number:'PR-FICTICIO',name:'Proyecto ficticio',clientId:'client',clientName:'Cliente ficticio',address:'Domicilio ficticio',goal:'Objetivo ficticio',due:'',stage:'planificacion',owner:'owner',members:{owner:{name:'Titular ficticio',access:'owner'}},needs:[],budgets:[],activity:[],revision:1,createdAt:100,updatedAt:100,_listProjectionPending:true,_listProjectionScopes:['all','u_owner']};
 const db=memoryDB({sv_chat_roles:{owner:{activo:active,rol:'vendedor'}},sv_chat_directorio:{owner:{nombre:'Titular ficticio'}},sv_permisos:{vendedor:{bloqueados:blocked?['proyectos']:[]}},sv_project_list_config:{ready:listReady},sv_proyectos:{project},sisventas:{clientes:{client:{nombre:'Cliente ficticio'}}}}),writes=[],reads=[];let authCalls=0,listCalls=0;
 const ref=db.ref.bind(db);
 db.ref=path=>{
  const raw=ref(path);
  function query(options={}){return {
   orderByChild:field=>query({...options,field}),equalTo:value=>query({...options,equal:value,hasEqual:true}),limitToFirst:limit=>query({...options,limit}),startAfter:after=>query({...options,after}),
   async get(){reads.push(path);const original=(await raw.get()).val();if(!Object.keys(options).length)return {val:()=>original};let entries=Object.entries(original||{});if(options.hasEqual)entries=entries.filter(([,row])=>(row?.[options.field]??null)===options.equal);if(options.field)entries.sort((a,b)=>String(a[1][options.field]??'').localeCompare(String(b[1][options.field]??'')));if(options.after!==undefined)entries=entries.filter(([,row])=>row[options.field]>options.after);if(options.limit)entries=entries.slice(0,options.limit);const value=Object.fromEntries(entries);return {val:()=>value};},
   async transaction(...args){writes.push(path);return raw.transaction(...args);}
  };}
  return query();
 };
 const auth=createBusinessAuth({verifyIdToken:async(token,revoked)=>{authCalls++;assert.equal(revoked,true);if(token!=='valid')throw Error('Revoked fictitious session');return {uid:'owner'};}},db);
 const projects=createProjects({auth,db,enabled,listStore:createProjectListStore(db)}),list=projects.list;projects.list=async(...args)=>{listCalls++;return list(...args);};
 const context={URL,commercialAdmission:Admission,commercialAdmissionPaused:Admission.isPaused(flag),projects,cors(){},send(res,status,body){res.status=status;res.body=body;}};
 vm.createContext(context);const handler=vm.runInContext('('+source.slice(start,end)+')',context);
 async function request(url='/proyectos?resumen=1',{method='GET',token='valid'}={}){const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code){this.status=code;},end(){}};await handler({method,url,headers:token?{authorization:'Bearer '+token}:{},resume(){}},response);return response;}
 return {db,writes,reads,request,listCalls:()=>listCalls,authCalls:()=>authCalls};
}
test('paused exact summary GET stops before real projects/listStore with pending originals and zero writes',async()=>{
 for(const url of ['/proyectos?resumen=1','/proyectos?resumen=%31','/proyectos?res%75men=1','/proyectos?cursor=old&resumen=1','/proyectos?resumen=1&resumen=0']){
  const f=fixture(),before=structuredClone(f.db.root),r=await f.request(url);assert.equal(r.status,503,url);assert.equal(r.body.code,'SV_COMMERCIAL_ADMISSION_PAUSED');assert.equal(r.body.retryable,true);assert.equal(r.headers['Retry-After'],'5');assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(f.listCalls(),0);assert.equal(f.authCalls(),0);assert.deepEqual(f.writes,[]);assert.deepEqual(f.reads,[]);assert.deepEqual(f.db.root,before);
 }
});
test('absent and false flags preserve actual authenticated summary repair of original and derived lists',async()=>{
 for(const flag of [undefined,'false']){
  const f=fixture(flag);
  const r=await f.request();assert.equal(r.status,200);assert.equal(f.listCalls(),1);assert.equal(f.authCalls(),1);assert.equal(r.body.projects.length,1);assert.equal(f.db.root.sv_proyectos.project._listProjectionPending,false);assert(f.writes.includes('sv_proyectos/project'));assert(f.writes.includes('sv_project_lists/all/project'));assert(f.writes.includes('sv_project_lists/u_owner/project'));assert.equal(f.db.root.sv_project_lists.u_owner.project.revision,1);
 }
});
test('paused nonsummary variants and other real project reads remain read-only with pending repair untouched',async()=>{
 for(const url of ['/proyectos','/proyectos?resumen=0','/proyectos?resumen=01','/proyectos?resumen=true','/proyectos?resumen=1%20','/proyectos?RESUMEN=1','/proyectos?resumen=0&resumen=1','/proyectos/detalle?id=project&resumen=1','/proyectos/opciones?proyecto=project&kind=base&resumen=1']){
  const f=fixture(),before=structuredClone(f.db.root),r=await f.request(url);assert.equal(r.status,200,url);assert.equal(f.authCalls(),1);assert.deepEqual(f.writes,[]);assert.deepEqual(f.db.root,before);
 }
 assert.equal((await fixture().request('/proyectos/?resumen=1')).status,405);
});
test('normal project Auth/module/config denials remain enforced without repairs or broadened permissions',async()=>{
 for(const flag of ['false','true'])for(const [options,request,status]of [[{},{token:null},401],[{},{token:'revoked'},401],[{active:false},{},403],[{blocked:true},{},403],[{enabled:false},{},503]]){
  const f=fixture(flag,options),r=await f.request('/proyectos',request);assert.equal(r.status,status);assert.deepEqual(f.writes,[]);
 }
 for(const [options,request,status]of [[{},{token:null},401],[{},{token:'revoked'},401],[{active:false},{},403],[{blocked:true},{},403],[{enabled:false},{},503],[{listReady:false},{},503]]){
  const f=fixture('false',options),r=await f.request('/proyectos?resumen=1',request);assert.equal(r.status,status);assert.deepEqual(f.writes,[]);
 }
});
test('summary query does not make unsupported methods into reads or bypass paused POST protection',async()=>{
 for(const method of ['PUT','DELETE','PATCH']){const f=fixture();assert.equal((await f.request('/proyectos?resumen=1',{method})).status,405);assert.deepEqual(f.writes,[]);assert.equal(f.listCalls(),0);}
 const f=fixture();assert.equal((await f.request('/proyectos?resumen=1',{method:'POST'})).status,503);assert.deepEqual(f.writes,[]);assert.equal((await f.request('/proyectos?resumen=1',{method:'OPTIONS'})).status,204);
});
