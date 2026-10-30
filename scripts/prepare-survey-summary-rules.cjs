'use strict';
// Propuesta pura; conserva las lecturas/escrituras originales y añade consistencia.
const Model=require('../js/core/survey-summaries.v1');
const denied=v=>v===undefined||v===false||v==='false';
function prepare(base){
 const out=structuredClone(base),r=out.rules,s=r?.sisventas,original=s?.relevamientos;
 if(!original||!denied(r['.read'])||!denied(r['.write'])||!denied(s['.read'])||!denied(s['.write']))throw Error('Revisar permisos efectivos y padres de Relevamientos antes de preparar el corte');
 if(s.relevamientos_resumen)throw Error('Ya existe un índice; no sobrescribir su preparación');
 const read=original['.read'],write=original['.write'];
 if([read,write].some(rule=>typeof rule!=='string'||rule==='true'||!rule.includes('auth')||/\b(?:data|newData)\b|\$[a-zA-Z_]/.test(rule)))throw Error('Las reglas originales no son trasladables sin revisión');
 if(Object.keys(original).some(key=>!key.startsWith('.')))throw Error('Hay condiciones por registro que deben conservarse explícitamente');
 const source="newData.parent().parent().parent().child('relevamientos').child($survey)",target="newData.parent().parent().child('relevamientos_resumen').child('records').child($survey)";
 const ready=path=>path+".child('meta').child('schema').val() === 1 && "+path+".child('meta').child('ready').val() === true";
 const expected=(src,field)=>'('+src+".child('"+field+"').exists() ? "+src+".child('"+field+"').val() : "+(field==='id'?'$survey':"''")+')';
 const matches=Model.fields.map(field=>target+".child('"+field+"').isString() && "+target+".child('"+field+"').val() === "+expected('newData',field)).join(' && ');
 original['.write']=false;
 original.$survey={'.write':'('+write+') && ('+ready("newData.parent().parent().child('relevamientos_resumen')")+') && ((newData.exists() && '+target+'.exists() && '+matches+') || (!newData.exists() && !'+target+'.exists()))'};
 const row={'.write':'('+write+') && ('+ready('newData.parent().parent()')+') && ((newData.exists() && '+source+'.exists()) || (!newData.exists() && !'+source+'.exists()))','.validate':"newData.hasChildren(['id','cliente','direccion','autor','savedAt'])"};
 for(const field of Model.fields)row[field]={'.validate':"newData.isString() && newData.val() === "+expected("newData.parent().parent().parent().parent().child('relevamientos').child($survey)",field)};
 row.$other={'.validate':false};
 s.relevamientos_resumen={'.read':read,'.write':false,meta:{'.write':false},records:{'.indexOn':['savedAt'],'$survey':row}};
 return out;
}
module.exports={prepare};
