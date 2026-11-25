'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {create}=require('../cotizador/office-stock');
const adapterCode=fs.readFileSync(path.join(__dirname,'../js/modules/office-stock-adapter.js'),'utf8');
const identity={uid:'demo',claims:{uid:'demo'}};
const profile={'sv_operational_read_config':{schema:1,ready:true},'sv_labor_config/officeStockVersion':1,'sv_chat_roles/demo':{activo:true,rol:'admin'},'sv_permisos/admin':{indiceVersion:2,indiceModulos:{stockoficina:true,productos:true}}};
const data=Object.fromEntries(Array.from({length:103},(_,i)=>['k-'+i,{general:i+1,reservado:0,codigo:'P-'+i}]));
data.zero={general:0,reservado:0};
data.reserve={general:0,reservado:2};
test('compact stock page reads only the live summary and ranks before pagination',async()=>{
 const reads=[];
 const service=create({enabled:true,store:{async read(key){reads.push(key);return key.endsWith('/inventario_operativo')?data:profile[key]??null;}},queryPage:async()=>assert.fail('No product lookups for compact stock')});
 const first=await service.list(identity,{compact:true,limit:50});
 assert.equal(first.rows.length,100);assert.equal(first.rows[0].key,'k-102');
 assert.equal(reads.filter(k=>k.endsWith('/inventario_operativo')).length,1);
 assert(!reads.some(k=>k.startsWith('sisventas/productos/')));
 const rest=await service.list(identity,{compact:true,limit:50,cursor:first.cursor});
 assert.equal(new Set([...first.rows,...rest.rows].map(r=>r.key)).size,104);
 assert.equal(rest.rows.at(-1).inventory.reservado,2);assert.equal(rest.cursor,null);
});
test('adapter keeps the open list synchronized with catalogue edits and removals',async()=>{
 const eventTarget=new EventTarget();
 const user={uid:'demo'};
 const requests=[];
 const row={key:'k-0',productKey:null,code:'P-0',name:'Bajo revisión',review:true,inventory:{general:1,reservado:0}};
 const sandbox={document:eventTarget,AbortSignal,window:{
  currentUserUid:'demo',currentRole:'admin',fbAuth:{currentUser:user},
  SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://example.test'},
  SVServiceAuth:{headers:async()=>({})},SVDataReadiness:{status:()=>({ready:true})},
  permisoModulo:()=>true,tienePermiso:()=>true,esProductoManoDeObra:()=>false,
  prodData:{a:{fbKey:'k-0',codigo:'P-0',nombre:'Inicial',imagenUrl:'https://example.test/inicial.jpg',activo:true}},
  fetch:async(url,opts)=>{requests.push(JSON.parse(opts.body));return{ok:true,json:async()=>({ok:true,rows:[row]})};}
 }};
 vm.runInNewContext(adapterCode,sandbox);
 const adapter=sandbox.window.SVOfficeStockAdapter.create();
 const list=await adapter.list({limit:50});
 assert.equal(requests[0].compact,true);assert.equal(list.rows[0].name,'Inicial');
 let updated;
 const off=adapter.onCatalogChange(()=>{updated=adapter.redecorate(list.rows)[0];});
 const catalogue=sandbox.window.prodData;
 Object.assign(catalogue.a,{nombre:'Editado',imagenUrl:'https://example.test/nueva.jpg',activo:false});
 eventTarget.dispatchEvent(new Event('sisventas:stock-catalog-changed'));
 assert.equal(updated.name,'Editado');assert.equal(updated.photo,'https://example.test/nueva.jpg');assert.equal(updated.canZero,true);
 delete catalogue.a;catalogue.b={fbKey:'otro',codigo:'P-0'};
 eventTarget.dispatchEvent(new Event('sisventas:stock-catalog-changed'));
 assert.equal(updated.review,true);assert.equal(updated.productKey,null);assert.equal(updated.inventory.general,1);
 assert.equal(requests.length,1);off();
});
