'use strict';
const P=require('./client-account-projection'),M=require('./commercial-pages-model'),Own=require('./commercial-ownership'),{digest}=require('./labor-guard'),{assertAccessReady}=require('./user-access');
const Plans=require('./client-account-scope-plan');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode}),incomplete=()=>Object.assign(fail(409,'No se pudo verificar esta cuenta. Un administrador debe revisar su habilitación.'),{code:'SV_CLIENT_ACCOUNTS_INCOMPLETE'});
function create({auth,db,guard,queryReader,enabled=false}){
 const read=async path=>(await db.ref(path).get()).val();
 async function snapshot(req,generation,io){
  const readNow=io?.read||read,queryNow=io?.queryReader||queryReader,accessDb={ref:path=>({get:async()=>{const value=await readNow(path);return{val:()=>value};}})};
  if(!enabled||guard?.clientAccounts!==true)throw fail(503,'La preparación de cuentas todavía no está habilitada.');
  if(req.method!=='POST'||new URL(req.url,'http://localhost').search)throw fail(403,'Volvé a tu cuenta para consultar.');
  const match=String(req.headers?.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!match)throw fail(401,'Sesión requerida.');let token;try{token=await auth.verifyIdToken(match[1],true);}catch(_){throw fail(401,'La sesión venció.');}
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(token?.uid||''))throw fail(403,'Identidad inválida.');await assertAccessReady(accessDb,token);
  const profile=await readNow('sv_chat_roles/'+token.uid),permissions=profile?.rol?await readNow('sv_permisos/'+profile.rol):null;
  if(profile?.activo!==true||profile.rol==='admin'||!Own.moduleAllowed(profile.rol,'cuentacorriente',permissions?{[profile.rol]:permissions}:{}))throw fail(403,'No tenés acceso a esta preparación.');
  const cfg=await readNow('sv_client_accounts_config');if(cfg?.schema!==1||cfg.ready!==true||cfg.scopeBootstrapVersion!==1||cfg.generation!==generation)throw incomplete();
  const users=await queryNow('sv_usuarios','uid',token.uid);
  const freshProfile=await readNow('sv_chat_roles/'+token.uid),freshPermissions=await readNow('sv_permisos/'+profile.rol),freshUsers=await queryNow('sv_usuarios','uid',token.uid);await assertAccessReady(accessDb,token);
  if(digest({profile,permissions,users})!==digest({profile:freshProfile,permissions:freshPermissions,users:freshUsers}))throw fail(409,'La identidad o los permisos cambiaron. Volvé a ingresar.');
  const freshConfig=await readNow('sv_client_accounts_config');if(digest(freshConfig)!==digest(cfg))throw incomplete();
  const people=Own.profiles(users,{[token.uid]:profile});if(people.length!==1||people[0].uid!==token.uid||!people[0].aliases.length)throw incomplete();
  const aliases=[...new Set(people[0].aliases)].sort();return{uid:token.uid,claims:token,role:profile.rol,permissions,permissionDigest:digest(permissions||{}),permissionRevision:permissions?.indiceRevision??null,aliases,generation,fingerprint:digest({uid:token.uid,profile,permissions,aliases,generation})};
 }
 async function execute(req,body){
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>k!=='generation')||typeof body.generation!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(body.generation))throw fail(400,'Preparación inválida.');
  const before=await snapshot(req,body.generation),actor={mode:'command',uid:before.uid,claims:before.claims,role:before.role,permissionDigest:before.permissionDigest,permissionRevision:before.permissionRevision,operation:'client-account-scope',input:{generation:before.generation}};
  if(guard.current())throw fail(409,'Terminá la operación actual antes de preparar la cuenta.');
  Plans.register(actor,{generation:before.generation,aliases:before.aliases});
  try{await guard.run(actor,async scope=>{scope.beforeCommit(async checks=>{const after=await snapshot(req,body.generation,{read:checks.readFresh,queryReader:checks.queryFresh});if(after.fingerprint!==before.fingerprint)throw fail(409,'La sesión o los permisos cambiaron. Volvé a ingresar.');});return{ok:true};});return{ok:true,generation:before.generation};}catch(error){if(error.code==='SV_CLIENT_ACCOUNTS_INCOMPLETE')throw incomplete();throw error;}finally{Plans.release(actor);}
 }
 return{execute};
}
module.exports={create};
