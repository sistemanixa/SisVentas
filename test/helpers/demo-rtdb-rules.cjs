'use strict';
const assert=require('node:assert/strict');
const base='http://127.0.0.1:9046',ns='demo-expense-audit3186';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function restrictedFetch(url,init){
 const target=new URL(url);assert.equal(target.origin,base);assert.equal(target.searchParams.get('ns'),ns);
 const override=target.searchParams.get('auth_variable_override');
 if(!override)return fetch(target,init);
 const actor=JSON.parse(override),now=Math.floor(Date.now()/1000),headers={...init.headers};delete headers.Authorization;
 target.searchParams.delete('auth_variable_override');
 target.searchParams.set('auth',encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://securetoken.google.com/'+ns,aud:ns,sub:actor.uid,user_id:actor.uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom'},...actor.token})+'.');
 return fetch(target,{...init,headers});
}
async function rest(method,path,value){
 const response=await fetch(base+'/'+path+'.json?ns='+ns,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});
 if(!response.ok)throw Error(method+' '+path+' HTTP '+response.status);return response.json();
}
function apply(state,patch){for(const [path,value]of Object.entries(patch)){const keys=path.split('/');let node=state;for(const key of keys.slice(0,-1))node=node[key]||(node[key]={});node[keys.at(-1)]=value;}}
module.exports={base,ns,restrictedFetch,rest,apply};
