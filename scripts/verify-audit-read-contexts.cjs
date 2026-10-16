'use strict';
// Solo GET. No crea sesiones, tokens personalizados ni registros de prueba.
const fs=require('fs'),assert=require('assert/strict'),{gcloud}=require('./lib/gcloud-cli.cjs'),{hash}=require('./apply-audit-cutover.cjs');
const policy=require('../js/core/domain-read-policy'),index=require('../js/core/permission-index'),actions=require('./action-policy.cjs');
(async()=>{if(!process.argv.includes('--check')){console.log(JSON.stringify({mode:'plan',reads:'Solo GET de estados HTTP con contexto UID limitado. Requiere inventario privado y corte exacto publicado.'}));return;}const token=gcloud(['auth','print-access-token']),headers={Authorization:'Bearer '+token},base='https://nixa-sisventas-default-rtdb.firebaseio.com/';
 const rules=await(await fetch(base+'.settings/rules.json',{headers})).json();assert.equal(hash(rules),hash(JSON.parse(fs.readFileSync('security/database.compact-final.candidate.json'))),'No comprobar como aplicado un corte que no coincide');
 const permissions=await(await fetch(base+'sv_permisos.json',{headers})).json(),inventory=JSON.parse(fs.readFileSync('tmp/user-directory-audit/inventory.private.json')),results=[];
 const request=async(uid,p,query)=>{const url=new URL(base+p+'.json');url.searchParams.set('auth_variable_override',JSON.stringify({uid,token:{}}));if(query)for(const[k,v]of Object.entries(query))url.searchParams.set(k,v);else url.searchParams.set('shallow','true');const r=await fetch(url,{method:'GET',headers,signal:AbortSignal.timeout(20000)});await r.body?.cancel();return r.status;};
 const numbered={};
 for(const profile of inventory.profiles){
  if(!profile.uid)continue;const identity=inventory.identities[profile.uid],role=identity?.rol,active=identity?.activo===true&&profile.activo!==false,label=String(role)+'-'+(numbered[role]=(numbered[role]||0)+1),cfg=permissions[role]||{};
  assert.ok([401,403].includes(await request(profile.uid,'sv_access_control')),'El contexto debe estar limitado por reglas');
  const moduleAllowed=m=>cfg.indiceModulos?.[m]===true;
  const actionAllowed=action=>{const a=actions[action];if(!a||!moduleAllowed(a.modulo))return false;const[group,name]=action.split('.'),v=cfg.acciones?.[group]?.[name];return typeof v==='boolean'?v:a.admin?role==='admin':(a.roles||policy.internalRoles).includes(role);};
  const domains={...policy.domains,...index.additionalDomains};
  const paths=process.argv.includes('--all-domains')?Object.keys(domains):['clientes','productos','ventas','pagos','empleados','config/cargos','relevamientos','config/comisionesEmpleados','mantenimiento'];
  for(const p of paths){
   const def=domains[p],expected=active&&policy.internalRoles.includes(role)&&(def.modules.some(moduleAllowed)||(def.actions||[]).some(actionAllowed));const status=await request(profile.uid,'sisventas/'+p);assert.equal(status,expected?200:401,label+' '+p);results.push({actor:label,path:p,status});
  }
  for(const path of ['sv_usuarios','sisventas/config/loginRapido','sisventas/_integraciones_server']){const status=await request(profile.uid,path);assert.equal(status,401,label+' '+path);results.push({actor:label,path,status});}
  if(active&&profile.empleadoFbKey&&policy.internalRoles.includes(role)){
   const expected=role==='admin'||moduleAllowed('ctaemp')||moduleAllowed('dashboard')&&(cfg.acciones?.dashboard?.miCuenta!==false&&role!=='admin');
   const status=await request(profile.uid,'sisventas/ctaemp/'+profile.empleadoFbKey);assert.equal(status,expected?200:401,label+' cuenta propia');results.push({actor:label,path:'ctaemp/propia',status});
  }
 }
 fs.writeFileSync('tmp/user-directory-audit/after-cut-read-contexts.json',JSON.stringify({rules:hash(rules),mode:'Solo GET con contexto UID; no login Auth',allDomains:process.argv.includes('--all-domains'),results},null,2));console.log(JSON.stringify({identities:inventory.profiles.length,checks:results.length,matched:true,realPasswordsChanged:false}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
