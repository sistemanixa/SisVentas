(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./commercial-money.v1.js'));
  else root.SVEmployeeClothingModel=factory(root.SVCommercialMoney);
})(typeof window==='object'?window:globalThis,function(Money){
  'use strict';
  if(!Money||typeof Money.isAmount!=='function')throw Error('Falta el cálculo monetario.');
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  function fail(message,code='CLOTHING_INVALID'){throw Object.assign(Error(message),{code});}
  function text(value,label,max=160){if(typeof value!=='string'||!value.trim()||value.length>max)fail('Revisá '+label+'.');return value.trim();}
  function key(value,label='la referencia'){const result=text(value,label,128);if(/[.#$\[\]\/\u0000-\u001f\u007f]/.test(result)||['__proto__','prototype','constructor'].includes(result))fail('Revisá '+label+'.');return result;}
  function count(value){if(!Number.isSafeInteger(value)||value<=0)fail('La cantidad debe ser un entero mayor a cero.');return value;}
  function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value.slice(0,10))fail('Revisá la fecha de la operación.');return value;}
  function freeze(value){if(object(value)||Array.isArray(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  function stable(value){if(Array.isArray(value))return value.map(stable);if(object(value))return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
  const signature=value=>JSON.stringify(stable(value));
  const copy=value=>JSON.parse(JSON.stringify(value));
  function create(){return freeze({schema:1,revision:0,garments:{},events:[],operations:{}});}
  function check(state){if(!object(state)||state.schema!==1||!Number.isSafeInteger(state.revision)||state.revision<0||!object(state.garments)||!Array.isArray(state.events)||!object(state.operations))fail('El registro de indumentaria necesita revisión.');}
  function garment(state,id,variantId){const item=state.garments[key(id,'la prenda')];if(!item)fail('La prenda no está registrada.');const variant=item.variants.find(v=>v.id===key(variantId,'el talle'));if(!variant)fail('El talle no está registrado.');return {item,variant};}
  function balance(state,garmentId,variantId){return state.events.filter(e=>e.garmentId===garmentId&&e.variantId===variantId).reduce((total,e)=>{const next=total+(e.type==='employee.deliver'?-e.quantity:e.quantity);if(!Number.isSafeInteger(next)||next<0)fail('El historial de existencias necesita revisión.');return next;},0);}
  function normalize(command){
    if(!object(command))fail('Falta la operación.');
    const base={type:command.type,operationId:key(command.operationId,'la operación'),actorId:key(command.actorId,'quién registra'),at:date(command.at)};
    if(command.type==='garment.create'){
      if(!Array.isArray(command.variants)||!command.variants.length||command.variants.length>100)fail('Agregá al menos un talle.');
      const variants=command.variants.map(v=>{if(!object(v))fail('Revisá el talle.');return {id:key(v.id,'el talle'),size:text(v.size,'el talle',40),color:text(v.color,'el color',60)};});
      if(new Set(variants.map(v=>v.id)).size!==variants.length||new Set(variants.map(v=>(v.size+'\u0000'+v.color).toLowerCase())).size!==variants.length)fail('Hay talles repetidos.');
      let photoUrl='';if(command.photoUrl){try{const url=new URL(command.photoUrl);if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)throw Error();photoUrl=url.href;}catch{fail('Revisá la foto.');}}
      return {...base,garmentId:key(command.garmentId,'la prenda'),name:text(command.name,'el nombre'),photoUrl,variants};
    }
    if(!['stock.receive','employee.deliver','employee.return'].includes(command.type))fail('Operación desconocida.');
    const result={...base,garmentId:key(command.garmentId,'la prenda'),variantId:key(command.variantId,'el talle'),quantity:count(command.quantity)};
    if(command.type==='stock.receive'){
      if(!['number','string'].includes(typeof command.unitCost)||!Money.isAmount(command.unitCost)||Money.decimal(command.unitCost).n<0n)fail('El costo debe tener como máximo dos decimales.');
      const unitCost=Money.amount(command.unitCost),totalCost=Money.product(unitCost,result.quantity);
      return {...result,unitCost,totalCost,currency:'ARS',gastoRef:key(command.gastoRef,'el gasto vinculado')};
    }
    result.employeeId=key(command.employeeId,'el empleado');
    if(command.type==='employee.return')result.deliveryOperationId=key(command.deliveryOperationId,'la entrega original');
    return result;
  }
  function apply(state,command){
    check(state);const operation=normalize(command),prior=state.operations[operation.operationId];
    if(prior){if(signature(prior)!==signature(operation))fail('La operación ya existe con otros datos.','CLOTHING_OPERATION_CONFLICT');return state;}
    if(state.revision===Number.MAX_SAFE_INTEGER)fail('El registro necesita revisión.');
    const next=copy(state);
    if(operation.type==='garment.create'){
      if(next.garments[operation.garmentId])fail('La prenda ya está registrada.');
      next.garments[operation.garmentId]={id:operation.garmentId,name:operation.name,photoUrl:operation.photoUrl,variants:operation.variants,createdBy:operation.actorId,createdAt:operation.at};
    }else{
      garment(state,operation.garmentId,operation.variantId);
      if(operation.type==='employee.deliver'&&balance(state,operation.garmentId,operation.variantId)<operation.quantity)fail('No hay existencias suficientes.','CLOTHING_INSUFFICIENT_STOCK');
      if(operation.type==='employee.return'){
        const delivery=state.events.find(e=>e.operationId===operation.deliveryOperationId&&e.type==='employee.deliver');
        if(!delivery||delivery.employeeId!==operation.employeeId||delivery.garmentId!==operation.garmentId||delivery.variantId!==operation.variantId)fail('La devolución no coincide con la entrega.');
        const returned=state.events.filter(e=>e.type==='employee.return'&&e.deliveryOperationId===delivery.operationId).reduce((n,e)=>n+e.quantity,0);
        if(returned+operation.quantity>delivery.quantity)fail('La devolución supera lo entregado.');
      }
      next.events.push(operation);
      balance(next,operation.garmentId,operation.variantId);
    }
    next.operations[operation.operationId]=operation;next.revision++;
    return freeze(next);
  }
  function inventory(state){check(state);return freeze(Object.values(state.garments).flatMap(g=>g.variants.map(v=>({garmentId:g.id,name:g.name,photoUrl:g.photoUrl,variantId:v.id,size:v.size,color:v.color,quantity:balance(state,g.id,v.id)}))));}
  function employeeHistory(state,employeeId){check(state);key(employeeId,'el empleado');return freeze(copy(state.events.filter(e=>e.employeeId===employeeId)));}
  return Object.freeze({create,apply,inventory,employeeHistory});
});
