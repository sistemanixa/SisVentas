'use strict';
const {digest}=require('./labor-guard');
const PURPOSE='sale-commission-assignment';
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),same=(a,b)=>digest(a)===digest(b);
const key=v=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const fail=(message,code='SV_CAS_CONFLICT',statusCode=409)=>Object.assign(Error(message),{statusCode,code});
function describe(body){
 if(body?.purpose!==PURPOSE||body.kind!=='atomic'||body.path!==''||!object(body.value)||!object(body.expectedHashes))throw fail('La asignación requiere un guardado protegido.','SV_COMMISSION_ASSIGNMENT_INPUT',400);
 const sources=Object.keys(body.expectedHashes),salePath=sources.find(p=>/^sisventas\/ventas\/[^/]+$/.test(p)),employeePath=sources.find(p=>/^sisventas\/empleados\/[^/]+$/.test(p));
 if(sources.length!==2||!salePath||!employeePath||!key(salePath.split('/')[2])||!key(employeePath.split('/')[2])||Object.values(body.expectedHashes).some(h=>!/^[a-f0-9]{64}$/.test(h||'')))throw fail('Verificá la venta y la persona seleccionada.','SV_COMMISSION_ASSIGNMENT_INPUT',400);
 const targets=['comisionadoPrincipalFbKey','comisionadoPrincipal','audit'].map(k=>salePath+'/'+k);
 if(!same(Object.keys(body.value).sort(),targets.sort())||body.value[salePath+'/comisionadoPrincipalFbKey']!==employeePath.split('/')[2]||typeof body.value[salePath+'/comisionadoPrincipal']!=='string'||!body.value[salePath+'/comisionadoPrincipal'].trim()||!Array.isArray(body.value[salePath+'/audit']))throw fail('La asignación no puede cambiar otros datos de la venta.','SV_COMMISSION_ASSIGNMENT_INPUT',400);
 return{salePath,employeePath,employeeKey:employeePath.split('/')[2],name:body.value[salePath+'/comisionadoPrincipal'],audit:body.value[salePath+'/audit']};
}
async function access(read,actor){
 if(!key(actor?.uid)||actor.claims?.uid!==actor.uid||actor.claims?.svPasswordChangeRequired===true)throw fail('Iniciá sesión nuevamente.','SV_LABOR_AUTH_CHANGED',403);
 const profile=await read('sv_chat_roles/'+actor.uid),cfg=await read('sv_permisos/admin'),reset=await read('sv_access_resets/'+actor.uid),blocked=Object.values(cfg?.bloqueados||{});
 if(profile?.activo!==true||profile.rol!=='admin'||cfg?.indiceVersion!==2||cfg.indiceModulos?.comisiones!==true||blocked.includes('comisiones')||!['venta','detalle'].some(m=>cfg.indiceModulos?.[m]===true&&!blocked.includes(m))||cfg.acciones?.ventas?.editar===false||cfg.acciones?.comisiones?.distribuir===false||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail('No tenés permiso para asignar el comisionado.','SV_LABOR_AUTH_CHANGED',403);
 return{profile,cfg,reset};
}
async function validate({scope,actor,body,now=Date.now}){
 const d=describe(body),authority=await access(p=>scope.get(p),actor),[sale,employee]=await Promise.all([scope.get(d.salePath),scope.get(d.employeePath)]);
 if(!object(sale)||!object(employee)||employee.activo===false||employee.eliminado===true||['inactivo','eliminado'].includes(String(employee.estado||'').toLowerCase())||employee.fbKey!=null&&employee.fbKey!==d.employeeKey||employee.activo!=null&&typeof employee.activo!=='boolean'||typeof employee.nombre!=='string'||employee.nombre!==d.name)throw fail('La venta o la persona seleccionada cambió.');
 if(sale.comisionadoPrincipalFbKey===d.employeeKey&&sale.comisionadoPrincipal===d.name)throw fail('La venta ya tiene ese comisionado. No se modificó.');
 const old=sale.audit??[];if(!Array.isArray(old)||d.audit.length!==old.length+1||!same(d.audit.slice(0,-1),old))throw fail('La auditoría original de la venta debe conservarse.');
 const entry=d.audit.at(-1),fields=['tipo','actorUid','usuario','fecha','accion','empleadoFbKey','empleadoNombre'];
 if(!object(entry)||!same(Object.keys(entry).sort(),fields.sort())||entry.tipo!=='comisionado_principal_asignado'||entry.actorUid!==actor.uid||typeof entry.usuario!=='string'||!entry.usuario.trim()||entry.usuario.length>300||typeof entry.fecha!=='string'||!Number.isFinite(Date.parse(entry.fecha))||new Date(entry.fecha).toISOString()!==entry.fecha||Math.abs(now()-Date.parse(entry.fecha))>300000||entry.accion!=='Comisionado principal asignado'||entry.empleadoFbKey!==d.employeeKey||entry.empleadoNombre!==d.name)throw fail('La auditoría de asignación no corresponde a esta sesión.');
 scope.beforeCommit(async({readFresh})=>{if(!same(await access(readFresh,actor),authority))throw fail('Los permisos cambiaron.','SV_LABOR_AUTH_CHANGED');const [freshSale,freshEmployee]=await Promise.all([readFresh(d.salePath),readFresh(d.employeePath)]);if(!same(freshSale,sale)||!same(freshEmployee,employee))throw fail('La venta o la persona cambió antes de confirmar.');});
 return d;
}
module.exports={PURPOSE,describe,access,validate};
