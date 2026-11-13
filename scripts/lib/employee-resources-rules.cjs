'use strict';
// Offline composition only. Never reads credentials or writes remote rules.
const {fence,userActor}=require('../../cotizador/labor-fence-policy');
const closed=x=>x===undefined||x===false||x==='false';
function build(input){
 const out=structuredClone(input),r=out?.rules;
 if(!r||!closed(r['.write'])||Object.keys(r).some(k=>k.startsWith('$')&&!closed(r[k]?.['.write'])))throw Error('Concesión padre o comodín raíz sin revisar.');
 for(const [domain,path,module,action]of [['clothing','sv_employee_clothing','empleados','indumentaria'],['categories','sv_expense_categories','gastos','categorias']]){
  if(r[path])throw Error('El registro ya tiene reglas; requiere comparación explícita.');
  const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()",cfg="root.child('sv_permisos').child("+role+")",reset="root.child('sv_access_resets').child(auth.uid)";
  const access="auth != null && auth.uid === auth.token.actorUid && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && "+role+" === auth.token.svEmployeeResourcesRole && "+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos/"+module+"').val() === true && "+cfg+".child('indiceRevision').val() === auth.token.svEmployeeResourcesPermissionRevision && ("+cfg+".child('acciones/"+module+"/"+action+"').val() === true || (!"+cfg+".child('acciones/"+module+"/"+action+"').exists() && ("+role+" === 'admin' || "+role+" === 'administrativo'))) && auth.token.svPasswordChangeRequired !== true && "+reset+".child('required').val() !== true && (!"+reset+".child('version').exists() || "+reset+".child('version').val() === auth.token.svAccessVersion)";
  const references="(auth.token.svEmployeeResourcesEmployee === '' || (root.child('sisventas/empleados').child(auth.token.svEmployeeResourcesEmployee).exists() && root.child('sisventas/empleados').child(auth.token.svEmployeeResourcesEmployee).child('activo').val() !== false && root.child('sisventas/empleados').child(auth.token.svEmployeeResourcesEmployee).child('eliminado').val() !== true)) && (auth.token.svEmployeeResourcesExpense === '' || (root.child('sisventas/gastos').child(auth.token.svEmployeeResourcesExpense).exists() && root.child('sisventas/gastos').child(auth.token.svEmployeeResourcesExpense).child('eliminado').val() !== true && root.child('sisventas/gastos').child(auth.token.svEmployeeResourcesExpense).child('anulado').val() !== true))";
  r[path]={'.read':false,'.write':fence(1,userActor)+" && auth.token.svEmployeeResourcesVersion === 1 && auth.token.svEmployeeResourcesDomain === '"+domain+"' && ("+access+") && ("+references+")",
   '.validate':"newData.hasChildren(['schema','revision','operations','audit']) && newData.child('schema').val() === 1 && newData.child('revision').isNumber() && newData.child('revision').val() === (data.exists() ? data.child('revision').val() + 1 : 1) && newData.child('operations').child(auth.token.opId).exists() && newData.child('audit').child(auth.token.opId).child('actorUid').val() === auth.uid && newData.child('audit').child(auth.token.opId).child('at').isString()"};
 }
 return out;
}
module.exports={build};
