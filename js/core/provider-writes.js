(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SVProviderWrites=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var fields=Object.freeze(['nombre','web','pais','monedaPrecios','activo','base','favorito','preciosSinIva','descuentoPorcentaje']);
  function key(value){if(typeof value!=='string'||!value||new TextEncoder().encode(value).length>768||/[.#$\[\]/\x00-\x1f\x7f]/.test(value)||['__proto__','constructor','prototype'].includes(value))throw Error('Proveedor inválido');return value;}
  function plan(entries){
    if(!Array.isArray(entries)||entries.length>500)throw Error('Lote de proveedores inválido');
    var patch={},seen=new Set();
    entries.forEach(function(entry){
      var id=key(entry.fbKey);if(seen.has(id))throw Error('Proveedor repetido en el lote');seen.add(id);
      var source='sisventas/proveedores/'+id,publicPath='sv_catalogo_proveedores/'+id;
      if(entry.remove===true){patch[source]=null;patch[publicPath]=null;return;}
      var changes=entry.changes;if(!changes||typeof changes!=='object'||Array.isArray(changes))throw Error('Cambios de proveedor inválidos');
      Object.keys(changes).forEach(function(field){
        field.split('/').forEach(key);
        if(field==='fbKey')return;
        var value=changes[field];if(value===undefined)throw Error('Valor de proveedor inválido');
        if(fields.includes(field.split('/')[0])&&field.includes('/'))throw Error('Campo público de proveedor inválido');
        patch[source+'/'+field]=value;
        if(fields.includes(field)){
          if(value!==null&&!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))throw Error('Valor público de proveedor inválido');
          patch[publicPath+'/'+field]=value;
        }
      });
    });
    var paths=Object.keys(patch).sort();for(var i=1;i<paths.length;i++)if(paths[i].startsWith(paths[i-1]+'/'))throw Error('Cambios de proveedor superpuestos');
    return patch;
  }
  function batch(root,entries){return Promise.resolve().then(function(){
    var patch=plan(entries);if(!Object.keys(patch).length)return;
    if(!root.fbDB||typeof root.fbRef!=='function'||typeof root.fbUpdate!=='function')throw Error('Sin conexión Firebase');
    return root.fbUpdate(root.fbRef(root.fbDB),patch);
  });}
  return Object.freeze({fields:fields,plan:plan,batch:batch,update:function(root,id,changes){return batch(root,[{fbKey:id,changes:changes}]);},remove:function(root,id){return batch(root,[{fbKey:id,remove:true}]);}});
});
