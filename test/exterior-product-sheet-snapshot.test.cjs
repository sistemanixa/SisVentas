const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('la ficha de Ofertas usa el producto cargado aunque no exista en el catálogo general',()=>{
const source=fs.readFileSync('js/modules/paraguay-shopping-access.js','utf8');const code=source.match(/root.prodData=\[\.\.\.Object.values\(root.prodData\|\|\{\}\)[^;]+;/)[0];
for(const old of [undefined,[],[{fbKey:'otro',codigo:'P-1'}],[{fbKey:'nuevo',codigo:'ANTERIOR'}]]){const root={prodData:old},saved=old,c={root,key:'nuevo',products:{nuevo:{codigo:'P-62996',nombre:'Echo Dot'}}};vm.runInNewContext(code,c);const found=root.prodData.find(p=>p.fbKey==='nuevo');assert.equal(found.codigo,'P-62996');assert.equal(root.prodData.filter(p=>p.fbKey==='nuevo').length,1);root.prodData=saved;assert.equal(root.prodData,old);}
});
