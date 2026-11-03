(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVCollectionSearchModel=api;})(typeof window==='object'?window:null,function(){'use strict';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/ +/g,' ');
const encode=value=>Array.from(value,c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
const fields=(row,kind)=>kind==='payments'?[row.saleNumber,row.client,row.medium]:[row.number,row.client];
function terms(row,kind){const out=new Set();for(const field of fields(row,kind)){const text=normalize(field).slice(0,2000);for(const size of [2,3])for(let i=0;i+size<=text.length;i++)out.add(encode(text.slice(i,i+size)));}return [...out];}
function query(value){const text=normalize(value);if(!text)return{text:'',term:''};if(text.length<2)throw Error('Escribí al menos 2 caracteres.');if(text.length>160)throw Error('La búsqueda es demasiado larga.');const word=text.split(' ').sort((a,b)=>b.length-a.length)[0],selected=word.length>=2?word:text;return{text,term:encode(selected.slice(0,3))};}
const matches=(row,value,kind)=>fields(row,kind).some(field=>normalize(field).includes(normalize(value)));
const collection=row=>Object.fromEntries(['key','number','client','clientKey','clientRecordKey','date','sort','totalCents','paidCents','balanceCents','cancelled'].map(field=>[field,row[field]]));
return Object.freeze({normalize,terms,query,matches,collection});});
