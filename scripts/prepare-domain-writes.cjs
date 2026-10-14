'use strict';
const fs=require('node:fs');
const base=JSON.parse(fs.readFileSync('tmp/security-domain-rules-base.json','utf8'));
const r=base.rules.sisventas;
const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()";
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const internal="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && ("+roles.map(x=>role+" === '"+x+"'").join(' || ')+')';
const protectedNodes=['config','clientes','clientes_unificados','clientes_unificados_indice','ventas','pagos','cobros_grupos','cobros_adjuntos','control_cobros','cobros_cuenta','cobros_cuenta_adjuntos','control_cobro_cuenta'];
function allowed(module,defaultRoles){
 const cfg="root.child('sv_permisos').child("+role+")",blocked=cfg+".child('bloqueados')";
 const checks=Array.from({length:64},(_,i)=>blocked+".child('"+i+"').val() !== '"+module+"'");
 return '('+internal+') && ((!'+cfg+'.exists() && ('+defaultRoles.map(x=>role+" === '"+x+"'").join(' || ')+')) || ('+cfg+'.exists() && '+checks.join(' && ')+'))';
}
function action(module,name,defaultRoles){
 const value="root.child('sv_permisos').child("+role+").child('acciones').child('"+module+"').child('"+name+"')";
 return '('+allowed(module,roles)+') && ('+value+'.val() === true || (!'+value+'.exists() && ('+defaultRoles.map(x=>role+" === '"+x+"'").join(' || ')+')))';
}
r['.write']=false;
// Las otras colecciones conservan autorización durante este corte.
// El comodín contempla colecciones vacías y excluye los dominios protegidos.
for(const [name,node]of Object.entries(r))if(!name.startsWith('.')&&!name.startsWith('$')&&!protectedNodes.includes(name)&&!name.startsWith('_')&&!['usuarios','chat'].includes(name))node['.write']=internal;
r.$dominio={'.write':'('+internal+') && !$dominio.beginsWith(\'_\') && '+[...protectedNodes,'usuarios','chat'].map(n=>"$dominio !== '"+n+"'").join(' && ')};
const commercial=['admin','administrativo','vendedor','tecnico_vendedor'];
r.config['.write']=action('configuracion','editar',['admin']);
// Los cargos se administran desde Empleados, no requieren acceso a Configuración.
r.config.cargos=r.config.cargos||{};
r.config.cargos['.write']=action('empleados','editar',['admin','administrativo']);
for(const n of ['clientes','clientes_unificados','clientes_unificados_indice']){r[n]=r[n]||{};r[n]['.write']=allowed('clientes',commercial);}
r.ventas=r.ventas||{};r.ventas['.write']=allowed('venta',commercial);r.ventas.$venta=r.ventas.$venta||{};
for(const field of ['totalPagado','estadoPago']){r.ventas.$venta[field]=r.ventas.$venta[field]||{};r.ventas.$venta[field]['.write']=allowed('cobranzas',commercial);}
for(const n of ['pagos','cobros_grupos','cobros_adjuntos','control_cobros','cobros_cuenta','cobros_cuenta_adjuntos','control_cobro_cuenta']){r[n]=r[n]||{};r[n]['.write']=allowed('cobranzas',commercial);}
base.rules.sv_permisos.$rol=base.rules.sv_permisos.$rol||{};
base.rules.sv_permisos.$rol.bloqueados={'$indice':{'.validate':"$indice.matches(/^([0-9]|[1-5][0-9]|6[0-3])$/) && newData.isString()"}};
fs.writeFileSync('security/database.domain-write.candidate.json',JSON.stringify(base,null,2));
console.log('Primer corte de escrituras comerciales preparado. Lecturas y otros módulos pendientes. No aplicado.');

