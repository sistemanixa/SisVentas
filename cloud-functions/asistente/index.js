const http    = require('http');
const https   = require('https');
const admin=require('./admin.cjs');

const FRONTEND_KEY  = process.env.FRONTEND_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

const server = http.createServer(async (req, res) => {
  const origin=req.headers.origin;
  if(['https://ventas.sistemanixa.com','http://127.0.0.1:8765','http://localhost:8765','http://127.0.0.1:8766','http://localhost:8766'].includes(origin))res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Frontend-Key, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST')    { res.writeHead(405); res.end('Método no permitido'); return; }

  const path=String(req.url||'').split('?')[0];
  if(!['/','/learn','/purchase-import','/statement-import','/transcribe'].includes(path)){res.writeHead(404);res.end(JSON.stringify({error:true,mensaje:'Ruta no encontrada'}));return;}
  const privateStatement=path==='/statement-import';
  const service=path==='/learn'?'learn':path==='/purchase-import'?'purchase-import':privateStatement?'statement-import':'chat';
  let identity;
  try{identity=await require('./service-auth.cjs').authorize({admin,authorization:req.headers.authorization,service,personalOwnerUid:process.env.PERSONAL_FINANCE_OWNER_UID||'',personalEnabled:process.env.PERSONAL_FINANCE_ENABLED==='true',viewAs:!!req.headers['x-sisventas-view-as']});}
  catch(error){res.writeHead(error.statusCode||503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:true,mensaje:error.statusCode?error.message:'No se pudo verificar el permiso; reintentá'}));return;}
  let body = ''; let bodyBytes=0; let oversized=false;const maxBody=privateStatement?22*1024*1024:5000000;
  if(privateStatement)res.setHeader('Cache-Control','no-store');
  if(Number(req.headers['content-length'])>maxBody){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:true,mensaje:'El archivo supera el tamaño permitido'}));req.resume();return;}
  req.on('data', chunk => {bodyBytes+=chunk.length;if(bodyBytes>maxBody){oversized=true;body='';return;}if(!oversized)body+=chunk;});
  req.on('end', async () => {
    try {
      if(oversized){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:true,mensaje:'El archivo supera el tamaño permitido'}));return;}
      let parsedBody;try{parsedBody=JSON.parse(body);}catch(_){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:true,mensaje:'Formato de solicitud inválido'}));return;}
      if(!parsedBody || typeof parsedBody!=='object' || Array.isArray(parsedBody)){res.writeHead(400);res.end(JSON.stringify({error:true,mensaje:'Solicitud inválida'}));return;}
      const statementPayload=privateStatement?require('./statement-import.cjs').payload(parsedBody):null;
      await require('./usage-limit.cjs').reserve({admin,uid:identity.uid});
      if(path==='/transcribe'){const result=await require('./audio.cjs').transcribe(req,parsedBody);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;}
      const { system, messages } = parsedBody;
      if(!privateStatement&&(!Array.isArray(messages)||!messages.length||messages.length>12)){res.writeHead(400);res.end(JSON.stringify({error:true,mensaje:'Conversación inválida'}));return;}

      const payload = JSON.stringify(statementPayload||{
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     system || '',
        messages:   (messages || []).slice(-12),
        ...(path==='/learn' ? {tools:[{name:'proponer_regla',description:'Proponer una regla exacta o pedir aclaración sin inventar condiciones.',input_schema:{type:'object',properties:{categoria:{type:'string'},codigo:{type:'string'},cantidad:{type:'integer'},pregunta:{type:'string'}},additionalProperties:false}}],tool_choice:{type:'tool',name:'proponer_regla'}} : path==='/purchase-import'?{}:{tools:[{type:'web_search_20250305',name:'web_search'}]})
      });

      const options = {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length':    Buffer.byteLength(payload)
        }
      };

      const apiReq = https.request(options, apiRes => {
        let data = '';
        apiRes.on('data', c => {if(privateStatement&&data.length+c.length>2*1024*1024){apiReq.destroy(Error('Respuesta demasiado grande'));return;}data+=c;});
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if(privateStatement){
              if(apiRes.statusCode<200||apiRes.statusCode>=300||parsed.error)throw Error('Proveedor no disponible');
              const result=require('./statement-import.cjs').normalize(parsed);
              res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,...result}));return;
            }
            const propuesta=(parsed.content||[]).find(b=>b.type==='tool_use'&&b.name==='proponer_regla');
            const textos = propuesta ? JSON.stringify(propuesta.input) : (parsed.content || [])
              .filter(b => b.type === 'text')
              .map(b => b.text)
              .join('\n');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              content: [{ type: 'text', text: textos || 'Sin respuesta' }]
            }));
          } catch(e) {
            res.writeHead(privateStatement?502:500); res.end(JSON.stringify({ error: true, mensaje: privateStatement?(e.statusCode?e.message:'No se pudo completar la lectura con IA; no se guardaron datos'):'Error parseando respuesta' }));
          }
        });
      });

      apiReq.on('error', e => { if(res.writableEnded||res.destroyed)return;res.writeHead(502); res.end(JSON.stringify({ error: true, mensaje: privateStatement?'No se pudo contactar la IA; el PDF no se guardó':e.message })); });
      if(privateStatement){apiReq.setTimeout(150000,()=>apiReq.destroy(Error('Tiempo agotado')));res.on?.('close',()=>{if(!res.writableEnded)apiReq.destroy(Error('Lectura cancelada'));});}
      apiReq.write(payload);
      apiReq.end();

    } catch(e) {
      if(e.retryAfter)res.setHeader('Retry-After',String(e.retryAfter));res.writeHead(e.statusCode||500,{'Content-Type':'application/json'}); res.end(JSON.stringify({ error: true, mensaje: e.statusCode?e.message:'No se pudo procesar la consulta' }));
    }
  });
});

server.listen(parseInt(process.env.PORT) || 8080, () => console.log('Asistente listo en puerto ' + (process.env.PORT || 8080)));
