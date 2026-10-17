'use strict';
// Operación explícita de prueba con el PDF indicado. Resultado privado en tmp/;
// jamás imprime archivo, cuerpo, nombre del titular ni secreto del proveedor.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),{execFileSync}=require('node:child_process');
const {payload,normalize}=require('../cloud-functions/asistente/statement-import.cjs');
async function main(){
 const file=process.argv[2],out=path.resolve(process.argv[3]||'tmp/statement-ai-private');
 if(!file)throw Error('Indicá un PDF privado para la prueba');
 const bytes=fs.readFileSync(file),request=payload({data:bytes.toString('base64')});
 const gcloud=path.join(process.env.LOCALAPPDATA,'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1');
 const key=execFileSync('powershell.exe',['-NoProfile','-Command',`& '${gcloud.replaceAll("'","''")}' secrets versions access latest --secret=ANTHROPIC_KEY --project=nixa-sisventas`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim();
 if(!key)throw Error('No se pudo usar la configuración existente de IA');
 const body=JSON.stringify(request),response=await new Promise((resolve,reject)=>{
  const req=https.request({hostname:'api.anthropic.com',path:'/v1/messages',method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','Content-Length':Buffer.byteLength(body)}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>{if(res.statusCode!==200)return reject(Error('El proveedor rechazó la lectura: HTTP '+res.statusCode));try{resolve(JSON.parse(data));}catch(_){reject(Error('Respuesta inválida'));}});});
  req.setTimeout(180000,()=>req.destroy(Error('Tiempo de lectura agotado')));req.on('error',reject);req.end(body);
 });
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'response-private.json'),JSON.stringify(response,null,2));
 const result=normalize(response);fs.writeFileSync(path.join(out,'reading-private.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({pages:result.pages,fields:Object.keys(result.fields),movements:result.movements.length,warnings:result.warnings.length,stopReason:response.stop_reason}));
}
main().catch(()=>{console.error('No se completó la lectura privada. No se guardaron datos en SisVentas.');process.exitCode=1;});
