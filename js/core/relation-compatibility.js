(function initRelationCompatibility(global){
  'use strict';
  var SV=global.SisVentas=global.SisVentas||{};
  var R=SV.Relations=SV.Relations||{};

  function arr(value){ return Array.isArray(value)?value:Object.values(value||{}); }
  function norm(value){ return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''); }
  function unique(list, predicate){ var found=list.filter(predicate); return found.length===1?found[0]:null; }
  function clients(){ return arr(global.clientesData||global.cliData||global.clientesList); }
  function employees(){ return arr(global.empData||global.empleadosData); }
  function categories(){ return arr(global.catData||global.categoriasData); }
  function suppliers(){ return arr(global.provData||global.proveedoresData); }
  function sales(){ return arr(global.ventasList||global.ventasData); }

  function byKeyOrBusiness(list,key,businessFields){
    if(!key) return null;
    var exact=unique(list,function(row){return String(row.fbKey||'')===String(key);});
    if(exact) return exact;
    return unique(list,function(row){return (businessFields||['id']).some(function(field){return norm(row[field])===norm(key);});});
  }
  function byUniqueName(list,value,fields){
    if(!value) return null;
    return unique(list,function(row){return fields.some(function(field){return norm(row[field])===norm(value);});});
  }

  R.client=function(record){
    return byKeyOrBusiness(clients(),record&&record.clienteFbKey,['id']) ||
      byKeyOrBusiness(clients(),record&&(record.clienteId||record.idCliente||record.clientId),['id']) ||
      byUniqueName(clients(),record&&(record.cliente||record.clienteNombre),['nombre','empresa','razonSocial']);
  };
  R.employee=function(record,prefix){
    prefix=prefix||'empleado';
    var key=record&&(record[prefix+'FbKey']||record[prefix+'Id']);
    var name=record&&record[prefix];
    return byKeyOrBusiness(employees(),key,['id','legajo']) || byUniqueName(employees(),name,['nombre']);
  };
  R.sale=function(record){
    return byKeyOrBusiness(sales(),record&&(record.ventaFbKey||record.ventaId||record.venta),['id','idOriginal']);
  };

  R.canonicalize=function(kind,record){
    if(!record||typeof record!=='object') return record;
    var client,employee,sale,match;
    if(['venta','presupuesto','ot'].indexOf(kind)>=0){ client=R.client(record); if(client&&client.fbKey) record.clienteFbKey=client.fbKey; }
    if(kind==='venta'){
      employee=R.employee(record,'empleado'); if(employee&&employee.fbKey) record.empleadoFbKey=employee.fbKey;
      match=R.employee(record,'comisionado2'); if(match&&match.fbKey) record.comisionado2FbKey=match.fbKey;
    }
    if(kind==='ot'||kind==='pago'){
      sale=R.sale(record); if(sale&&sale.fbKey) record.ventaFbKey=sale.fbKey;
      if(!client&&sale) client=R.client(sale);
      if(client&&client.fbKey) record.clienteFbKey=client.fbKey;
    }
    if(kind==='ot'){
      employee=byKeyOrBusiness(employees(),record.tecnicoFbKey||record.tecnicoId,['id','legajo']) || byUniqueName(employees(),record.tecnico,['nombre']);
      if(employee&&employee.fbKey) record.tecnicoFbKey=employee.fbKey;
    }
    if(kind==='producto'){
      match=byKeyOrBusiness(categories(),record.categoriaFbKey,['id']) || byUniqueName(categories(),record.categoria,['nombre']);
      if(match&&match.fbKey) record.categoriaFbKey=match.fbKey;
      match=byKeyOrBusiness(suppliers(),record.proveedorFbKey,['id','codigo']) || byUniqueName(suppliers(),record.proveedor,['nombre','razonSocial','empresa']);
      if(match&&match.fbKey) record.proveedorFbKey=match.fbKey;
    }
    return record;
  };
  global.canonicalizarRelaciones=R.canonicalize;

  function wrap(name,kind){
    var original=global[name];
    if(typeof original!=='function'||original._svRelations) return;
    var wrapped=function(record){ R.canonicalize(kind,record); return original.apply(this,arguments); };
    wrapped._svRelations=true; wrapped._svOriginal=original; global[name]=wrapped;
  }
  wrap('fbGuardarVenta','venta');
  wrap('fbGuardarPresupuesto','presupuesto');
  wrap('fbGuardarOT','ot');
  wrap('fbGuardarProducto','producto');
})(window);
