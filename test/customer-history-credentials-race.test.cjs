const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
test('una respuesta lenta de otro domicilio no reemplaza las credenciales del seleccionado',async()=>{
 const lista={innerHTML:''},resolve={};const c={_credClienteId:'r',_credClienteLegacyId:'r',_credCargaSecuencia:0,_credClientesGrupo:[],_clienteCategoriaSede:()=>'',credCerrarEditor(){},credEtiquetaDomicilio:o=>o.fbKey,CRED_TIPO_ICONOS:{},CRED_TIPO_LABELS:{},escapeHTML:v=>String(v||''),window:{fbDB:{},tienePermiso:()=>false},document:{getElementById:()=>lista},credGetGrupo:owner=>new Promise(r=>{resolve[owner.fbKey]=data=>r({owner,data});})};
 load(c,['credSetGrupo','credCargar']);c.credSetGrupo([{fbKey:'a'}]);c.credCargar();c.credSetGrupo([{fbKey:'b'}]);c.credCargar();
 resolve.b({actual:{desc:'ACTUAL'}});await new Promise(setImmediate);assert.match(lista.innerHTML,/ACTUAL/);
 resolve.a({anterior:{desc:'ANTERIOR'}});await new Promise(setImmediate);assert.match(lista.innerHTML,/ACTUAL/);assert.doesNotMatch(lista.innerHTML,/ANTERIOR/);
});
