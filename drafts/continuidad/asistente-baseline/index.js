const http    = require('http');
const https   = require('https');

const FRONTEND_KEY  = process.env.FRONTEND_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

const server = http.createServer(async (req, res) => {
  const origin=req.headers.origin;
  if(['https://ventas.sistemanixa.com','http://127.0.0.1:8765','http://localhost:8765'].includes(origin))res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Frontend-Key, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST')    { res.writeHead(405); res.end('Método no permitido'); return; }

  const key = req.headers['x-frontend-key'];
  if (key !== FRONTEND_KEY) { res.writeHead(401); res.end(JSON.stringify({ error: true, mensaje: 'No autorizado' })); return; }

  let body = '';
  req.on('data', chunk => {body += chunk; if(body.length>5000000)req.destroy();});
  req.on('end', async () => {
    try {
      const parsedBody=JSON.parse(body);
      if(req.url==='/transcribe'){const result=await require('./audio.cjs').transcribe(req,parsedBody);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;}
      const { system, messages } = parsedBody;

      const payload = JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     system || '',
        messages:   (messages || []).slice(-12),
        ...(req.url==='/learn' ? {tools:[{name:'proponer_regla',description:'Proponer una regla exacta o pedir aclaración sin inventar condiciones.',input_schema:{type:'object',properties:{categoria:{type:'string'},codigo:{type:'string'},cantidad:{type:'integer'},pregunta:{type:'string'}},additionalProperties:false}}],tool_choice:{type:'tool',name:'proponer_regla'}} : {tools:[{type:'web_search_20250305',name:'web_search'}]})
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
        apiRes.on('data', c => data += c);
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
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
            res.writeHead(500); res.end(JSON.stringify({ error: true, mensaje: 'Error parseando respuesta' }));
          }
        });
      });

      apiReq.on('error', e => { res.writeHead(502); res.end(JSON.stringify({ error: true, mensaje: e.message })); });
      apiReq.write(payload);
      apiReq.end();

    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: true, mensaje: e.message }));
    }
  });
});

server.listen(parseInt(process.env.PORT) || 8080, () => console.log('Asistente listo en puerto ' + (process.env.PORT || 8080)));