'use strict';
// Structural planner only. It neither proves absence nor authorizes a write.
// The command/policy must separately require the bound absence evidence.
const Reference=require('./office-stock-reference');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_INITIAL_INVENTORY_REVIEW'});
function build(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['productKey','product','original'].includes(key))||!Reference.key(input.productKey)||input.original!==null)throw fail('La estructura inicial requiere un destino canónico ausente y verificado.');
 const {productKey,product}=input;
 if(Reference.productStatus(product)!=='active'||product.activo!==true||product.fbKey!==undefined&&product.fbKey!==productKey)throw fail('El producto no admite una estructura inicial de inventario.');
 const code=product.codigo??product.cod??productKey;
 if(typeof code!=='string'&&!(typeof code==='number'&&Number.isFinite(code)))throw fail('El código original necesita revisión.');
 const inventory={productoKey:productKey,codigo:code,...(typeof product.nombre==='string'?{descripcion:product.nombre}:typeof product.descripcion==='string'?{descripcion:product.descripcion}:{}),...(typeof product.unidad==='string'?{unidad:product.unidad}:{}),general:0,reservado:0,consumido:0,enCompra:0,asignaciones:{},rendicionesOT:{},operaciones:{}};
 return{path:'sisventas/inventario_operativo/'+productKey,precondition:null,inventory};
}
module.exports={build};
