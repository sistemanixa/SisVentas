'use strict';
// Typed OT authority composed with (never replacing) the native Sale writer.
const {digest}=require('./labor-guard'),Adapters=require('./ot-related-adapters');
const issued=new WeakMap(),port=Symbol('ot-material-edit'),PURPOSE='ot-materials';
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
const fail=()=>Object.assign(Error('La corrección de materiales requiere su plan original autorizado.'),{statusCode:403,code:'SV_OT_MATERIAL_EDIT_AUTHORITY'});
function authority(profile,cfg){const role=profile?.rol;if(profile?.activo!==true||!['admin','administrativo','vendedor','tecnico','tecnico_vendedor'].includes(role)||cfg?.indiceVersion!==2||cfg.indiceModulos?.ordentrabajo!==true||Object.values(cfg.bloqueados||{}).includes('ordentrabajo')||!(typeof cfg.acciones?.ot?.corregirMateriales==='boolean'?cfg.acciones.ot.corregirMateriales:['admin','administrativo','vendedor'].includes(role)))throw fail();return {role,permissionRevision:cfg.indiceRevision??null,permissionDigest:digest(cfg)};}
function binding(actor,lease){return digest({uid:actor.uid,claims:actor.claims,operation:actor.operation,input:actor.input,opId:actor.opId,transportDigest:actor.transportDigest,lease});}
function live(actor,lease,now=Date.now()){if(actor?.mode!=='user'||actor.uid!==actor.claims?.uid||actor.uid!==lease?.actorUid||actor.opId!==lease?.opId||actor.input?.id!==actor.opId||actor.input?.kind!=='atomic'||actor.input?.purpose!==PURPOSE||digest(actor.input)!==actor.transportDigest||lease.digest!==actor.transportDigest||lease.mode!=='user'||!key(lease.fence)||!Number.isSafeInteger(lease.expiresAt)||lease.expiresAt<=now)throw fail();}
function attach({actor,lease,profile,cfg,config,ot,otKey,originalSale,sale,saleKey,patch,at,name,mode='existing'}){
 live(actor,lease);const context=authority(profile,cfg);if(!key(otKey)||!key(saleKey)||config?.schema!==1||config.ready!==true||!key(config.generation)||!['existing','additional'].includes(mode)||!patch||typeof patch!=='object'||Array.isArray(patch))throw fail();
 const plan=Adapters[mode==='existing'?'existingSale':'additionalSale']({ot,otKey,originalSale,sale,saleKey,actor:{uid:actor.uid,name},at}),otBase='sisventas/ordenes_trabajo/'+otKey,saleBase='sisventas/ventas/'+saleKey;
 if(actor.input.expectedHashes?.[otBase]!==digest(ot)||actor.input.expectedHashes?.[saleBase]!==digest(originalSale??null))throw fail();
 if(digest(require('./ot-physical-write-policy').projection(ot))!==digest(require('./ot-physical-write-policy').projection({...ot,materiales:plan.materiales})))throw fail();
 for(const [path,value]of Object.entries(plan.related))if(!Object.hasOwn(patch,path)||digest(patch[path])!==digest(value))throw fail();
 for(const path of Object.keys(patch)){if(Object.hasOwn(plan.related,path))continue;if(path===saleBase||path.startsWith(saleBase+'/'))continue;if(mode==='additional'&&/^sisventas\/notificaciones_admin\/[A-Za-z0-9_-]+$/.test(path))continue;throw fail();}
 if(!Object.keys(patch).some(path=>path===saleBase||path.startsWith(saleBase+'/')))throw fail();
 const salePaths=Object.keys(patch).filter(path=>path===saleBase||path.startsWith(saleBase+'/'));for(let i=0;i<salePaths.length;i++)for(let j=0;j<i;j++)if(salePaths[i].startsWith(salePaths[j]+'/')||salePaths[j].startsWith(salePaths[i]+'/'))throw fail();
 let saleAfter=structuredClone(originalSale??null);for(const path of salePaths)saleAfter=path===saleBase?structuredClone(patch[path]):require('./labor-guard').put(saleAfter,path.slice(saleBase.length+1).split('/'),patch[path]);const expectedSale=structuredClone(sale);if(!Object.hasOwn(saleAfter||{},'fbKey')&&expectedSale.fbKey===saleKey)delete expectedSale.fbKey;if(digest(saleAfter)!==digest(expectedSale))throw fail();
 // Bind the exact post-native business patch. The host must already have run
 // its financial model/permission checks; this capability grants only OT.
 const handle=Object.freeze({});issued.set(handle,{uid:actor.uid,otKey,saleKey,generation:config.generation,...context,binding:binding(actor,lease),patch:structuredClone(patch),sources:{[otBase]:structuredClone(ot),[saleBase]:structuredClone(originalSale??null),sv_ot_metadata_config:structuredClone(config)}});actor[port]=handle;return plan;
}
function owns(actor){const p=issued.get(actor?.[port]);return !!p&&actor.uid===p.uid;}
function token(actor,lease){const p=issued.get(actor?.[port]);if(!owns(actor)||p.binding!==binding(actor,lease))return {svOTMetadataVersion:0};return {svOTMetadataVersion:1,svOTMetadataKind:'materials',svOTMetadataOTKey:p.otKey,svOTMetadataRole:p.role,svOTMetadataPermissionRevision:p.permissionRevision,svOTMetadataGeneration:p.generation,svOTMetadataFence:lease.fence,svOTMetadataCreating:false,svOTMetadataAdministrative:false,svOTMetadataEditing:false};}
function validate(actor,profile,cfg){const p=issued.get(actor?.[port]);if(!owns(actor)||digest(authority(profile,cfg))!==digest({role:p.role,permissionRevision:p.permissionRevision,permissionDigest:p.permissionDigest}))throw fail();}
async function validateSource({actor,lease,patch,readFresh,operationalSummaries=false,now=Date.now()}){
 live(actor,lease,now);const p=issued.get(actor?.[port]);if(!owns(actor)||p.binding!==binding(actor,lease)||typeof readFresh!=='function')throw fail();validate(actor,await readFresh('sv_chat_roles/'+actor.uid),await readFresh('sv_permisos/'+p.role));
 for(const [path,value]of Object.entries(p.sources))if(digest(await readFresh(path))!==digest(value))throw fail();
 const expected=structuredClone(p.patch),Records=require('./record-list-model'),{put}=require('./labor-guard');
 if(operationalSummaries){const config=await readFresh('sv_record_list_config');if(config?.schema===1&&config.ready===true)for(const root of new Set(Object.keys(expected).map(Records.recordPath).filter(Boolean))){if(!Object.hasOwn(p.sources,root))throw fail();let after=structuredClone(p.sources[root]);for(const [path,value]of Object.entries(expected))if(path===root)after=structuredClone(value);else if(path.startsWith(root+'/'))after=put(after,path.slice(root.length+1).split('/'),value);for(const path of Object.keys(expected))if(path===root||path.startsWith(root+'/'))delete expected[path];Object.assign(expected,Records.plan(root,p.sources[root],after,actor.opId));}}
 const technical=['sv_labor_indexes/','sv_commercial_pages/','sv_client_accounts/','sv_client_history/','sv_sale_financial_dependencies/','sv_dashboard_commercial_activity_proposal/','sv_dashboard_budget_proposal/'];
 for(const [path,value]of Object.entries(expected))if(!Object.hasOwn(patch,path)||digest(patch[path])!==digest(value))throw fail();for(const path of Object.keys(patch))if(!Object.hasOwn(expected,path)&&path!=='sv_labor_guard'&&path!=='sv_labor_receipts/'+actor.opId&&!technical.some(prefix=>path.startsWith(prefix)))throw fail();
 const receipt=patch['sv_labor_receipts/'+actor.opId];if(patch.sv_labor_guard!==null||receipt?.actorUid!==actor.uid||receipt.digest!==lease.digest||receipt.fence!==lease.fence)throw fail();return true;
}
async function prepare({actor,lease,body,patch,scope,now=Date.now}){
 live(actor,lease,now());if(digest(body)!==digest(actor.input)||!scope?.getAsUser||!scope?.get||!scope?.beforeCommit||!patch||typeof patch!=='object'||Array.isArray(patch))throw fail();
 const paths=Object.keys(patch),otKeys=new Set(),saleKeys=new Set();
 for(const path of paths){const ot=/^sisventas\/ordenes_trabajo\/([^/]+)\/(materiales|audit|ventasAdicionales\/[^/]+)$/.exec(path),sale=/^sisventas\/ventas\/([^/]+)(?:\/.*)?$/.exec(path);if(ot&&key(ot[1]))otKeys.add(ot[1]);else if(sale&&key(sale[1]))saleKeys.add(sale[1]);else if(!/^sisventas\/notificaciones_admin\/[A-Za-z0-9_-]+$/.test(path))throw fail();}
 if(otKeys.size!==1||saleKeys.size!==1)throw fail();const otKey=[...otKeys][0],saleKey=[...saleKeys][0],otBase='sisventas/ordenes_trabajo/'+otKey,saleBase='sisventas/ventas/'+saleKey;
 const [ot,originalSale,profile,config,directory]=await Promise.all([scope.getAsUser(otBase),scope.getAsUser(saleBase),scope.get('sv_chat_roles/'+actor.uid),scope.get('sv_ot_metadata_config'),scope.get('sv_chat_directorio/'+actor.uid)]),cfg=await scope.get('sv_permisos/'+profile?.rol);authority(profile,cfg);
 let sale=structuredClone(originalSale);for(const path of paths)if(path===saleBase)sale=structuredClone(patch[path]);else if(path.startsWith(saleBase+'/'))sale=require('./labor-guard').put(sale,path.slice(saleBase.length+1).split('/'),patch[path]);
 const mode=originalSale===null?'additional':'existing',at=now(),name=directory?.nombre||actor.uid,plan=Adapters[mode==='existing'?'existingSale':'additionalSale']({ot,otKey,originalSale,sale,saleKey,actor:{uid:actor.uid,name},at}),normalized={};
 // Only this command's known OT leaves are replaced by the server-derived plan.
 // Financial values remain exactly the already validated native Sale patch.
 for(const [path,value]of Object.entries(patch))if(!path.startsWith(otBase+'/'))normalized[path]=structuredClone(value);else if(!Object.hasOwn(plan.related,path))throw fail();
 Object.assign(normalized,plan.related);attach({actor,lease,profile,cfg,config,ot,otKey,originalSale,sale,saleKey,patch:normalized,at,name,mode});
 scope.beforeCommit(async({readFresh,readFreshAsUser})=>{
  validate(actor,await readFresh('sv_chat_roles/'+actor.uid),await readFresh('sv_permisos/'+profile.rol));
  for(const [path,value]of [[otBase,ot],[saleBase,originalSale]])if(digest(await readFreshAsUser(path))!==digest(value))throw fail();
  if(digest(await readFresh('sv_ot_metadata_config'))!==digest(config))throw fail();
 });return {patch:normalized,plan,otKey,saleKey,mode};
}
module.exports={PURPOSE,authority,attach,prepare,owns,isBound:owns,token,validate,validateSource};
