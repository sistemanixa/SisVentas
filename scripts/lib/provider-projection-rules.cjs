'use strict';
const {fields}=require('../../js/core/provider-writes');
function build(input){
 const result=structuredClone(input),rules=result.rules,privateRules=rules?.sisventas?.proveedores,publicRules=rules?.sv_catalogo_proveedores;
 if(!privateRules||!publicRules||typeof privateRules['.write']!=='string'||Object.keys(privateRules).some(k=>!k.startsWith('.')))throw Error('Revisar las reglas actuales de Proveedores antes de integrar');
 const authority=privateRules['.write'],newRoot='newData.parent().parent().parent()',mirror=newRoot+".child('sv_catalogo_proveedores').child($provider)";
 const fieldChecks=fields.map(field=>"(data.child('"+field+"').val() === newData.child('"+field+"').val() || newData.child('"+field+"').val() === "+mirror+".child('"+field+"').val())").join(' && ');
 privateRules['.write']=false;
 privateRules.$provider={'.write':'('+authority+') && (newData.exists() ? ('+fieldChecks+') : !'+mirror+'.exists())'};
 const fieldNames=fields.map(f=>"$field === '"+f+"'").join(' || '),privateField=newRoot+".child('sisventas/proveedores').child($provider).child($field)",scalar='(newData.isString() || newData.isNumber() || newData.isBoolean())';
 publicRules['.write']=false;
 publicRules.$provider={
  '.write':'('+authority+") && !newData.exists() && !newData.parent().parent().child('sisventas/proveedores').child($provider).exists()",
  '$field':{'.write':'('+authority+') && ('+fieldNames+') && newData.val() === '+privateField+'.val()', '.validate':'('+fieldNames+') && '+scalar+' && newData.val() === '+privateField+'.val()'}
 };
 return result;
}
module.exports={build};
