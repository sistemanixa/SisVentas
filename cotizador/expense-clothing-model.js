(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./office-stock-money.js'));else root.SVExpenseClothingModel=factory(root.SVCommercialMoney);})(typeof window==='object'?window:globalThis,function(Money){
 'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v)),norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const fail=message=>{throw Object.assign(Error(message),{statusCode:400,code:'SV_EXPENSE_CLOTHING_INVALID'});};
 function text(v,label,max,optional=false){if(typeof v!=='string'||v.length>max||!optional&&!v.trim())fail('Revisá '+label+'.');return v.trim();}
 function normalize(value){
  if(!value||Array.isArray(value)||Object.keys(value).some(k=>!['schema','items'].includes(k))||value.schema!==1||!Array.isArray(value.items)||!value.items.length||value.items.length>50)fail('Agregá las prendas de esta compra.');
  const items=value.items.map(row=>{if(!row||Array.isArray(row)||Object.keys(row).some(k=>!['name','size','color','quantity'].includes(k)))fail('Revisá los datos de la prenda.');if(!Number.isSafeInteger(row.quantity)||row.quantity<1)fail('La cantidad debe ser un entero mayor a cero.');return {name:text(row.name,'la prenda',160),size:text(row.size,'el talle',40),color:text(row.color??'','el color',60,true),quantity:row.quantity};});
  const seen=new Set();for(const row of items){const key=[norm(row.name),norm(row.size),norm(row.color)].join('|');if(seen.has(key))fail('Hay una prenda, talle y color repetidos. Sumá sus cantidades en una sola fila.');seen.add(key);}return {schema:1,items};
 }
 function category(value,state){if(norm(value)==='indumentaria')return true;return Object.values(state?.entries||{}).some(e=>{const names=[e.name,...(e.aliases||[])].map(norm);return names.includes('indumentaria')&&names.includes(norm(value));});}
 function plan(state,expense,{key,operationId,actorId,at}){
  const data=normalize(expense.indumentaria);if(!state||state.schema!==1||(!Number.isSafeInteger(state.revision)||state.revision<0||state.revision===Number.MAX_SAFE_INTEGER)||!state.garments||!Array.isArray(state.events)||!state.operations)fail('El registro de indumentaria requiere revisión.');
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(key)||!/^[A-Za-z0-9_-]{8,100}$/.test(operationId)||['constructor','prototype','__proto__'].includes(key)||!actorId||!Number.isFinite(Date.parse(at)))fail('La referencia de ingreso no es válida.');
  if(!Money.isAmount(expense.monto)||Money.amount(expense.monto)<=0)fail('Revisá el importe de la compra.');
  if(state.expenseReceipts?.[key]||state.events.some(e=>e.gastoRef===key))fail('Este gasto ya tiene prendas ingresadas. No se volvió a sumar stock.');
  if(state.operations[operationId])fail('La operación ya está registrada.');
  const next=copy(state),received=[];
  for(const [i,row]of data.items.entries()){
   const matches=Object.values(next.garments).filter(g=>norm(g.name)===norm(row.name));if(matches.length>1)fail('Hay prendas con el mismo nombre que requieren revisión.');
   let garment=matches[0];if(!garment){const id='garment-'+operationId+'-'+i;garment={id,name:row.name,photoUrl:'',variants:[],createdBy:actorId,createdAt:at};if(next.garments[id])fail('La referencia de prenda ya está ocupada.');next.garments[id]=garment;}
   const variants=garment.variants.filter(v=>norm(v.size)===norm(row.size)&&norm(v.color)===norm(row.color));if(variants.length>1)fail('Hay talles duplicados que requieren revisión.');
   let variant=variants[0];if(!variant){variant={id:'variant-'+operationId+'-'+i,size:row.size,color:row.color};garment.variants.push(variant);}
   const event={type:'stock.receive',operationId:'receipt-'+operationId+'-'+i,actorId,at,garmentId:garment.id,variantId:variant.id,quantity:row.quantity,gastoRef:key,costSource:'expense'};next.events.push(event);received.push({garmentId:garment.id,variantId:variant.id,quantity:row.quantity});
  }
  next.expenseReceipts??={};next.expenseReceipts[key]={operationId,items:data.items,received,amount:Money.amount(expense.monto),currency:'ARS',actorId,at};
  next.operations[operationId]={type:'expense.receive',operationId,actorId,at,gastoRef:key};next.audit={...(state.audit||{}),[operationId]:{actorUid:actorId,at,type:'expense.receive'}};next.revision++;return next;
 }
 return Object.freeze({normalize,category,plan});
});
