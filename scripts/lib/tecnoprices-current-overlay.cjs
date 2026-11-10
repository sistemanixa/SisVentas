'use strict';
// Offline composition against the exact serving image. No credentials or network.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const BASE_IMAGE='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:977f670b2790a87163ba615508fdd3432dae756fd5a62797ee551bfc08be75d9';
const BASE_SHA256='65bcf210546539b6c70ccc1018df009ceaec867e458172b411525c41fcf02fd4';
const HELPER_SHA256='61de81562c642a3481eab004dbe328242779642961855263acda5c9e96b9c322';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const changes=[
 [`        await page.locator('form[action="control.php"] input[name="usuario"]').fill(usuario);\n        await page.locator('form[action="control.php"] input[name="password"]').fill(password);\n        await page.locator('form[action="control.php"] button[type="submit"]').click();`,`        await require('./tecnoprices-login').login(page, usuario, password);`],
 [`    const evidenciaPrecio = await extraerPrecioPaginaProveedor(page, tipo, bodyText);`,`    if (tipo === 'tecnoprices') await require('./tecnoprices-login').assertSession(page);\n    const evidenciaPrecio = await extraerPrecioPaginaProveedor(page, tipo, bodyText);`],
 [`  } catch (e) {\n    e.trace = trace;\n    throw e;`,`  } catch (e) {\n    if (tipo === 'tecnoprices') {\n      sesionesProveedorManual.delete(claveSesionProveedorManual(proveedorKey, tipo));\n      throw Object.assign(new Error('No se pudo consultar Tecnoprices. Revisá el acceso al proveedor antes de reintentar.'), { code:'TECNOPRICES_LOOKUP_FAILED' });\n    }\n    e.trace = trace;\n    throw e;`]
];
function rewrite(source,reverse=false){
 const start='async function cotizarProveedorConLogin(',end='\nasync function cotizarBiosegur(';
 if(source.split(start).length!==2||source.split(end).length!==2)throw Error('Los límites del lector no son únicos.');
 const from=source.indexOf(start),to=source.indexOf(end,from);if(to<from)throw Error('Lector inesperado.');
 let body=source.slice(from,to);
 for(const values of changes){const pair=values.map(s=>s.replaceAll('\n','\r\n')),[before,after]=reverse?[pair[1],pair[0]]:pair;if(body.split(before).length!==2)throw Error('El lector no coincide con las anclas revisadas.');body=body.replace(before,after);}
 return source.slice(0,from)+body+source.slice(to);
}
function apply(index){if(!Buffer.isBuffer(index)||sha(index)!==BASE_SHA256)throw Error('La fuente no corresponde a la imagen publicada.');const source=index.toString('utf8'),result=rewrite(source);if(rewrite(result,true)!==source)throw Error('Cambio fuera del alcance del lector.');return Buffer.from(result);}
function plan({index,helper}){if(!Buffer.isBuffer(helper)||sha(helper)!==HELPER_SHA256)throw Error('El helper no coincide con la fuente canónica revisada.');const patched=apply(index),files={'server/index.js':patched,'server/tecnoprices-login.js':Buffer.from(helper)};return{files,manifest:{schema:1,kind:'tecnoprices-login-current-overlay',baseImage:BASE_IMAGE,baseIndexSha256:BASE_SHA256,files:Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)])),preservation:{outsideSupplierReader:true,stock:true,otDeleteAuthority:true,payments:true,permissions:true,commissions:true,storedUrls:true},activation:{otAttestationRotationRequired:true,ready:false},built:false,deployed:false}};}
function prepare({index,helper,outputDir}){if(fs.existsSync(outputDir))throw Error('La salida debe ser nueva.');const result=plan({index,helper});for(const[p,b]of Object.entries(result.files)){const dest=path.join(outputDir,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx'});}fs.writeFileSync(path.join(outputDir,'Dockerfile'),`FROM ${BASE_IMAGE}\nWORKDIR /app\nCOPY server/index.js server/tecnoprices-login.js ./\nRUN node --check index.js && node --check tecnoprices-login.js && node -e "const h=require('./tecnoprices-login');if(typeof h.login!=='function'||typeof h.assertSession!=='function')throw Error('Missing login helper');require('./ot-delete-authority');"\n`);fs.writeFileSync(path.join(outputDir,'.gcloudignore'),'*\n!Dockerfile\n!server/\n!server/*.js\n!manifest.json\n');fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(result.manifest,null,2));return result.manifest;}
module.exports={BASE_IMAGE,BASE_SHA256,HELPER_SHA256,sha,rewrite,apply,plan,prepare};
const BASE_POOL_NORMALIZED_SHA256='daf095422a4c54ddc91bf81315ea59242d1d94c8e71a09e013b22e5d601d7a60';
function productionIndex(index){
 const initial=apply(index).toString('utf8'),start=initial.indexOf('async function cotizarProveedorConLogin('),end=initial.indexOf('\nasync function cotizarBiosegur(',start);let body=initial.slice(start,end);
 const edits=[
  ["      timezoneId:'America/Argentina/Buenos_Aires',", "      timezoneId:'America/Argentina/Buenos_Aires',\n      ...(tipo === 'tecnoprices' ? {userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + browser.version() + ' Safari/537.36'} : {}),"],
  ["    if (incluirFicha) await protegerNavegacionFicha(context, tipo);", "    if (tipo === 'tecnoprices') context.setDefaultTimeout(2500);\n    if (incluirFicha) await protegerNavegacionFicha(context, tipo);"]
 ].map(pair=>pair.map(s=>s.replaceAll('\n','\r\n')));
 for(const[before,after]of edits){if(body.split(before).length!==2)throw Error('Ancla del contexto de navegador incompatible.');body=body.replace(before,after);}
 let restored=body;for(const[before,after]of edits.slice().reverse())restored=restored.replace(after,before);if(restored!==initial.slice(start,end))throw Error('Cambio inesperado de contexto.');
 return Buffer.from(initial.slice(0,start)+body+initial.slice(end));
}
function productionPool(pool){if(!Buffer.isBuffer(pool))throw Error('Falta la fuente del pool.');const text=pool.toString('utf8').replaceAll('\r\n','\n');if(sha(Buffer.from(text))!==BASE_POOL_NORMALIZED_SHA256)throw Error('El pool no coincide con la base revisada.');const before='    return {\n      async newContext(opciones) {';if(text.split(before).length!==2)throw Error('Ancla de pool incompatible.');return Buffer.from(text.replace(before,'    return {\n      version:()=>browser.version(),\n      async newContext(opciones) {'));}
function planProduction({index,helper,pool}){const result=plan({index,helper});result.files['server/index.js']=productionIndex(index);result.files['server/navegador-compartido.js']=productionPool(pool);result.manifest.kind='tecnoprices-login-current-production-overlay';result.manifest.basePoolNormalizedSha256=BASE_POOL_NORMALIZED_SHA256;delete result.manifest.preservation.outsideSupplierReader;result.manifest.preservation.indexOutsideSupplierReader=true;result.manifest.preservation.poolVersionAccessorOnly=true;result.manifest.files=Object.fromEntries(Object.entries(result.files).map(([p,b])=>[p,sha(b)]));return result;}
function prepareProduction({index,helper,pool,outputDir}){
 if(fs.existsSync(outputDir))throw Error('La salida debe ser nueva.');const result=planProduction({index,helper,pool});for(const[p,b]of Object.entries(result.files)){const dest=path.join(outputDir,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx'});}
 const check="const fs=require('fs'),c=require('crypto');const s=fs.readFileSync('navegador-compartido.js','utf8').replace(/\\r\\n/g,'\\n');if(c.createHash('sha256').update(s).digest('hex')!=='"+BASE_POOL_NORMALIZED_SHA256+"')throw Error('Unexpected base browser pool');";
 fs.writeFileSync(path.join(outputDir,'Dockerfile'),`FROM ${BASE_IMAGE}\nWORKDIR /app\nRUN node -e "${check}"\nCOPY server/index.js server/tecnoprices-login.js server/navegador-compartido.js ./\nRUN node --check index.js && node --check tecnoprices-login.js && node --check navegador-compartido.js && node -e "require('./tecnoprices-login');require('./ot-delete-authority');require('./navegador-compartido');"\n`);
 fs.writeFileSync(path.join(outputDir,'.gcloudignore'),'*\n!Dockerfile\n!server/\n!server/*.js\n!manifest.json\n');fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(result.manifest,null,2));return result.manifest;
}
Object.assign(module.exports,{BASE_POOL_NORMALIZED_SHA256,productionIndex,productionPool,planProduction,prepareProduction});
