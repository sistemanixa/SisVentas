'use strict';
const prefixes=['svOTMetadata','svOTInventory','svOTCount','svOTPhysical','svOTLifecycle'];
const sanitize=incoming=>Object.fromEntries(Object.entries(incoming||{}).filter(([name])=>!prefixes.some(prefix=>name.startsWith(prefix))));
function reserved(){const out={svOTPhysicalCommitVersion:0,svOTPhysicalUnchanged:false};for(const family of ['Metadata','Inventory','Count','Lifecycle']){const prefix='svOT'+family;out[prefix+'Version']=0;for(const field of ['OTKey','Kind','Role','PermissionRevision','Generation','Fence'])out[prefix+field]=null;}for(const field of ['Administrative','Editing','Creating','Resolving'])out['svOTMetadata'+field]=false;for(const field of ['SaleKey','ClaimKey','PreviousSaleKey','PreviousClaimKey'])out['svOTMetadata'+field]=null;out.svOTLifecycleSaleKey=null;out.svOTCountProductKey=null;out.svOTCountInventoryKey=null;return out;}
async function validateSource(options){
 const Source=require('./ot-stock-source-authority'),Count=require('./ot-office-count-policy'),Metadata=require('./ot-metadata-policy');
 if(Source.isBound(options.actor)){await Source.validate(options);return true;}
 if(Count.isBound(options.actor)){await Count.validate(options);return true;}
 if(Metadata.structureIsBound(options.actor)){await Metadata.validateStructureSource(options);return true;}
 if(Metadata.materials.isBound(options.actor)){await Metadata.materials.validateSource(options);return true;}
 return false;
}
async function claims({actor,lease,patch,readFresh,operationalSummaries=false,physicalEnabled=false,now=Date.now()}){
 readFresh=require('./office-stock-reference-io').memoRead(readFresh).read;
 const Life=require('./ot-lifecycle-policy'),Inventory=require('./ot-inventory-policy'),Count=require('./ot-office-count-policy'),Metadata=require('./ot-metadata-policy');
 const tokens={...Life.token(actor,lease),...Inventory.token(actor,lease),...Count.token(actor,lease),...Metadata.token(actor,lease)};
 for(const [field,version]of [['otLifecycle','svOTLifecycleVersion'],['otInventory','svOTInventoryVersion'],['otCount','svOTCountVersion'],['otMetadata','svOTMetadataVersion'],['otStructure','svOTMetadataVersion']])if(actor?.[field]&&tokens[version]!==1)throw Object.assign(Error('La capacidad de OT no es válida.'),{statusCode:403,code:'SV_OT_CAPABILITY_REQUIRED'});
 const physical=tokens.svOTLifecycleVersion===1||tokens.svOTInventoryVersion===1||tokens.svOTCountVersion===1;
 const structured=Metadata.structureIsBound(actor)||Metadata.materials.isBound(actor);
 if((physical||structured)&&!await validateSource({actor,lease,patch,readFresh,operationalSummaries,now}))throw Object.assign(Error('Falta verificar el plan completo de OT.'),{statusCode:403,code:'SV_OT_SOURCE_REQUIRED'});
 if(tokens.svOTMetadataVersion===1){const [profile,cfg]=await Promise.all([readFresh('sv_chat_roles/'+actor.uid),readFresh('sv_permisos/'+tokens.svOTMetadataRole)]);Metadata.validate(actor,profile,cfg);}
 return {...reserved(),...tokens,...(physicalEnabled?await require('./ot-physical-write-policy').claims({patch,actor,lease,read:readFresh,operationalSummaries,now}):{})};
}
module.exports={sanitize,reserved,validateSource,claims};
