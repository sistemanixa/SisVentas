'use strict';
// Routing only; the injected server verifier owns B's signature and common pins.
async function route({enabled=false,mappingPresent=false,assertAdmission}={}){
 if(enabled!==true||mappingPresent===false)return 'legacy';
 if(mappingPresent!==true||typeof assertAdmission!=='function')throw Object.assign(Error('El vínculo de Compras todavía no está preparado. No se guardaron cambios.'),{code:'SV_PURCHASE_INVENTORY_NOT_READY',statusCode:503});
 await assertAdmission();
 return 'coordinated';
}
module.exports={route};
