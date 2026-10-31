'use strict';
const M=require('../../js/core/record-list-model');
function prepare(input){
 const out=structuredClone(input),s=out.rules?.sisventas;if(!s||s.listados_resumen||out.rules.sv_record_list_config)throw Error('Revisar las rutas de listados antes de aplicar');
 for(const n of [out.rules,s])if(n['.read']!==false&&n['.read']!=null||n['.write']!==false&&n['.write']!=null)throw Error('Autoridad amplia en un padre');
 const index={'.read':false,'.write':false};
 const rootAt=depth=>'newData'+'.parent()'.repeat(depth);
 const at=(base,segments)=>segments.reduce((p,k)=>p+'.child('+k+')',base);
 function translated(expr,domain,segments,depth){const before=at("root.child('sisventas').child('"+domain+"')",segments),after=at(rootAt(depth)+".child('sisventas').child('"+domain+"')",segments);return expr.replace(/\bnewData\b/g,'__AFTER__').replace(/\bdata\b/g,before).replace(/__AFTER__/g,after);}
 function tree(domain,parts,inverse){
  const source=at(rootAt(parts.length+(inverse?3:4))+".child('sisventas').child('"+domain+"').child($record)",parts);
  const mirror=at(rootAt(parts.length+3)+".child('sisventas/listados_resumen/"+domain+"').child($record)",parts);
  const other=inverse?mirror:source;
  const omitted=parts.length?'('+M.omitted[domain].concat(['fbKey']).map(k=>parts[0]+" === '"+k+"'").join(' || ')+')':'false';
  const media=parts.length?'('+parts.flatMap(p=>M.media.map(k=>p+" === '"+k+"'")).join(' || ')+')':'false';
  const binary=(inverse?'newData':source)+".isString() && "+(inverse?'newData':source)+".val().matches(/^[dD][aA][tT][aA]:.*/)";
  const skip='('+omitted+' || '+media+' || ('+binary+'))';
  const eq='(newData.hasChildren() ? '+other+'.hasChildren() : newData.val() === '+other+'.val())';
  const node={'.validate':inverse?skip+' || '+eq:'!'+skip+' && '+eq};
  if(parts.length<8){const child='$f'+parts.length;node[child]=tree(domain,parts.concat(child),inverse);}else node.$tooDeep={'.validate':inverse?skip:false};
  return node;
 }
 for(const domain of M.domains){
  const old=s[domain];if(!old||typeof old['.read']!=='string'||typeof old['.write']!=='string')throw Error('Falta autoridad original de '+domain);
  const read=old['.read'],write=old['.write'],child=old.$gasto;
  const globalRead=read.replace(/query\.equalTo\b/g,'null').replace(/query\.orderByChild\b/g,'null');
  const commission=node=>'('+['pct','pctOriginal','gananciaBase','baseGanancia','porcentaje'].map(k=>node+".child('"+k+"').exists()").concat(['tipoPagable','origen','tipo'].map(k=>"("+node+".child('"+k+"').isString() && ("+node+".child('"+k+"').val().toLowerCase() === 'comision' || "+node+".child('"+k+"').val().toLowerCase() === 'comisión'))")).join(' || ')+')';

  if(domain!=='gastos'&&Object.keys(old).some(k=>!k.startsWith('.')))throw Error('Revisar reglas por registro de '+domain);
  if(domain==='gastos'&&(!child||Object.keys(old).some(k=>!k.startsWith('.')&&k!=='$gasto')))throw Error('Revisar subreglas de gastos');
  const sourceRow=domain==='gastos'?structuredClone(child):{},summaryRow=tree(domain,[],false),sourceTree=tree(domain,[],true);
  const peer="newData.parent().parent().child('listados_resumen/"+domain+"').child($record)",prior="root.child('sisventas/"+domain+"').child($record)",oldRevision='('+prior+".child('"+M.revision+"').exists() ? "+prior+".child('"+M.revision+"').val() : 0)";
  if(domain!=='gastos')sourceRow['.write']='('+translated(write,domain,[],3)+') && (newData.exists() ? (newData.child(\''+M.revision+'\').val() === '+oldRevision+' + 1 && '+peer+'.exists()) : !'+peer+'.exists())';
  sourceRow['.read']='('+(domain==='gastos'?globalRead:read)+')'+(child?.['.read']?' || (('+child['.read'].replace(/\$gasto\b/g,'$record')+') && !'+commission('data')+')':'');
  const existingValidation=sourceRow['.validate'];sourceRow['.validate']=(existingValidation?'('+existingValidation+') && ':'')+sourceTree['.validate'];
  sourceRow.$f0=sourceTree.$f0;
  sourceRow[M.revision]={'.validate':"newData.isNumber() && newData.val() === newData.parent().parent().parent().child('listados_resumen/"+domain+"').child($record).child('"+M.revision+"').val()"};
  sourceRow[M.operation]={'.validate':"newData.isString() && newData.val().length <= 160 && newData.val() === newData.parent().parent().parent().child('listados_resumen/"+domain+"').child($record).child('"+M.operation+"').val()"};
  if(child){function rename(n){for(const [k,v]of Object.entries(n))if(typeof v==='string')n[k]=v.replace(/\$gasto\b/g,'$record');else if(v&&typeof v==='object')rename(v);}rename(sourceRow);}
  summaryRow['.write']='('+translated(write,domain,[],4)+')';
  if(child){let extra=[child['.write']&&translated(child['.write'],domain,['$record'],4),child.bajaAdministrativa?.['.write']&&translated(child.bajaAdministrativa['.write'],domain,['$record',"'bajaAdministrativa'"],4)].filter(Boolean).map(x=>x.replace(/\$gasto\b/g,'$record'));if(extra.length)summaryRow['.write']='('+summaryRow['.write']+') || '+extra.map(e=>'('+e+')').join(' || ');}
  summaryRow['.read']=translated(sourceRow['.read'],domain,['$record'],4);
  for(const [name,condition]of Object.entries({_svListSummary:'newData.val() === true',_svListAttachments:'newData.hasChildren()',_svListDocumental:domain==='ordenes_trabajo'?"newData.hasChildren(['completo','fotos','firma'])":'false'}))summaryRow[name]={'.validate':condition};
  summaryRow[M.revision]={'.validate':"newData.isNumber() && newData.val() === newData.parent().parent().parent().parent().child('"+domain+"').child($record).child('"+M.revision+"').val()"};
  summaryRow[M.operation]={'.validate':"newData.isString() && newData.val() === newData.parent().parent().parent().parent().child('"+domain+"').child($record).child('"+M.operation+"').val()"};
  const next={...old,'.read':false,'.write':domain==='gastos'?write:false};delete next.$gasto;next.$record=sourceRow;s[domain]=next;
  index[domain]={'.read':domain==='gastos'?globalRead:read,'.write':false,_svCoverage:{'.write':false},$record:summaryRow};if(old['.indexOn'])index[domain]['.indexOn']=old['.indexOn'];
  if(domain==='gastos'){
   function employeeTree(parts){const src=at(rootAt(parts.length+4)+".child('sisventas/gastos').child($record)",parts),record=rootAt(parts.length+4)+".child('sisventas/gastos').child($record)",normal=tree(domain,parts,false),first=parts[0];let allowed='false';
    if(parts.length===0)allowed='true';else if(parts.length===1)allowed='('+M.publicFields.concat(['pagos','compensaciones','adelantosAplicados']).map(k=>first+" === '"+k+"'").join(' || ')+')';
    else if(parts.length===2)allowed="("+['pagos','compensaciones','adelantosAplicados'].map(k=>first+" === '"+k+"'").join(' || ')+")";
    else if(parts.length===3)allowed="("+['pagos','compensaciones','adelantosAplicados'].map(k=>first+" === '"+k+"'").join(' || ')+") && ("+M.paymentFields.concat(['gastoFbKey','periodoDescuento','periodoComputo','mes']).map(k=>parts[2]+" === '"+k+"'").join(' || ')+')';
    normal['.validate']='('+normal['.validate']+') && (!'+commission(record)+' || ('+allowed+'))';
    if(parts.length<8){const name='$f'+parts.length;normal[name]=employeeTree(parts.concat(name));}return normal;
   }
   const publicRow=employeeTree([]),record="newData.parent().parent().parent().parent().child('sisventas/gastos').child($record)";
   publicRow['.write']=summaryRow['.write'];publicRow['.read']='('+globalRead+') || ('+translated(child['.read'].replace(/\$gasto\b/g,'$record'),domain,['$record'],4)+')';
   for(const field of [M.revision,M.operation,'_svListSummary','_svListAttachments'])publicRow[field]=structuredClone(summaryRow[field]);
   const atRecord="newData.parent().parent().parent().parent().parent().child('sisventas/gastos').child($record)",id="("+atRecord+".child('ventaId').exists() ? '' + "+atRecord+".child('ventaId').val() : ("+atRecord+".child('numeroVenta').exists() ? '' + "+atRecord+".child('numeroVenta').val() : ("+atRecord+".child('ventaNumero').exists() ? '' + "+atRecord+".child('ventaNumero').val() : '')))";
   const customer="("+atRecord+".child('cliente').isString() && "+atRecord+".child('cliente').val() !== '' ? ' · ' + "+atRecord+".child('cliente').val() : ("+atRecord+".child('clienteNombre').isString() && "+atRecord+".child('clienteNombre').val() !== '' ? ' · ' + "+atRecord+".child('clienteNombre').val() : ''))";
   publicRow.bajaAdministrativa=tree(domain,["'bajaAdministrativa'"],false);publicRow.bajaAdministrativa['.validate']='('+commission(atRecord)+' ? (newData.val() === true && '+atRecord+".child('bajaAdministrativa').exists()) : ("+publicRow.bajaAdministrativa['.validate']+'))';
   publicRow.descripcion={'.validate':'('+commission(atRecord)+" ? newData.val() === ('Comisión venta #' + "+id+" + "+customer+") : newData.val() === "+atRecord+".child('descripcion').val())"};
   index.gastos_empleado={'.read':read,'.write':false,_svCoverage:{'.write':false},$record:publicRow};if(old['.indexOn'])index.gastos_empleado['.indexOn']=old['.indexOn'];
  }

 }
 s.listados_resumen=index;out.rules.sv_record_list_config={'.read':"auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true",'.write':false};return out;
}
module.exports={prepare};
