'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const shell=vm.runInNewContext(worker.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
const localUrls=[...html.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/g)].map(row=>row[1]).filter(url=>/\.(?:js|css)(?:\?|$)/.test(url));
test('the current shell includes every exact local script and stylesheet URL used by the index',()=>{
 assert.equal(new Set(shell).size,shell.length);
 for(const url of localUrls)assert(shell.includes(url),'Missing exact index URL: '+url);
 for(const url of shell){
  assert(url.startsWith('./'),'Only local public assets belong to the shell');
  const pathname=url.split('?')[0];assert(!/(?:^|\/)(?:docs|test|scripts|tmp|security|cotizador|cloud-functions|\.local)(?:\/|$)/.test(pathname));
  assert(!pathname.includes('..'),'No parent paths in the shell');
  const target=path.resolve(root,pathname);assert(target===root||target.startsWith(root+path.sep));
  assert(fs.existsSync(target),'Missing shell asset: '+url);
 }
});
test('immutable application, version marker and cache belong to the same local candidate',()=>{
 const active=html.match(/src="\.\/(js\/app\.(v\d+\.\d+\.\d+)\.js)"/);assert(active);
 const version=active[2],app=fs.readFileSync(path.join(root,active[1]),'utf8');
 assert(worker.includes("const CACHE = 'sisventas-"+version+"'"));
 assert(shell.includes('./'+active[1]));assert(shell.includes('./js/core/version.'+version+'.js'));
 assert(app.includes("VERSION: '"+version+"-firebase'"));
 assert(app.includes("version:'"+version+"'"));
 for(const marker of ['js/core/version.js','js/core/version.'+version+'.js'])assert(fs.readFileSync(path.join(root,marker),'utf8').includes("SISVENTAS_PWA_VERSION = '"+version+"'"));
});
