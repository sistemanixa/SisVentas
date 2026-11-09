'use strict';
const vm=require('node:vm'),{webcrypto}=require('node:crypto'),{createCoordinatedBackend}=require('./coordinated-backend.cjs'),{apply}=require('./labor-ui-flow.cjs'),{functionSource}=require('./app-functions.cjs');
async function fixture({lost=false}={}){
 const original={id:'OT-FICTION',clienteFbKey:'c',responsableUid:'u',materiales:[]},backend=await createCoordinatedBackend({ordenes_trabajo:{OT1:original}});apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceModulos:{ordentrabajo:true}}});backend.store.otDeleteFenceReady=true;
 const handler=require('../../cotizador/ot-delete-http-adapter').createOTDeleteHttpAdapter({enabled:true,guard:backend.guard,store:backend.store,authorize:async()=>({uid:'u',claims:{uid:'u'}})}),notices=[],root={currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},crypto:webcrypto,SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async()=>({})},tienePermiso:()=>true,fbDB:{},fbRef:(_,path)=>path,fbGet:async path=>({val:()=>backend.get(path)}),fetch:async(url,init)=>{
 if(url.endsWith('/operaciones/ot/disponible'))return Response.json({ok:true,version:1,enabled:true});
 if(url.endsWith('/laboral/capacidades'))return Response.json({ok:true,payments:{enabled:false,version:1},adminExpense:{enabled:false,version:1},otDelete:{enabled:true,version:1}});
 if(url.endsWith('/laboral/operacion'))return Response.json({ok:true,status:backend.commits.length?'confirmed':'rejected'});
 const result=await handler.handle({method:'POST',url:'/operaciones/ot/eliminar'},JSON.parse(init.body));if(lost){lost=false;throw Error('ACK perdido');}return Response.json(result);
 }};
 const storage=new Map();root.sessionStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};root.SVLaborWriteRecovery=require('../../js/core/labor-write-recovery').create(root);root.SVFinancialCommands=require('../../js/core/financial-commands').create(root);
 let active=true,returned=0;const context={window:root,Set,otData:[{...original,fbKey:'OT1'}],FB_PATHS:{ordenesTrabajo:'sisventas/ordenes_trabajo'},tienePermiso:root.tienePermiso,notify:message=>notices.push(message),svCapturarContextoOperacion:()=>()=>active,svConfirm:async()=>true,volverListaOT:()=>returned++};vm.createContext(context);vm.runInContext(functionSource('eliminarOT'),context);
 return {backend,root,context,notices,run:()=>context.eliminarOT('OT1'),retire:()=>{active=false;root.currentUserUid='other';},returned:()=>returned};
}
module.exports={fixture};
