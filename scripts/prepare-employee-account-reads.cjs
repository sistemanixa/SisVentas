'use strict';
const fs=require('fs');
const base=JSON.parse(fs.readFileSync('security/database.domain-read.candidate.json'));
const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()";
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const internal="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && ("+roles.map(x=>role+" === '"+x+"'").join(' || ')+')';
const cfg="root.child('sv_permisos').child("+role+")";
function moduleAllowed(name,defaults){return '((!'+cfg+'.exists() && ('+defaults.map(x=>role+" === '"+x+"'").join(' || ')+')) || ('+cfg+'.exists() && '+Array.from({length:64},(_,i)=>cfg+".child('bloqueados').child('"+i+"').val() !== '"+name+"'").join(' && ')+'))';}
function action(name,defaults){const [mod,key]=name.split('.'),p=cfg+".child('acciones').child('"+mod+"').child('"+key+"')";return '('+p+'.val() === true || (!'+p+'.exists() && ('+defaults.map(x=>role+" === '"+x+"'").join(' || ')+')))';}
const admin='('+internal+') && '+moduleAllowed('ctaemp',roles)+' && '+action('empleados.verCuentas',['admin']);
const profile="root.child('sv_usuarios').child(root.child('sv_empleado_uid').child(auth.uid).child('perfilFbKey').val())";
const own='('+internal+') && '+profile+".child('uid').val() === auth.uid && "+profile+".child('activo').val() !== false && "+profile+".child('empleadoFbKey').isString() && "+profile+".child('empleadoFbKey').val() === $empleado && ("+moduleAllowed('ctaemp',roles)+' || ('+moduleAllowed('dashboard',roles)+' && '+action('dashboard.miCuenta',['administrativo','vendedor','tecnico_vendedor','tecnico'])+'))';
base.rules.sv_empleado_uid={'.read':false,'.write':false,'$uid':{'.read':'('+internal+') && auth.uid === $uid'}};
const r=base.rules.sisventas;r.ctaemp={'.read':admin,'.write':internal,'$empleado':{'.read':own}};
r.$dominio['.read']+=' && $dominio !== \'ctaemp\'';
const ownQuery=own.replaceAll('$empleado','query.equalTo');
const ownExpense=own.replaceAll('$empleado',"(data.child('empleadoId').isString() && data.child('empleadoId').val() !== '' ? data.child('empleadoId').val() : data.child('empleadoFbKey').val())");
r.gastos['.read']='('+r.gastos['.read']+') || (('+ownQuery+") && (query.orderByChild === 'empleadoId' || query.orderByChild === 'empleadoFbKey'))";
r.gastos['.indexOn']=['empleadoId','empleadoFbKey'];
r.gastos.$gasto={'.read':ownExpense,'.validate':"!newData.child('empleadoId').exists() || !newData.child('empleadoFbKey').exists() || newData.child('empleadoId').val() === '' || newData.child('empleadoFbKey').val() === '' || newData.child('empleadoId').val() === newData.child('empleadoFbKey').val()"};
r.vacaciones['.read']='('+r.vacaciones['.read']+') || (('+ownQuery+") && query.orderByChild === 'empleadoId')";
r.vacaciones['.indexOn']=['empleadoId'];
r.vacaciones.$periodo={'.read':own.replaceAll('$empleado',"data.child('empleadoId').val()")};
fs.writeFileSync('security/database.employee-account-read.candidate.json',JSON.stringify(base,null,2)+'\n');
console.log('Lecturas de cuentas personales preparadas; sin aplicación en producción.');
