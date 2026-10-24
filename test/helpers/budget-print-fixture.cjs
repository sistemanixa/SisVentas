'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const active=require(root+'/test/helpers/active-app').readActiveApp;
function printSource(source=active().source){const start=source.indexOf('async function imprimirPresupuesto('),end=source.indexOf('\nfunction asegurarOTVentaConPago',start);if(start<0||end<start)throw Error('Missing active budget print function');return source.slice(start,end);}
async function render({detail=false,image=false,long=false,many=1,source=active().source}={}){
 let html='',model={v3Ready:true,numero:'PP-FICTICIO-0137',cliente:'Cliente ficticio de impresión',items:Array.from({length:many},(_,i)=>({cod:'P-'+String(i+1).padStart(4,'0'),desc:long?'Equipo ficticio con descripción extensa '+('referencia '.repeat(12)):['Equipo ficticio de instalación','Accesorio ficticio para prueba'][i%2],qty:i%3+1,punit:long?123456789012345.67:128500.75,sub:long?123456789012345.67:128500.75,disc:i%2?0:5})),subtotal:long?123456789012345.67:9473856.42,descuento:long?12345678901.23:457250.75,iva:long?23456789012345.67:1893487.19,total:long?145679132345790.12:10910092.86,conIva:true,observaciones:'Condiciones ficticias preservadas.',fecha:'2026-10-24',vence:'2026-11-08'};
 const record={id:model.numero,tituloSolucion:'Solución ficticia de seguridad'},before=JSON.stringify({model,record});
 const win={document:{write:s=>{html=s;},close(){},getElementById:()=>true},location:{},addEventListener(){}};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ctx={window:{open:()=>win,SVPrintLayout:require(root+'/js/core/print-layout.v1')},document:{getElementById:()=>null},svValidarSalidaComercial:()=>true,_pptoModeloImpresion:()=>model,_pptoConDetalle:detail,_comprobanteConImagen:{ppto:image},productoDesdeItem:()=>null,logoImpresionActualUrl:()=>'',escapeHTML:esc,formatearFechaComprobante:s=>s,porcentajeDescuentoComprobante:()=> '4,83%',precioUnitarioConDescuentoHTML:v=>'$'+v.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}),referenciaUsdPresupuesto:()=>({importe:1234.56,tipo:'ficticia',cotizacion:1500}),location:{href:'http://127.0.0.1:8766/index.html',origin:'http://127.0.0.1:8766'},setTimeout(){},URL:{createObjectURL:()=>''},Blob,notify:s=>{throw Error(s);},fetch(){throw Error('No network allowed');}};
 vm.createContext(ctx);vm.runInContext(printSource(source),ctx);await ctx.imprimirPresupuesto(record);
 if(JSON.stringify({model,record})!==before)throw Error('Print mutated fixture');return{html,model,record};
}
module.exports={render,printSource,root};
