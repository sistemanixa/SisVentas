module.exports=function(){
 const date={'.validate':'newData.isNumber() && newData.val() > 0 && newData.val() <= now + 300000 && (!data.exists() || newData.val() === data.val())'};
 return {creadoEn:date,fechasProductos:{'$producto':{'.validate':"newData.parent().parent().child('productos').child($producto).exists()",agregadoEn:date,compradoEn:date,'$otro':{'.validate':false}}}};
};
