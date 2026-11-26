'use strict';
const M=require('./sale-delete-target-index');
const {digest}=require('./labor-guard');
const {pool}=require('./payment-snapshot');
const plans=new WeakMap();
async function prepare({scope,store}){
 const actor=scope?.actor;
 if(actor?.mode!=='user'||actor.role!=='admin'||actor.financialAction!=='ventas.eliminar.preparar'||typeof scope.installSaleDeleteRelations!=='function')throw M.fail('La preparación requiere mantenimiento administrativo.');
 if(await store.exists('sv_sale_delete_relations')!==false||await scope.get(M.CONFIG)!==null)throw M.fail('El circuito ya existe; no se sustituye durante una preparación.');
 let bytes=0;
 const values=await pool(M.roots,async path=>{
  const value=await scope.get(path);
  if(value!==null&&!M.plain(value))throw M.fail('La preparación requiere fuentes completas.');
  const size=Buffer.byteLength(JSON.stringify(value));bytes+=size;
  if(size>(path==='sisventas/gastos'?16:8)*1024*1024||bytes>64*1024*1024)throw M.fail('La preparación excede el alcance permitido.');
  return value;
 });
 const sources=Object.fromEntries(M.roots.map((root,index)=>[root,values[index]])),hashes=Object.fromEntries(M.roots.map((root,index)=>[root,digest(values[index])]));
 const generation='links-'+digest({uid:actor.uid,opId:scope.lease.opId}).slice(0,48),prepared=await M.prepare(sources,{generation}),plan=Object.freeze({});
 plans.set(plan,{scope,uid:actor.uid,opId:scope.lease.opId,patch:prepared.patch,hashes});
 await scope.installSaleDeleteRelations(plan);
 return {ok:true,committed:true,prepared:true,generation};
}
function consume(plan,actor,lease,scope){
 const proof=plans.get(plan);if(!proof||proof.scope!==scope||actor.mode!=='user'||actor.role!=='admin'||actor.financialAction!=='ventas.eliminar.preparar'||proof.uid!==actor.uid||proof.opId!==lease.opId)throw M.fail('La preparación no corresponde a este guardado.');
 plans.delete(plan);return structuredClone({patch:proof.patch,hashes:proof.hashes});
}
module.exports={prepare,consume};
