'use strict';
const crypto=require('node:crypto');
const Sales=require('./commercial-models/sales-read-model');
const validNumber=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0;
const round=v=>Math.round((v+Number.EPSILON)*100)/100;
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const key=(prefix,parts)=>prefix+'_'+parts.map(v=>String(v??'').replace(/[^A-Za-z0-9_-]/g,'_')).join('_');
const businessId=v=>String(v||'').replace(/^#/,'').trim().toUpperCase();
function linked(r,sale){return !!r&&(r.ventaFbKey?String(r.ventaFbKey)===sale.fbKey:[r.ventaId,r.venta].some(v=>v&&businessId(v)===businessId(sale.id)));}
function originalCost(item){
 if(item.comisionCostoHistoricoPendiente===true)return null;
 for(const k of ['costoUnitarioAntesPreparacion','costoUnitarioPresupuestado'])if(validNumber(item[k]))return Number(item[k]);
 const qty=Number(item.qty??item.cantidad??1);
 for(const k of ['costoTotalCompra','costoTotal','costo'])if(validNumber(item[k]))return Number(item[k])/qty;
 for(const k of ['costoUnitarioCompra','costoUnitario','costoCompra','compra','precioCompra','precio_compra'])if(validNumber(item[k]))return Number(item[k]);
 if(validNumber(item.costoUnitarioUSD)&&validNumber(item.cotizacionUsada)&&Number(item.cotizacionUsada)>0)return Number(item.costoUnitarioUSD)*Number(item.cotizacionUsada);
 return null;
}
function employeesFor(sale,employees){
 const rows=Object.entries(employees||{}).map(([fbKey,e])=>({...e,fbKey}));
 const resolve=(id,name)=>{if(id)return rows.find(e=>e.fbKey===id)||null;if(!name)return null;const matches=rows.filter(e=>String(e.nombre||'').trim().toLocaleLowerCase('es')===String(name).trim().toLocaleLowerCase('es'));return matches.length===1?matches[0]:null;};
 const first=resolve(sale.comisionadoPrincipalFbKey||sale.empleadoFbKey,sale.comisionadoPrincipal||sale.empleado);
 const second=resolve(sale.comisionado2FbKey||sale.empleado2FbKey,sale.comisionado2||sale.empleado2);
 if(!first||((sale.comisionado2FbKey||sale.empleado2FbKey||sale.comisionado2||sale.empleado2)&&!second))return null;
 return [first,...(second&&second.fbKey!==first.fbKey?[second]:[])];
}
function cargoPercent(emp,config){
 const id=emp.cargoId||emp.cargo||emp.categoria||'',cargo=config.cargos?.[id]||{};
 const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
 const aliases=[id,cargo.id,cargo.nombre,cargo.cargo,cargo.categoria,cargo.categoriaBase];
 const base=norm(cargo.categoriaBase||cargo.nombre||id),n=norm(id);
 for(const [code,values]of Object.entries({tecnico_c:['Cat. 39','cat_39','TECNICO C'],tecnico_b:['Cat. 15','cat_15','TECNICO B'],tecnico_a:['Cat. 08','cat_08','TECNICO A'],administrativo:['ADMINIS','Administrativo'],inicial:['INICIAL'],temporal:['A-TEMP','Temporal']}))if(n===code||base===code||code==='administrativo'&&base==='adminis'||code==='temporal'&&base==='a_temp')aliases.push(...values);
 const configs={'Cat. 39':{pct:2.5},'Cat. 15':{pct:1.5},'Cat. 08':{pct:1},...config.comisiones};
 for(const alias of aliases)if(configs[alias])return configs[alias].pct;
 const names=aliases.map(norm);const found=Object.keys(configs).find(k=>names.includes(norm(k)));return found?configs[found].pct:0;
}
function preview({sale,payments,employees,config,existing=[]}){
 const result={status:'revision',motivo:'',faltantes:[],participantes:[],ventaId:sale.id,ventaFbKey:sale.fbKey};
 if(sale.comisionHabilitada!==true)return {...result,status:'no_aplica',motivo:'La venta no tiene comisión habilitada'};
 if(sale.anulada||sale.anulado||['anulada','anulado','sin_cargo'].includes(String(sale.estado||sale.estadoPago||'').toLowerCase()))return {...result,status:'no_aplica',motivo:'La venta está anulada o es sin cargo'};
 const economic=Sales.saleEconomic(sale),read=new Sales.SalesReadModel([sale],payments),summary=read.summaryFor(sale.fbKey);
 if(!economic.ready)return {...result,motivo:'Revisar la coherencia de ítems e importes de la venta'};
 result.total=round(economic.total);result.cobrado=round(summary.paid);
 if(economic.total<=0||summary.paid+0.011<economic.total)return {...result,status:'pendiente_cobro',motivo:'La venta todavía no está totalmente cobrada'};
 const people=employeesFor(sale,employees);
 if(!people||people.some(e=>e.activo===false||String(e.estado||'').toLowerCase()==='inactivo'))return {...result,motivo:'Revisar la identidad o actividad de los comisionados'};
 const max=Number(config.maxComisionPct??10);if(!Number.isFinite(max)||max<0||max>100)return {...result,motivo:'Tope de comisión inválido'};
 const requested=people.map(e=>{const individual=config.comisionesEmpleados?.[e.fbKey];return Number(individual!=null?(typeof individual==='number'?individual:individual.pct):cargoPercent(e,config));});
 if(requested.some(p=>!Number.isFinite(p)||p<0||p>100))return {...result,motivo:'Porcentaje de comisión inválido'};
 const active=people.map((e,i)=>({...e,solicitado:requested[i]})).filter(e=>e.solicitado>0);
 if(!active.length||max===0)return {...result,status:'no_aplica',motivo:'No hay un porcentaje de comisión configurado'};
 const sum=active.reduce((t,e)=>t+e.solicitado,0);
 result.participantes=active.map(e=>({empleadoFbKey:e.fbKey,nombre:e.nombre||'',pctOriginal:e.solicitado,pct:active.length>1&&sum>max?max/active.length:Math.min(e.solicitado,max)}));
 if(existing.length){const all=result.participantes.every(e=>existing.some(x=>x.empleadoFbKey===e.empleadoFbKey&&x.key!=='control'));return {...result,status:all?'existente':'revision',motivo:all?'Ya hay comisiones vinculadas. Se conservan sin cambios':'Hay registros previos o parciales. Requieren conciliación sin sobrescribirlos'};}
 const items=Object.values(sale.items||{});let cost=0;
 items.forEach((it,i)=>{const unit=originalCost(it);
 if(unit===null)result.faltantes.push({indice:i,codigo:it.cod||it.codigo||'',descripcion:it.desc||it.descripcion||'',cantidad:Number(it.qty??it.cantidad??1)});
 else cost+=unit*Number(it.qty??it.cantidad??1);});
 if(result.faltantes.length)return {...result,motivo:'Faltan costos originales; no se usa el catálogo actual'};
 if(!Number.isFinite(cost))return {...result,motivo:'Revisar cantidades y costos originales de los ítems'};
 result.base={ventaNeta:round(economic.taxableBase),costoOriginal:round(cost),ganancia:round(economic.taxableBase-cost)};
 if(result.base.ganancia<=0)return {...result,status:'no_aplica',motivo:'La ganancia original no es positiva'};
 result.participantes.forEach(e=>e.monto=round(result.base.ganancia*e.pct/100));
 result.participantes=result.participantes.filter(e=>e.monto>0);
 const digest=hash({sale:financialSource(sale),payments:summary.payments,base:result.base,participantes:result.participantes});
 return {...result,status:result.participantes.length?'lista':'no_aplica',motivo:'',digest};
}
function financialSource(sale){return Object.fromEntries(['id','items','total','subtotal','descuento','descuentoGeneral','descuentoPct','iva','conIva','ivaPct','anulada','anulado','estado','estadoPago','comisionHabilitada','comisionadoPrincipalFbKey','comisionadoPrincipal','empleadoFbKey','empleado','comisionado2FbKey','comisionado2','empleado2FbKey','empleado2'].filter(k=>sale[k]!==undefined).map(k=>[k,sale[k]]));}
module.exports={preview,originalCost,employeesFor,hash,key,linked,financialSource,round};
