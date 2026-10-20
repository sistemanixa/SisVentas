(function(root){
 'use strict';
 const role=document.body.dataset.fixtureRole,key='presupuesto-ficticio',uid='usuario-ficticio',Budget=root.SisVentas.V3.BudgetReadModel;
 const copy=value=>JSON.parse(JSON.stringify(value)),el=id=>document.getElementById(id),photo=name=>new URL('/test/fixtures/budget-presentation-'+name+'.png',location.href).href;
 function defaults(){return {title:'Conectividad y seguridad · ejemplo',client:'Cliente ficticio · Taller del Sur',currency:'ARS',discount:10,iva:true,rows:[
  {code:'FICT-CAM-01',description:'Cámara de ejemplo Full HD · visión nocturna y soporte regulable',quantity:2,price:11250.25,discount:5,unit:'Unidad',image:photo('camera')},
  {code:'FICT-MON-02',description:'Monitor de ejemplo de 24 pulgadas · conexión para puesto de trabajo',quantity:1,price:19990.50,discount:0,unit:'Unidad',image:photo('monitor')},
  {code:'FICT-SER-03',description:'Instalación de ejemplo, configuración y puesta en marcha',quantity:3.5,price:610.10,discount:0,unit:'Hora',image:''}
 ]};}
 function recordFrom(data){const model=Budget.build({items:data.rows.map(row=>({cod:row.code,desc:row.description,qty:row.quantity,punit:row.price,disc:row.discount})),descuentoGeneral:data.discount,conIva:data.iva});return {
  fbKey:key,id:'PP-DEMO-0001',tituloSolucion:data.title,cliente:data.client,moneda:data.currency,conIva:data.iva,ivaPct:21,subtotal:model.subtotal,descuentoGeneral:data.discount,descuentoAmt:model.generalDiscount,iva:model.iva,total:model.total,
  items:data.rows.map((row,index)=>({cod:row.code,desc:row.description,qty:row.quantity,punit:row.price,disc:row.discount,sub:model.items[index].net,unidad:row.unit,imagenUrl:row.image}))};}
 function draftFrom(data,saved,id,updated){return {schema:1,id,kind:'presupuesto',updated,original:copy(saved),data:{edit:key,editId:saved.id,currency:data.currency,iva:data.iva,detail:true,
  fields:[{id:'pp-numero',value:saved.id},{id:'pp-titulo-solucion',value:data.title},{id:'pp-cli',value:data.client},{id:'pp-descuento',value:String(data.discount)}],
  rows:data.rows.map(row=>({cod:row.code,desc:row.description,qty:String(row.quantity),price:row.price,disc:String(row.discount),data:{unidad:row.unit,imagenUrl:row.image}}))}};}
 function productData(data){return Object.fromEntries(data.rows.map((row,index)=>['ficticio-'+index,{codigo:row.code,unidad:row.unit,imagenUrl:row.image}]));}
 function initial(){const data=defaults(),record=recordFrom(data);return {record,products:productData(data),connected:true,ready:true,authenticated:true,event:{ownerUid:uid,ready:true,records:[draftFrom(data,record,'edicion-ficticia-1',Date.now())],deletedIds:[]}};}
 if(role==='viewer'){
  let state=initial(),reads=0,loads=0;const observers=new Set(),fakeUser={uid};
  root.isAuthenticated=true;root.currentUserUid=uid;root.currentRole='admin';root.fbAuth={currentUser:fakeUser};root._impersonacionOriginal=null;root.prodData=copy(state.products);
  root.permisoModulo=module=>module==='presupuesto';root.buscarPptoPorRef=ref=>ref===key?copy(state.record):null;
  root.SVCommercialOwnership={clean:record=>Object.fromEntries(Object.entries(record||{}).filter(([name])=>name!=='fbKey'&&!name.startsWith('_sv')))};
  root.SVConnectionMonitor={canSync:()=>state.connected};
  root.fbDB={ficticio:true};root.fbRef=(database,path)=>{if(database!==root.fbDB||path!=='sisventas/presupuestos/'+key)throw Error('Ruta fuera del registro ficticio');return path;};
  root.fbGet=async path=>{if(path!=='sisventas/presupuestos/'+key)throw Error('Lectura ficticia rechazada');reads++;metrics();return {val:()=>copy(state.record)};};
  root.svDrafts={subscribe(callback){observers.add(callback);callback(copy(state.event));metrics();return()=>{observers.delete(callback);metrics();};}};
  root.notify=message=>{el('viewer-notice').textContent=String(message);};
  root.fetch=()=>Promise.reject(Error('Red bloqueada en la fixture'));
  root.XMLHttpRequest=function(){throw Error('Red bloqueada en la fixture');};root.WebSocket=function(){throw Error('Red bloqueada en la fixture');};root.EventSource=function(){throw Error('Red bloqueada en la fixture');};
  function send(message){if(root.parent!==root)root.parent.postMessage(message,location.origin);}
  function metrics(){const text='Observadores locales: '+observers.size+' · Lecturas simuladas: '+reads+' · Fotos cargadas: '+loads;el('viewer-counters').textContent=text;send({type:'budget-fixture-metrics',text,reads,loads,observers:observers.size});}
  function apply(next){
   const wasConnected=state.connected,wasAuthenticated=state.authenticated;state=copy(next);root.prodData=copy(state.products);
   root.isAuthenticated=state.authenticated;root.currentUserUid=state.authenticated?uid:'';root.fbAuth.currentUser=state.authenticated?fakeUser:null;
   if(wasAuthenticated&&!state.authenticated)document.dispatchEvent(new CustomEvent('sisventas:session-ended'));
   else if(!wasAuthenticated&&state.authenticated)document.dispatchEvent(new CustomEvent('sisventas:session-ready'));
   for(const callback of [...observers])callback(copy(state.event));
   if(wasConnected!==state.connected)root.dispatchEvent(new CustomEvent('sisventas:connection-'+(state.connected?'restored':'lost')));
   metrics();
  }
  root.addEventListener('message',event=>{if(event.source!==root.parent||event.origin!==location.origin)return;const message=event.data;if(message?.type==='budget-fixture-state')apply(message.state);else if(message?.type==='budget-fixture-open')document.querySelector('[data-budget-view]')?.click();});
  document.addEventListener('load',event=>{if(event.target.tagName==='IMG'){loads++;metrics();}},true);
  document.addEventListener('DOMContentLoaded',()=>{document.dispatchEvent(new CustomEvent('sisventas:session-ready'));metrics();if(root.parent!==root)send({type:'budget-fixture-ready'});else if(new URL(location.href).searchParams.get('open')!=='0')document.querySelector('[data-budget-view]')?.click();});
  return;
 }
 let data=defaults(),saved=recordFrom(data),connected=true,ready=true,authenticated=true,second=false,finished=false,generation=1,updated=Date.now(),lastEvent;
 const frame=el('viewer-frame');
 function tick(){updated=Math.max(Date.now(),updated+1);return updated;}
 function currentEvent(){
  if(finished)return {ownerUid:uid,ready:connected&&ready,records:[],deletedIds:['edicion-ficticia-'+generation]};
  const records=[draftFrom(data,saved,'edicion-ficticia-'+generation,updated)];
  if(second){const other=copy(data);other.title+=' · alternativa';other.rows[0].quantity+=1;records.push(draftFrom(other,saved,'alternativa-ficticia-'+generation,updated+1));}
  return {ownerUid:uid,ready:connected&&ready,records,deletedIds:[]};
 }
 function send(repeat=false){
  const event=repeat&&lastEvent?copy(lastEvent):currentEvent();
  if(connected||!lastEvent||finished)lastEvent=copy(event);else{event.records=copy(lastEvent.records);event.deletedIds=copy(lastEvent.deletedIds);}
  event.ready=authenticated&&connected&&ready;
  if(!authenticated){event.ownerUid='';event.records=[];event.deletedIds=[];}
  const state={record:copy(saved),products:productData(data),connected,ready,authenticated,event};frame.contentWindow?.postMessage({type:'budget-fixture-state',state},location.origin);
  el('editor-status').textContent=(!authenticated?'Sesión ficticia cerrada. ':!connected?'Sin conexión simulada: los cambios quedan pendientes en el editor. ':!ready?'Sincronización pausada. ':'Edición ficticia enviada por evento. ')+(finished?'Edición finalizada.':'Productos: '+data.rows.length+'.');
 }
 function changed(){if(finished){finished=false;generation++;}tick();send();}
 function input(label,value,field,index,type='text'){const wrap=document.createElement('label');wrap.textContent=label;const control=document.createElement('input');control.type=type;control.value=value;control.dataset.field=field;control.dataset.index=index;if(type==='number'){control.step=field==='quantity'?'0.5':'0.01';control.min='0';}wrap.appendChild(control);return wrap;}
 function renderRows(){const host=el('demo-items');host.replaceChildren();data.rows.forEach((row,index)=>{
  const card=document.createElement('details');card.className='demo-product';card.open=index<3;const summary=document.createElement('summary');summary.textContent=row.code+' · '+row.description;card.appendChild(summary);
  card.appendChild(input('Descripción',row.description,'description',index));const pair=document.createElement('div');pair.className='fields-row';pair.append(input('Cantidad',row.quantity,'quantity',index,'number'),input('Precio unitario',row.price,'price',index,'number'));card.appendChild(pair);
  const secondPair=document.createElement('div');secondPair.className='fields-row';secondPair.append(input('Descuento de línea %',row.discount,'discount',index,'number'));const label=document.createElement('label');label.textContent='Imagen';const select=document.createElement('select');select.dataset.field='image';select.dataset.index=index;
  for(const [value,text]of [['','Sin imagen'],[photo('camera'),'Cámara ficticia'],[photo('monitor'),'Monitor ficticio']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.appendChild(option);}select.value=row.image;label.appendChild(select);secondPair.appendChild(label);card.appendChild(secondPair);host.appendChild(card);
 });}
 el('demo-items').addEventListener('input',event=>{const control=event.target,field=control.dataset.field,row=data.rows[Number(control.dataset.index)];if(!row||!field)return;row[field]=['quantity','price','discount'].includes(field)?Number(control.value):control.value;changed();});
 for(const [id,field]of [['demo-title','title'],['demo-client','client'],['demo-currency','currency'],['demo-discount','discount'],['demo-iva','iva']])el(id).addEventListener('input',event=>{data[field]=field==='iva'?event.target.checked:field==='discount'?Number(event.target.value):event.target.value;changed();});
 el('open-viewer').addEventListener('click',()=>{send();frame.contentWindow?.postMessage({type:'budget-fixture-open'},location.origin);});
 el('many-items').addEventListener('click',()=>{if(data.rows.length>3)data.rows=data.rows.slice(0,3);else for(let i=4;i<=12;i++)data.rows.push({code:'FICT-EX-'+i,description:'Producto ficticio adicional '+i+' · ejemplo para revisar el desplazamiento',quantity:i%3+1,price:1350.15+i,discount:0,unit:'Unidad',image:i%2?photo('camera'):photo('monitor')});el('many-items').textContent=data.rows.length>3?'Volver a 3 productos':'Mostrar 12 productos';renderRows();changed();});
 el('reverse-items').addEventListener('click',()=>{data.rows.reverse();renderRows();changed();});
 el('second-draft').addEventListener('click',()=>{second=!second;el('second-draft').textContent=second?'Retirar segunda edición':'Agregar segunda edición';changed();});
 el('save-demo').addEventListener('click',()=>{saved=recordFrom(data);finished=true;second=false;tick();send();});
 el('discard-demo').addEventListener('click',()=>{finished=true;second=false;tick();send();});
 el('connection-demo').addEventListener('click',()=>{connected=!connected;el('connection-demo').textContent=connected?'Simular sin conexión':'Restablecer conexión';send();});
 el('ready-demo').addEventListener('click',()=>{ready=!ready;el('ready-demo').textContent=ready?'Pausar sincronización':'Reanudar sincronización';send();});
 el('repeat-demo').addEventListener('click',()=>send(true));
 el('logout-demo').addEventListener('click',()=>{authenticated=false;send();});
 el('reset-demo').addEventListener('click',()=>{data=defaults();saved=recordFrom(data);connected=true;ready=true;authenticated=true;second=false;finished=false;generation++;lastEvent=null;tick();for(const [id,field]of [['demo-title','title'],['demo-client','client'],['demo-currency','currency'],['demo-discount','discount']])el(id).value=data[field];el('demo-iva').checked=true;el('connection-demo').textContent='Simular sin conexión';el('ready-demo').textContent='Pausar sincronización';el('second-draft').textContent='Agregar segunda edición';el('many-items').textContent='Mostrar 12 productos';renderRows();send();});
 el('frame-size').addEventListener('change',event=>{el('viewer-wrap').dataset.size=event.target.value;});
 root.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.origin!==location.origin)return;if(event.data?.type==='budget-fixture-ready')send();else if(event.data?.type==='budget-fixture-metrics')el('viewer-metrics').textContent=event.data.text;});
 frame.addEventListener('load',()=>send());renderRows();send();
})(window);
