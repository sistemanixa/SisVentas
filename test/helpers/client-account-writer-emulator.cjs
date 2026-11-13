'use strict';
// Real wrapper + real Host + real loopback rules; no financial endpoint.
const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const source=require('node:path').resolve(__dirname,'../..').replaceAll('\\','/')+'/';
const {restrictedFetch,base,ns}=require(source+'test/helpers/demo-rtdb-rules.cjs');
const Host=require(source+'js/modules/client-account-host.v1.js');
function writer({beforeMetadataReturn,beforeSDKWrite}={}){
 const filename=source+'test/labor-writes.test.cjs',text=fs.readFileSync(filename,'utf8'),context={require:createRequire(filename),module:{exports:{}},structuredClone,URL,TextEncoder,Uint8Array,AbortSignal};
 vm.runInNewContext(text.slice(0,text.indexOf("\ntest('"))+'\nmodule.exports=fixture;',context);
 const f=context.module.exports(),stats={reads:[],direct:0,commands:f.commands,draft:'Título ficticio conservado'};
 const pathOf=ref=>new URL(ref.toString()).pathname.replace(/^\//,'');
 async function request(method,path,value){const u=new URL(base+'/'+path+'.json?ns='+ns);u.searchParams.set('auth_variable_override',JSON.stringify({uid:'u',token:{uid:'u'}}));const r=await restrictedFetch(u,{method,headers:{'Content-Type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})});const body=await r.json();if(!r.ok)throw Object.assign(Error('Permission denied by exact emulator rules'),{code:'PERMISSION_DENIED'});return body;}
 f.sdk.get=async ref=>{const p=pathOf(ref);stats.reads.push(p);const value=await request('GET',p);if(p==='sv_commercial_pages_config')await beforeMetadataReturn?.(f);return{key:ref.key,ref,val:()=>structuredClone(value),exists:()=>value!==null};};
 f.sdk.update=async(ref,value)=>{stats.direct++;await beforeSDKWrite?.(f);return request('PATCH',pathOf(ref),value);};
 Object.assign(f.root,{SV_CLIENT_ACCOUNTS_ROLLOUT:{schema:1,enabled:false},document:{hidden:false,getElementById:()=>null,addEventListener(){}},navigator:{onLine:true},_svPaginaDesdeRuta:()=> 'presupuesto',permisoModulo:()=>true,fbGet:f.sdk.get,fbRef:f.sdk.ref});
 f.root.SVClientAccountHost=Host.install(f.root);
 return{...f,stats,saveTitle:value=>f.root.fbUpdate(f.ref('sisventas/presupuestos/b'),{tituloSolucion:value})};
}
module.exports={writer};
