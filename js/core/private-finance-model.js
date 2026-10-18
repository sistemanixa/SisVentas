(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVPrivateFinanceModel=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const groups=['cards','statements','movements','payments','insurances','installments','expenses','strategies','documents','history'];
 const fail=(statusCode,message)=>{throw Object.assign(Error(message),{statusCode});};
 const copy=v=>JSON.parse(JSON.stringify(v));
 const key=v=>{if(typeof v!=='string'||!v||v.length>128||!/^[a-zA-Z0-9_-]+$/.test(v)||['__proto__','constructor','prototype'].includes(v))fail(400,'Identificador inválido');return v;};
 const text=(v,max=500,required=false)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())fail(400,'Revisá los textos requeridos y su longitud');return v.trim();};
 const one=(v,list)=>{if(!list.includes(v))fail(400,'Opción inválida');return v;};
 const money=(v,nullable=false,signed=false)=>{if(v==null&&nullable)return null;if(!Number.isSafeInteger(v)||Math.abs(v)>1e13||!signed&&v<0)fail(400,'Importe inválido: debe conservar centavos');return v;};
 const currency=v=>one(v,['ARS','USD']);
 function extracted(input){if(input==null)return {};const out={};for(const name of ['bank','brand','previousUSD','temUSD','tnaUSD','previous','total','usd','minimum','minimumCurrency','close','due','period','tem','tna','cft']){const f=input[name];if(f==null)continue;if(!f||typeof f!=='object'||Array.isArray(f))fail(400,'Procedencia inválida');if(!['string','number'].includes(typeof f.value)||typeof f.value==='number'&&!Number.isFinite(f.value))fail(400,'Valor extraído inválido');out[name]={value:typeof f.value==='string'?text(f.value,80):f.value,original:text(f.original||'',500),page:money(f.page),origin:f.origin==='PDF · IA'?'PDF · IA':'PDF',unit:text(f.unit||'',120)};}return out;}
 const date=(v,optional=false)=>{if(optional&&(v==null||v===''))return null;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)fail(400,'Fecha inválida');return v;};

 function printedMovementDate(m){
  const proof=m.dateEvidence;if(m.origin!=='PDF'||m.dateSource!=='documento'||!proof||proof.date!==m.date||proof.page!==m.page||!(m.page>0&&m.page<=150))return false;
  const short=proof.original.match(/^(\d{2})\/([A-Za-záéíóú]+)\b/i),months={ene:'01',jan:'01',feb:'02',mar:'03',abr:'04',apr:'04',may:'05',jun:'06',jul:'07',ago:'08',aug:'08',sep:'09',set:'09',oct:'10',nov:'11',dic:'12',dec:'12'};
  return !!(short&&m.date.slice(8)===short[1]&&m.date.slice(5,7)===months[short[2].toLowerCase().slice(0,3)]);
 }

 const period=v=>{if(typeof v!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(v))fail(400,'Período inválido');return v;};
 const today=stamp=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(stamp));
 function amount(value,signed=false){const m=String(value).trim().match(/^(-?)(\d{1,11})(?:[.,](\d{1,2}))?$/);if(!m||m[1]&&!signed)fail(400,'Usá un importe sin separador de miles y hasta dos decimales');return money(Number((m[1]? -1n:1n)*(BigInt(m[2])*100n+BigInt((m[3]||'').padEnd(2,'0')))),false,signed);}
 function rate(v){if(v==null||v==='')return null;const n=typeof v==='number'?v:Number(String(v).replace(',','.'));if(!Number.isFinite(n)||n<0||n>100||Math.abs(n*1000-Math.round(n*1000))>1e-7)fail(400,'TEM inválida (0 a 100, hasta tres decimales)');return Math.round(n*1000)/1000;}
 const fee=(base,tem)=>Number((BigInt(money(base))*BigInt(Math.round(rate(tem)*1000))+50000n)/100000n);
 function empty(ownerUid){return {version:1,ownerUid,revision:0,...Object.fromEntries(groups.map(k=>[k,[]])),operations:{}};}
 function hydrate(value,ownerUid){if(!value)return empty(ownerUid);const s=copy(value);if(s.ownerUid!==ownerUid)fail(403,'Espacio no disponible');for(const g of groups)s[g]=Object.values(s[g]||{});s.operations=s.operations||{};return s;}
 const latest=(s,cardId)=>s.statements.filter(x=>x.card===cardId).sort((a,b)=>b.close.localeCompare(a.close)||b.updatedAt-a.updatedAt)[0];
 const paid=(s,statement,c='ARS')=>s.payments.filter(p=>p.statement===statement.id&&p.currency===c&&p.status!=='Anulado').reduce((t,p)=>t+p.amount,0);
 function balance(s,statement,c='ARS'){if(!statement)return null;const base=c==='USD'?statement.usd:statement.total;if(base==null)return null;const charges=s.movements.filter(m=>m.statement===statement.id&&m.postClose&&m.currency===c).reduce((t,m)=>t+m.amount,0);return money(base+charges-paid(s,statement,c),false,true);}
 function totalDebt(s,c='ARS'){const all=s.cards.map(x=>latest(s,x.id)).filter(Boolean),values=all.map(x=>balance(s,x,c));return values.some(v=>v==null)?null:money(values.reduce((t,v)=>t+v,0),false,true);}
 function shift(p,n){period(p);const [y,m]=p.split('-').map(Number),d=new Date(Date.UTC(y,m-1+n,15));return d.toISOString().slice(0,7);}
 function quota(q){return {last:shift(q.period,q.total-q.current),release:shift(q.period,q.total-q.current+1)};}
 function project(base,tem,monthly,n=12){money(base);money(monthly);rate(tem);if(tem==null)fail(400,'Falta TEM');const values=[base];let interest=0;for(let i=0;i<n;i++){const f=fee(values.at(-1),tem);interest=money(interest+f);values.push(money(Math.max(0,values.at(-1)+f-monthly)));}return {values,interest};}
 function apply(previous,command,actor,ctx){
  key(actor.uid);const s=hydrate(previous,actor.uid),stamp=ctx.now,id=key(command.id),d=command.data||{},before=copy(s);
  if(s.operations[id]){if(s.operations[id].digest!==ctx.digest)fail(409,'El reintento no coincide con la operación original');return {state:s,replayed:true};}
  if(!Number.isSafeInteger(command.revision)||command.revision!==s.revision)fail(409,'Los datos cambiaron en otra pestaña. Conservá el formulario y actualizá antes de guardar.');
  const find=(g,k)=>s[g].find(x=>x.id===key(k))||fail(404,'Registro no disponible');
  const save=(g,value)=>{const at=s[g].findIndex(x=>x.id===value.id),old=(at>=0?s[g][at]:null)||before[g].find(x=>x.id===value.id);value={...value,ownerUid:actor.uid,createdAt:old?.createdAt??stamp,updatedAt:stamp,revision:(old?.revision||0)+1};if(at>=0)s[g][at]=value;else s[g].push(value);return value;};
  const cardId=k=>find('cards',k).id,entityId=key(d.id||id),note=()=>text(d.note||'',2000);
  let action=command.type,entity=entityId;
  if(command.type==='card-save'){
   if(!/^#[0-9a-f]{6}$/i.test(d.color||''))fail(400,'Color inválido');
   save('cards',{id:entityId,bank:text(d.bank,100,true),brand:text(d.brand,60,true),masked:text(d.masked||'',8),color:d.color,status:one(d.status||'Activa',['Activa','Archivada']),policy:text(d.policy||'',300),note:note()});
  }else if(command.type==='statement-save'){
   const old=s.statements.find(x=>x.id===entityId),card=cardId(d.card),p=period(d.period),close=date(d.close),due=date(d.due);
   if(due<close||close>today(stamp))fail(400,'Revisá cierre y vencimiento');
   if(old&&old.card!==card)fail(409,'No se puede cambiar la tarjeta de un resumen');
   if(s.statements.some(x=>x.id!==entityId&&x.card===card&&x.period===p))fail(409,'Ese período ya existe: revisá su resumen para conservar pagos y versiones');
   const file=d.file?find('documents',d.file).id:null;
   if(!d.reviewed)fail(400,'Confirmá la revisión del resumen');
   const current={id:entityId,card,period:p,close,due,previous:money(d.previous,true),total:money(d.total,true),usd:money(d.usd,true),minimum:money(d.minimum,true),minimumCurrency:currency(d.minimumCurrency||'ARS'),tem:rate(d.tem),source:old?'PDF + corrección manual':one(d.source||'Manual desde PDF',['Manual','Manual desde PDF','PDF + revisión manual','PDF + corrección manual']),file,files:[...new Set([...Object.values(old?.files||[]),...(file?[file]:[])])],reviewed:true,reconciliation:text(d.reconciliation||'',1000),extracted:d.extracted?extracted(d.extracted):old?.extracted||{},versions:Object.values(old?.versions||{})};
   if(file&&file!==old?.file)current.extracted=extracted(d.extracted);
   if(old)current.versions.push({at:stamp,previous:{...old,versions:undefined}});
   for(const c of ['ARS','USD']){const base=c==='ARS'?current.total:current.usd;if(base!=null&&base<paid(s,current,c)&&!current.reconciliation)fail(409,'El saldo es menor que los pagos registrados. Explicá la conciliación antes de continuar');}
   if(!Array.isArray(d.movements)||d.movements.length>1500)fail(400,'Revisá los movimientos (hasta 1500 por resumen)');
   const movements=d.movements.map(m=>({id:key(m.id),statement:entityId,card,date:date(m.date),concept:text(m.concept,300,true),ref:text(m.ref||'',160),amount:money(m.amount,false,true),currency:currency(m.currency),kind:one(m.kind,['Consumo','Seguro','Débito a confirmar','Cuota','Interés','Impuesto','Pago del período anterior','Conversión','Ajuste']),origin:m.origin==='PDF'?'PDF':'Manual desde PDF',page:m.page==null?null:money(m.page),current:m.current==null?null:Number(m.current),total:m.total==null?null:Number(m.total),...(m.dateSource==='cierre'?{dateSource:'cierre'}:m.origin==='PDF'&&m.dateSource==='documento'&&m.dateEvidence?{dateSource:'documento',dateEvidence:{date:date(m.dateEvidence.date),page:money(m.dateEvidence.page),original:text(m.dateEvidence.original,500,true)}}:{}),postClose:false}));
   const seen=new Set();for(const m of movements){if(seen.has(m.id)||s.movements.some(x=>x.id===m.id&&x.statement!==entityId))fail(400,'Movimiento repetido');seen.add(m.id);if(m.date>close&&!(printedMovementDate(m)&&m.date<=due))fail(400,'Un movimiento posterior al cierre requiere fecha impresa verificable y no superar el vencimiento');if(m.dateSource==='cierre'&&m.date!==close)fail(400,'La fecha del cargo debe coincidir con el cierre');if(m.kind==='Cuota'&&(!Number.isInteger(m.current)||!Number.isInteger(m.total)||m.current<1||m.current>m.total||m.total>120))fail(400,'Cuotas inválidas');if(m.kind!=='Cuota')m.current=m.total=null;}
   for(const m of s.movements.filter(x=>x.statement===entityId&&!x.postClose&&!seen.has(x.id))){if(s.expenses.some(x=>x.linkedMovement===m.id)||s.insurances.some(x=>(x.charges||[]).includes(m.id))||s.installments.some(x=>x.movement===m.id))fail(409,'Un movimiento eliminado tiene vínculos: conservá su referencia o conciliá primero');}
   const delta=['ARS','USD'].filter(c=>{const base=c==='ARS'?current.total:current.usd,previous=c==='ARS'?current.previous:current.extracted.previousUSD?.value;return previous!=null&&base!=null&&money(previous,true)+movements.filter(m=>m.currency===c).reduce((t,m)=>t+m.amount,0)!==base;});
   if(delta.length&&!current.reconciliation)fail(400,'Los subtotales no concilian. Revisá el PDF o explicá la diferencia');
   save('statements',current);s.movements=s.movements.filter(m=>m.statement!==entityId||m.postClose);for(const m of movements){
    const input=d.movements.find(x=>x.id===m.id);save('movements',m);
    if(['Seguro','Débito a confirmar'].includes(m.kind)){
     const existing=input.insuranceId?find('insurances',input.insuranceId):s.insurances.find(i=>Object.values(i.charges||{}).includes(m.id));
     if(existing&&existing.currency!==m.currency)fail(400,'La moneda del seguro vinculado no coincide');
     if(existing)save('insurances',{...existing,charges:[...new Set([...Object.values(existing.charges||{}),m.id])]});
     else save('insurances',{id:key(m.id+'-insurance'),name:m.concept,ref:m.ref,coverage:'',amount:Math.abs(m.amount),currency:m.currency,card,classification:'Por confirmar',decision:'Evaluar',cancelDate:null,note:'Candidato del resumen: verificar identidad y cobertura.',charges:[m.id],history:[],origin:'PDF + revisión manual'});
    }
    if(m.kind==='Cuota'){
     const existing=input.installmentId?find('installments',input.installmentId):s.installments.find(q=>q.movement===m.id);
     if(existing&&(existing.card!==card||existing.currency!==m.currency))fail(400,'La compra vinculada no coincide en tarjeta y moneda');
     save('installments',{id:existing?.id||key(m.id+'-installment'),concept:existing?.concept||m.concept,card,amount:Math.abs(m.amount),currency:m.currency,current:m.current,total:m.total,period:p,movement:m.id,originMovement:existing?.originMovement||existing?.movement||m.id,status:existing?.status||'Activa',origin:'PDF + revisión manual'});
    }
   }
  }else if(command.type==='payment-save'){
   const st=find('statements',d.statement),value=money(d.amount),c=currency(d.currency),dt=date(d.date,!!d.declared),type=one(d.type,['Mínimo','Total','Parcial','Extraordinario']);if(!value)fail(400,'El pago debe ser mayor a cero');
   if(d.declared&&type!=='Mínimo')fail(400,'Solo un mínimo declarado puede quedar sin fecha');if(dt&&(dt<st.close||dt>today(stamp)))fail(400,'La fecha debe estar entre el cierre y hoy');
   if(type==='Mínimo'&&c!==st.minimumCurrency)fail(400,'La moneda no coincide con el mínimo del resumen');
   const b=balance(s,st,c);if((b==null||value>b)&&!d.reconciliation)fail(409,'El pago requiere conciliación explícita por saldo desconocido o excedido');if(type==='Total'&&value!==b)fail(400,'El pago total debe coincidir con el saldo de esa moneda');
   if(s.payments.some(p=>p.statement===st.id&&p.currency===c&&p.amount===value&&p.date===dt&&p.status!=='Anulado'))fail(409,'Ya existe un pago con fecha, moneda e importe iguales');
   if(type==='Mínimo'){if(c!==st.minimumCurrency)fail(400,'La moneda no coincide con el mínimo del resumen');if(st.minimum==null&&!d.reconciliation)fail(400,'Mínimo desconocido: completá la conciliación');const pending=st.minimum==null?null:Math.max(0,st.minimum-paid(s,st,c));if(pending===0||pending!=null&&value<pending)fail(400,'El mínimo está cubierto o el importe no lo alcanza; revisá el tipo de pago');}
   save('payments',{id:entityId,statement:st.id,card:st.card,amount:value,currency:c,date:dt,type,status:'Registrado',initial:!!d.declared,origin:d.declared?'Declarado sin comprobante':'Manual',note:note(),reconciliation:text(d.reconciliation||'',1000)});
  }else if(command.type==='payment-edit'){
   const p=find('payments',entityId),st=find('statements',p.statement);if(!p.initial||p.status==='Anulado')fail(400,'Solo se completan mínimos declarados activos');const dt=date(d.date,true);if(dt&&(dt<st.close||dt>today(stamp)))fail(400,'Fecha de pago inválida');save('payments',{...p,date:dt,note:note()});
  }else if(command.type==='payment-void'){
   const p=find('payments',entityId);if(p.status==='Anulado')fail(409,'El registro ya está anulado');save('payments',{...p,status:'Anulado',voidReason:text(d.reason,1000,true),voidAt:stamp});
  }else if(command.type==='insurance-save'){
   const old=s.insurances.find(i=>i.id===entityId),decision=one(d.decision,['Mantener','Evaluar','Solicitar baja','Baja solicitada','Baja confirmada']),cancelDate=date(d.cancelDate,true);if(['Baja solicitada','Baja confirmada'].includes(decision)&&!cancelDate||cancelDate&&cancelDate>today(stamp))fail(400,'Indicá una fecha real de baja');
   const charges=Object.values(d.charges||old?.charges||[]).map(x=>find('movements',x).id);
   save('insurances',{id:entityId,name:text(d.name,180,true),ref:text(d.ref||'',160),coverage:text(d.coverage||'',300),amount:money(d.amount),currency:currency(d.currency||'ARS'),card:cardId(d.card),decision,classification:one(d.classification,['Seguro','Por confirmar','No es seguro']),cancelDate,note:note(),charges,history:[...Object.values(old?.history||[]),...(old?[{at:stamp,previous:{card:old.card,decision:old.decision,amount:old.amount,cancelDate:old.cancelDate}}]:[])],origin:old?.origin||'Manual'});
  }else if(command.type==='charge-save'){
   const insurance=find('insurances',d.insurance),st=latest(s,cardId(d.card)),dt=date(d.date),v=money(d.amount);if(!st||dt<=st.close||dt>today(stamp)||!v)fail(400,'El cargo debe ser posterior al último cierre y no futuro');
   if(s.movements.some(m=>m.postClose&&m.card===st.card&&m.date===dt&&m.amount===v&&m.concept===insurance.name))fail(409,'Ese cargo ya está registrado');
   save('movements',{id:entityId,statement:st.id,card:st.card,date:dt,concept:insurance.name,ref:insurance.ref,amount:v,currency:insurance.currency,kind:'Seguro',origin:'Manual',postClose:true,note:note()});insurance.charges=[...Object.values(insurance.charges||[]),entityId];
  }else if(command.type==='installment-save'){
   const cur=Number(d.current),total=Number(d.total);if(!Number.isInteger(cur)||!Number.isInteger(total)||cur<1||cur>total||total>120)fail(400,'Revisá cuota actual y total (hasta 120)');
   const old=s.installments.find(q=>q.id===entityId),movement=d.movement?find('movements',d.movement).id:old?.movement||null;
   save('installments',{id:entityId,concept:text(d.concept,180,true),card:cardId(d.card),amount:money(d.amount),currency:currency(d.currency||'ARS'),current:cur,total,period:period(d.period),movement,originMovement:old?.originMovement||old?.movement||movement,status:one(d.status||old?.status||'Activa',['Activa','Anulada']),origin:'Manual'});
  }else if(command.type==='expense-save'){
   const v=money(d.amount),c=currency(d.currency||'ARS'),dt=date(d.date),status=one(d.status,['Pendiente','Pagado']),link=d.linkedMovement?find('movements',d.linkedMovement):null;if(!v||status==='Pagado'&&dt>today(stamp))fail(400,'Importe o fecha del gasto inválidos');
   if(link&&(link.amount!==v||link.currency!==c||s.expenses.some(e=>e.id!==entityId&&e.linkedMovement===link.id)))fail(409,'El vínculo debe coincidir en moneda e importe y no estar asignado');
   if(s.expenses.some(e=>e.id!==entityId&&e.concept.toLowerCase()===String(d.concept).trim().toLowerCase()&&e.date===dt&&e.amount===v&&e.currency===c))fail(409,'Ese gasto ya existe');
   save('expenses',{id:entityId,concept:text(d.concept,180,true),category:text(d.category,60,true),amount:v,currency:c,date:dt,method:text(d.method,60,true),frequency:one(d.frequency,['Ocasional','Mensual']),status,linkedMovement:link?.id||'',note:note()});
  }else if(command.type==='strategy-save'){
   const st=latest(s,cardId(d.card)),base=balance(s,st),extra=money(d.extra),monthly=d.monthly==null?null:money(d.monthly),tem=rate(d.rate);if(base==null||base<0||extra>base)fail(400,'Revisá el saldo base y el extraordinario');
   const result=tem!=null&&monthly!=null?project(base-extra,tem,monthly):null;
   save('strategies',{id:entityId,name:text(d.name||'Escenario',100,true),at:stamp,card:st.card,base,totalBase:totalDebt(s),extra,monthly,rate:tem,strategy:one(d.strategy,['accessible','rate']),result,baseStatements:s.cards.map(c=>latest(s,c.id)).filter(Boolean).map(x=>({id:x.id,revision:x.revision,balance:balance(s,x),usd:balance(s,x,'USD')})),assumptions:'Un período mensual completo; otras tarjetas constantes; sin consumos, cuotas futuras ni impuestos nuevos; aporte incluye mínimo.'});
  }else fail(400,'Acción no disponible');
  const changed=groups.filter(g=>g!=='history'&&JSON.stringify(before[g])!==JSON.stringify(s[g]));
  s.history.unshift({id,ownerUid:actor.uid,actorUid:actor.uid,at:stamp,action,entity,origin:command.type==='strategy-save'?'Simulado':'Manual',changes:changed.map(g=>({group:g,before:before[g].filter(x=>!s[g].some(y=>y.id===x.id&&JSON.stringify(y)===JSON.stringify(x))),after:s[g].filter(x=>!before[g].some(y=>y.id===x.id&&JSON.stringify(y)===JSON.stringify(x)))}))});
  s.revision++;s.updatedAt=stamp;s.operations[id]={digest:ctx.digest,revision:s.revision};
  if(JSON.stringify(s).length>6e6||Object.keys(s.operations).length>10000)fail(413,'El espacio requiere archivo histórico antes de agregar más registros');
  return {state:copy(s),replayed:false};
 }
 return {groups,key,text,money,date,period,amount,rate,fee,empty,hydrate,latest,paid,balance,totalDebt,quota,shift,project,apply};
});
