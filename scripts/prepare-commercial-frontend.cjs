'use strict';
// Offline preparation only. No authentication, deployment or production reads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(root,args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const rootNames=new Set(['index.html','personal-finance.html','catalogo.html','sw.js','push-sw.js','manifest.webmanifest','logo_blanco.jpg','nixa-icon-192.png','nixa-icon-512.png']);
function allowed(name){return rootNames.has(name)||/^js\/vendor\/(?:pdfjs\/LICENSE|zxing\/LICENSE(?:-library)?)$/.test(name)||/^(?:js|css)\/.+\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?|ttf|map|mjs)$/i.test(name);}
function publicNames(names,version){const number=name=>name.match(/app\.v(\d+)\.(\d+)\.(\d+)\.js/).slice(1).map(Number),compare=(a,b)=>{const x=number(a),y=number(b);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2];},active='js/app.'+version+'.js',apps=names.filter(p=>/^js\/app\.v\d+\.\d+\.\d+\.js$/.test(p)&&compare(p,active)<=0).sort((a,b)=>compare(b,a)).slice(0,3),retained=new Set(apps);return names.filter(allowed).filter(p=>!/^js\/app\.v/.test(p)||retained.has(p));}
function once(text,from,to){if(text.split(from).length!==2)throw Error('Unknown frontend anchor: '+from);return text.replace(from,to);}
function validate(assets,version,enabled){
 const read=p=>{if(!assets.has(p))throw Error('Missing public asset '+p);return assets.get(p).toString();},index=read('index.html'),app=read('js/app.'+version+'.js'),core=read('js/core/version.'+version+'.js'),worker=read('sw.js');
 const local=[...index.matchAll(/(?:src|href)=["'](\.\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)].map(match=>match[1]),shellSection=worker.match(/const SHELL = \[([\s\S]*?)\];/);
 if(!shellSection)throw Error('Unknown worker SHELL');const shell=[...shellSection[1].matchAll(/["'](\.\/[^"']*)["']/g)].map(match=>match[1]),shellSet=new Set(shell);
 for(const url of [...local,...shell]){const filename=url.slice(2).split('?')[0]||'index.html';if(filename.includes('\\')||filename.split('/').some(part=>!part||part==='.'||part==='..')||!assets.has(filename))throw Error('Missing or unsafe referenced public asset '+url);}
 if(local.some(url=>!shellSet.has(url)))throw Error('Index URL absent from exact worker SHELL');if(new Set(local).size!==local.length)throw Error('Duplicate local script or stylesheet');
 const loadedApps=local.filter(url=>/^\.\/js\/app\.v\d+\.\d+\.\d+\.js(?:\?|$)/.test(url)),loadedMarkers=local.filter(url=>/^\.\/js\/core\/version\.v\d+\.\d+\.\d+\.js(?:\?|$)/.test(url));if(loadedApps.length!==1||loadedMarkers.length!==1)throw Error('Multiple or missing immutable application/marker');
 for(const anchor of ["VERSION: '"+version+"-firebase'",'./js/app.'+version+'.js','./js/core/version.'+version+'.js'])if(!index.includes(anchor))throw Error('Incoherent index version');
 if(!app.includes("VERSION: '"+version+"-firebase'")||!app.includes("version:'"+version+"'"))throw Error('Incoherent application version/history');
 if(!core.includes("SISVENTAS_PWA_VERSION = '"+version+"'")||read('js/core/version.js')!==core)throw Error('Incoherent core version');
 for(const anchor of ["'sisventas-"+version+"'","'./js/app."+version+".js'","'./js/core/version."+version+".js'"])if(!worker.includes(anchor))throw Error('Incoherent worker version');
 for(const flag of ['ACCOUNTS','HISTORY']){const declaration='SV_CLIENT_'+flag+'_ROLLOUT=Object.freeze({schema:1,enabled:'+enabled+'})';if(index.split(declaration).length!==2||[...index.matchAll(new RegExp('SV_CLIENT_'+flag+'_ROLLOUT\\s*=','g'))].length!==1)throw Error('Unknown or duplicate rollout declaration');}
 return true;
}
function prepare({source,expectedCommit,output,date='08/11/2026'}){
 source=fs.realpathSync(source);output=path.resolve(output);
 if(!/^[a-f0-9]{40}$/.test(expectedCommit||'')||git(source,['rev-parse','HEAD'])!==expectedCommit)throw Error('Reviewed full source commit required');
 if(git(source,['status','--porcelain','--untracked-files=normal']))throw Error('Source checkout must be clean');
 const relative=path.relative(source,output).replaceAll('\\','/');if(!relative.startsWith('tmp/')||relative.split('/').includes('..')||git(source,['check-ignore',relative])!==relative)throw Error('Output must be in ignored source tmp');
 let ancestor=path.dirname(output);while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);const actualParent=fs.realpathSync(ancestor);if(actualParent!==source&&!actualParent.startsWith(source+path.sep))throw Error('Output ancestor escapes source');
 if(fs.existsSync(output))throw Error('Output already exists');if(!/^\d{2}\/\d{2}\/\d{4}$/.test(date))throw Error('Explicit release date required');
 const tracked=git(source,['ls-files','-z']).split('\0').filter(Boolean);if(tracked.includes('js/app.v3.19.20.js')||tracked.includes('js/core/version.v3.19.20.js'))throw Error('Next immutable version already exists');
 const names=publicNames(tracked,'v3.19.19'),assets=new Map();for(const name of names){const file=path.join(source,name);if(fs.lstatSync(file).isSymbolicLink())throw Error('Public symlink rejected');assets.set(name,fs.readFileSync(file));}
 const from='v3.19.19',to='v3.19.20';validate(assets,from,false);if(assets.has('js/app.'+to+'.js')||assets.has('js/core/version.'+to+'.js'))throw Error('Next immutable version already exists');
 const transformations=[];function change(name,text,origin=name){const before=assets.get(origin);assets.set(name,Buffer.from(text));transformations.push({path:name,source:origin,beforeSha256:hash(before),afterSha256:hash(assets.get(name))});}
 let index=assets.get('index.html').toString();index=index.replaceAll(from,to);for(const flag of ['ACCOUNTS','HISTORY'])index=once(index,'SV_CLIENT_'+flag+'_ROLLOUT=Object.freeze({schema:1,enabled:false})','SV_CLIENT_'+flag+'_ROLLOUT=Object.freeze({schema:1,enabled:true})');change('index.html',index);
 let app=assets.get('js/app.'+from+'.js').toString();app=once(app,"VERSION: '"+from+"-firebase'","VERSION: '"+to+"-firebase'");app=once(app,"Object.freeze({version:'"+from+"'","Object.freeze({version:'"+to+"',date:'"+date+"',title:'Integración comercial',notes:Object.freeze(['Cuenta corriente e historial con fuentes completas y permisos verificados.'])}),\n Object.freeze({version:'"+from+"'");change('js/app.'+to+'.js',app,'js/app.'+from+'.js');
 const core=once(assets.get('js/core/version.js').toString(),"SISVENTAS_PWA_VERSION = '"+from+"'","SISVENTAS_PWA_VERSION = '"+to+"'");change('js/core/version.'+to+'.js',core,'js/core/version.js');change('js/core/version.js',core);change('sw.js',assets.get('sw.js').toString().replaceAll(from,to));validate(assets,to,true);
 // Match Hosting retention: active app and its two preceding immutable versions.
 const apps=[...assets.keys()].filter(p=>/^js\/app\.v\d+\.\d+\.\d+\.js$/.test(p)).sort((a,b)=>{const x=a.match(/\d+/g).map(Number),y=b.match(/\d+/g).map(Number);return y[0]-x[0]||y[1]-x[1]||y[2]-x[2];});for(const name of apps.slice(3))assets.delete(name);
 const files=[...assets].sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:hash(bytes)}));
 const manifest={schema:1,kind:'commercial-frontend-local-only',sourceCommit:expectedCommit,sourceVersion:from,version:to,rollouts:{accounts:true,history:true},transformations,files,activation:'Not deployed. Requires reviewed clean release checkout, server/rules/index cut and separate authorization.'};
 fs.mkdirSync(path.join(output,'public'),{recursive:true});for(const [name,bytes]of assets){const file=path.join(output,'public',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});}fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
if(require.main===module){const value=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};try{const result=prepare({source:value('--source'),expectedCommit:value('--expected-commit'),output:value('--output'),date:value('--date')});console.log(JSON.stringify({version:result.version,sourceCommit:result.sourceCommit,files:result.files.length,mode:'local-only'}));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={prepare,validate,allowed,publicNames};
