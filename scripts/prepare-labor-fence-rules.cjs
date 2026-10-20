'use strict';
// Offline candidate builder. Never authenticates, reads a remote DB or applies rules.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {SERVICE_UID,MAX_LEASE_MS,DOMAINS,CONFIG,SERVER_ONLY,permissionsIdle,financialRule,childRule,metadataRules,recognizedRule}=require('../cotizador/labor-fence-policy');
// The two positive ancestor/fallback grants in the reviewed 136954... baseline.
// A changed grant needs review, not a best-effort rewrite of unfamiliar rules.
const KNOWN_CONFIG_WRITE='1f3bb6f0a6ea2e6d64e51f9e18ee149103923da3eecf1421f5d090ff12c0f66d';
const KNOWN_DOMAIN_WRITE='55328fb5887b58013b23ca4c69833d1fbc02051bd60426e6725dcf3df2ebdbe9';
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const closed=value=>value===undefined||value===false||value==='false';
function expression(value){if(value===undefined)return 'false';if(typeof value!=='string'&&typeof value!=='boolean')throw Error('Expresión de regla inválida');return String(value);}
const or=(a,b)=>closed(a)?expression(b):closed(b)?expression(a):'('+expression(a)+') || ('+expression(b)+')';
function rewriteTokens(text,transform){return text.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\$[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*/g,token=>token[0]==="'"||token[0]==='"'?token:transform(token));}
function specialize(node,variable,value){if(Array.isArray(node))return node.map(x=>specialize(x,variable,value));if(node&&typeof node==='object')return Object.fromEntries(Object.entries(node).map(([k,v])=>[k,specialize(v,variable,value)]));return typeof node==='string'?rewriteTokens(node,t=>t===variable?JSON.stringify(value):t):node;}
function rejectDescendantGrants(node){for(const [key,child]of Object.entries(node||{}))if(!key.startsWith('.')&&child&&typeof child==='object'){if(!closed(child['.write']))throw Error('Concesión descendiente de comodín inesperada');rejectDescendantGrants(child);}}
function wrap(node,depth,inherited=false,serverOnly=false){
 const old=node['.write'];
 node['.write']=financialRule(depth,serverOnly?'false':or(inherited,old));
 // A grant below a protected root must not re-enable direct browser writes.
 function children(current,d){for(const [key,child]of Object.entries(current))if(!key.startsWith('.')&&child&&typeof child==='object'){
  if(Object.hasOwn(child,'.write'))child['.write']=serverOnly?false:childRule(d+1,expression(child['.write']));
  children(child,d+1);
 }}children(node,depth);
}
function build(input,{expectedHash}={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||!input.rules||typeof input.rules!=='object')throw Error('Se requiere JSON de reglas explícito');
 if(expectedHash&&(!/^[a-f0-9]{64}$/i.test(expectedHash)||hash(input)!==expectedHash.toLowerCase()))throw Error('El hash semántico de la base no coincide');
 const result=structuredClone(input),r=result.rules,s=r.sisventas;
 if(!closed(r['.write'])||!s||!closed(s['.write']))throw Error('Concesión de escritura ancestro inesperada');
 for(const [key,node]of Object.entries(r))if(key.startsWith('$')&&node&&typeof node==='object')throw Error('Comodín raíz inesperado');
 for(const key of ['sv_labor_guard','sv_labor_receipts','sv_labor_indexes','sv_labor_config'])if(Object.hasOwn(r,key))throw Error('La base ya contiene coordinación laboral: revisar el diff');
 const wildcard=s.$dominio;
 for(const [key,node]of Object.entries(s))if(key.startsWith('$')&&key!=='$dominio'&&node&&typeof node==='object')throw Error('Comodín de dominio inesperado');
 if(wildcard&&!closed(wildcard['.write'])&&hash(wildcard['.write'])!==KNOWN_DOMAIN_WRITE)throw Error('Concesión comodín no revisada');
 rejectDescendantGrants(wildcard);
 const cfg=s.config||(s.config={}),configWrite=cfg['.write'];
 if(!closed(configWrite)&&hash(configWrite)!==KNOWN_CONFIG_WRITE)throw Error('Concesión de Configuración no revisada');
 // Move the reviewed config ancestor grant to direct children. A PUT of the
 // complete config is intentionally denied; unrelated child/PATCH access stays.
 cfg['.write']=false;
 for(const [key,node]of Object.entries(cfg))if(!key.startsWith('.')&&node&&typeof node==='object'&&!CONFIG.includes(key)){
  if(key.startsWith('$')&&key!=='$config')throw Error('Comodín de Configuración inesperado');
  if(key==='$config'){
   if(!closed(node['.write']))throw Error('Concesión comodín de Configuración inesperada');
   rejectDescendantGrants(node);
   node['.write']='('+expression(configWrite)+') && '+CONFIG.map(k=>"$config !== '"+k+"'").join(' && ');
  }else node['.write']=or(configWrite,node['.write']);
 }
 if(!cfg.$config)cfg.$config={'.write':'('+expression(configWrite)+') && '+CONFIG.map(k=>"$config !== '"+k+"'").join(' && ')};
 for(const domain of DOMAINS){if(!s[domain])s[domain]=wildcard?specialize(wildcard,'$dominio',domain):{};wrap(s[domain],2);}
 for(const key of CONFIG){if(!cfg[key])cfg[key]=cfg.$config?specialize(cfg.$config,'$config',key):{};wrap(cfg[key],3,configWrite);}
 if(wildcard&&Object.hasOwn(wildcard,'.write'))wildcard['.write']='('+expression(wildcard['.write'])+') && '+DOMAINS.map(k=>"$dominio !== '"+k+"'").join(' && ');
 for(const key of SERVER_ONLY){r[key]||={};wrap(r[key],1,false,true);}
 // Permission authorization is captured before entering the command. Freeze all
 // ordinary permission mutations while the lease lives, including deletion.
 function gatePermissions(node){for(const [key,value]of Object.entries(node||{}))if(key==='.write'){if(!closed(value))node[key]='('+expression(value)+') && '+permissionsIdle;}else if(!key.startsWith('.')&&value&&typeof value==='object')gatePermissions(value);}
 gatePermissions(r.sv_permisos);
 Object.assign(r,metadataRules());
 return result;
}
if(require.main===module){const [source,destination,expectedHash]=process.argv.slice(2);if(!source||!destination||!destination.endsWith('.candidate.json')||path.resolve(source)===path.resolve(destination))throw Error('Uso: node scripts/prepare-labor-fence-rules.cjs base-local.json salida.candidate.json [sha256-semántico-base]');const input=JSON.parse(fs.readFileSync(source,'utf8')),candidate=build(input,{expectedHash});fs.mkdirSync(path.dirname(path.resolve(destination)),{recursive:true});fs.writeFileSync(destination,JSON.stringify(candidate,null,2)+'\n');console.log('Candidata LOCAL sin aplicar. Base '+hash(input)+'; candidata '+hash(candidate));}
module.exports={build,hash,SERVICE_UID,MAX_LEASE_MS,DOMAINS,CONFIG,SERVER_ONLY,KNOWN_CONFIG_WRITE,KNOWN_DOMAIN_WRITE,recognizedRule};
