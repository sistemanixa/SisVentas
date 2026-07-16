(function(window){
  'use strict';
  var SV=window.SisVentas=window.SisVentas||{};
  function iso(date){
    var d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function range(cursor,view){
    var d=new Date(cursor||new Date()), start, end;
    if(view==='dia') start=end=new Date(d);
    else if(view==='semana'){
      start=new Date(d); start.setDate(start.getDate()-((start.getDay()+6)%7));
      end=new Date(start); end.setDate(end.getDate()+6);
    }else{
      start=new Date(d.getFullYear(),d.getMonth(),1);
      end=new Date(d.getFullYear(),d.getMonth()+1,0);
    }
    return {start:iso(start),end:iso(end)};
  }
  function toRows(value){
    return Object.entries(value||{}).map(function(entry){ return Object.assign({fbKey:entry[0]},entry[1]||{}); });
  }
  function subscribeDateRange(path,bounds,onRows,onError){
    if(!window.fbDB||!window.fbRef||!window.fbOnValue) return function(){};
    var base=window.fbRef(window.fbDB,path), target=base;
    if(window.fbQuery&&window.fbOrderByChild&&window.fbStartAt&&window.fbEndAt){
      target=window.fbQuery(base,window.fbOrderByChild('fecha'),window.fbStartAt(bounds.start),window.fbEndAt(bounds.end+'\uf8ff'));
    }
    return window.fbOnValue(target,function(snapshot){
      var rows=toRows(snapshot.val());
      if(target===base) rows=rows.filter(function(row){ return String(row.fecha||'').slice(0,10)>=bounds.start&&String(row.fecha||'').slice(0,10)<=bounds.end; });
      onRows(rows,bounds);
    },onError||function(error){ console.error('[DataQuery]',path,error); });
  }
  SV.DataQuery={iso:iso,range:range,subscribeDateRange:subscribeDateRange};
})(window);
