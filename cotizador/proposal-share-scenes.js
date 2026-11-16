'use strict';
// Server-local public marketing labels, parity-tested with the presentation model.
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
module.exports=Object.freeze({scene,overview});
