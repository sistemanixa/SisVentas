'use strict';
// Pure routing proposal. Proof must come from an internal verifier, never the body.
function route({enabled=false,mappingPresent=false,proof=null}={}){
 if(enabled!==true||mappingPresent===false)return 'legacy';
 if(mappingPresent!==true||proof?.schema!==1||proof.catalogBarrierVerified!==true||proof.legacySdkBlocked!==true||proof.purchaseWriterReady!==true)throw Object.assign(Error('El vínculo de Compras todavía no está preparado. No se guardaron cambios.'),{code:'SV_PURCHASE_INVENTORY_NOT_READY',statusCode:503});
 return 'coordinated';
}
module.exports={route};
