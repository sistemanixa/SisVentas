'use strict';
const {financialConfigAccess}=require('./employee-directory');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const DEFAULTS=Object.freeze({'Cat. 39':Object.freeze({pct:2.5,min:0,max:0}),'Cat. 15':Object.freeze({pct:1.5,min:0,max:0}),'Cat. 08':Object.freeze({pct:1,min:0,max:0})});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function dictionary(value){if(value===null||value===undefined)return {};if(!object(value))throw fail(503,'No se pudo consultar la configuración de comisiones');return structuredClone(value);}
// Presentation-only effective configuration. The financial preview and writers
// retain their original calculation path and existing historical records.
function effectiveConfig(config={}){return {comisiones:Object.assign(structuredClone(DEFAULTS),dictionary(config.comisiones)),comisionesEmpleados:dictionary(config.comisionesEmpleados),maxComisionPct:config.maxComisionPct??10};}
function createCommissionConfiguration({authorize,db}){
 async function read(req){
  const identity=await authorize(req);if(!financialConfigAccess(identity))throw fail(403,'No tenés permiso para consultar esta configuración');
  const names=['comisiones','comisionesEmpleados','maxComisionPct'];
  const values=await Promise.all(names.map(async name=>(await db.ref('sisventas/config/'+name).get()).val()));
  return effectiveConfig(Object.fromEntries(names.map((name,i)=>[name,values[i]])));
 }
 return {read};
}
module.exports={createCommissionConfiguration,effectiveConfig};
