'use strict';
// Explicit candidate only. Complete metadata command capability, never a client flag.
const Fence=require('../../cotizador/labor-fence-policy'),Activation=require('./stock-link-activation-rules.cjs'),Permission=require('./ot-metadata-permission-rules.cjs'),{outside}=require('./stock-link-scope-rules.cjs');
const closed=v=>v===undefined||v===false||v==='false';
function prepare(input,{activationPins}={}){
 const out=structuredClone(input),s=out.rules?.sisventas,ot=s?.ordenes_trabajo;
 if(!ot||!closed(out.rules['.write'])||!closed(s['.write']))throw Error('Falta la política OT completa o existe concesión raíz.');
 const wild=Object.keys(ot).filter(k=>k.startsWith('$'));
 if(wild.length!==1||!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(wild[0]))throw Error('Comodín OT no revisable.');
 const key=wild[0],row=ot[key];if(typeof row['.write']==='string'&&row['.write'].includes('svOTMetadataVersion'))throw Error('Candidata metadata ya instalada.');
 const restricted=[],absent="(auth == null || auth.token.svOTMetadataVersion !== 1)";
 function restrict(node,path,condition){if(!closed(node['.write'])){if(typeof node['.write']!=='string')throw Error('Grant OT desconocido.');const gate=condition?'(!('+condition+') || '+absent+')':absent;node['.write']='('+gate+') && ('+node['.write']+')';restricted.push(path+'/.write');}for(const[k,v]of Object.entries(node))if(!k.startsWith('.'))restrict(v,path+'/'+k,condition);}
 // Metadata tokens must use the new record grant even when parents allow SDK writes.
 for(const[k,v]of Object.entries(s))if(k.startsWith('$'))restrict(v,'sisventas/'+k,k+" === 'ordenes_trabajo'");
 restrict(ot,'sisventas/ordenes_trabajo');
 const t='auth.token',role=t+'.svOTMetadataRole',profile="root.child('sv_chat_roles').child(auth.uid)",cfg="root.child('sv_permisos').child("+role+')',reset="root.child('sv_access_resets').child(auth.uid)",config="root.child('sv_ot_metadata_config')";
 const conditions=[outside,Fence.fence(3,Fence.userActor),Activation.predicate(activationPins),t+'.svLaborWriterSchema === 2',t+'.svOTMetadataVersion === 1',t+'.svOTPhysicalCommitVersion === 1',t+'.svOTPhysicalUnchanged === true',key+' === '+t+'.svOTMetadataOTKey',t+'.svOTMetadataFence === '+t+'.fence',config+".child('schema').val() === 1",config+".child('ready').val() === true",config+".child('generation').val() === "+t+'.svOTMetadataGeneration',"root.child('sv_stock_reference_config/activation/generation').val() === "+t+'.svOTMetadataGeneration',profile+".child('activo').val() === true",profile+".child('rol').val() === "+role,'('+['admin','administrativo','vendedor','tecnico','tecnico_vendedor'].map(r=>role+" === '"+r+"'").join(' || ')+')',cfg+".child('indiceVersion').val() === 2",cfg+".child('indiceRevision').val() === "+t+'.svOTMetadataPermissionRevision',cfg+".child('indiceModulos/ordentrabajo').val() === true",...Array.from({length:64},(_,i)=>cfg+".child('bloqueados/"+i+"').val() !== 'ordentrabajo'"),t+'.svPasswordChangeRequired !== true',reset+".child('required').val() !== true",'(!'+reset+".child('version').exists() || "+reset+".child('version').val() === "+t+'.svAccessVersion)',Permission.predicate(),'data.exists() && newData.exists()'];
 row['.write']='('+String(row['.write']??false)+') || ('+conditions.map(x=>'('+x+')').join(' && ')+')';
 return{rules:out,manifest:{schema:1,grantPath:'sisventas/ordenes_trabajo/'+key+'/.write',parentGrantAdded:false,physicalUnchangedRequired:true,permissionFlagsFromServerRequired:true,restrictedExistingGrants:restricted,activated:false}};
}
module.exports={prepare};
