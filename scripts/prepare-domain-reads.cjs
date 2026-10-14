'use strict';
const fs=require('node:fs'),policy=require('../js/core/domain-read-policy.js'),actions=require('./action-policy.cjs');
const base=JSON.parse(fs.readFileSync('security/database.domain-write.candidate.json','utf8'));
const r=base.rules.sisventas,role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()";
const internal="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && ("+policy.internalRoles.map(x=>role+" === '"+x+"'").join(' || ')+')';
function allowed(module) {
 const cfg="root.child('sv_permisos').child("+role+")",blocked=cfg+".child('bloqueados')";
 const defaults=policy.restrictedDefaults[module]||policy.internalRoles;
 return '((!'+cfg+'.exists() && ('+defaults.map(x=>role+" === '"+x+"'").join(' || ')+')) || ('+cfg+'.exists() && '+Array.from({length:64},(_,i)=>blocked+".child('"+i+"').val() !== '"+module+"'").join(' && ')+'))';
}
function action(key) {
 const [module,name]=key.split('.'),value="root.child('sv_permisos').child("+role+").child('acciones').child('"+module+"').child('"+name+"')";
 const rule=actions[key];if(!rule)throw Error('Acción no registrada: '+key);
 const defaults=rule.admin?['admin']:(rule.roles||policy.internalRoles);
 return '('+allowed(rule.modulo||module)+' && ('+value+'.val() === true || (!'+value+'.exists() && ('+defaults.map(x=>role+" === '"+x+"'").join(' || ')+'))))';
}
const protectedNodes=Object.keys(policy.domains).filter(x=>!x.includes('/'));
r['.read']=false;
// Primer corte: los dominios no migrados conservan lectura por identidad interna.
// No dar permiso padre: una concesión padre haría ineficaces las reglas hijas.
for(const [name,node] of Object.entries(r))if(!name.startsWith('.')&&!name.startsWith('$')&&name!=='config')node['.read']=node['.read']===undefined?internal:'('+internal+') || ('+node['.read']+')';
r.$dominio['.read']='('+internal+') && '+allowed('configuracion')+' && !$dominio.beginsWith(\'_\') && '+[...protectedNodes,'config'].map(x=>"$dominio !== '"+x+"'").join(' && ');
r.config['.read']=false;
for(const [name,node] of Object.entries(r.config))if(!name.startsWith('.')&&!name.startsWith('$'))node['.read']=node['.read']===undefined?internal:'('+internal+') || ('+node['.read']+')';
r.config.$config={'.read':'('+internal+') && '+Object.keys(policy.domains).filter(p=>p.startsWith('config/')).map(p=>"$config !== '"+p.split('/')[1]+"'").join(' && ')+" && !$config.beginsWith('_')"};
for(const [path,def] of Object.entries(policy.domains)) {
 const inheritedWrite= !path.includes('/') && !r[path];
 let node=r;for(const part of path.split('/'))node=node[part]||(node[part]={});
 // Al crear una regla explícita, Firebase deja de usar el comodín de ese
 // nombre. Copiar su permiso efectivo anterior evita bloquear escrituras.
 if(inheritedWrite)node['.write']=internal;
 node['.read']='('+internal+') && ('+[...def.modules.map(allowed),...(def.actions||[]).map(action)].join(' || ')+')';
 if(path==='productos')node['.read']='('+node['.read']+') || ('+base.rules.sisventas.productos['.read']+')';
}
fs.writeFileSync('security/database.domain-read.candidate.json',JSON.stringify(base,null,2)+'\n');
console.log('Candidata de lectura preparada para '+Object.keys(policy.domains).length+' dominios. No aplicada.');
