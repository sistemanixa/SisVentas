const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({databaseURL:'https://nixa-sisventas-default-rtdb.firebaseio.com'});
async function transcribe(req, body) {
  const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!token) throw Error('Iniciá sesión nuevamente.');
  const user=await admin.auth().verifyIdToken(token,true);
  const role=(await admin.database().ref('sv_chat_roles/'+user.uid).get()).val();
  if(!role||!role.activo||!['admin','administrativo'].includes(role.rol))throw Error('Sin permiso para dictar presupuestos.');
  if(typeof body.audio!=='string'||body.audio.length>4500000||!/^UklGR/.test(body.audio))throw Error('Audio inválido o demasiado largo.');
  const auth=await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'}});
  if(!auth.ok)throw Error('No se pudo autorizar la transcripción.');
  const access=await auth.json();
  const response=await fetch('https://speech.googleapis.com/v1/speech:recognize',{method:'POST',headers:{Authorization:'Bearer '+access.access_token,'Content-Type':'application/json'},body:JSON.stringify({config:{languageCode:'es-AR',enableAutomaticPunctuation:true},audio:{content:body.audio}}),signal:AbortSignal.timeout(60000)});
  const data=await response.json();if(!response.ok)throw Error('El servicio de transcripción no pudo procesar el audio.');
  return {text:(data.results||[]).map(r=>r.alternatives?.[0]?.transcript||'').join(' ')};
}
module.exports={transcribe};
