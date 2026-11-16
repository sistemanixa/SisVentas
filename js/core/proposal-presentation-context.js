(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(root);else root.SVProposalPresentationContext=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const APPROVED_CLOSING=Object.freeze({kind:'nixa-engineering',months:18,title:'Ingeniería y acompañamiento de Nixa',paragraphs:Object.freeze(['Durante 18 meses, Nixa ha acompañado el proyecto con asesoramiento técnico, mantenimiento y trabajos de ingeniería.','Cada propuesta da continuidad a ese recorrido y al conocimiento adquirido sobre las necesidades del edificio, integrando la planificación, la selección de soluciones y el acompañamiento para su implementación.'])});
 // APPROVED_FINGERPRINT_RULES: parent fills only the human-approved SHA-256
 // client/document fingerprints. No raw IDs or display names belong here.
 const RULES = Object.freeze([Object.freeze({clientHash:"955ee8c20d6f6326fe25a9dc25a4fada4b203e1251e3d0e643b6f4c60eb43f33",budgetHashes:Object.freeze(["0b9a9ed239d0734b1f0b1581be9c1becc4a4eb2ad3f4888edfab60dcedfa9055","4b475ee9b6d98af9a9efb59983887657948a2d62484f6173033e327437a75b52","6829fa27c09cea1fc20f7a7e7a2e31f1172db21b96d955fe3c96b208a35c3aaa","9a69f06ad0970451dc4b8afab48bc629324eeea081dfd9450aac58c022f45994","b1889e347a5d3149ea2bc399f757c4f88b0e70a7f4763478bd20a5f8199bdfa2","eb6dc55781be712b10497e64ac0ffe2b17c41f0aef8856347a6579d2185a80cc"])})]);
 const HASH=/^[a-f0-9]{64}$/;
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 function exact(value,keys){if(!object(value))return false;const own=Reflect.ownKeys(value);return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k));}
 function exactArray(value,length){return Array.isArray(value)&&value.length===length&&Reflect.ownKeys(value).length===length+1&&Array.from({length},(_,i)=>Object.hasOwn(value,i)).every(Boolean);}
 const digest=value=>typeof value==='string'&&HASH.test(value);
 const ref=value=>typeof value==='string'&&value.length>0&&value.length<=768&&!!value.trim()&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
 function isClosing(value){return exact(value,['kind','months','title','paragraphs'])&&value.kind===APPROVED_CLOSING.kind&&value.months===18&&value.title===APPROVED_CLOSING.title&&exactArray(value.paragraphs,2)&&value.paragraphs.every((p,i)=>p===APPROVED_CLOSING.paragraphs[i]);}
 function copy(){return {kind:APPROVED_CLOSING.kind,months:APPROVED_CLOSING.months,title:APPROVED_CLOSING.title,paragraphs:[...APPROVED_CLOSING.paragraphs]};}
 function validRules(rules){return Array.isArray(rules)&&rules.length<=32&&exactArray(rules,rules.length)&&rules.every(rule=>exact(rule,['clientHash','budgetHashes'])&&digest(rule.clientHash)&&Array.isArray(rule.budgetHashes)&&rule.budgetHashes.length>0&&rule.budgetHashes.length<=12&&exactArray(rule.budgetHashes,rule.budgetHashes.length)&&rule.budgetHashes.every(digest)&&new Set(rule.budgetHashes).size===rule.budgetHashes.length);}
 function resolveFingerprints(value,rules=RULES){
  if(!exact(value,['clientHashes','budgetHash'])||!Array.isArray(value.clientHashes)||value.clientHashes.length<1||value.clientHashes.length>4||!exactArray(value.clientHashes,value.clientHashes.length)||!value.clientHashes.every(digest)||new Set(value.clientHashes).size!==value.clientHashes.length||!digest(value.budgetHash)||!validRules(rules))return null;
  return rules.some(rule=>value.clientHashes.includes(rule.clientHash)&&rule.budgetHashes.includes(value.budgetHash))?copy():null;
 }
 async function forRecord(record,number,rules=RULES){
  if(!object(record)||typeof number!=='string'||!number.trim()||number.trim().length>160||/[\x00-\x1f\x7f]/.test(number)||!validRules(rules))return null;
  const refs=[...new Set(['clienteFbKey','clienteKey','clienteId','idCliente'].map(k=>record[k]).filter(ref))];if(!refs.length)return null;
  try{
   const subtle=root.crypto?.subtle,Encoder=root.TextEncoder;if(!subtle||typeof subtle.digest!=='function'||typeof Encoder!=='function')return null;const encoder=new Encoder();
   const hash=async text=>Array.from(new Uint8Array(await subtle.digest('SHA-256',encoder.encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
   const values=await Promise.all([...refs,number.trim()].map(hash));return resolveFingerprints({clientHashes:values.slice(0,-1),budgetHash:values.at(-1)},rules);
  }catch(_){return null;}
 }
 return Object.freeze({APPROVED_CLOSING,RULES,isClosing,resolveFingerprints,forRecord});
});
