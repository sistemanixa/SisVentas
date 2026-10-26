(function(root,factory){
 'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SVDashboardStartupDemand=api;
})(typeof window==='object'?window:null,function(){
 'use strict';
 // Dependencies are explicit consumers, not a role-based grant. Callers still
 // enforce each source's authorization and own subscription lifecycle.
 var consumers=Object.freeze({
  metrics:['clientes','ventas','pagos','presupuestos'],
  profitability:['clientes','productos','ventas','pagos'],
  sales:['clientes','ventas','pagos'],
  chart:['ventas'],
  activity:['clientes','ventas','presupuestos'],
  ownAccount:['usuarios','empleados','gastos'],
  ownOrders:['usuarios','empleados','clientes','ordenesTrabajo'],
  pendingOrders:['clientes','ordenesTrabajo'],
  priceHealth:['productos','proveedores'],
  recentActivity:['clientes','ventas','pagos','presupuestos','ordenesTrabajo']
 });
 Object.keys(consumers).forEach(function(key){Object.freeze(consumers[key]);});
 var actions=Object.freeze({metrics:'dashboard.metricasGlobales',profitability:'dashboard.rentabilidad',sales:'ventas.verDashboard',chart:'dashboard.grafico',activity:'dashboard.miActividad',ownAccount:'dashboard.miCuenta',ownOrders:'dashboard.misOT',pendingOrders:'dashboard.otsPendientes'});
 function plan(options){
  options=options||{};var selected=[],reasons={},enabled=[];
  if(options.authenticated!==true||options.visible!==true||options.page!=='dashboard'||options.moduleAllowed!==true)return Object.freeze({sources:Object.freeze([]),consumers:Object.freeze([]),reasons:Object.freeze({})});
  Object.keys(consumers).forEach(function(name){
   // Non-action widgets must be confirmed visible by the integration; neither
   // their presence in markup nor a user's role proves that they are needed.
   var active=actions[name]?typeof options.can==='function'&&options.can(actions[name])===true:options.widgets&&options.widgets[name]===true;
   if(!active)return;enabled.push(name);
   consumers[name].forEach(function(source){
    // Reduced directory is legitimate even without raw employees permission.
    var allowed=(source==='empleados'||source==='usuarios')?options.directoryAllowed===true:typeof options.canDomain==='function'&&options.canDomain(source)===true;
    if(!allowed)return;
    if(!reasons[source]){selected.push(source);reasons[source]=[];}reasons[source].push(name);
   });
  });
  Object.keys(reasons).forEach(function(key){Object.freeze(reasons[key]);});
  return Object.freeze({sources:Object.freeze(selected),consumers:Object.freeze(enabled),reasons:Object.freeze(reasons)});
 }
 function create(options){
  if(!options||typeof options.capture!=='function'||typeof options.valid!=='function')throw Error('Invalid demand context');
  var current=null;
  function retire(){if(current)current.active=false;current=null;}
  function start(demand){
   var scope=options.capture();if(!scope||!options.valid(scope)){retire();return [];}
   if(!current||current.scope!==scope){retire();current={scope:scope,active:true,attempts:new Set()};}
   var entry=current,started=[];
   for(var source of demand.sources){
    if(current!==entry||!entry.active||!options.valid(scope)){retire();break;}
    if(entry.attempts.has(source))continue;
    var loader=options.loaders&&options.loaders[source];if(typeof loader!=='function')throw Error('Missing demanded source: '+source);
    // Register first, so a synchronous render cannot start a duplicate source.
    entry.attempts.add(source);started.push(source);
    try{var pending=loader();if(pending&&typeof pending.catch==='function')pending.catch(function(){/* Source owner presents error/retry; no polling here. */});}
    catch(error){if(typeof options.failed==='function')options.failed(source,error);}
   }
   return started;
  }
  return Object.freeze({start:start,retire:retire});
 }
 return Object.freeze({plan:plan,create:create,consumers:consumers});
});
