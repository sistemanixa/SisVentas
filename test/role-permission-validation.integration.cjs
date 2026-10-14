'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const host=process.env.SV_ROLES_EMULATOR_URL||'http://127.0.0.1:9015';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(host))throw Error('Solo emulador local');
const namespace='demo-role-permission-validation';
const candidate=JSON.parse(fs.readFileSync('security/database.domain-write.candidate.json'));
async function put(path,data,uid){
 const query=new URLSearchParams({ns:namespace});if(uid!==undefined)query.set('auth_variable_override',JSON.stringify(uid===null?null:{uid}));
 return fetch(host+'/'+path+'.json?'+query,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(data)});
}
before(async()=>{
 assert.equal((await put('.settings/rules',{rules:{sv_permisos:candidate.rules.sv_permisos}})).status,200);
 assert.equal((await put('',{sv_chat_roles:{admin:{rol:'admin',activo:true},inactive:{rol:'admin',activo:false},...Object.fromEntries(['administrativo','vendedor','tecnico_vendedor','tecnico','distribuidora'].map(rol=>[rol,{rol,activo:true}]))}})).status,200);
});
test('admin guarda vendedor con módulos bloqueados y permiso de corregir pagos',async()=>{
 const data={_version:7,vendedor:{bloqueados:['configuracion','usuarios'],acciones:{gastos:{corregirPagos:true}}}};
 assert.equal((await put('sv_permisos',data,'admin')).status,200);
 const r=await fetch(host+'/sv_permisos.json?ns='+namespace,{headers:{Authorization:'Bearer owner'}});
 assert.deepEqual(await r.json(),data);
});
test('admin guarda los 64 índices permitidos',async()=>assert.equal((await put('sv_permisos',{vendedor:{bloqueados:Array(64).fill('gastos')}},'admin')).status,200));
for(const index of ['64','100','-1','01','x'])test('rechaza índice fuera del contrato '+index,async()=>assert.equal((await put('sv_permisos',{vendedor:{bloqueados:{[index]:'gastos'}}},'admin')).status,401));
test('rechaza módulos con valor no textual',async()=>assert.equal((await put('sv_permisos',{vendedor:{bloqueados:[true]}},'admin')).status,401));
for(const uid of ['administrativo','vendedor','tecnico_vendedor','tecnico','distribuidora','inactive','unknown',null])test('no permite guardar a '+uid,async()=>assert.equal((await put('sv_permisos',{vendedor:{bloqueados:['gastos']}},uid)).status,401));
