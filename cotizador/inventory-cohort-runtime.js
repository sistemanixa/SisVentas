'use strict';
// Revision-local composition: verify immutable bytes once; read remote admission
// on every operation. This module never installs a marker or mutates business data.
const {digest}=require('./labor-guard');
const ACTIVATION='sv_stock_reference_config/activation',INSTALLED='sv_stock_reference_config/installed';
const fail=()=>Object.assign(Error('El circuito de inventario todavía no está disponible. Conservá el formulario.'),{statusCode:503,code:'SV_INVENTORY_COHORT_NOT_READY',svLaborAttempted:false});
function create({enabled=false,readOnly=false,read,serverRoot,uiRoot,env=process.env,now=Date.now}={}){
 if(typeof enabled!=='boolean'||typeof readOnly!=='boolean'||typeof now!=='function')throw Error('Configuración de inventario inválida.');
 let config=null,verifier=null,mappedAdmission=null,absenceAuthority=null,installedEver=false;
 if(enabled){
  const Pins=require('./inventory-code-pins');
  config=Pins.parseEnvironment(env);
  verifier=Pins.createVerifier({serverRoot,uiRoot,env});
  if(!Pins.isVerifier(verifier))throw fail();
  mappedAdmission=require('./office-stock-explicit-reference').createMappedAdmission({enabled:true,...config,now});
  absenceAuthority=require('./inventory-absence-evidence').create({read,verifier,contract:config.expectedContract,now});
 }
 async function inspect({read:reader=read}={}){
  if(typeof reader!=='function')throw fail();
  // Undefined is not an authoritative absence. Only RTDB's explicit null is.
  const [marker,document]=await Promise.all([reader(INSTALLED),reader(ACTIVATION)]);
  if(marker===undefined||document===undefined)throw fail();
  if(marker!==null||document!==null)installedEver=true;
  let valid=false;
  if(enabled&&marker!==null&&document!==null){
   try{
    valid=require('./inventory-installation-contract').validateMarker(marker,{document,verifier,now:now()})===true;
   }catch(_){valid=false;}
  }
  return{marker,document,valid,installed:installedEver,ready:valid&&!readOnly,generation:config?.expectedPins.generation||''};
 }
 async function capabilities(options){const state=await inspect(options);return{version:1,installed:state.installed,ready:state.ready,generation:state.generation};}
 async function assertAdmission(options){
  const state=await inspect(options);
  if(!state.ready||!mappedAdmission)throw fail();
  // Keep the genuine Explicit authority, including its signature/contract check.
  await mappedAdmission.admit({read:async path=>path===ACTIVATION?state.document:(options?.read||read)(path)});
  return Object.freeze({schema:1,verified:true,writerVersion:1,generation:config.expectedPins.generation,activationDigest:digest(state.document),rulesDigest:config.expectedRulesDigest,contractDigest:config.expectedPins.contractDigest});
 }
 return Object.freeze({mappedAdmission,absenceAuthority,assertAdmission,verifyCohort:assertAdmission,capabilities});
}
module.exports={create,ACTIVATION,INSTALLED};
