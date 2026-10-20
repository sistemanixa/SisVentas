(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../v3/budget-read-model.js'));
  else root.SVBudgetPresentationModel=factory(root.SisVentas&&root.SisVentas.V3&&root.SisVentas.V3.BudgetReadModel);
})(typeof globalThis!=='undefined'?globalThis:this,function(Budget){
  'use strict';
  var WARNING='Este presupuesto necesita revisión';
  var QUANTITY=['qty','cantidad','cant','unidades'],PRICE=['punit','precio','precioUnitario','precio_unitario','precioVenta','unitario','valorUnitario'];
  var LINE_DISCOUNT=['disc','descuentoPct','porcentajeDescuento','descuento'],LINE_TOTAL=['sub','subtotal','totalItem','importe'];
  var DISCOUNT=['descuentoGeneral','descuentoPct','porcentajeDescuento','descuento'];
  function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function first(record,keys,fallback){for(var i=0;i<keys.length;i++){var value=record[keys[i]];if(value!==undefined&&value!==null&&value!=='')return value;}return fallback;}
  function text(value,max){return typeof value==='string'?value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,max):typeof value==='number'&&Number.isFinite(value)?String(value).slice(0,max):'';}
  function numeric(value,raw){
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(typeof value!=='string'||!value.trim())return null;
    var input=value.trim();
    if(raw)return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input)&&Number.isFinite(Number(input))?Number(input):null;
    input=input.replace(/^(?:ARS|USD|US\$|U\$S|\$)\s*/i,'').replace(/\s/g,'');
    if(!/^[+-]?(?:\d[\d.,]*|\.\d+)$/.test(input))return null;
    var parsed=Budget.parseNumber(input);return parsed===0&&/[1-9]/.test(input)?null:parsed;
  }
  function money(value,raw){var n=numeric(value,raw);return n!==null&&n>=0?n:null;}
  function percent(value,raw){var n=numeric(value,raw);return n!==null&&n>=0&&n<=100?n:null;}
  function currency(value,legacy){var c=text(value,8).toUpperCase();return !c&&legacy?'ARS':c==='ARS'||c==='USD'?c:'';}
  function sameMoney(a,b){return a!==null&&Number.isFinite(b)&&Math.abs(a-b)<0.0000001;}
  function finiteCalculation(items,model){
    var sum=0;
    for(var i=0;i<items.length;i++){
      var gross=items[i].quantity*items[i].unitPrice;sum+=gross;
      if(!Number.isFinite(gross)||!Number.isFinite(sum)||!Number.isFinite(Budget.roundMoney(gross)))return false;
    }
    return [model.subtotal,model.generalDiscount,model.taxableBase,model.iva,model.total].every(Number.isFinite)&&model.items.every(function(item){return [item.quantity,item.unitNet,item.gross,item.discount,item.net].every(Number.isFinite);});
  }
  function includesIva(record){
    var value=record.conIva!==undefined?record.conIva:record.incluyeIva!==undefined?record.incluyeIva:record.sinIva!==undefined?!record.sinIva:true;
    return {value:value!==false,valid:typeof value==='boolean'&&(record.sinIva===undefined||typeof record.sinIva==='boolean')};
  }
  function firebaseMediaToken(url){
    if(url.protocol!=='https:'||url.host!=='firebasestorage.googleapis.com')return false;
    var route=url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/),tokens=url.searchParams.getAll('token'),alt=url.searchParams.getAll('alt');
    if(!route||tokens.length!==1||alt.length!==1||alt[0]!=='media'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tokens[0]))return false;
    var bucket=decodeURIComponent(route[1]),name=decodeURIComponent(route[2]);
    return /^[a-z0-9][a-z0-9._-]+[a-z0-9]$/.test(bucket)&&!/[\\\u0000-\u001f\u007f]/.test(name)&&name.split('/').every(function(part){return !!part.trim()&&part!=='.'&&part!=='..';});
  }
  function safeImage(value){
    if(typeof value!=='string'||value.length>4096||/[\u0000-\u0020\u007f]/.test(value))return '';
    try{
      var url=new URL(value);if(!/^https?:$/.test(url.protocol)||url.username||url.password)return '';
      var mediaToken=firebaseMediaToken(url);
      // En Storage el bucket suele terminar en .com; el archivo es el objeto tras /o/.
      var path=mediaToken?url.pathname.slice(url.pathname.indexOf('/o/')+3):url.pathname;for(var i=0;i<2;i++)path=decodeURIComponent(path);
      if(/\.(?:svgz?|html?|xhtml|xml|xsl|xslt|js|mjs|cjs|hta|swf|wasm|exe|com|bat|cmd|ps1|vbs|jar)(?:[.;/]|$)/i.test(path))return '';
      for(var entry of url.searchParams){
        if(entry[0]==='token'&&mediaToken)continue;
        if(/^(?:auth|authorization|token|access_token|id_token|api[_-]?key|key|secret|password|signature|sig|x-goog-credential|x-goog-signature|x-amz-credential|x-amz-signature|awsaccesskeyid|googleaccessid)$/i.test(entry[0]))return '';
      }
      return url.href;
    }catch(_){return '';}
  }
  function productsList(products){return Array.isArray(products)?products.map(function(p){return {record:object(p),key:''};}):Object.keys(object(products)).map(function(key){return {record:object(products[key]),key:key};});}
  function productFor(item,products){
    var reference=text(first(item,['productoFbKey','pid','productoKey'],''),256),code=text(first(item,['cod','codigo','sku'],''),120);
    if(reference){var byId=products.filter(function(p){return [p.key,p.record.fbKey,p.record.id].some(function(id){return typeof id==='string'&&id===reference;});});if(byId.length===1)return byId[0].record;if(byId.length>1)return null;}
    var byCode=code?products.filter(function(p){return text(p.record.codigo||p.record.cod,120)===code;}):[];
    return byCode.length===1?byCode[0].record:null;
  }
  function visual(item,products){
    var product=productFor(item,products),image='';
    // La foto actual puede acompañar valores históricos; jamás se toma su precio.
    var candidates=product?[product.imagenUrl,product.imagenUrlOriginal,item.imagenUrl,item.productoImagenUrl]:[item.imagenUrl,item.productoImagenUrl];
    for(var i=0;i<candidates.length&&!image;i++)image=safeImage(candidates[i]);
    return {unit:text(item.unidad||product&&product.unidad||'',60),image:image};
  }
  function result(header,items,totals,valid){
    return Object.freeze({number:header.number,title:header.title,client:header.client,currency:header.currency,
      items:Object.freeze(items.map(function(item){return Object.freeze(item);})),
      subtotal:totals.subtotal,discountPct:totals.discountPct,discount:totals.discount,iva:totals.iva,ivaRate:totals.ivaRate,
      includesIva:totals.includesIva,total:totals.total,valid:!!valid,warning:valid?'':WARNING});
  }
  function header(record,curr){return {number:text(first(record,['id','numero','nro'],''),80),title:text(record.tituloSolucion||'',180),client:text(record.cliente||record.clienteNombre||'',200),currency:curr};}
  function recordItems(record){
    var value=first(record,['items','productos','detalle','renglones'],[]),items=Array.isArray(value)?value.slice():Object.values(object(value));
    return items.map(function(item,index){return {item:object(item),index:index};}).sort(function(a,b){
      var x=Number(first(a.item,['orden','order','posicion'],0)),y=Number(first(b.item,['orden','order','posicion'],0));
      return (Number.isFinite(x)&&x>0?x:Number.MAX_SAFE_INTEGER)-(Number.isFinite(y)&&y>0?y:Number.MAX_SAFE_INTEGER)||a.index-b.index;
    }).map(function(entry){return entry.item;});
  }
  function fromRecord(record,products){
    record=object(record);var list=productsList(products),iva=includesIva(record),curr=currency(first(record,['moneda','currency'],''),true),valid=!!curr&&iva.valid;
    var items=recordItems(record).map(function(item){
      var qty=numeric(first(item,QUANTITY,null)),price=money(first(item,PRICE,null)),discount=percent(first(item,LINE_DISCOUNT,0)),subtotal=money(first(item,LINE_TOTAL,null)),photo=visual(item,list);
      if(qty===null||qty<=0||price===null||price<=0||discount===null||subtotal===null)valid=false;
      return {code:text(first(item,['cod','codigo','sku'],''),120),description:text(first(item,['descripcionPersonalizada','desc','descripcion','nombre','producto'],''),2000),quantity:qty!==null&&qty>0?qty:null,unit:photo.unit,unitPrice:price,discountPct:discount,subtotal:subtotal,image:photo.image};
    });
    var subtotal=money(record.subtotal),discountPct=percent(first(record,DISCOUNT,0)),discount=money(record.descuentoAmt),ivaAmount=money(record.iva),total=money(first(record,['total','totalPresupuesto','importeTotal'],null)),rate=iva.value?percent(first(record,['ivaPct','tasaIva','porcentajeIva'],21)):0;
    if(!items.length||items.some(function(item){return !item.description&&!item.code;})||[subtotal,discountPct,discount,ivaAmount,total,rate].some(function(n){return n===null;}))valid=false;
    var model=Budget.build({items:items.map(function(item){return {cod:item.code,desc:item.description,qty:item.quantity||0,punit:item.unitPrice||0,disc:item.discountPct||0,sub:item.subtotal};}),descuentoGeneral:discountPct||0,conIva:iva.value,ivaPct:rate||0});
    if(!model.ready||!finiteCalculation(items,model)||!sameMoney(subtotal,model.subtotal)||!sameMoney(discount,model.generalDiscount)||!sameMoney(ivaAmount,model.iva)||!sameMoney(total,model.total))valid=false;
    items.forEach(function(item,index){if(!sameMoney(item.subtotal,model.items[index].net))valid=false;});
    return result(header(record,curr),items,{subtotal:subtotal,discountPct:discountPct,discount:discount,iva:ivaAmount,ivaRate:rate,includesIva:iva.value,total:total},valid);
  }
  function placeholder(value){return !value||value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.…]/g,'').toLowerCase()==='selecciona un producto';}
  function fromDraft(draft,record,products){
    var data=object(object(draft).data),saved=object(record),fields=Object.create(null),list=productsList(products);
    (Array.isArray(data.fields)?data.fields:[]).forEach(function(field){if(field&&typeof field.id==='string')fields[field.id]=field.value;});
    function field(id,fallback){return Object.prototype.hasOwnProperty.call(fields,id)?fields[id]:fallback;}
    var curr=currency(data.currency,false),iva=typeof data.iva==='boolean'?{value:data.iva,valid:true}:includesIva(saved),discountPct=percent(field('pp-descuento',first(saved,DISCOUNT,0)),true),valid=!!curr&&iva.valid&&discountPct!==null;
    if(data.iva!==undefined&&typeof data.iva!=='boolean')valid=false;
    var items=(Array.isArray(data.rows)?data.rows:[]).map(function(row){
      row=object(row);var meta=object(row.data),code=text(row.cod,120),description=text(meta.descripcionPersonalizada||row.desc||'',2000),qty=numeric(row.qty,true),price=money(row.price,true),discount=percent(row.disc===''||row.disc==null?0:row.disc,true);
      if(!code&&placeholder(description)&&price===0&&(qty===1||qty===0||qty===null)&&discount===0)return null;
      if(!code&&placeholder(description)||qty===null||qty<=0||price===null||price<=0||discount===null)valid=false;
      var photo=visual({cod:code,productoFbKey:meta.productoFbKey,unidad:meta.unidad,imagenUrl:meta.imagenUrl},list);
      return {code:code,description:placeholder(description)?'':description,quantity:qty!==null&&qty>0?qty:null,unit:photo.unit,unitPrice:price,discountPct:discount,image:photo.image};
    }).filter(Boolean);
    if(!items.length)valid=false;
    var model=Budget.build({items:items.map(function(item){return {cod:item.code,desc:item.description,qty:item.quantity||0,punit:item.unitPrice||0,disc:item.discountPct||0};}),descuentoGeneral:discountPct||0,conIva:iva.value,ivaPct:21});
    if(!model.ready||!finiteCalculation(items,model))valid=false;
    items.forEach(function(item,index){item.subtotal=item.quantity!==null&&item.unitPrice!==null&&item.discountPct!==null&&Number.isFinite(model.items[index].net)?model.items[index].net:null;});
    var labels={number:text(field('pp-numero',first(saved,['id','numero','nro'],'')),80),title:text(field('pp-titulo-solucion',saved.tituloSolucion||''),180),client:text(field('pp-cli',saved.cliente||saved.clienteNombre||''),200),currency:curr};
    return result(labels,items,{subtotal:valid?model.subtotal:null,discountPct:discountPct,discount:valid?model.generalDiscount:null,iva:valid?model.iva:null,ivaRate:iva.value?21:0,includesIva:iva.value,total:valid?model.total:null},valid);
  }
  if(!Budget||typeof Budget.build!=='function')throw Error('No está disponible el cálculo de presupuestos');
  return Object.freeze({fromRecord:fromRecord,fromDraft:fromDraft});
});
