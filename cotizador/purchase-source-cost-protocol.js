'use strict';
// Reserved server output only. No persisted field or caller claim issues authority.
const Policy=require('./purchase-inventory-policy');
const PREFIX='svPurchaseSourceCost';
const reserved=Object.freeze({svPurchaseSourceCostVersion:0,svPurchaseSourceCostSaleKey:'',svPurchaseSourceCostOrderKey:'',svPurchaseSourceCostKind:'',svPurchaseSourceCostBasePatchHash:'',svPurchaseSourceCostSourceHash:'',svPurchaseSourceCostPermissionDigest:''});
function sanitize(claims){return Object.fromEntries(Object.entries(claims||{}).filter(([key])=>!key.startsWith(PREFIX)));}
function claims(actor,lease,basePatch){
 const source=Policy.getSourceAuthority(actor,lease,basePatch);
 if(!source?.sealed||source.kind!=='receive'||!source.saleWritten||!source.saleKey)return {...reserved};
 return {svPurchaseSourceCostVersion:1,svPurchaseSourceCostSaleKey:source.saleKey,svPurchaseSourceCostOrderKey:source.orderKey,svPurchaseSourceCostKind:'receive',svPurchaseSourceCostBasePatchHash:source.basePatchHash,svPurchaseSourceCostSourceHash:source.sourceHash,svPurchaseSourceCostPermissionDigest:source.permissionDigest};
}
module.exports={PREFIX,reserved,sanitize,claims};
