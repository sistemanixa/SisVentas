'use strict';
const {createHash}=require('node:crypto'),{gzip}=require('node:zlib'),{promisify}=require('node:util');
const compress=promisify(gzip);
function acceptsGzip(header){return String(header||'').split(',').some(part=>{const [name,...params]=part.trim().toLowerCase().split(';');if(name!=='gzip')return false;const quality=params.find(p=>p.trim().startsWith('q='));return !quality||Number(quality.trim().slice(2))>0;});}
function matches(header,etag){return String(header||'').split(',').some(v=>v.trim()==='*'||v.trim().replace(/^W\//,'')===etag);}
async function sendCommercial(req,res,payload){
 // Se llama únicamente DESPUÉS de autenticar y filtrar los registros. Nunca se
 // comparte una respuesta entre cuentas ni se almacena información en disco.
 const json=Buffer.from(JSON.stringify(payload));
 const etag='W/"'+createHash('sha256').update(json).digest('base64url')+'"';
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Vary','Authorization, Origin, Accept-Encoding');
 res.setHeader('Access-Control-Expose-Headers','ETag');res.setHeader('ETag',etag);
 if(matches(req.headers['if-none-match'],etag.replace(/^W\//,''))){res.writeHead(304);res.end();return;}
 let body=json;
 if(json.length>=1024&&acceptsGzip(req.headers['accept-encoding'])){const packed=await compress(json);if(packed.length<json.length){body=packed;res.setHeader('Content-Encoding','gzip');}}
 res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':body.length});res.end(body);
}
module.exports={sendCommercial,acceptsGzip};
