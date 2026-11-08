'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const BASE_SHA256='1f9f7b82348009ea6374ecdf4c0b0b4bbb1fdb95c856c4538a9389f22282b1d3';
const HELPER_SHA256='61de81562c642a3481eab004dbe328242779642961855263acda5c9e96b9c322';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const changes=[
 [
  `        await page.locator('form[action="control.php"] input[name="usuario"]').fill(usuario);\n        await page.locator('form[action="control.php"] input[name="password"]').fill(password);\n        await page.locator('form[action="control.php"] button[type="submit"]').click();`,
  `        await require('./tecnoprices-login').login(page, usuario, password);`
 ],
 [
  `    const evidenciaPrecio = await extraerPrecioPaginaProveedor(page, tipo, bodyText);`,
  `    if (tipo === 'tecnoprices') await require('./tecnoprices-login').assertSession(page);\n    const evidenciaPrecio = await extraerPrecioPaginaProveedor(page, tipo, bodyText);`
 ],
 [
  `  } catch (e) {\n    e.trace = trace;\n    throw e;`,
  `  } catch (e) {\n    if (tipo === 'tecnoprices') {\n      sesionesProveedorManual.delete(claveSesionProveedorManual(proveedorKey, tipo));\n      throw Object.assign(new Error('No se pudo consultar Tecnoprices. Revisá la sesión y la URL exacta del producto.'), { code:'TECNOPRICES_LOOKUP_FAILED' });\n    }\n    e.trace = trace;\n    throw e;`
 ]
];
function rewrite(source,reverse=false){
 const start='async function cotizarProveedorConLogin(',end='\nasync function cotizarBiosegur(';
 if(source.split(start).length!==2||source.split(end).length!==2)throw Error('Ambiguous scraper boundaries; no patch applied');
 const from=source.indexOf(start),to=source.indexOf(end,from);if(to<from)throw Error('Invalid scraper boundaries');
 let body=source.slice(from,to);
 for(const entry of changes){const pair=entry.map(text=>text.replaceAll('\n','\r\n'));const [before,after]=reverse?[pair[1],pair[0]]:pair;if(body.split(before).length!==2)throw Error('Unexpected scraper anchor; no patch applied');body=body.replace(before,after);}
 return source.slice(0,from)+body+source.slice(to);
}
function apply(source){
 if(sha(source)!==BASE_SHA256)throw Error('Stock image entrypoint changed; no patch applied');
 const result=rewrite(source);if(rewrite(result,true)!==source)throw Error('Patch is not exactly reversible');return result;
}
function revert(source){const original=rewrite(source,true);if(sha(original)!==BASE_SHA256||apply(original)!==source)throw Error('Modified overlay; refusing reversal');return original;}
function verifyHelper(bytes){if(sha(bytes)!==HELPER_SHA256)throw Error('Unreviewed Tecnoprices helper; no patch applied');}
if(require.main===module){
 const mode=process.argv[2],file=process.argv[3]||'/app/index.js';
 if(!['apply','verify','revert'].includes(mode))throw Error('Expected apply, verify or revert');
 verifyHelper(fs.readFileSync(path.join(__dirname,'tecnoprices-login.js')));
 const source=fs.readFileSync(file,'utf8');
 const result=mode==='apply'?apply(source):revert(source);
 if(mode!=='verify')fs.writeFileSync(file,result);
 process.stdout.write(JSON.stringify({mode,sourceSha256:sha(source),resultSha256:sha(mode==='verify'?source:result),baseSha256:BASE_SHA256})+'\n');
}
module.exports={apply,revert,verifyHelper,sha,BASE_SHA256,HELPER_SHA256};
