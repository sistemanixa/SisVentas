'use strict';
// Offline composition only. The published immutable application is never edited.
const {prepare}=require('./ot-delete-ui-precheck.cjs');
const {validate}=require('./office-stock-positive-frontend.cjs');
const FROM='v3.20.0',TO='v3.20.1';
function once(text,before,after){if(text.split(before).length!==2)throw Error('La base pública no coincide: '+before);return text.replace(before,after);}
function plan(base,financialCommands){
 if(!(base instanceof Map)||!Buffer.isBuffer(financialCommands))throw Error('Fuentes públicas requeridas');
 validate(base,FROM);const assets=new Map([...base].map(([p,b])=>[p,Buffer.from(b)]));
 if(assets.has('js/app.'+TO+'.js'))throw Error('La versión de destino ya existe');
 let index=assets.get('index.html').toString(),sw=assets.get('sw.js').toString();
 for(const [before,after]of [['./js/app.'+FROM+'.js','./js/app.'+TO+'.js'],['./js/core/version.'+FROM+'.js','./js/core/version.'+TO+'.js'],['./js/core/financial-commands.js?v=3.19.0','./js/core/financial-commands.js?v=3.20.1'],['./js/modules/office-stock.js?v=3.20.0','./js/modules/office-stock.js?v=3.20.1']]){index=once(index,before,after);sw=once(sw,before,after);}
 index=once(index,"VERSION: '"+FROM+"-firebase'","VERSION: '"+TO+"-firebase'");
 sw=once(sw,"const CACHE = 'sisventas-"+FROM+"';","const CACHE = 'sisventas-"+TO+"';");
 let app=prepare(assets.get('js/app.'+FROM+'.js').toString());
 app=once(app,"VERSION: '"+FROM+"-firebase'","VERSION: '"+TO+"-firebase'");
 app=once(app," Object.freeze({version:'"+FROM+"'"," Object.freeze({version:'"+TO+"',date:'09/11/2026',title:'Eliminación de OT',notes:Object.freeze(['La eliminación comprueba disponibilidad y permisos antes de confirmar.','Las órdenes sin actividad se eliminan conservando su venta y sus importes.'])}),\n Object.freeze({version:'"+FROM+"'");
 const core=once(assets.get('js/core/version.js').toString(),"SISVENTAS_PWA_VERSION = '"+FROM+"'","SISVENTAS_PWA_VERSION = '"+TO+"'");
 for(const[p,b]of [['index.html',index],['sw.js',sw],['js/app.'+TO+'.js',app],['js/core/version.'+TO+'.js',core],['js/core/version.js',core]])assets.set(p,Buffer.from(b));
 assets.set('js/core/financial-commands.js',Buffer.from(financialCommands));validate(assets,TO);
 return assets;
}
module.exports={plan,FROM,TO};
