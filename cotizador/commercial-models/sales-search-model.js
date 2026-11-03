(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVSalesSearchModel=api;})(typeof window==='object'?window:null,function(){'use strict';
function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/ +/g,' ');}
const encode=s=>Array.from(s,c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
function terms(row){const set=new Set();for(const field of [row?.number,row?.client,row?.notes]){const text=normalize(field).slice(0,2000);for(let i=0;i+3<=text.length;i++)set.add(encode(text.slice(i,i+3)));}return Array.from(set);}
function query(value){const text=normalize(value);if(!text)return{text:'',term:''};if(text.length<3)throw Error('Escribí al menos 3 caracteres para buscar en todo el historial.');if(text.length>160)throw Error('La búsqueda es demasiado larga.');const word=text.split(' ').sort((a,b)=>b.length-a.length)[0];return{text,term:encode((word.length>=3?word:text).slice(0,3))};}
function matches(row,value){const text=normalize(value);return [row?.number,row?.client,row?.notes].some(v=>normalize(v).includes(text));}
return{normalize,terms,query,matches};});
