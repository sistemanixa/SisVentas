'use strict';
// Preparación sintética derivada; ningún output de OT ni autoridad de inventario.
const assert=require('node:assert/strict'),path=require('node:path');
const rolePermissions={indiceVersion:2,indiceRevision:1,bloqueados:[],indiceModulos:Object.fromEntries(['dashboard','productos','stockoficina','ordenes','balancecompra','venta','presupuesto','ordentrabajo','soporte','clientes','configuracion'].map(k=>[k,true])),acciones:{dashboard:{miCuenta:false},stock:{ajustar:true},productos:{editar:true},ordenes:{editar:true,eliminar:true},mantenimiento:{migrar:true},ot:{crear:true,editar:true,editarDatosAdministrativos:true,entregarMateriales:true,rendirMateriales:true,ajustarStockOficina:true}}};
async function prepare({nativeFactoryFile,sourceRoot,...options}){
 const factory=require(path.resolve(nativeFactoryFile)),at=file=>require(path.join(path.resolve(sourceRoot),file));
 // El helper E no exporta un defaultSources puro. Una fixture de descubrimiento
 // proporciona originales genuinos para scan; sólo se copian índices derivados.
 const probe=await factory.create({sourceRoot,...options,rolePermissions});
 try{
  const activation=at('scripts/lib/record-list-activation.cjs'),prepared=await activation.scan(async p=>probe.get(p));
  const rows=at('cotizador/record-list-model').parseIndex('ordenes_trabajo',prepared.indexes.ordenes_trabajo);
  const floor=Object.values(rows).reduce((max,row)=>{const match=/^OT-(\d+)$/.exec(row.id||'');return match?Math.max(max,Number(match[1])):max;},0);assert.ok(Number.isSafeInteger(floor));
  const generation=probe.document.generation,sourceSeed={
   sv_labor_config:{otLifecycleVersion:1,otOfficeCountVersion:1,otWarehouseVersion:2},
   sv_record_list_config:{schema:1,ready:true},sv_ot_metadata_config:{schema:1,ready:true,generation,numberingFloor:floor},sv_ot_inventory_config:{schema:1,ready:true,generation,referenceMode:'mapped'},
   sv_usuarios:{qaAdmin:{uid:'fake',nombre:'Admin QA',rol:'admin',activo:true},qaTechProfile:{uid:'qa-tech',nombre:'Técnico QA',rol:'tecnico',activo:true,empleadoFbKey:'qaTech'}},
   sv_chat_roles:{'qa-tech':{rol:'tecnico',activo:true}},sv_access_resets:{'qa-tech':{required:false,version:'qa'}},sv_empleado_uid:{'qa-tech':{perfilFbKey:'qaTechProfile'}},
   sv_permisos:{tecnico:{indiceVersion:2,indiceRevision:1,bloqueados:[],indiceModulos:{ordentrabajo:true},acciones:{ot:{rendirMateriales:true}}}},
   sisventas:{clientes:{qaClient:{id:'C-QA',nombre:'Cliente QA',activo:true}},empleados:{qaTech:{nombre:'Técnico QA',activo:true,tipoEmpleado:'tecnico'}},proveedores:{qaProvider:{nombre:'Proveedor QA',activo:true,moneda:'ARS'}},
    productos:{product:{precioVenta:25,proveedores:[{proveedorKey:'qaProvider',nombre:'Proveedor QA',precio:10,costoRealArs:10,disponible:true}]}},contadores:{ordenTrabajo:floor},listados_resumen:prepared.indexes}
  };
  assert.equal(sourceSeed.sisventas.ordenes_trabajo,undefined,'No sembrar nueva OT de salida');
  return {sourceSeed,rolePermissions:structuredClone(rolePermissions),originalOT:probe.get('sisventas/ordenes_trabajo/ot'),generation,floor,recordListCounts:prepared.counts};
 }finally{probe.cleanup();}
}
module.exports={prepare,rolePermissions};
