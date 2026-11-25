'use strict';
// Opaque server port. Neither an inventory JSON document nor a Boolean callback
// can substitute for the genuine mapped admission and immutable-byte verifier.
const {digest}=require('./labor-guard'),Pins=require('./inventory-code-pins'),Install=require('./inventory-installation-contract'),Activation=require('./stock-link-activation-contract');
const authorities=new WeakSet();
function createInventoryCohortAuthority({mappedAdmission,verifier}={}){
 const Explicit=require('./office-stock-explicit-reference');
 if(!Explicit.isMappedAdmission(mappedAdmission)||!Pins.isVerifier(verifier))throw Error('Falta la autoridad genuina de cohorte para eliminar OT.');
 async function capture({read,pins,now=Date.now()}={}){
  if(typeof read!=='function')throw Error('Falta lectura autoritativa de inventario.');
  const paths=['sv_stock_reference_config/activation','sv_stock_reference_config/installed'],values=structuredClone(await Promise.all(paths.map(read))),[document,marker]=values;
  if(!Install.validateMarker(marker,{document,verifier,now})||document.generation!==pins.inventoryGeneration||document.contractDigest!==pins.inventoryContractDigest||document.rulesDigest!==pins.rulesSha256||digest(Activation.pins(Object.fromEntries(['schema','generation','baselineDigest','contractDigest','codePins','indexQueryCoverageVersion'].map(k=>[k,document[k]]))))!==pins.inventoryPinsSha256)throw Error('La instalación no coincide con el corte nativo de OT.');
  await mappedAdmission.admit({read});
  if(digest(await Promise.all(paths.map(read)))!==digest(values))throw Error('La instalación cambió durante la admisión de OT.');
  return Object.freeze({activationSha256:digest(document),installedSha256:digest(marker),generation:document.generation,contractDigest:document.contractDigest});
 }
 const authority=Object.freeze({capture});authorities.add(authority);return authority;
}
module.exports={createInventoryCohortAuthority,isAuthority:value=>authorities.has(value)};
