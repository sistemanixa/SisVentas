'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/data-readiness.js','utf8');
function fixture(options={}){
 const links=[],frames=[];const base=options.base||'https://fixture.invalid/sisventas/';
 if(options.existing)links.push({tagName:'LINK',rel:'stylesheet',href:options.existing});
 const head=options.head===false?null:{appendChild:node=>links.push(node)};
 const document={head,baseURI:base,currentScript:options.script===null?null:{src:options.script||'https://fixture.invalid/sisventas/js/core/data-readiness.js?v=3.13.0'},
  createElement:tag=>({tagName:tag.toUpperCase()}),querySelectorAll:()=>links.filter(node=>node.rel==='stylesheet'&&node.href),getElementById:id=>links.find(node=>node.id===id)||null,addEventListener(){}};
 const window={location:{href:base},addEventListener(){}};
 const c={URL,window,document,requestAnimationFrame:fn=>frames.push(fn)};vm.createContext(c);
 const run=()=>vm.runInContext(source,c);run();return{c,window,document,links,frames,run};
}
test('un índice antiguo recibe el CSS estático desde la raíz de activos o la base y un DOM sin head sigue funcionando',()=>{
 const fromScript=fixture({base:'https://fixture.invalid/sisventas/ventas/17'});assert.equal(fromScript.links.length,1);assert.equal(fromScript.links[0].rel,'stylesheet');assert.equal(fromScript.links[0].href,'https://fixture.invalid/sisventas/css/loading-status.css?v=3.13.1');
 const fromBase=fixture({script:null});assert.equal(fromBase.links[0].href,'https://fixture.invalid/sisventas/css/loading-status.css?v=3.13.1');
 const withoutHead=fixture({head:false});assert.equal(withoutHead.links.length,0);assert.equal(withoutHead.window.SVDataReadiness.status(['productos']).ready,false);
});
test('el índice nuevo conserva su enlace existente sin insertar otro ni cambiar la versión solicitada',()=>{
 const existing='./css/loading-status.css?v=3.13.1',f=fixture({existing});assert.equal(f.links.length,1);assert.equal(f.links[0].href,existing);assert.equal(f.links[0].id,undefined);
});
test('reentrar al módulo y volver a renderizar no duplica el enlace del fallback',()=>{
 const f=fixture();assert.equal(f.links.length,1);const link=f.links[0];f.window.SVDataReadiness.render();f.window.SVDataReadiness.render();f.run();f.window.SVDataReadiness.render();assert.equal(f.links.length,1);assert.equal(f.links[0],link);
});
