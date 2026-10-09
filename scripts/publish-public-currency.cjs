const fs=require('fs'),{execFileSync}=require('child_process'),{isDeepStrictEqual}=require('util');
(async()=>{
const token=execFileSync('powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
const base='https://nixa-sisventas-default-rtdb.firebaseio.com',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function rules(){const r=await fetch(base+'/.settings/rules.json',{headers});if(!r.ok)throw Error('Read rules '+r.status);return r.json();}
const before=await rules(),next=structuredClone(before);require('./public-currency-rules.cjs').publicCurrencyRules(next.rules);
fs.writeFileSync('tmp/rules-before-public-currency.json',JSON.stringify(before));
if(!isDeepStrictEqual(await rules(),before))throw Error('Concurrent change');
const r=await fetch(base+'/.settings/rules.json',{method:'PUT',headers,body:JSON.stringify(next)});if(!r.ok)throw Error('Rules update '+r.status);
if(!isDeepStrictEqual(await rules(),next))throw Error('Verification failed');
for(const f of require('./public-currency-rules.cjs').fields){const res=await fetch(base+'/sisventas/config/tipoCambio/'+f+'.json');if(!res.ok)throw Error('Public rate inaccessible');}
const denied=await fetch(base+'/sisventas/config.json');if(denied.ok)throw Error('Config should be private');console.log('Cotizaciones públicas accesibles; resto de configuración privado.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
