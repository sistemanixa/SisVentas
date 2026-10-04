'use strict';
const fs = require('node:fs');
function reglasParaguay(base) {
  const result = structuredClone(base);
  const role = "root.child('sv_chat_roles').child(auth.uid).child('rol').val()";
  const active = "auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true";
  const restricted = active+" && "+role+" === 'compras_paraguay'";
  function lock(node, path='') {
    for (const [key,value] of Object.entries(node)) {
      if ((key === '.read' || key === '.write') && typeof value === 'string') {
        if (path !== 'sv_chat_roles/$uid' || key !== '.read') node[key] = '('+value+') && '+role+" !== 'compras_paraguay'";
      } else if (value && typeof value === 'object') lock(value,path ? path+'/'+key : key);
    }
  }
  lock(result.rules);
  result.rules.sisventas.config.tipoCambio = {'.read':restricted};
  result.rules.sv_usuarios['.indexOn'] = ['uid'];
  result.rules.sv_usuarios['.read'] = '('+result.rules.sv_usuarios['.read']+') || ('+restricted+" && query.orderByChild === 'uid' && query.equalTo === auth.uid)";
  result.rules.sisventas.productos = Object.assign({},result.rules.sisventas.productos,{
    '.indexOn':['categoria'],
    '.read': restricted+" && query.orderByChild === 'categoria' && query.equalTo === 'COMPRAS PARAGUAY'"
  });
  result.rules.sv_listas_paraguay = {
    '$uid': {
      '.read':active+" && ("+role+" === 'admin' || (auth.uid === $uid && "+role+" === 'compras_paraguay'))",
      '$lista': {
        '.write':active+" && ("+role+" === 'admin' || ("+role+" === 'compras_paraguay' && auth.uid === $uid))",
        '.validate':"newData.hasChildren(['nombre','productos','actualizadoEn'])",
        nombre:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 120'},
        actualizadoEn:{'.validate':'newData.isNumber() && newData.val() <= now + 300000 && newData.val() >= 0'},
        productos:{
          '.validate':'newData.hasChildren()',
          '$producto':{'.validate':"newData.isNumber() && newData.val() > 0 && newData.val() <= 9999 && newData.val() % 1 === 0 && root.child('sisventas/productos').child($producto).child('categoria').val() === 'COMPRAS PARAGUAY' && root.child('sisventas/productos').child($producto).child('activo').val() !== false && root.child('sisventas/productos').child($producto).child('estado').val() !== 'Inactivo' && root.child('sisventas/productos').child($producto).child('esManoDeObra').val() !== true"}
        },
        comprasFinales:{
          '$producto':{
            '.validate':"newData.parent().parent().child('productos').child($producto).exists() && newData.hasChildren(['moneda','proveedor']) && newData.hasChild('cantidad') === newData.hasChild('precioUnitario') && (newData.child('estado').val() !== 'comprado' || (newData.child('cantidad').val() > 0 && newData.hasChild('precioUnitario')))",
            cantidad:{'.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() <= 9999 && newData.val() % 1 === 0'},
            estado:{'.validate':"newData.isString() && (newData.val() === 'pendiente' || newData.val() === 'pedido' || newData.val() === 'comprado')"},
            precioUnitario:{'.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000000'},
            moneda:{'.validate':"newData.isString() && (newData.val() === 'USD' || newData.val() === 'ARS' || newData.val() === 'PYG')"},
            proveedor:{'.validate':'newData.isString() && newData.val().length <= 120'},
            '$otro':{'.validate':false}
          }
        },
        '$otro':{'.validate':false}
      }
    }
  };
  return require('./reglas-permisos-distribuidora.cjs').permisosDistribuidora(require('./generar-reglas-distribuidora.cjs').reglasDistribuidora(result));
}
if(require.main===module) {
  const [source,target]=process.argv.slice(2);
  fs.writeFileSync(target,JSON.stringify(reglasParaguay(JSON.parse(fs.readFileSync(source,'utf8'))),null,2)+'\n');
}
module.exports={reglasParaguay};
