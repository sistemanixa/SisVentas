'use strict';
// Deliberate public allowlist. Never serialize the source budget or trial DTO.
const Trial=require('./budget-presentation-trial-model');
const Deck=require('./proposal-share-scenes');
const Context=require('../js/core/proposal-presentation-context'),crypto=require('node:crypto');
const ASSETS=Object.freeze(['','cerradura-camara','cerradura-teclado','portero-pantalla','portero-teclado','videovigilancia','portero-columna']);
const failure=()=>Object.assign(Error('La propuesta necesita revisión antes de compartirla.'),{statusCode:409,code:'PROPOSAL_SHARE_INVALID'});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim())||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))throw failure();return value.trim();}
function amount(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)throw failure();return value;}
function amounts(value){if(!object(value))throw failure();return Object.fromEntries(['subtotal','discount','iva','total'].map(k=>[k,amount(value[k])]));}
function publicProposal(value){
 if(!object(value)||!Array.isArray(value.items)||!value.items.length||value.items.length>200||!object(value.money)||!object(value.exchange)||!object(value.scene))throw failure();
 const items=value.items.map(item=>{if(!object(item)||typeof item.quantity!=='number'||!Number.isFinite(item.quantity)||item.quantity<=0||item.quantity>Number.MAX_SAFE_INTEGER)throw failure();return {description:text(item.description,1200,true),quantity:item.quantity};});
 if(!['ARS','USD'].includes(value.sourceCurrency)||!ASSETS.includes(value.scene.asset))throw failure();
 const discountPct=amount(value.money.discountPct),rate=amount(value.exchange.rate);if(discountPct>100||rate<=0||rate>1e9)throw failure();
 const date=text(value.date,10);if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw failure();
 if(value.presentationClosing!==undefined&&!Context.isClosing(value.presentationClosing))throw failure();
 return {number:text(value.number,80),title:text(value.title,250),client:text(value.client,250,true),address:text(value.address,500),date,items,sourceCurrency:value.sourceCurrency,money:{ars:amounts(value.money.ars),usd:amounts(value.money.usd),discountPct},exchange:{rate,label:text(value.exchange.label,160,true)},scene:{asset:value.scene.asset,title:text(value.scene.title,250,true),subtitle:text(value.scene.subtitle,500,true)},overview:text(value.overview,2500,true),...(value.presentationClosing?{presentationClosing:{...value.presentationClosing,paragraphs:[...value.presentationClosing.paragraphs]}}:{})};
}
function resolveContext(record,number){const hash=value=>crypto.createHash('sha256').update(value,'utf8').digest('hex'),refs=[...new Set(['clienteFbKey','clienteKey','clienteId','idCliente'].map(k=>record[k]).filter(v=>typeof v==='string'&&v.length>0&&v.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)))];return Context.resolveFingerprints({clientHashes:refs.map(hash),budgetHash:hash(number.trim())});}
function buildPublicProposal(record,options,contextResolver=resolveContext){
 if(!object(record)||record.eliminado===true||record._svListSummary||record._svPagedSummary)throw failure();
 // Reject oversized input before the documentary builder traverses its rows.
 const rows=record.items;if(!(Array.isArray(rows)||object(rows))||Object.keys(rows).length>200)throw failure();
 const dto=Trial.build(record,options);if(dto.status!=='READY')throw failure();
 const date=typeof record.fecha==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(record.fecha)?record.fecha:'';
 const closing=contextResolver(record,dto.number);
 return publicProposal({...dto,date,scene:Deck.scene(dto),overview:Deck.overview(dto),...(closing?{presentationClosing:closing}:{})});
}
module.exports=Object.freeze({ASSETS,buildPublicProposal,publicProposal});
