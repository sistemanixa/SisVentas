'use strict';
// Extend the limited catalog role; shared commercial data stays inaccessible.
function reglasDistribuidora(base) {
 const out=structuredClone(base);
 const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()";
 const eq=role+" === 'compras_paraguay'", ne=role+" !== 'compras_paraguay'";
 function visit(node,path='') {
  for(const [key,value] of Object.entries(node)) {
   if((key==='.read'||key==='.write')&&typeof value==='string') {
    let next=value.replaceAll(eq,'('+eq+' || '+role+" === 'distribuidora')");
    const chat = /^sv_chat(?:\/|_escribiendo\/|_directorio$)/.test(path);
    if(!chat)next=next.replaceAll(ne,'('+ne+' && '+role+" !== 'distribuidora')");
    node[key]=next;
   } else if(value&&typeof value==='object') visit(value,path?path+'/'+key:key);
  }
 }
 visit(out.rules);return out;
}
module.exports={reglasDistribuidora};
