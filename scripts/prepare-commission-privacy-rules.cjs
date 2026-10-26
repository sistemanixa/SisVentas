'use strict';
// OFFLINE PROPOSAL ONLY. No credentials, Firebase SDK, remote reads or apply.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Policy=require('../cotizador/labor-fence-policy');
const Domains=require('../cotizador/domain-read-policy');
const BASELINE_HASH='6268175501462837f6b12f4575a7c530a6e5ea942246f953067df8efc5940d19';
const RAW=['ctaemp','gastos','comisiones_generacion','empleados','auditoria_pagos','pagos_realizados'];
const CONFIG=['cargos','comisiones','maxComisionPct','comisionesEmpleados'];
const VIEW_ROOT='sv_employee_account_views';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const closed=v=>v===undefined||v===false||v==='false';
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(object(v))return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const profile="root.child('sv_chat_roles').child(auth.uid)",role=profile+".child('rol').val()",cfg="root.child('sv_permisos').child("+role+")";
const reset="root.child('sv_access_resets').child(auth.uid)";
const listed=values=>'('+values.map(v=>role+" === '"+v+"'").join(' || ')+')';
const builtin=listed(Domains.internalRoles),external=listed(['distribuidor','distribuidora','compras_paraguay','cliente','externo','external']);
const internal="auth != null && "+profile+".child('activo').val() === true && "+profile+".child('rol').isString() && ("+builtin+" || ("+cfg+".exists() && "+cfg+".child('indiceVersion').val() === 2 && !"+external+"))";
const accessReset="auth != null && auth.token.svPasswordChangeRequired !== true && "+reset+".child('required').val() !== true && (!"+reset+".child('version').exists() || auth.token.svAccessVersion === "+reset+".child('version').val())";
function moduleAllowed(name){const defaults=Domains.restrictedDefaults[name]||Domains.internalRoles;return '((!'+cfg+'.exists() && '+listed(defaults)+') || ('+cfg+".exists() && "+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos/"+name+"').val() === true))";}
function actionAllowed(group,name,defaults=['admin']){const action=cfg+".child('acciones/"+group+'/'+name+"')";return '('+action+".val() === true || (!"+action+'.exists() && '+listed(defaults)+'))';}
const ownAccess='('+moduleAllowed('ctaemp')+' || ('+moduleAllowed('dashboard')+' && '+actionAllowed('dashboard','miCuenta',['administrativo','vendedor','tecnico_vendedor','tecnico'])+'))';
const managerAccount='('+moduleAllowed('ctaemp')+' && '+actionAllowed('empleados','verCuentas')+')';
const globalManager='('+['gastos','tesoreria','reportes','rentabilidad'].map(moduleAllowed).concat(['('+moduleAllowed('comisiones')+' && '+actionAllowed('comisiones','aprobar')+')',managerAccount,'('+moduleAllowed('dashboard')+' && '+actionAllowed('dashboard','metricasGlobales')+')']).join(' || ')+')';
const directoryManager='('+managerAccount+' || ('+moduleAllowed('empleados')+' && '+actionAllowed('empleados','editar',['admin','administrativo'])+'))';
const cargoManager='('+directoryManager+' || '+moduleAllowed('configuracion')+')';
const companionManager='('+['cobranzas','gastos','tesoreria'].map(moduleAllowed).join(' || ')+')';
const financial='('+internal+' && '+role+" === 'admin' && ("+moduleAllowed('configuracion')+' || '+moduleAllowed('comisiones')+') && '+accessReset+')';
function ownEmployee(id){const binding="root.child('sv_empleado_uid').child(auth.uid).child('perfilFbKey').val()",person="root.child('sv_usuarios').child("+binding+")";return '('+person+".child('uid').val() === auth.uid && "+person+".child('activo').val() !== false && "+person+".child('empleadoFbKey').isString() && "+person+".child('empleadoFbKey').val() === "+id+')';}
const ready=meta=>meta+".child('schema').val() === 1 && "+meta+".child('ready').val() === true";
const employees="root.child('"+VIEW_ROOT+"/v1/employees')",global="root.child('"+VIEW_ROOT+"/v1/globalExpenses')";
const employeeRead='('+internal+' && '+accessReset+' && '+ready("data.child('meta')")+' && (('+ownEmployee('$employee')+' && '+ownAccess+') || '+managerAccount+'))';
const globalRead='('+internal+' && '+accessReset+' && '+ready("data.child('meta')")+' && '+globalManager+')';
const companionRead='('+internal+' && '+accessReset+' && '+ready("data.child('meta')")+' && '+companionManager+')';
const directoryRead='('+internal+' && '+accessReset+' && '+ready("data.child('meta')")+' && '+directoryManager+')';
const payrollMetaManager='('+moduleAllowed('empleados')+' && ('+actionAllowed('empleados','bonificar')+' || '+actionAllowed('empleados','registrarHaberes')+'))';
const payrollMetaRead='('+internal+' && '+accessReset+' && '+ready("root.child('sv_employee_account_views/v1/globalEmployeeDirectory/meta')")+' && '+ready('data')+' && '+payrollMetaManager+')';
const cargoRead='('+internal+' && '+accessReset+' && '+ready("data.child('meta')")+' && '+cargoManager+')';
const value="data.child('value')",binding="root.child('sv_empleado_uid').child(auth.uid).child('perfilFbKey').val()",person="root.child('sv_usuarios').child("+binding+")",ownId=person+".child('empleadoFbKey').val()";
const ownerAliases=['empleadoId','empleadoFbKey','empFbKey'];
const matchingOwners=ownerAliases.map(k=>'(!'+value+".child('"+k+"').exists() || ("+value+".child('"+k+"').isString() && ("+value+".child('"+k+"').val() === '' || "+value+".child('"+k+"').val() === "+ownId+')))' ).join(' && ');
const legacy=value+".child('legacyKey')",legacyOwn='('+legacy+".isString() && "+legacy+".val().matches(/^ctaemp\\/[^\\/]+\\/[^\\/]+$/) && "+legacy+".val().beginsWith('ctaemp/' + "+ownId+" + '/'))";
const matchingLegacy='(!'+legacy+'.isString() || !'+legacy+".val().beginsWith('ctaemp/') || "+legacyOwn+')';
const hasOwnReference='('+ownerAliases.map(k=>value+".child('"+k+"').val() === "+ownId).concat([legacyOwn]).join(' || ')+')';
const itemRead='('+internal+' && '+accessReset+' && '+ready("data.child('meta')")+' && '+ready(global+".child('meta')")+' && '+ownEmployee(ownId)+' && '+ownId+" !== '' && "+matchingOwners+' && '+matchingLegacy+' && '+hasOwnReference+' && '+ownAccess+')';
function expression(value){if(typeof value!=='string'&&typeof value!=='boolean')throw Error('Expresión de lectura no reconocida');return String(value);}
function restrictReads(node,condition){for(const [key,value]of Object.entries(node||{})){if(key==='.read'&&!closed(value))node[key]='('+expression(value)+') && ('+condition+')';else if(!key.startsWith('.')&&object(value))restrictReads(value,condition);}}
function assertAncestor(node,label){if(!object(node)||!closed(node['.read'])||!closed(node['.write']))throw Error('Concesión ancestro inesperada: '+label);}
function build(input,{expectedHash=BASELINE_HASH}={}){
 if(!object(input)||!object(input.rules)||!/^[a-f0-9]{64}$/.test(expectedHash)||hash(input)!==expectedHash)throw Error('Base exacta de reglas requerida; no se aplicó ninguna regla');
 const r=input.rules,s=r.sisventas;assertAncestor(r,'raíz');assertAncestor(s,'sisventas');assertAncestor(s.config,'config');
 if(Object.keys(r).some(k=>k.startsWith('$')))throw Error('Comodín raíz no revisado');if(Object.hasOwn(r,VIEW_ROOT))throw Error('Las vistas ya existen: revisar la transición');
 const serviceWrite=Policy.metadataRules().sv_labor_indexes['.write'];if(r.sv_labor_indexes?.['.write']!==serviceWrite)throw Error('Fence de índices no reconocido');
 for(const name of RAW)if(!object(s[name]))throw Error('Nodo original ausente: '+name);
 for(const name of CONFIG)if(!object(s.config[name]))throw Error('Configuración original ausente: '+name);
 const result=structuredClone(input),next=result.rules,domain=next.sisventas;
 for(const name of RAW)restrictReads(domain[name],financial);
 for(const name of CONFIG)restrictReads(domain.config[name],financial);
 if(domain.$dominio)restrictReads(domain.$dominio,['config',...RAW].map(k=>"$dominio !== '"+k+"'").join(' && '));
 if(domain.config.$config)restrictReads(domain.config.$config,CONFIG.map(k=>"$config !== '"+k+"'").join(' && '));
 // New child validator only; original config writes/validators are preserved.
 next.sv_labor_config.employeeAccountViews={'.validate':"newData.hasChildren(['schema','enabled'])",schema:{'.validate':"newData.val() === 1"},enabled:{'.validate':"newData.isBoolean()"},'$other':{'.validate':false}};
 next[VIEW_ROOT]={'.read':false,'.write':serviceWrite,v1:{'.read':false,employees:{'.read':false,'$employee':{'.read':employeeRead}},globalExpenses:{'.read':globalRead,rows:{'.read':false,'.indexOn':['value/tipoPagable'],'$expense':{'.read':itemRead}}},globalPaymentBatches:{'.read':companionRead,rows:{'.read':false}},globalPaymentAudit:{'.read':companionRead,rows:{'.read':false}},globalEmployeeDirectory:{'.read':directoryRead,rows:{'.read':false,'$employee':{meta:{'.read':payrollMetaRead}}}},globalCargoDirectory:{'.read':cargoRead,rows:{'.read':false}}}};
 return result;
}
if(require.main===module){const args=process.argv.slice(2),[source,target,expectedHash=BASELINE_HASH]=args;const resolved=p=>path.resolve(p).toLowerCase();if(args.length<2||args.length>3||!source||!target||!target.endsWith('.candidate.json')||resolved(source)===resolved(target))throw Error('Uso OFFLINE: node scripts/prepare-commission-privacy-rules.cjs base-local.json salida.candidate.json [hash-canónico-base]');const result=build(JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,'')),{expectedHash});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log('PROPUESTA LOCAL, NO APLICADA. Base '+expectedHash+'; candidata '+hash(result));}
module.exports={build,hash,BASELINE_HASH,VIEW_ROOT,RAW,CONFIG,expressions:{financial,employeeRead,globalRead,itemRead,internal,accessReset,ownAccess,managerAccount,globalManager,companionManager,companionRead,directoryManager,cargoManager,directoryRead,cargoRead,payrollMetaManager,payrollMetaRead},moduleAllowed,actionAllowed};
