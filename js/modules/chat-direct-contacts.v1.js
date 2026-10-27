(function(root,factory){'use strict';const create=factory();if(typeof module==='object'&&module.exports)module.exports={create};if(root)root.SVChatContacts=create(root);})(typeof window==='object'?window:null,function(){
 'use strict';
 return function create(root){let owner='',choosing=false,query='';
  function peers(){const uid=root.currentUserUid;return Object.entries(root._chatDirectorio||{}).filter(([id,p])=>id!==uid&&p&&p.activo!==false&&String(p.nombre||'').trim()).map(([uid,p])=>({uid,name:String(p.nombre)})).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  }
  function open(uid){
   const user=root.fbAuth?.currentUser,p=(root._chatDirectorio||{})[uid];
   if(root._impersonacionOriginal||!root.currentUserUid||user?.uid!==root.currentUserUid||uid===root.currentUserUid||!p||p.activo===false){root.notify?.('Este contacto no está disponible.');return false;}
   const channel=root.chatDirectoId(uid);if(!root.chatPuedeAccederCanal(channel)){root.notify?.('No tenés acceso a esta conversación.');return false;}
   choosing=false;query='';root._chatCanal=channel;root.chatGuardarCanal(channel);root.chatMarcarCanalActivo(channel);const input=root.document.getElementById('chat-input');if(input)input.placeholder='Mensaje a '+p.nombre+'…';root.chatCargarCanal(channel);updateHeader(channel);return true;
  }
  function element(tag,text,className){const el=root.document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;}
  function button(text,fn){const b=element('button',text,'btn btn-sm');b.type='button';b.addEventListener('click',fn);return b;}
  function row(person,online){const b=button('',()=>open(person.uid));b.style.cssText='display:flex;align-items:center;gap:10px;width:100%;padding:12px 8px;text-align:left;white-space:normal;min-height:48px';const dot=element('span',online?'●':'○');dot.style.color=online?'var(--green)':'var(--text3)';dot.setAttribute('aria-hidden','true');const name=element('span',person.name);name.style.cssText='flex:1;overflow-wrap:anywhere';b.append(dot,name);b.setAttribute('aria-label','Escribir a '+person.name);return b;}
  function updateHeader(channel){
   channel=channel||root._chatCanal;const title=root.document.getElementById('chat-title'),back=root.document.getElementById('chat-direct-back'),label=root.document.getElementById('chat-online-label'),status=root.SVChatPresence?.status?.();
   const direct=String(channel||'').startsWith('directo_'),peer=direct?Object.entries(root._chatDirectorio||{}).find(([uid])=>uid!==root.currentUserUid&&root.chatDirectoId(uid)===channel):null;
   if(title){title.textContent=direct?(peer?.[1]?.nombre||'Mensaje directo'):(channel==='directos'?'Mensajes directos':'Mensajes internos');title.title=title.textContent;}
   if(back)back.hidden=!direct;
   if(label&&direct){const online=peer&&(root.usuariosPresentesUnicos?.(false)||[]).some(p=>p.uid===peer[0]);label.textContent=status&&!status.ready?'Conexión del chat sin confirmar':online?'En línea':'Mensaje directo';}
   else if(label&&status&&!status.ready)label.textContent='Conexión del chat sin confirmar';
  }
  function decorate(host,conversations){
   if(!host||root._chatCanal!=='directos')return;updateHeader('directos');if(owner!==root.currentUserUid){owner=root.currentUserUid;choosing=false;query='';}
   const selected=new Set((root.usuariosPresentesUnicos?.(false)||[]).map(p=>String(p.uid||''))),people=peers(),online=people.filter(p=>selected.has(p.uid)),status=root.SVChatPresence?.status?.();
   const header=element('div');header.style.cssText='display:flex;justify-content:flex-end;gap:8px;margin:0 0 12px';header.append(button(choosing?'Volver a conversaciones':'Nuevo mensaje',()=>{choosing=!choosing;query='';root.chatAbrirDirectos(true);}));host.prepend(header);
   if(choosing){
    // A picker is not a conversation: opening it never creates or sends a message.
    for(const child of Array.from(host.children))if(child!==header)child.remove();
    const title=element('h3','¿A quién querés escribir?');title.style.cssText='font-size:14px;margin:8px 0';host.append(title);
    const search=element('input');search.type='search';search.placeholder='Buscar persona…';search.setAttribute('aria-label','Buscar persona para mensaje');search.value=query;search.style.cssText='width:100%;min-height:42px;margin:4px 0 12px';const list=element('div');list.style.cssText='display:grid;gap:4px';host.append(search,list);
    function paint(){list.replaceChildren();const term=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');const visible=people.filter(p=>p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').includes(term));visible.forEach(p=>list.append(row(p,selected.has(p.uid))));if(!visible.length)list.append(element('p',root._chatDirectorioListo===false?'Cargando personas…':'No hay personas que coincidan.'));}
    search.addEventListener('input',()=>{query=search.value;paint();});paint();return;
   }
   const existing=Array.from(host.querySelectorAll('[onclick^="chatAbrirDirecto("]'));
   existing.forEach((el,index)=>{const c=conversations?.[index];if(c?.otroUid){el.removeAttribute('onclick');el.addEventListener('click',()=>open(c.otroUid));}});
   const section=element('section');section.style.cssText='border-top:1px solid var(--border);margin-top:16px;padding-top:12px;display:grid;gap:4px';const title=element('h3','Personas conectadas'+(online.length?' · '+online.length:''));title.style.cssText='font-size:12px;color:var(--text3);margin:0 0 6px';section.append(title);online.forEach(p=>section.append(row(p,true)));
   if(!online.length){const text=status&&!status.ready?'Conexión del chat sin confirmar.':'No hay otras personas conectadas ahora.';const hint=element('p',text);hint.style.cssText='font-size:12px;color:var(--text3);margin:4px 0';section.append(hint);}host.append(section);
  }
  root.document?.addEventListener?.('sisventas:session-ended',()=>{owner='';choosing=false;query='';});
  root.document?.addEventListener?.('sisventas:chat-directory-ready',()=>{updateHeader(root._chatCanal);if(root._chatCanal==='directos'&&root.document.getElementById('chat-modal')?.classList.contains('open'))root.chatAbrirDirectos(true);});
  return {peers,open,decorate,updateHeader};
 };
});
