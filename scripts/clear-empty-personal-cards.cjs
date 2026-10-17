'use strict';
// Mantenimiento explícito del titular: se niega a modificar un espacio que
// tenga resúmenes, pagos, documentos o cualquier otro registro financiero.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https'),{execFileSync}=require('node:child_process');
function gcloud(args){const script=path.join(process.env.LOCALAPPDATA,'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1');return execFileSync('powershell.exe',['-NoProfile','-Command',`& '${script.replaceAll("'","''")}' ${args}`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();}
function request(url,token,method='GET',body,etag){return new Promise((resolve,reject)=>{const data=body===undefined?null:JSON.stringify(body),req=https.request(url,{method,headers:{Authorization:'Bearer '+token,'X-Firebase-ETag':'true',...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{}),...(etag?{'if-match':etag}:{})}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>{if(res.statusCode!==200)return reject(Error('No se confirmó la consulta o el cambio: HTTP '+res.statusCode));try{resolve({data:JSON.parse(text),etag:res.headers.etag});}catch(_){reject(Error('Respuesta no válida'));}});});req.on('error',reject);req.setTimeout(30000,()=>req.destroy(Error('Tiempo agotado')));req.end(data);});}
async function main(){
 const config=JSON.parse(gcloud('run services describe cotizador --region=southamerica-east1 --project=nixa-sisventas --format=json'));
 const env=Object.fromEntries(config.spec.template.spec.containers[0].env.map(e=>[e.name,e.value]));
 const uid=env.PERSONAL_FINANCE_OWNER_UID;if(env.PERSONAL_FINANCE_ENABLED!=='true'||!uid||! /^[\w-]+$/.test(uid))throw Error('No se pudo confirmar el titular habilitado');
 const token=gcloud('auth print-access-token'),url='https://nixa-sisventas-default-rtdb.firebaseio.com/sv_personal_finance/'+uid+'.json';
 const initial=await request(url,token),raw=initial.data;if(!raw||raw.ownerUid!==uid||!initial.etag)throw Error('No se pudo verificar el espacio privado');
 const values=g=>Object.values(raw[g]||{}),financial=['statements','movements','payments','insurances','installments','expenses','strategies','documents'];
 const counts=Object.fromEntries(['cards',...financial,'history'].map(g=>[g,values(g).length]));
 const plan={counts,canClear:financial.every(g=>!values(g).length)&&values('history').every(h=>h.action==='card-save')};
 console.log(JSON.stringify(plan));
 if(!process.argv.includes('--apply'))return;
 if(!plan.canClear)throw Error('Hay registros financieros o historial asociado: no se modificó nada');
 if(!counts.cards){console.log('El espacio ya está sin tarjetas');return;}
 const out='C:/SisVentas/tmp/pdf-ai/private-before-clear';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'state-private.json'),JSON.stringify(raw));
 const id=crypto.randomUUID(),now=Date.now(),next=structuredClone(raw);next.cards=[];next.revision=(raw.revision||0)+1;next.updatedAt=now;
 next.history=[{id,ownerUid:uid,actorUid:uid,at:now,action:'empty-cards-cleared',entity:'cards',origin:'Manual autorizado por titular',changes:[{group:'cards',before:values('cards'),after:[]}]},...values('history')];
 next.operations={...(raw.operations||{}),[id]:{digest:crypto.createHash('sha256').update(JSON.stringify({type:'empty-cards-cleared',revision:raw.revision})).digest('hex'),revision:next.revision}};
 await request(url,token,'PUT',next,initial.etag);
 const verified=(await request(url,token)).data;if(Object.values(verified.cards||{}).length||verified.revision!==next.revision||financial.some(g=>Object.values(verified[g]||{}).length))throw Error('Revisar estado: la comprobación final no coincidió');
 console.log('Tarjetas vacías retiradas del espacio privado; respaldo local y auditoría conservados. Sin cambios empresariales.');
}
main().catch(()=>{console.error('No se pudo completar el mantenimiento privado; revisar el plan y la conexión sin repetir escrituras a ciegas.');process.exitCode=1;});
