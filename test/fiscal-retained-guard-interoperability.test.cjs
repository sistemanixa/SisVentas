'use strict';
// Exercise the fiscal candidate's retained source, not the newly edited guard.
const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs');
const SOURCE='10aecd47a71954ccffb455c956c011bc90e62325';
function retained(){
 const cache=new Map(),root=path.resolve(__dirname,'..');
 function load(file){
  if(!/^(cotizador|cloud-functions\/emitir-factura)\/[A-Za-z0-9_./-]+\.(js|cjs|json)$/.test(file)||file.includes('..'))throw Error('Outside retained fiscal source');
  if(cache.has(file))return cache.get(file).exports;
  const bytes=cp.execFileSync('git',['show',SOURCE+':'+file],{cwd:root,windowsHide:true,maxBuffer:8*1024*1024});
  if(file==='cotizador/labor-guard.js')a.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'a28c5acd6baf8e169426fa03d2be829645d4ee32fb15113b49781b96d0ed62de');
  const module={exports:{}};cache.set(file,module);
  if(file.endsWith('.json'))module.exports=JSON.parse(bytes);else{
   const localRequire=name=>{if(require('node:module').isBuiltin(name))return require(name);if(!name.startsWith('.'))throw Error('External dependency forbidden in retained fixture: '+name);let target=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));if(!/\.(js|cjs|json)$/.test(target))target+='.js';return load(target);};
   vm.runInThisContext('(function(require,module,exports,__filename,__dirname){'+bytes.toString()+'\n})',{filename:SOURCE+':'+file})(localRequire,module,module.exports,path.join(root,file),path.join(root,path.dirname(file)));
  }
  return module.exports;
 }
 return load;
}
test('retained fiscal guard and current commercial guard preserve common projections and customer originals',async()=>{
 const load=retained(),OldGuard=load('cotizador/labor-guard.js'),Bridge=load('cloud-functions/emitir-factura/labor-bridge.cjs');
 const f=await createCoordinatedBackend({clientes:{c:{id:'C-SYNTHETIC',nombre:'Synthetic'}},ventas:{s:{id:'V-SYNTHETIC',clienteFbKey:'c',responsableUid:'u',total:100,subtotal:100,items:[]}}});
 const originals=structuredClone(f.state.sisventas),guard=OldGuard.createLaborGuard({store:f.store,saleFinancialDependencies:true,operationalSummaries:true,commercialPages:true,clientAccounts:true,clientHistory:true,uuid:()=> 'retained-fiscal-fixture'});
 const failures=[],run=guard.run;guard.run=async(...args)=>{try{return await run(...args);}catch(e){failures.push(e.message);throw e;}};
 const db={ref:p=>({get:async()=>({val:()=>f.get(p)}),transaction:async update=>{const value=update(f.get(p));if(value!==undefined)apply(f.state,{[p]:value});return{committed:value!==undefined,snapshot:{val:()=>f.get(p)}};}})};
 const bridge=Bridge.createFiscalLaborBridge({db,guard}),operationId='a'.repeat(64),job={operationId,claim:'synthetic',ventaKey:'s',clase:'factura',uid:'u',facturaAnteriorCae:''};
 apply(f.state,{['sv_fiscal_emissions/'+operationId]:job});
 a.equal((await bridge.complete(job,{cae:'SYNTHETIC-CAE',fecha:'2026-11-08',total:100})).persistenciaPendiente,false,JSON.stringify(failures));
 a.deepEqual(f.state.sisventas.clientes,originals.clientes);a.equal(f.state.sisventas.ventas.s.total,100);
 const afterAttachment=structuredClone(f.state.sisventas),count=f.commits.length;a.equal((await bridge.resume(operationId)).persistenciaPendiente,false);a.deepEqual(f.state.sisventas,afterAttachment);a(f.commits.slice(count).every(patch=>!Object.keys(patch).some(p=>p.startsWith('sisventas/'))),'Retry may refresh coordination metadata, never repeat a business mutation');
 await f.gateway.write({uid:'u',claims:{uid:'u'}},{id:'current-customer-deactivation',kind:'patch',path:'sisventas/clientes/c',value:{activo:false}});
 await a.rejects(f.gateway.write({uid:'u',claims:{uid:'u'}},{id:'current-customer-removal',kind:'set',path:'sisventas/clientes/c',value:null}),{code:'SV_CUSTOMER_PHYSICAL_DELETE_BLOCKED'});
 a.equal(f.state.sisventas.clientes.c.activo,false);a.equal(f.state.sisventas.ventas.s.factura.cae,'SYNTHETIC-CAE');a.equal(f.state.sisventas.ventas.s.total,100);
 for(const p of f.commits.flatMap(Object.keys))a(!p.startsWith('sisventas/pagos/')&&!p.startsWith('sisventas/comisiones/')&&!p.startsWith('sisventas/inventario_operativo/'));
});
