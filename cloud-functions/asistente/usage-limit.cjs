'use strict';
function setting(env,key,fallback){const n=Number(env[key]);return Number.isInteger(n)&&n>0?n:fallback;}
function fail(status,message,retry){const e=new Error(message);e.statusCode=status;if(retry)e.retryAfter=retry;return e;}
async function reserve({admin,uid,now=Date.now(),env=process.env}){
 if(!uid)throw fail(401,'Sesión requerida');
 const windowMs=600000,bucket=Math.floor(now/windowMs),day=Math.floor(now/86400000);
 const limits={userWindow:setting(env,'AI_USER_WINDOW_LIMIT',60),userDay:setting(env,'AI_USER_DAY_LIMIT',500),globalWindow:setting(env,'AI_GLOBAL_WINDOW_LIMIT',300),globalDay:setting(env,'AI_GLOBAL_DAY_LIMIT',3000)};
 const ref=admin.database().ref('sv_server_ai_usage');
 let denied=false;
 const result=await ref.transaction(current=>{
  denied=false;const c=current||{};
  if(c.day!==day){c.day=day;c.dayCount=0;c.users={};}
  if(c.bucket!==bucket){c.bucket=bucket;c.windowCount=0;}
  const u=(c.users||{})[uid]||{dayCount:0};if(u.bucket!==bucket){u.bucket=bucket;u.windowCount=0;}
  if((u.windowCount||0)>=limits.userWindow||(u.dayCount||0)>=limits.userDay||(c.windowCount||0)>=limits.globalWindow||(c.dayCount||0)>=limits.globalDay){denied=true;return;}
  u.windowCount=(u.windowCount||0)+1;u.dayCount=(u.dayCount||0)+1;c.windowCount=(c.windowCount||0)+1;c.dayCount=(c.dayCount||0)+1;c.users=c.users||{};c.users[uid]=u;return c;
 });
 if(!result.committed){if(denied)throw fail(429,'Se alcanzó el límite de consultas de IA. Intentá más tarde.',Math.ceil((windowMs-now%windowMs)/1000));throw fail(503,'No se pudo reservar la consulta. Reintentá.');}
}
module.exports={reserve};
