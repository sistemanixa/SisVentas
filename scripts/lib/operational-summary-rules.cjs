'use strict';
const M=require('../../js/core/operational-read-model');
function prepare(input){
 if(input?.rules?.['.read']!==false&&input?.rules?.['.read']!=null||input?.rules?.['.write']!==false&&input?.rules?.['.write']!=null)throw Error('Revisar permisos del padre raíz antes de preparar índices.');
 const out=structuredClone(input),s=out.rules?.sisventas;if(!s||s.compras_resumen)throw Error('Revisar configuración de resúmenes operativos.');
 if(s['.read']!==false&&s['.read']!=null||s['.write']!==false&&s['.write']!=null)throw Error('Revisar permisos del padre sisventas.');
 const index={'.read':false,'.write':false};
 const equal=(a,b)=>a+'.val() === '+b+'.val()';
 function tree(domain,segments,inverse,variables=[]){
  const anchor='newData'+'.parent()'.repeat(segments.length+(inverse?3:4)),other=anchor+".child('sisventas').child('"+(inverse?'compras_resumen/':'')+domain+"').child($record)"+segments.map(k=>k.startsWith('$')?'.child('+k+')':".child('"+k+"')").join('');
  const skip=variables.length?'('+variables.flatMap(v=>M.excluded.map(k=>v+" === '"+k+"'")).join(' || ')+')':'false';
  const match='(newData.hasChildren() ? ('+other+'.exists() && '+other+'.hasChildren()) : '+equal('newData',other)+')';
  const node={'.validate':inverse?'('+skip+') || '+match:'!('+skip+') && '+match};
  if(variables.length<8){const name='$p'+variables.length;node[name]=tree(domain,segments.concat(name),inverse,variables.concat(name));}
  return node;
 }
 for(const domain of M.domains){
  const original=s[domain];if(!original||Object.keys(original).some(k=>!k.startsWith('.'))||typeof original['.write']!=='string'||typeof original['.read']!=='string')throw Error('Revisar autoridad original de '+domain);
  const write=original['.write'],read=original['.read'];
  if(/\b(?:data|newData)\b/.test(read))throw Error('Revisar autoridad de lectura por ubicación en '+domain);
  const rootAccess='newData.parent().parent()';
  if(/\b(?:data|newData)\b/.test(write.split(rootAccess).join('')))throw Error('Hay condiciones de ubicación que requieren revisión en '+domain);
  const rowAuthority=write.split(rootAccess).join(rootAccess+'.parent()'),headerAuthority=write.split(rootAccess).join(rootAccess+'.parent().parent()');
  const mirror="newData.parent().parent().child('compras_resumen').child('"+domain+"').child($record)",source="newData.parent().parent().parent().child('"+domain+"').child($record)";
  const beforeSource="root.child('sisventas').child('"+domain+"').child($record)",old='('+beforeSource+".child('"+M.revision+"').exists() ? "+beforeSource+".child('"+M.revision+"').val() : 0)",revision="newData.child('"+M.revision+"').isNumber() && newData.child('"+M.revision+"').val() === "+old+' + 1';
  const row={'.read':read,'.write':'('+rowAuthority+') && (newData.exists() ? ('+revision+' && '+mirror+'.exists()) : !'+mirror+'.exists())'};
  row[M.revision]={'.validate':"newData.val() === newData.parent().parent().parent().child('compras_resumen').child('"+domain+"').child($record).child('"+M.revision+"').val()"};
  row[M.operation]={'.validate':"newData.isString() && newData.val().length <= 160 && newData.val() === newData.parent().parent().parent().child('compras_resumen').child('"+domain+"').child($record).child('"+M.operation+"').val()"};
  const summary={'.write':'('+headerAuthority+') && (newData.exists() ? ('+source+'.exists() && '+source+".child('"+M.revision+"').val() === "+old+' + 1) : !'+source+'.exists())','.validate':"newData.hasChildren(['"+M.revision+"'])"};
  summary[M.revision]={'.validate':"newData.isNumber() && newData.val() === newData.parent().parent().parent().parent().child('"+domain+"').child($record).child('"+M.revision+"').val()"};
  summary[M.operation]={'.validate':"newData.isString() && newData.val() === newData.parent().parent().parent().parent().child('"+domain+"').child($record).child('"+M.operation+"').val()"};
  for(const field of M.fields[domain]){
   if(M.booleanOnly.includes(field)){
    const target="newData.parent().parent().parent().child('compras_resumen').child('"+domain+"').child($record).child('"+field+"')";
    row[field]={'.validate':"(newData.val() !== false && newData.val() !== '' && newData.val() !== 0 ? "+target+'.val() === true : !'+target+'.exists())'};
    const sourceField="newData.parent().parent().parent().parent().child('"+domain+"').child($record).child('"+field+"')";
    summary[field]={'.validate':'newData.val() === true && '+sourceField+'.exists() && '+sourceField+".val() !== false && "+sourceField+".val() !== '' && "+sourceField+'.val() !== 0'};
   }else if(field==='compraConfirmacion'){
    const mirrorField="newData.parent().parent().parent().child('compras_resumen').child('"+domain+"').child($record).child('"+field+"')",sourceField="newData.parent().parent().parent().parent().child('"+domain+"').child($record).child('"+field+"')";
    row[field]={'.validate':'newData.hasChildren() ? '+mirrorField+'.exists() : '+equal('newData',mirrorField)};
    summary[field]={'.validate':'newData.hasChildren() ? '+sourceField+'.exists() : '+equal('newData',sourceField),'$other':{'.validate':false}};
    for(const child of ['estado','fecha']){
     row[field][child]={'.validate':equal('newData',"newData.parent().parent().parent().parent().child('compras_resumen').child('"+domain+"').child($record).child('compraConfirmacion').child('"+child+"')")};
     summary[field][child]={'.validate':equal('newData',"newData.parent().parent().parent().parent().parent().child('"+domain+"').child($record).child('compraConfirmacion').child('"+child+"')")};
    }
   }else if(['items','sources','simuladorParaguay','ordenesIds','proveedoresFinales'].includes(field)){row[field]=tree(domain,[field],true);summary[field]=tree(domain,[field],false);}
   else{
    const mirrorField="newData.parent().parent().parent().child('compras_resumen').child('"+domain+"').child($record).child('"+field+"')",sourceField="newData.parent().parent().parent().parent().child('"+domain+"').child($record).child('"+field+"')";
    row[field]={'.validate':'!newData.hasChildren() && '+equal('newData',mirrorField)};summary[field]={'.validate':'!newData.hasChildren() && '+equal('newData',sourceField)};
   }
  }
  summary.$other={'.validate':false};original['.write']=false;original['.read']=false;original.$record=row;
  index[domain]={'.read':read,_svCoverage:{'.write':false},'$record':summary};
 }
 s.compras_resumen=index;
 if(out.rules.sv_operational_read_config)throw Error('Ya existe configuración operativa; revisar antes de reemplazarla.');
 out.rules.sv_operational_read_config={'.read':"auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true",'.write':false};
 return out;
}
module.exports={prepare};
