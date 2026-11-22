'use strict';
// OFFLINE candidate only. No IO, deployment, activation or coverage creation.
const Catalog=require('./catalog-write-fence-rules.cjs'),Policy=require('../../cotizador/labor-fence-policy'),Activation=require('./stock-link-activation-rules.cjs');
const ROOT='sisventas/stock_vinculos',fields=['productKey','inventoryKey','receiptIdentityKey','revision','operationId','uid','reason','ts'],resultFields=['ok','committed','operationId','productKey','inventoryKey','receiptIdentityKey','revision'];
const closed=v=>v===undefined||v===false||v==='false',and=list=>list.map(v=>'('+v+')').join(' && '),at=(node,path)=>path.split('/').filter(Boolean).reduce((s,k)=>s+".child('"+k+"')",node);
const key=value=>value+".isString() && "+value+".val().matches(/^[A-Za-z0-9_-]{1,128}$/) && "+['constructor','prototype','__proto__'].map(v=>value+".val() !== '"+v+"'").join(' && ');
const equal=(a,b,names)=>and(names.map(k=>a+".child('"+k+"').val() === "+b+".child('"+k+"').val()"));
function prepare(input,{activationPins}={}){
 const out=Catalog.prepare(input),root=out.rules;
 if(root.sisventas?.stock_vinculos)throw Error('La asociación ya existe: revisar antes de componer.');
 const excluded=[];
 function exclude(node,segments,conditions){
  if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo de autoridad inválido.');
  for(const action of ['.read','.write'])if(!closed(node[action])){
   if(segments.length<2||!conditions.length)throw Error('Concesión ancestro no aislable: '+(segments.join('/')||'/')+'/'+action);
   if(typeof node[action]!=='string')throw Error('Concesión de comodín desconocida.');
   node[action]='!('+conditions.join(' && ')+') && ('+node[action]+')';excluded.push(segments.join('/')+'/'+action);
  }
  for(const[name,child]of Object.entries(node)){
   if(name.startsWith('.'))continue;const target=['sisventas','stock_vinculos'][segments.length];
   if(target&&name!==target&&!name.startsWith('$'))continue;
   if(name.startsWith('$')&&!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error('Comodín no reconocido.');
   exclude(child,segments.concat(name),conditions.concat(target&&name.startsWith('$')?name+" === '"+target+"'":[]));
  }
 }
 exclude(root,[],[]);
 const retiredSdk=Activation.retireSdk(out,activationPins);
 const T='auth.token',product=T+'.svStockLinkProductKey',inventory=T+'.svStockLinkInventoryKey',op=T+'.opId',role=T+'.svStockLinkRole',receipt=T+'.svStockLinkReceiptIdentityKey',N='newData'+'.parent()'.repeat(4),link=node=>at(node,ROOT),F=node=>link(node)+".child('porProducto').child("+product+')',R=node=>link(node)+".child('porInventario').child("+inventory+')',O=node=>link(node)+".child('operaciones').child("+op+')',generic=node=>at(node,'sv_labor_receipts')+'.child('+op+')';
 const profile=at('root','sv_chat_roles')+'.child(auth.uid)',cfg=at('root','sv_permisos')+'.child('+role+')',reset=at('root','sv_access_resets')+'.child(auth.uid)';
 const permission=and([profile+".child('activo').val() === true",profile+".child('rol').val() === "+role,"("+role+" === 'admin' || "+role+" === 'administrativo')",cfg+".child('indiceVersion').val() === 2",cfg+".child('indiceModulos/stockoficina').val() === true",cfg+".child('indiceModulos/productos').val() === true",cfg+".child('acciones/stock/ajustar').val() !== false",cfg+".child('indiceRevision').val() === "+T+'.svStockLinkPermissionRevision',T+".svFinancialAction === 'stock.ajustar'",T+'.svFinancialActorRole === '+role,T+'.svFinancialPermissionRevision === '+T+'.svStockLinkPermissionRevision',T+'.svPasswordChangeRequired !== true',reset+".child('required').val() !== true",'(!'+reset+".child('version').exists() || "+reset+".child('version').val() === "+T+'.svAccessVersion)']);
 const oldPair='((!'+F('root')+'.exists() && !'+R('root')+'.exists()) || ('+F('root')+'.exists() && '+R('root')+'.exists() && '+equal(F('root'),R('root'),fields)+' && '+F('root')+".child('productKey').val() === "+product+' && '+F('root')+".child('inventoryKey').val() === "+inventory+' && '+F('root')+".child('receiptIdentityKey').val() === "+receipt+'))';
 const pair=and([F(N)+'.exists()',R(N)+'.exists()',equal(F(N),R(N),fields),F(N)+".child('productKey').val() === "+product,F(N)+".child('inventoryKey').val() === "+inventory,F(N)+".child('receiptIdentityKey').val() === "+receipt,F(N)+".child('operationId').val() === "+op,F(N)+".child('uid').val() === auth.uid",F(N)+".child('revision').val() === ("+F('root')+".exists() ? "+F('root')+".child('revision').val() + 1 : 1)",O(N)+'.exists()','!'+O('root')+'.exists()',O(N)+".child('uid').val() === auth.uid",O(N)+".child('operationId').val() === "+op,equal(generic(N)+".child('result')",O(N)+".child('result')",resultFields),O(N)+".child('result/ok').val() === true",...['productKey','inventoryKey','receiptIdentityKey','revision','operationId'].map(k=>O(N)+".child('result/"+k+"').val() === "+F(N)+".child('"+k+"').val()")]);
 const grant=and([Activation.predicate(activationPins),Policy.fence(4,Policy.userActor),T+'.svLaborWriterSchema === 2',T+'.svStockLinkVersion === 1',product+'.matches(/^[A-Za-z0-9_-]{1,128}$/)',inventory+'.matches(/^[A-Za-z0-9_-]{1,128}$/)',receipt+'.matches(/^[A-Za-z0-9_-]{1,128}$/)',permission,oldPair,pair]);
 const safeInt=node=>node+'.isNumber() && '+node+'.val() % 1 === 0 && '+node+'.val() > 0 && '+node+'.val() <= 9007199254740991';
 function shape(names){return{'.validate':'newData.hasChildren('+JSON.stringify(names)+')','$other':{'.validate':false}};}
 function record(variable,claim){const n={'.write':and([variable+' === '+claim,grant]),...shape(fields)};for(const f of ['productKey','inventoryKey','receiptIdentityKey','operationId'])n[f]={'.validate':key('newData')};n.operationId['.validate']+=' && newData.val().length >= 8';n.revision={'.validate':safeInt('newData')};n.ts={'.validate':safeInt('newData')};n.uid={'.validate':'newData.isString() && newData.val() === auth.uid && newData.val().length <= 128'};n.reason={'.validate':'newData.isString() && newData.val().length <= 240 && newData.val().matches(/(.|\\n|\\r)*[^ \\t\\r\\n](.|\\n|\\r)*/)'};return n;}
 const operation={'.write':and(['$operation === '+op,grant]),...shape(['uid','operationId','commandDigest','result']),uid:{'.validate':'newData.isString() && newData.val() === auth.uid'},operationId:{'.validate':key('newData')+' && newData.val().length >= 8'},commandDigest:{'.validate':"newData.isString() && newData.val().matches(/^[a-f0-9]{64}$/)"},result:shape(resultFields)};
 operation.result.committed={'.validate':'newData.isBoolean() && newData.val() === true'};operation.result.ok={'.validate':'newData.isBoolean() && newData.val() === true'};for(const f of ['productKey','inventoryKey','receiptIdentityKey','operationId'])operation.result[f]={'.validate':key('newData')};operation.result.revision={'.validate':safeInt('newData')};
 root.sisventas.stock_vinculos={'.read':false,'.write':false,porProducto:{'$product':record('$product',product)},porInventario:{'$inventory':record('$inventory',inventory)},operaciones:{'$operation':operation},'$other':{'.validate':false}};
 const scope=require('./stock-link-scope-rules.cjs').restrict(out);
 return{rules:out,manifest:{version:1,namespace:ROOT,excluded,retiredSdk,scope,paths:['porProducto/$product','porInventario/$inventory','operaciones/$operation'],catalogComposed:true,activationRequired:true,activated:false,coverageCreated:false}};
}
module.exports={prepare,fields,resultFields};
