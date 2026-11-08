'use strict';
// Offline-only narrowing of existing authority. No signing or remote reads.
const Attestation=require('../../cotizador/commercial-delete-attestation'),Protocol=require('../../cotizador/commercial-delete-commit-protocol');
const Fence=require('../../cotizador/labor-fence-policy');
const Metadata=require('./commercial-delete-metadata-baseline.cjs');
const Wildcard=require('./commercial-delete-domain-wildcard.cjs');
const closed=value=>value===undefined||value===false||value==='false';
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const domains=['ventas','ordenes','ordenes_trabajo'];
const literal=JSON.stringify;
const fail=()=>{throw Error('Revisar concesiones padre, comodines o forma de regla antes de cerrar eliminaciones.');};
const child=(root,path)=>root+".child("+literal(path)+")";
function authority(root,phase='Before'){
 const token='auth.token.'+Protocol.PREFIX,marker=child(root,Attestation.PATH),terms=[token+'Version === 1'];
 for(const [field,claim,value]of [['schema',null,2],['capability',null,'commercial-delete-v1'],['activationId','ActivationId'],['rulesSha256','RulesSha256'],['artifactSha256','ArtifactSha256'],['sourceSha256','SourceSha256'],['manifestSha256','ManifestSha256'],['pinsSha256','PinsSha256']]){
  if(claim)terms.push(child(marker,field)+'.isString()',child(marker,field)+'.val() === '+token+claim);else terms.push(child(marker,field)+'.val() === '+literal(value));
 }
 terms.push(child(marker,'signature')+'.isString()',child(marker,'signature')+'.val() === '+token+'Signature',child(marker,'issuedAt')+'.isNumber()',child(marker,'issuedAt')+'.val() === '+token+'IssuedAt',token+'IssuedAt >= 0',token+'IssuedAt <= now');
 const configs={'sv_labor_config':null,'sv_operational_read_config':'Operational','sv_commercial_pages_config':'Pages','sv_client_accounts_config':'Accounts','sv_client_history_config':'History'};
 for(const [path,generation]of Object.entries(configs)){terms.push(child(root,path+'/schema')+'.val() === 1',child(root,path+'/ready')+'.val() === true');if(generation)terms.push(child(root,path+'/generation')+'.val() === '+token+generation+'Generation');}
 terms.push(child(root,'sv_client_accounts_config/writerMode')+".val() === 'coordinated-v1'",child(root,'sv_client_history_config/writerSchema')+'.val() === 1',child(root,'sv_client_history/v1/state/dependencyManifest')+'.val() === 1');
 const coverage={commercialPages:'sv_commercial_pages/v1/coverage',clientAccounts:'sv_client_accounts/v1/coverage/all',clientHistory:'sv_client_history/v1/state',paymentMembership:'sv_labor_indexes/paymentRefs_v1/coverage',saleFinancialDependencies:'sv_sale_financial_dependencies/v1/coverage'};
 const names={commercialPages:'Pages',clientAccounts:'Accounts',clientHistory:'History',paymentMembership:'Membership',saleFinancialDependencies:'Financial'};
 for(const [name,path]of Object.entries(coverage)){const c=child(root,path),revision=name==='paymentMembership'?'sequence':'revision';terms.push(child(c,'schema')+'.val() === 1',child(c,'ready')+'.val() === true',child(c,'generation')+'.val() === '+token+names[name]+'Generation',child(c,revision)+'.isNumber()',token+names[name]+'Revision >= 0',child(c,revision)+'.val() >= '+token+names[name]+'Revision');}
 terms.push(child(root,'sv_sale_financial_dependencies/v1/coverage/unresolved')+'.val() === 0');
 // Repeat mutable coverage predicates at both atomic snapshots. Revisions may
 // advance independently: untouched history domains retain older revisions.
 const History=require('../../cotizador/client-history-model'),Membership=require('../../cotizador/payment-membership-index'),Financial=require('../../cotizador/sale-financial-dependencies-model');
 const integer=(node,min=0)=>terms.push(node+'.isNumber()',node+'.val() >= '+min,node+'.val() <= '+Number.MAX_SAFE_INTEGER,node+'.val() % 1 === 0');
 const hex=node=>terms.push(node+'.isString()',node+'.val().matches(/^[a-f0-9]{64}$/)');
 const pages=child(root,coverage.commercialPages),accounts=child(root,coverage.clientAccounts),history=child(root,coverage.clientHistory),membership=child(root,coverage.paymentMembership),financial=child(root,coverage.saleFinancialDependencies);
 for(const [name,path]of Object.entries(coverage))integer(child(child(root,path),name==='paymentMembership'?'sequence':'revision'),['clientHistory','saleFinancialDependencies'].includes(name)?1:0);
 for(const field of ['sales','payments'])integer(child(pages,field));
 for(const field of ['salesRecords','paymentRecords'])integer(child(accounts,field));
 terms.push(child(accounts,'ownerManifest')+'.val() === 1',child(accounts,'ownerEvidenceVersion')+'.val() === 1',child(accounts,'salesRecords')+'.val() === '+child(pages,'sales')+'.val()',child(accounts,'paymentRecords')+'.val() === '+child(pages,'payments')+'.val()');
 integer(child(history,'records'));const historyCounts=[];
 for(const domain of History.domains){const c=child(root,'sv_client_history/v1/coverage/all/'+domain);terms.push(child(c,'schema')+'.val() === 1',child(c,'ready')+'.val() === true',child(c,'generation')+'.val() === '+child(history,'generation')+'.val()');integer(child(c,'revision'),1);terms.push(child(c,'revision')+'.val() <= '+child(history,'revision')+'.val()');for(const field of ['records','originalRecords','unlinkedRecords'])integer(child(c,field));for(const field of ['originalRecords','unlinkedRecords'])terms.push(child(c,'records')+'.val() >= '+child(c,field)+'.val()');historyCounts.push(child(c,'records')+'.val()');}
 terms.push('('+historyCounts.join(' + ')+') === '+child(history,'records')+'.val()',child(root,'sv_client_history/v1/coverage/all/ventas/originalRecords')+'.val() === '+child(accounts,'salesRecords')+'.val()',child(root,'sv_client_history/v1/coverage/all/pagos/originalRecords')+'.val() === '+child(accounts,'paymentRecords')+'.val()');
 terms.push(child(membership,'matcherHash')+'.val() === '+literal(Membership.MATCHER_HASH));for(const field of ['paymentCount','membershipCount'])integer(child(membership,field));terms.push(child(membership,'paymentCount')+'.val() === '+child(pages,'payments')+'.val()',child(membership,'membershipCount')+'.val() <= '+child(membership,'paymentCount')+'.val() * 12');for(const field of ['relationAccumulator','buildDigest'])hex(child(membership,field));
 for(const domain of Financial.domains){hex(child(financial,'sources/'+domain));integer(child(financial,'counts/'+domain));}
 for(const [name,field]of Object.entries(Protocol.membershipFields))terms.push(child(membership,field)+'.val() === '+token+'Membership'+phase+'.'+name);
 return '('+terms.join(' && ')+')';
}
function prepare(input,{pins}={}){
 // Policy is independent of its eventual digest. Optional pins are validated,
 // but the final expected pins are enforced by the trusted runtime protocol.
 if(pins!==undefined&&!Attestation.validPins(pins))throw Error('Los pines suministrados son inválidos.');
 const out=structuredClone(input),r=out?.rules,s=r?.sisventas;if(!object(r)||!object(s)||!closed(r['.read'])||!closed(r['.write'])||!closed(s['.write']))fail();
 function anyGrant(node){return !!node&&typeof node==='object'&&Object.entries(node).some(([key,value])=>key==='.write'?!closed(value):!key.startsWith('.')&&anyGrant(value));}
 for(const [name,node]of Object.entries(r))if(name.startsWith('$')&&anyGrant(node))fail();
 const namespace=r.sv_deployment_attestations;if(namespace&&(!closed(namespace['.read'])||!closed(namespace['.write'])||Object.keys(namespace).some(key=>key.startsWith('$'))))fail();
 if(namespace?.commercial_delete&&Object.keys(namespace.commercial_delete).some(key=>!['.read','.write'].includes(key)))fail();
 r.sv_deployment_attestations={...(namespace||{}),'.read':false,'.write':false,commercial_delete:{'.read':false,'.write':false}};
 const token='auth.token.'+Protocol.PREFIX;
 function requireCommit(depth){return '('+Fence.fence(depth,'('+Fence.serverActor+') || ('+Fence.userActor+')',false)+' && '+authority('root','Before')+' && '+authority('newData'+'.parent()'.repeat(depth),'After')+')';}
 function write(value,depth,record,recordNew,id,domain){
  if(closed(value))return value;
  if(typeof value!=='string')fail();
  const base=domain==='ventas'?token+"Operation === 'saleDelete' && "+token+'OriginKey === '+id:domain==='ordenes'?token+"Operation === 'orderDelete' && "+token+'OriginKey === '+id:'(('+token+"Operation === 'otDelete' && "+token+'OriginKey === '+id+') || ('+token+"Operation === 'saleDelete' && "+token+'OTKeys['+id+'] === true))';
  const returning=domain==='ventas'?' || '+require('./sale-return-rules.cjs').deletionGrant(depth,id,record,recordNew):'';
  const mandatory='(!'+record+'.exists() || '+recordNew+'.exists()'+returning+' || ('+requireCommit(depth)+' && ('+base+')))';
  // A claim-bearing commit also checks atomic authority on every existing
  // grant it uses, including receipt and lease removal (handled below).
  return '('+value+') && '+mandatory;
 }
 function visit(node,depth,domain,id){
  if(!node||typeof node!=='object'||Array.isArray(node))fail();
  if(Object.hasOwn(node,'.write'))node['.write']=write(node['.write'],depth,'data'+'.parent()'.repeat(depth-3),'newData'+'.parent()'.repeat(depth-3),id,domain);
  for(const [key,value]of Object.entries(node))if(!key.startsWith('.')){if(key.startsWith('$')&&!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(key))fail();visit(value,depth+1,domain,id);}
 }
 for(const domain of domains){const node=s[domain];if(!object(node)||!closed(node['.write']))fail();for(const [name,record]of Object.entries(node))if(!name.startsWith('.')){if(name.startsWith('$')?!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(name):/[.#$\[\]\/\x00-\x1f\x7f]/.test(name)||['__proto__','prototype','constructor'].includes(name))fail();const id=name.startsWith('$')?name:literal(name);visit(record,3,domain,id);}}
 // Reject an overlapping wildcard authority rather than pretending that an
 // explicit node's child veto can revoke that separate grant.
 for(const [name,node]of Object.entries(s))if(name.startsWith('$')&&anyGrant(node)&&!Wildcard.recognized(name,node))fail();
 for(const path of ['sv_labor_guard','sv_labor_receipts'])if(!r[path])fail();
 function metadata(node,depth,expected,path){if(!node||typeof node!=='object')fail();if(Object.hasOwn(node,'.write')&&!closed(node['.write'])){if(typeof node['.write']!=='string'||node['.write']!==expected?.['.write']&&!Metadata.recognized(path,node['.write']))fail();node['.write']='('+node['.write']+') && ('+token+'Version !== 1 || '+requireCommit(depth)+')';}for(const [name,value]of Object.entries(node))if(!name.startsWith('.'))metadata(value,depth+1,expected?.[name],path+'/'+name);}
 if(!closed(r.sv_labor_receipts['.write']))fail();const known=Fence.metadataRules();metadata(r.sv_labor_guard,1,known.sv_labor_guard,'sv_labor_guard');metadata(r.sv_labor_receipts,1,known.sv_labor_receipts,'sv_labor_receipts');
 return out;
}
module.exports={prepare,authority};
