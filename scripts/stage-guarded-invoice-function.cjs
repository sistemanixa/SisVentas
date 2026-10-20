'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{builtinModules}=require('node:module');

const FUNCTION_ROOT='cloud-functions/emitir-factura';
const LABOR_ROOTS=['labor-guard.js','labor-rtdb-store.js'];
const MANIFEST='stage-manifest.json',VENDOR_MANIFEST='vendor/labor/manifest.json';
const builtins=new Set(builtinModules.map(name=>name.replace(/^node:/,'')));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const compare=(a,b)=>a<b?-1:a>b?1:0;
const slash=value=>value.replaceAll('\\','/');
const inside=(root,target)=>{const relative=path.relative(root,target);return relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
const fail=message=>{throw Error(message);};
function git(root,args,options={}){
 try{return execFileSync('git',['--no-replace-objects','-c','core.fsmonitor=false',...args],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,...options});}
 catch(error){throw Error('No se pudo verificar Git: '+(error.stderr?.toString().trim()||error.message));}
}
function cleanSource(source,expectedCommit){
 if(!/^[a-f0-9]{40}$/.test(expectedCommit||''))fail('Indicar --expected-commit con el SHA completo revisado.');
 const root=fs.realpathSync(path.resolve(source));
 if(fs.realpathSync(git(root,['rev-parse','--show-toplevel']).trim())!==root)fail('--source debe ser la raíz del checkout revisado.');
 if(git(root,['rev-parse','HEAD']).trim()!==expectedCommit)fail('El SHA revisado no coincide con HEAD.');
 if(git(root,['status','--porcelain=v1','--untracked-files=all','--ignore-submodules=none']).trim())fail('El checkout debe estar completamente limpio; no se excluyen cambios locales.');
 return root;
}
function noLinks(target){
 let current=path.resolve(target);
 while(true){
  if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())fail('No se permiten enlaces simbólicos en el destino.');
  const parent=path.dirname(current);if(parent===current)break;current=parent;
 }
}
function checkedDestination(destination,source){
 if(typeof destination!=='string'||!path.isAbsolute(destination))fail('--destination debe indicar una ruta absoluta privada de tmp.');
 const result=path.resolve(destination);noLinks(result);
 if(inside(source,result))fail('El destino debe quedar fuera del checkout fuente.');
 if(!inside(path.resolve(os.tmpdir()),result)&&!result.split(/[\\/]/).some(part=>/^(tmp|temp)$/i.test(part)))fail('El destino debe estar en una carpeta privada tmp o temp.');
 const parent=path.dirname(result);
 if(!fs.existsSync(parent)||!fs.statSync(parent).isDirectory())fail('La carpeta padre del destino debe existir.');
 if(fs.existsSync(result)&&(!fs.statSync(result).isDirectory()||fs.readdirSync(result).length))fail('El destino debe ser un directorio nuevo o vacío.');
 // A private ignored tmp in another checkout is allowed; tracked/public paths
 // are not. There is no Git mutation, staging or checkout in this script.
 let repository='';
 try{repository=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:parent,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).trim();}catch(_){}
 if(repository){
  const relative=slash(path.relative(repository,result));
  if(git(repository,['ls-files','--',relative,relative+'/**']).trim())fail('El destino contiene archivos versionados.');
  try{execFileSync('git',['check-ignore','--quiet','--no-index','--',relative+'/stage-placeholder'],{cwd:repository,windowsHide:true,stdio:'ignore'});}catch(_){fail('El destino dentro de Git debe estar ignorado por completo.');}
 }
 return result;
}
function trackedFiles(root,commit){
 const result=new Map();
 for(const entry of git(root,['ls-tree','-r','-z','--full-tree',commit]).split('\0')){
  if(!entry)continue;
  const match=entry.match(/^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/);
  if(!match)fail('Inventario Git inválido.');
  result.set(match[4],{mode:match[1],type:match[2]});
 }
 return result;
}
function safeName(name){
 if(name.split('/').some(part=>!part||part==='..'||part.startsWith('.')||/^(node_modules|docs|test|tests|profiles|tmp|temp)$/i.test(part)))fail('Archivo excluido del paquete: '+name);
 if(/(?:secret|credential|service[-_]?account|private[-_]?key|\.pem$|\.p12$)/i.test(path.posix.basename(name)))fail('No se permiten archivos de secretos: '+name);
 if(!/\.(?:js|cjs|json)$/.test(name))fail('Tipo de archivo no desplegable: '+name);
}

// A small lexer, not a require regexp: comments, quoted strings and regular
// expressions cannot introduce dependencies. Nonliteral require, import and
// common indirect loaders fail closed. This inventories reviewed CommonJS;
// it does not execute code to discover dependencies.
function requires(source,label){
 const tokens=[];let index=0;
 const regexStart=()=>{const previous=tokens.at(-1);return !previous||['(','[','{','=',':',',',';','!','?','&','|','+','-','*','%','~','>','<'].includes(previous.value)||previous.type==='id'&&['return','throw','case','delete','typeof','void','yield','await','in','of'].includes(previous.value);};
 while(index<source.length){
  const char=source[index];
  if(/\s/.test(char)){index++;continue;}
  if(source.startsWith('//',index)){index=source.indexOf('\n',index+2);if(index<0)break;continue;}
  if(source.startsWith('/*',index)){const end=source.indexOf('*/',index+2);if(end<0)fail('Comentario sin cerrar: '+label);index=end+2;continue;}
  if(char==='"'||char==="'"||char==='`'){
   const quote=char;let value='',escaped=false,closed=false;index++;
   while(index<source.length){const next=source[index++];if(next==='\\'){escaped=true;value+=next+(source[index++]||'');continue;}if(next===quote){closed=true;break;}if(quote==='`'&&next==='$'&&source[index]==='{')fail('Plantilla dinámica no soportada por el inventario: '+label);value+=next;}
   if(!closed)fail('Cadena sin cerrar: '+label);tokens.push({type:'string',value,escaped});continue;
  }
  if(char==='/'&&regexStart()){
   index++;let characterClass=false,closed=false;
   while(index<source.length){const next=source[index++];if(next==='\\'){index++;continue;}if(next==='[')characterClass=true;else if(next===']')characterClass=false;else if(next==='/'&&!characterClass){closed=true;break;}}
   if(!closed)fail('Expresión regular sin cerrar: '+label);while(/[A-Za-z]/.test(source[index]||' '))index++;tokens.push({type:'regex',value:'/regex/'});continue;
  }
  const identifier=source.slice(index).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
  if(identifier){tokens.push({type:'id',value:identifier[0]});index+=identifier[0].length;continue;}
  tokens.push({type:'punctuation',value:char});index++;
 }
 const result=[];
 for(let position=0;position<tokens.length;position++){
  const token=tokens[position];
  if(token.type==='id'&&['import','export','eval','Function'].includes(token.value))fail('Carga dinámica o ESM no soportada: '+label);
  if(token.type==='id'&&['module','globalThis','global'].includes(token.value)&&tokens[position+1]?.value==='[')fail('Carga computada no soportada: '+label);
  if(token.type==='string'&&token.value==='require'&&tokens[position-1]?.value==='[')fail('Carga require computada no soportada: '+label);
  if(token.type!=='id'||token.value!=='require')continue;
  if(tokens[position-1]?.value==='.')fail('Carga require indirecta no soportada: '+label);
  const [open,specifier,close]=tokens.slice(position+1,position+4);
  if(open?.value!=='('||specifier?.type!=='string'||specifier.escaped||close?.value!==')')fail('require debe usar una ruta literal simple: '+label);
  result.push(specifier.value);
 }
 return result;
}
function buildPlan({source,expectedCommit,destination}){
 const root=cleanSource(source,expectedCommit),target=checkedDestination(destination,root),tracked=trackedFiles(root,expectedCommit),buffers=new Map(),entries=new Map(),external=new Set();
 function blob(name){
  safeName(name);const info=tracked.get(name);
  if(!info||info.type!=='blob'||!['100644','100755'].includes(info.mode))fail('Falta un archivo regular versionado: '+name);
  let current=root;
  for(const part of name.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())fail('No se permiten enlaces en la fuente: '+name);}
  return git(root,['show',expectedCommit+':'+name],{encoding:null});
 }
 const packageBytes=blob(FUNCTION_ROOT+'/package.json'),packageInfo=JSON.parse(packageBytes.toString('utf8'));
 const declared={...packageInfo.dependencies};
 function resolveLocal(base,specifier){
  const normalized=path.posix.normalize(path.posix.join(path.posix.dirname(base),specifier));
  for(const candidate of [normalized,normalized+'.js',normalized+'.cjs',normalized+'.json',normalized+'/index.js',normalized+'/index.cjs'])if(tracked.has(candidate))return candidate;
  fail('Dependencia local ausente: '+base+' -> '+specifier);
 }
 function add(name,destinationName){
  if(entries.has(destinationName)){if(entries.get(destinationName).source!==name)fail('Dos fuentes compiten por '+destinationName);return;}
  const buffer=blob(name);buffers.set(destinationName,buffer);entries.set(destinationName,{path:destinationName,source:name,bytes:buffer.length,sha256:hash(buffer)});
  if(!/\.(js|cjs)$/.test(name))return;
  for(const specifier of requires(buffer.toString('utf8'),name)){
   if(!specifier.startsWith('.')){
    if(path.posix.isAbsolute(specifier)||specifier.includes('\\'))fail('Dependencia inválida: '+specifier);
    const plain=specifier.replace(/^node:/,'');if(builtins.has(plain))continue;
    const dependency=specifier.startsWith('@')?specifier.split('/').slice(0,2).join('/'):specifier.split('/')[0];
    if(!Object.hasOwn(declared,dependency))fail('Dependencia npm no declarada por la función: '+specifier);
    external.add(dependency);continue;
   }
   let dependency;
   if(name===FUNCTION_ROOT+'/labor-bridge.cjs'&&/^\.\/vendor\/labor\/labor-(guard|rtdb-store)(?:\.js)?$/.test(specifier))dependency='cotizador/'+path.posix.basename(specifier).replace(/\.js$/,'')+'.js';
   else dependency=resolveLocal(name,specifier);
   if(name.startsWith('cotizador/')){
    if(!dependency.startsWith('cotizador/'))fail('Una dependencia laboral sale de cotizador: '+dependency);
    add(dependency,'vendor/labor/'+dependency.slice('cotizador/'.length));
   }else if(dependency.startsWith(FUNCTION_ROOT+'/')){
    if(dependency.includes('/vendor/'))fail('La fuente no debe contener un vendor previo.');
    add(dependency,dependency.slice(FUNCTION_ROOT.length+1));
   }else if(name===FUNCTION_ROOT+'/labor-bridge.cjs'&&LABOR_ROOTS.includes(dependency.slice('cotizador/'.length))&&dependency.startsWith('cotizador/'))add(dependency,'vendor/labor/'+dependency.slice('cotizador/'.length));
   else fail('Una dependencia de la función sale de su paquete: '+dependency);
  }
 }
 add(FUNCTION_ROOT+'/package.json','package.json');add(FUNCTION_ROOT+'/package-lock.json','package-lock.json');
 if(packageInfo.main!=='index.js')fail('La entrada desplegable debe ser index.js.');
 add(FUNCTION_ROOT+'/index.js','index.js');
 if(!entries.has('labor-bridge.cjs'))fail('La función no alcanza labor-bridge.cjs; no se prepara una variante sin guard.');
 for(const file of LABOR_ROOTS)if(!entries.has('vendor/labor/'+file))fail('Falta dependencia obligatoria del guard: '+file);
 const lock=JSON.parse(buffers.get('package-lock.json').toString('utf8'));
 const dependencies=value=>JSON.stringify(Object.entries(value||{}).sort(([a],[b])=>compare(a,b)));
 if(!lock.packages?.['']||dependencies(lock.packages[''].dependencies)!==dependencies(packageInfo.dependencies))fail('package-lock no coincide con las dependencias de package.json.');
 const vendor={schema:1,kind:'guarded-invoice-labor',sourceCommit:expectedCommit,files:[...entries.values()].filter(entry=>entry.path.startsWith('vendor/labor/')).sort((a,b)=>compare(a.path,b.path))};
 const vendorBytes=Buffer.from(JSON.stringify(vendor,null,2)+'\n');buffers.set(VENDOR_MANIFEST,vendorBytes);entries.set(VENDOR_MANIFEST,{path:VENDOR_MANIFEST,source:null,bytes:vendorBytes.length,sha256:hash(vendorBytes)});
 const manifest={schema:1,kind:'guarded-invoice-function',sourceCommit:expectedCommit,entryPoint:'index.js',files:[...entries.values()].sort((a,b)=>compare(a.path,b.path)),externalPackages:Object.fromEntries([...external].sort().map(name=>[name,declared[name]]))};
 const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
 return {source:root,destination:target,manifest,manifestSha256:hash(manifestBytes),buffers,manifestBytes};
}
function stage(options){
 const plan=buildPlan(options);
 if(options.apply===true){
  cleanSource(plan.source,options.expectedCommit);checkedDestination(plan.destination,plan.source);
  if(!fs.existsSync(plan.destination))fs.mkdirSync(plan.destination);
  for(const [name,bytes]of [...plan.buffers].sort(([a],[b])=>compare(a,b))){const target=path.join(plan.destination,...name.split('/'));noLinks(path.dirname(target));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
  fs.writeFileSync(path.join(plan.destination,MANIFEST),plan.manifestBytes,{flag:'wx'});
 }
 return {mode:options.apply===true?'staged':'plan',destination:plan.destination,manifest:plan.manifest,manifestSha256:plan.manifestSha256,note:'Sólo empaquetado local; no instala dependencias ni despliega.'};
}
function argumentsFor(argv){
 const options={source:path.resolve(__dirname,'..'),apply:false};
 const flags=new Map([['--source','source'],['--expected-commit','expectedCommit'],['--destination','destination']]),seen=new Set();
 for(let i=0;i<argv.length;i++){
  const flag=argv[i];if(seen.has(flag))fail('Argumento repetido: '+flag);seen.add(flag);
  if(flag==='--apply'){options.apply=true;continue;}
  if(!flags.has(flag)||!argv[i+1]||argv[i+1].startsWith('--'))fail('Argumento inválido: '+flag);
  options[flags.get(flag)]=argv[++i];
 }
 return options;
}
if(require.main===module){try{console.log(JSON.stringify(stage(argumentsFor(process.argv.slice(2))),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={stage,buildPlan,requires,MANIFEST,VENDOR_MANIFEST};
