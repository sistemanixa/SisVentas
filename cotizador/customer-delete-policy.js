'use strict';
// Temporary fail-closed boundary: physical customer removal needs a future
// authoritative command. Logical deactivation and ordinary edits remain valid.
// clientes holds authoritative customer/address records. The unificados and
// indice collections describe grouping/membership; editing those links must
// remain available and cannot remove this original through that projector.
const ROOT='sisventas/clientes';
const fail=()=>Object.assign(Error('No se puede eliminar físicamente el cliente. Podés desactivarlo conservando su historial.'),{statusCode:409,code:'SV_CUSTOMER_PHYSICAL_DELETE_BLOCKED'});
function exists(v){if(v===null||v===undefined)return false;if(typeof v!=='object')return true;return Object.values(v).some(exists);}
function relevant(path){return path===ROOT||ROOT.startsWith(path+'/')||path.startsWith(ROOT+'/');}
function after(before,target,patch){const {parts,child,put}=require('./labor-guard');let next=structuredClone(before);for(const[path,value]of Object.entries(patch)){if(path===target)next=structuredClone(value);else if(target.startsWith(path+'/'))next=child(value,parts(target.slice(path.length+1)));else if(path.startsWith(target+'/'))next=put(next,parts(path.slice(target.length+1)),value);}return next;}
async function validate({patch,read,enabled=false}){
 if(!enabled)return false;const paths=Object.keys(patch).filter(relevant);if(!paths.length)return false;
 if(paths.some(path=>path===ROOT||ROOT.startsWith(path+'/'))){const before=await read(ROOT),next=after(before,ROOT,patch);for(const key of Object.keys(before||{}))if(exists(before[key])&&!exists(next&&Object.hasOwn(next,key)?next[key]:null))throw fail();}
 else{const records=new Set(paths.map(path=>ROOT+'/'+path.slice(ROOT.length+1).split('/')[0]));for(const record of records){const before=await read(record);if(exists(before)&&!exists(after(before,record,patch)))throw fail();}}
 return true;
}
module.exports={ROOT,exists,relevant,after,validate};
