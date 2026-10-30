(function(root,factory){
 'use strict';const create=factory();
 if(typeof module==='object'&&module.exports)module.exports={create};
 else root.SVChatReadModel=create(root);
})(typeof window==='object'?window:null,function(){
 'use strict';
 const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,240}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
 return function create(root){
  function paths(channel,key){if(!valid(channel)||key!==undefined&&!valid(key))throw Error('Conversación inválida');return {body:'sv_chat/'+channel+(key?'/'+key:''),header:'sv_chat_headers/'+channel+(key?'/'+key:'')};}
  function session(){const user=root.fbAuth?.currentUser,uid=root.currentUserUid;return function(){if(!user||user!==root.fbAuth?.currentUser||uid!==root.currentUserUid||uid!==user.uid||root._impersonacionOriginal)throw Error('La sesión cambió. Volvé a abrir el chat.');};}
  async function send(channel,message){
   const check=session();check();const p=paths(channel),reference=root.fbPush(root.fbRef(root.fbDB,p.body));
   const row={...message,autorUid:root.currentUserUid};const target=paths(channel,reference.key),patch={};
   patch[target.body]=row;patch[target.header]=root.SVChatHeaderModel.chat(row);check();
   await root.fbUpdate(root.fbRef(root.fbDB),patch);check();return reference;
  }
  async function markRead(channel,keys){
   const check=session();check();const uid=root.currentUserUid,patch={};
   for(const key of [...new Set(keys)]){const p=paths(channel,key),nonce=root.crypto.randomUUID();patch[p.body+'/leido/'+uid]=true;patch[p.header+'/leido/'+uid]=true;patch[p.body+'/leidoNonce']=nonce;patch[p.header+'/leidoNonce']=nonce;}
   if(!Object.keys(patch).length)return;check();await root.fbUpdate(root.fbRef(root.fbDB),patch);check();
  }
  async function clear(channel){const check=session();check();const p=paths(channel),patch={[p.body]:null,[p.header]:null};await root.fbUpdate(root.fbRef(root.fbDB),patch);check();}
  function listenHeaders(channel,next,error){const check=session();check();const p=paths(channel);return root.fbOnValue(root.fbRef(root.fbDB,p.header),snap=>{try{check();next(snap);}catch(e){error?.(e);}},error);}
  return Object.freeze({send,markRead,clear,listenHeaders,paths});
 };
});
