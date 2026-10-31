const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('../js/modules/exterior-preparation');
function fixture(){
 const source=fs.readFileSync('js/modules/exterior-preparation.js','utf8'),start=source.indexOf('    function addExtra('),end=source.indexOf('    function extraResults(',start);
 let focused=0,renders=0,saves=0;const input={value:'consulta anterior',focus(){focused++;}},rows=[{code:'VENTA',qty:3}],d={rows,extras:[]};
 const c={owner:"fixture-user",currentLocalReference:api.currentLocalReference,busy:false,frozen:false,dirty:false,status:'',searchTerm:'consulta anterior',extraSequence:0,d,ctx:{catalog:[{key:'P',code:'P-3',description:'Producto ficticio',providers:[{proveedorKey:'S',nombre:'Proveedor ficticio',costo:294058,exterior:false}]}],save(){saves++;}},selectProvider:api.selectProvider,render(){renders++;},frame:{querySelector:()=>input},root:{notify(){}},Date:{now:()=>123}};
 vm.createContext(c);vm.runInContext(source.slice(start,end),c);return {c,d,rows,input,counts:()=>({focused,renders,saves})};
}
test('seleccionar agrega sólo a stock y devuelve el foco sin guardar ni alterar la venta',()=>{
 const t=fixture();assert.equal(t.c.addExtra('P'),true);assert.equal(t.d.rows,t.rows);assert.equal(t.rows.length,1);assert.equal(t.d.extras.length,1);assert.equal(t.d.extras[0].destination,'stock');assert.equal(t.d.extras[0].agreed,294058);assert.equal(t.d.extras[0].localReference.amount,294058);assert.equal(t.d.extras[0].localReference.capturedBy,'fixture-user');assert.equal(t.c.dirty,true);assert.equal(t.input.value,'');assert.equal(t.c.searchTerm,'');assert.deepEqual(t.counts(),{focused:1,renders:1,saves:0});
});
test('altas consecutivas en el mismo milisegundo tienen identidad propia sin fusionar cantidades',()=>{
 const t=fixture();t.c.addExtra('P');t.c.addExtra('P');assert.equal(t.d.extras.length,2);assert.notEqual(t.d.extras[0].key,t.d.extras[1].key);assert.ok(t.d.extras.every(r=>r.qty===1&&r.destination==='stock'));assert.deepEqual(t.counts(),{focused:2,renders:2,saves:0});
});
test('compra cerrada, guardado en curso o producto ausente no agregan ni guardan',()=>{
 for(const mode of ['frozen','busy','missing']){const t=fixture();if(mode!=='missing')t.c[mode]=true;t.c.addExtra(mode==='missing'?'absent':'P');assert.equal(t.d.extras.length,0);assert.equal(t.c.dirty,false);assert.deepEqual(t.counts(),{focused:0,renders:0,saves:0});}
});
