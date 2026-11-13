(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.SVProposalDeckModel=factory();})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const key=value=>typeof value==='string'&&value.length>0&&value.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
 function refs(record){return ['clienteFbKey','clienteKey','clienteId','idCliente'].map(k=>record?.[k]).filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim());}
 function sameClient(a,b){const ar=refs(a),br=refs(b);return ar.length>0&&br.length>0&&ar.some(k=>br.includes(k));}
 function select(records,keys){
  if(!Array.isArray(keys)||!keys.length||keys.length>12||new Set(keys).size!==keys.length||keys.some(k=>!key(k)))throw Error('Elegí entre 1 y 12 propuestas diferentes.');
  const result=keys.map(k=>records.find(r=>r.fbKey===k));
  if(result.some(r=>!r||r.eliminado===true||r._svListSummary||r._svPagedSummary||!r.items))throw Error('No se pudieron consultar todas las propuestas completas.');
  if(result.slice(1).some(r=>!sameClient(result[0],r)))throw Error('Elegí propuestas del mismo cliente.');
  return result;
 }
 function scene(dto){
  const codes=new Set((dto?.items||[]).map(i=>String(i.code||'').toUpperCase().replace(/^P-?/,'')));
  for(const [code,asset,title,subtitle]of [['62910','cerradura-camara','Cerraduras inteligentes','Reconocimiento facial para tus accesos'],['2823','cerradura-teclado','Cerraduras inteligentes','Videoportero, huella y conectividad Wi-Fi'],['63017','portero-pantalla','Comunicación y acceso','Videoportero y control de acceso para el edificio'],['18448','portero-teclado','Videoportería y seguridad','Comunicación interior y control de ingreso'],['12297','videovigilancia','Videovigilancia integrada','Una mirada más completa sobre tu edificio'],['62934','portero-columna','Accesos inteligentes','Control de acceso para espacios compartidos']])if(codes.has(code))return {asset,title,subtitle};
  return {asset:'',title:'Tu propuesta',subtitle:'Equipos y servicios para tu espacio'};
 }
 function overview(dto){
  const codes=new Map((dto.items||[]).map(i=>[String(i.code||'').toUpperCase().replace(/^P-?/,''),i]));
  const qty=code=>codes.get(code)?.quantity;
  if(qty('62910'))return 'Una propuesta de '+qty('62910')+' cerraduras inteligentes con reconocimiento facial y alternativas de ingreso por tarjeta, código y aplicación. Los trabajos incluidos se detallan junto con los equipos presupuestados.';
  if(qty('2823'))return 'Una propuesta de '+qty('2823')+' cerraduras inteligentes de tres pernos con videoportero, huella y Wi-Fi. Los servicios de instalación, configuración y postventa se detallan en el alcance presupuestado.';
  if(qty('63017'))return 'Una propuesta integral de videoportería y acceso con '+qty('63017')+' frentes con pantalla de 8 pulgadas'+(qty('5171')?', '+qty('5171')+' monitores interiores':'')+(qty('62934')?' y '+qty('62934')+' terminales de identificación facial, QR y tarjeta':'')+'. Incluye los componentes y servicios detallados en esta presentación.';
  if(qty('18448'))return 'Una solución para conectar el ingreso del edificio mediante '+qty('18448')+' frentes de videoportero'+(qty('5171')?' y '+qty('5171')+' monitores interiores':'')+'. El control de acceso, los componentes de cierre, la alimentación y el cableado se detallan en el presupuesto.';
  if(qty('12297'))return 'Una solución de videovigilancia que reúne '+qty('12297')+' kit de cámaras, grabación local y elementos de conexión. Las cantidades de equipos y los servicios de instalación se detallan a continuación.';
  if(qty('62934'))return 'Una propuesta para organizar los ingresos con '+qty('62934')+' terminales de reconocimiento facial, códigos QR y tarjetas'+(qty('63019')?' sobre '+qty('63019')+' pedestales':'')+'. Los componentes de apertura y trabajos incluidos se detallan en las páginas siguientes.';
  return 'Esta propuesta reúne los equipos y servicios presupuestados para '+dto.client+'. Las cantidades, los trabajos incluidos y la inversión se detallan en las páginas siguientes.';
 }
 function pages(dto){
  if(dto?.status!=='READY'||!Array.isArray(dto.items)||!dto.items.length)throw Error('El presupuesto necesita revisión antes de presentarlo.');
  const numeric=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  if(!['subtotal','discount','iva','total'].every(k=>numeric(dto.money?.ars?.[k]))||!numeric(dto.money?.usd?.total)||!numeric(dto.money?.discountPct)||dto.money.discountPct>100||!numeric(dto.exchange?.rate)||dto.exchange.rate===0||!dto.exchange.label||dto.items.some(i=>typeof i.description!=='string'||!i.description.trim()||!numeric(i.quantity)||i.quantity===0))throw Error('Faltan importes o cantidades válidos para presentar.');
  const visual=scene(dto),out=[{kind:'cover',title:dto.title||visual.title,subtitle:visual.subtitle,client:dto.client,address:dto.address,number:dto.number},{kind:'intro',title:visual.subtitle,client:dto.client,address:dto.address,number:dto.number}];
  for(let i=0;i<dto.items.length;i+=8)out.push({kind:'items',title:'Equipos y servicios',items:dto.items.slice(i,i+8)});
  out.push({kind:'money',title:'Tu inversión',money:dto.money,exchange:dto.exchange});return out;
 }
 return Object.freeze({validKey:key,sameClient,select,pages,scene,overview});
});
