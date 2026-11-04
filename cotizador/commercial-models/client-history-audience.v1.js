(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./domain-read-policy'),require('./ot-personal-scope'));
 else root.SVClientHistoryAudience=factory(root.SVDomainReads,root.SVOTPersonalScope);
})(typeof window==='object'?window:globalThis,function(Domains,Assigned){
 'use strict';
 const financial=new Set(['ventas','pagos','presupuestos']);
 const operational=new Set(['ordenes_trabajo','reclamos','tickets','equipos']);
 const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
 // Pure authorization over a trusted, current context. Never pass HTTP body
 // properties as the context, origin, owner or assignment. This is not a route.
 function valid(c){return !!Domains&&!!Assigned&&c?.active===true&&key(c.uid)&&c.authUid===c.uid&&Domains.internalRoles.includes(c.role)&&c.viewing!==true&&c.passwordResetRequired===false&&typeof c.moduleAllowed==='function'&&typeof c.actionAllowed==='function';}
 function domainAllowed(c,domain){return Domains.allows(domain,c.role,m=>c.moduleAllowed(m)===true,a=>c.actionAllowed(a)===true);}
 function plan(c,domain){
  if(!valid(c)||!domainAllowed(c,'clientes'))return null;
  if(financial.has(domain)){
   if(c.financialHistoryAccess?.[domain]!==true||!domainAllowed(c,domain))return null;
   return Object.freeze({domain,originals:c.role==='admin'?'all':'own',embedded:c.role==='admin'?'all':'own'});
  }
  if(!operational.has(domain))return null;
  const originals=!domainAllowed(c,domain)?'none':domain==='ordenes_trabajo'&&c.actionAllowed('ot.verTodas')!==true?'assigned':'all';
  const parentReadable=c.financialHistoryAccess?.ventas===true&&domainAllowed(c,'ventas');
  const embedded=['equipos','tickets'].includes(domain)&&parentReadable?(c.role==='admin'?'all':'own'):'none';
  if(originals==='none'&&embedded==='none')return null;
  return Object.freeze({domain,originals,embedded});
 }
 function allows(c,domain,source){
  const scope=plan(c,domain);if(!scope||!source||!['original','embedded'].includes(source.origin))return false;
  const audience=source.origin==='embedded'?scope.embedded:scope.originals;
  if(audience==='none')return false;
  if(audience==='own')return key(source.ownerUid)&&source.ownerUid===c.uid;
  if(audience==='assigned')return !!source.record&&c.employee?.activo!==false&&Assigned.assigned(source.record,c.employee,c.employeeDirectory);
  return audience==='all';
 }
 return Object.freeze({plan,allows});
});
