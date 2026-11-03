(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVChatText=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function format(value){
  const text=String(value??''),pattern=/(^|[\s(\[{])((?:https?:\/\/|www\.)[^\s<>"']+)/gi;let output='',last=0,match;
  while((match=pattern.exec(text))){const prefix=match[1],raw=match[2];let label=raw.replace(/[.,;:!]+$/,'');
   for(const [open,close]of [['(',')'],['[',']'],['{','}']])while(label.endsWith(close)&&label.split(close).length>label.split(open).length)label=label.slice(0,-1);
   const href=/^www\./i.test(label)?'https://'+label:label;let safe=false;
   try{const url=new URL(href);safe=['http:','https:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password&&!/[\\\u0000-\u001f\u007f]/.test(href);}catch(_){/* Texto no reconocido como URL. */}
   output+=escape(text.slice(last,match.index))+escape(prefix);
   output+=safe?'<a class="chat-text-link" href="'+escape(href)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+'</a>'+escape(raw.slice(label.length)):escape(raw);
   last=pattern.lastIndex;
  }
  return output+escape(text.slice(last));
 }
 return Object.freeze({format});
});
