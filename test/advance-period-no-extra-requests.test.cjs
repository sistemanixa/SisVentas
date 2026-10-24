'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function fixture(){
 const calls=[],blocked=name=>(...args)=>{calls.push({name,args});throw Error('Unexpected transport: '+name);};
 const c={Date,Math,Number,String,Object,Array,Set,Map,JSON,console,movsEmpData:[],gastosData:[],_gastosPagosCache:null,_ctaEmpMovVisibleParaRol:()=>true};c.window=c;
 for(const name of ['fetch','fbGet','fbSet','fbUpdate','fbRemove','setTimeout','setInterval'])c[name]=blocked(name);
 load(c,['_adelantoMesSiguiente','_adelantoPeriodoDescuento','_adelantoDescontableEnMes','actualizarPeriodoDescuentoMovEmp','pagoGastoEstaAnulado','_adelantoEsEntregaLegacy','_adelantoMontoEntregado','_habAdelantoDisponibleRaw','_habPrepararCompensacion','_ctaEmpMontoAdelantoACompensar','_ctaEmpAdelantosPendientes']);return {c,calls};
}
test('changing the form date or discount month is local and never consults Cotizador, RTDB or a timer',()=>{
 const {c,calls}=fixture(),nodes={'movi-periodo-descuento':{value:'',dataset:{}},'movi-periodo-descuento-wrap':{style:{}},'movi-tipo':{value:'adelanto'},'movi-fecha':{value:'2026-10-14'}};c.document={getElementById:id=>nodes[id]};
 for(let i=0;i<50;i++)c.actualizarPeriodoDescuentoMovEmp(false);assert.equal(nodes['movi-periodo-descuento'].value,'2026-11');
 nodes['movi-periodo-descuento'].value='2027-03';nodes['movi-periodo-descuento'].dataset.editado='1';nodes['movi-fecha'].value='2026-12-15';c.actualizarPeriodoDescuentoMovEmp(false);assert.equal(nodes['movi-periodo-descuento'].value,'2027-03');
 c.actualizarPeriodoDescuentoMovEmp(true);assert.equal(nodes['movi-periodo-descuento'].value,'2027-01');assert.deepEqual(calls,[]);
});
test('eligibility and payroll preview use the loaded movements without an extra server request',()=>{
 const {c,calls}=fixture(),movement=date=>({tipo:'adelanto',estado:'pagado',fecha:date,fechaPago:date,monto:100.25,montoPagado:100.25}),rows={past:movement('2026-09-10'),future:movement('2026-10-14')};c.movsEmpData=Object.values(rows);const before=JSON.stringify(rows);
 for(let i=0;i<50;i++){assert.equal(c._ctaEmpAdelantosPendientes('2026-10').length,1);assert.equal(c._habPrepararCompensacion(rows,500,'2026-10').total,100.25);assert.equal(c._habPrepararCompensacion(rows,500,'2026-11').total,200.5);}
 assert.equal(JSON.stringify(rows),before);assert.deepEqual(calls,[]);
});
test('confirming one advance uses the existing writer once and makes no separate month-check request',async()=>{
 const {c,calls}=fixture(),nodes=Object.fromEntries(['movi-monto','movi-tipo','movi-estado','movi-medio','movi-fecha','movi-desc','movi-periodo-descuento','movi-periodico','modal-movi-emp'].map(id=>[id,{value:'',dataset:{}}]));
 nodes['movi-tipo'].value='adelanto';nodes['movi-estado'].value='pagado';nodes['movi-medio'].value='Efectivo';nodes['movi-fecha'].value='2026-10-14';nodes['movi-periodo-descuento'].value='2026-12';let writes=0,saved;
 Object.assign(c,{document:{getElementById:id=>nodes[id]||null},fbDB:{},ctaEmpActual:'employee',empData:{employee:{fbKey:'employee',nombre:'Persona ficticia'}},currentUser:'Operador ficticio',currentRole:'admin',movEmpFotoBase64:null,getMontoRaw:()=>81.23,tienePermiso:()=>true,_puedeGestionarAdelantos:()=>true,notify(){},_movEmpBotonGuardar(){},_guardarMovimientoEmpleado:async value=>{writes++;saved=value;}});
 load(c,['guardarMovEmp']);c.guardarMovEmp();await Promise.resolve();assert.equal(writes,1);assert.equal(saved.periodoDescuento,'2026-12');assert.equal(saved.fechaPago,'2026-10-14');assert.deepEqual(calls,[]);
});
