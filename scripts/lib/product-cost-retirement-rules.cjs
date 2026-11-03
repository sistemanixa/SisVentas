'use strict';
const assert=require('node:assert/strict');
function prepare(input){const out=structuredClone(input),product=out.rules?.sisventas?.productos?.$producto;assert.ok(product,'Falta la regla específica de productos');const field=product.costoRealArs;assert.ok(field&&typeof field['.validate']==='string','Revisar validador existente antes de sustituirlo');assert.ok(!field['.validate'].includes('data.exists() && newData.val() === data.val()'),'Protección ya aplicada');field['.validate']='('+field['.validate']+') && (data.exists() && newData.val() === data.val())';return out;}
module.exports={prepare};
