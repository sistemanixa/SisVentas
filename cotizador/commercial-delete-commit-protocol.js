'use strict';
const {digest,parts,child,put}=require('./labor-guard'),Attestation=require('./commercial-delete-attestation');
const Membership=require('./payment-membership-index');
const membershipFields={Sequence:'sequence',Digest:'buildDigest',Accumulator:'relationAccumulator',PaymentCount:'paymentCount',Count:'membershipCount',MatcherHash:'matcherHash'};
const PREFIX='svCommercialDelete';
const projectionClaims={commercialPages:'Pages',clientAccounts:'Accounts',clientHistory:'History',paymentMembership:'Membership',saleFinancialDependencies:'Financial'};
const names=['Version','Operation','OriginKey','OTKeys','ActivationId','RulesSha256','ArtifactSha256','SourceSha256','ManifestSha256','PinsSha256','Signature','IssuedAt','OperationalGeneration','MembershipBefore','MembershipAfter',...Object.values(projectionClaims).flatMap(name=>[name+'Generation',name+'Revision'])];
const roots={saleDelete:'ventas',orderDelete:'ordenes',otDelete:'ordenes_trabajo'};
const operations={saleDelete:'sale-delete',orderDelete:'purchase-order-delete',otDelete:'ot-delete'};
const inputs={saleDelete:'ventaKey',orderDelete:'orderKey',otDelete:'otKey'};
const fail=()=>Object.assign(Error('La eliminación requiere claims derivados de evidencia vigente y del commit coordinado.'),{statusCode:409,code:'SV_COMMERCIAL_DELETE_PROTOCOL'});
const key=value=>typeof value==='string'&&value.length>0&&value.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
function reservedClaims(incoming={}){return {...Object.fromEntries(Object.keys(incoming||{}).filter(name=>name.startsWith(PREFIX)).map(name=>[name,null])),...Object.fromEntries(names.map(name=>[PREFIX+name,name==='Version'?0:name==='OTKeys'?{}:null]))};}
function create({verifier,pins}={}){
 const expected=Attestation.validPins(pins)?structuredClone(pins):null;
 async function claims({proof,patch,lease,actor,readFresh,runtime}={}){
  const reserved=reservedClaims(actor?.claims),deleted={};
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw fail();
  for(const [path,value]of Object.entries(patch)){
   const p=parts(path);
   if(p[0]==='sisventas'&&(p.length===1||Object.values(roots).includes(p[1])&&p.length<3))throw fail();
   if(p[0]==='sisventas'&&Object.values(roots).includes(p[1])&&p.length===3&&value===null){if(!key(p[2]))throw fail();(deleted[p[1]]||=[]).push(p[2]);}
  }
  if(!Object.keys(deleted).length){if(proof)throw fail();return reserved;}
  // Returning an unused sale to a new budget is an existing, separately
  // authorized economic transition, not a destructive delete command. Keep
  // its exact gateway intent and lease binding; never trust a JWT purpose.
  if(!proof&&actor?.mode==='user'&&actor.operation==='legacy-atomic'&&actor.financialAction==='ventas.moverPresupuesto'&&actor.uid===lease?.actorUid&&lease.mode==='user'&&actor.opId===lease.opId){
   let pair;try{pair=require('./sale-return-to-budget').describe(actor.input);}catch{throw fail();}
   const saleKey=pair.salePath.split('/').at(-1),normalize=require('./payment-membership-index').normalizeRtdb;
   if(Object.keys(deleted).length!==1||deleted.ventas?.length!==1||deleted.ventas[0]!==saleKey||patch[pair.salePath]!==null||!patch[pair.budgetPath]||digest(normalize(patch[pair.budgetPath]))!==digest(normalize(actor.input.value[pair.budgetPath])))throw fail();
   return reserved;
  }
  if(!expected||typeof verifier?.assertCurrent!=='function'||typeof readFresh!=='function'||!proof)throw fail();
  const fresh=await verifier.assertCurrent({proof,readFresh,runtime}),operation=fresh.operation,origin=actor?.input?.[inputs[operation]];
  if(fresh.pinsSha256!==digest(expected))throw fail();
  if(!roots[operation]||!key(origin)||actor.operation!==operations[operation]||actor.uid!==lease?.actorUid||!['user','command'].includes(actor.mode)||lease.mode!==actor.mode||!key(lease.opId)||actor.opId!==lease.opId||!deleted[roots[operation]]?.includes(origin))throw fail();
  if(Object.entries(deleted).some(([domain,ids])=>domain===roots[operation]?ids.length!==1:operation!=='saleDelete'||domain!=='ordenes_trabajo'))throw fail();
  if(operation==='saleDelete'&&deleted.ordenes_trabajo?.length){const sale=await readFresh('sisventas/ventas/'+origin);if(!sale)throw fail();for(const id of deleted.ordenes_trabajo){const ot=await readFresh('sisventas/ordenes_trabajo/'+id);if(!ot||!require('./payment-membership-matcher').belongsToSale(ot,{...sale,fbKey:origin}))throw fail();}}
  const receipt=patch['sv_labor_receipts/'+lease.opId];
  if(patch.sv_labor_guard!==null||!receipt||receipt.fence!==lease.fence||receipt.digest!==lease.digest||receipt.actorUid!==lease.actorUid)throw fail();
  if(Object.keys(patch).some(path=>path==='sv_deployment_attestations'||path.startsWith('sv_deployment_attestations/')||['sv_labor_config','sv_operational_read_config','sv_commercial_pages_config','sv_client_accounts_config','sv_client_history_config'].some(base=>path===base||path.startsWith(base+'/'))))throw fail();
  const marker=await readFresh(Attestation.PATH);if(digest(marker)!==fresh.attestationSha256)throw fail();
  // Rules cannot recompute a SHA-256. Bind both independently validated
  // coverage tuples, permitting the writer's legitimate sequence/digest delta.
  const beforeMembership=Membership.validateCoverage(await readFresh(Membership.COVERAGE_PATH));
  let afterMembership=structuredClone(beforeMembership);
  for(const [path,value]of Object.entries(patch)){
   if(path===Membership.COVERAGE_PATH)afterMembership=structuredClone(value);
   else if(path.startsWith(Membership.COVERAGE_PATH+'/'))afterMembership=put(afterMembership,parts(path.slice(Membership.COVERAGE_PATH.length+1)),value);
   else if(Membership.COVERAGE_PATH.startsWith(path+'/'))afterMembership=child(value,parts(Membership.COVERAGE_PATH.slice(path.length+1)));
  }
  afterMembership=Membership.validateCoverage(afterMembership);
  const membershipClaims=Object.fromEntries(Object.entries({Before:beforeMembership,After:afterMembership}).map(([phase,value])=>[PREFIX+'Membership'+phase,Object.fromEntries(Object.entries(membershipFields).map(([name,field])=>[name,value[field]]))]));
  const otKeys=Object.fromEntries((deleted.ordenes_trabajo||[]).map(id=>[id,true]));if(Object.keys(otKeys).length>128)throw fail();
  const projections=Object.fromEntries(Object.entries(projectionClaims).flatMap(([name,claim])=>[[PREFIX+claim+'Generation',expected.projections[name].generation],[PREFIX+claim+'Revision',expected.projections[name].minimumRevision]]));
  return {...reserved,...projections,...membershipClaims,[PREFIX+'OperationalGeneration']:expected.operationalGeneration,[PREFIX+'Version']:1,[PREFIX+'Operation']:operation,[PREFIX+'OriginKey']:origin,[PREFIX+'OTKeys']:otKeys,[PREFIX+'ActivationId']:fresh.activationId,[PREFIX+'RulesSha256']:fresh.rulesDigest,[PREFIX+'ArtifactSha256']:fresh.artifactSha256,[PREFIX+'SourceSha256']:marker.sourceSha256,[PREFIX+'ManifestSha256']:fresh.manifestSha256,[PREFIX+'PinsSha256']:fresh.pinsSha256,[PREFIX+'Signature']:marker.signature,[PREFIX+'IssuedAt']:marker.issuedAt};
 }
 return Object.freeze({claims});
}
module.exports={PREFIX,membershipFields,reservedClaims,create};
