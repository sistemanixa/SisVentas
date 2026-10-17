'use strict';
const {createHash}=require('node:crypto'),{gzip,brotliCompress,constants}=require('node:zlib'),{promisify}=require('node:util');
const compress=promisify(gzip),compressBrotli=promisify(brotliCompress);
function acceptsGzip(header){return String(header||'').split(',').some(part=>{const [name,...params]=part.trim().toLowerCase().split(';');if(name!=='gzip')return false;const quality=params.find(p=>p.trim().startsWith('q='));return !quality||Number(quality.trim().slice(2))>0;});}
function encodingQuality(header,encoding){
 const candidates=String(header||'').split(',').map(part=>{const [name,...params]=part.trim().toLowerCase().split(';');const q=params.find(p=>p.trim().startsWith('q='));const value=q?Number(q.trim().slice(2)):1;return {name,q:Number.isFinite(value)&&value>=0&&value<=1?value:0};});
 const exact=candidates.filter(p=>p.name===encoding);if(exact.length)return Math.min(...exact.map(p=>p.q));
 const wildcard=candidates.find(p=>p.name==='*');return wildcard?wildcard.q:0;
}
function preferredEncoding(header){const br=encodingQuality(header,'br'),gz=encodingQuality(header,'gzip');return br>0&&br>=gz?'br':gz>0?'gzip':'';}
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
 const encoding=preferredEncoding(req.headers['accept-encoding']);
 if(json.length>=1024&&encoding){const packed=encoding==='br'?await compressBrotli(json,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}):await compress(json);if(packed.length<json.length){body=packed;res.setHeader('Content-Encoding',encoding);}}
 res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':body.length});res.end(body);
}
module.exports={sendCommercial,acceptsGzip,preferredEncoding};
