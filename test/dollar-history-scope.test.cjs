const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../js/core/dollar-history-scope.v1');
const chart=require('../js/modules/dolar-month-chart');

for(const [anchor,mode,start,end] of [
 ['2026-10-24','day','2026-10-24','2026-10-24'],
 ['2026-10-24','month','2026-10-01','2026-10-31'],
 ['2024-02-29','month','2024-02-01','2024-02-29'],
 ['2026-02-28','month','2026-02-01','2026-02-28'],
 ['2026-01-01','week','2025-12-29','2026-01-04'],
 ['2026-12-31','week','2026-12-28','2027-01-03'],
 ['2026-12-31','year','2026-01-01','2026-12-31'],
 ['2026-03-08','week','2026-03-02','2026-03-08'],
 ['2026-11-01','week','2026-10-26','2026-11-01']
])test('rango por clave '+anchor+' '+mode,()=>{
 const scope=model.create('period',anchor,mode);
 assert.equal(scope.start,start);assert.equal(scope.end,end);assert.equal(scope.signature,'period|'+start+'|'+end);assert.ok(Object.isFrozen(scope));
 const old=chart.period(anchor,mode);assert.equal(scope.start,old.start);assert.equal(scope.end,old.end);
});
for(const input of ['2026-2-03','2026-02-29','2026-02-30','2026-00-01','2026-13-01','2026-10-00','2026-10-32','0999-12-31','10000-01-01','20/10/2026','2026-10-24T00:00:00Z','2026-10-24 ','',null,12])test('no inventa clave equivalente '+String(input),()=>{
 assert.equal(model.validDate(input),false);assert.throws(()=>model.create('period',input,'month'));
});
for(const mode of ['','decade',null,{},'MONTH'])test('rechaza modo '+String(mode),()=>assert.throws(()=>model.create('period','2026-10-24',mode)));
test('Todo conserva la referencia, valores, formatos, claves numéricas, prototipo y orden exactos',()=>{
 const raw={2:{legacy:true},'2010-01-01':{a:{oficial:1234.56789,ts:1}},'2026-10-99':{z:{fecha:'2026-10-24',blue:'1500.01'}},legacy:{a:{mep:0}}};
 Object.defineProperty(raw,'__proto__',{value:{x:{oficial:700}},enumerable:true});
 const before=JSON.stringify(raw),scope=model.create('all',undefined,undefined);
 assert.equal(model.filter(raw,scope),raw);assert.equal(JSON.stringify(raw),before);assert.equal(scope.signature,'all');
 for(const x of [undefined,null,false,0,[],{foo:'bar'}])assert.equal(model.filter(x,scope),x);
});
test('rango incluye límites completos, excluye fechas no canónicas y conserva payload sin conversiones',()=>{
 const row={oficial:'1234.56789',fecha:'2010-01-01',hora:'cualquier texto',ts:2};
 const raw={'2026-09-30':{a:{}},'2026-10-01':{b:row},'2026-10-31':{c:{mep:0}},'2026-11-01':{},'2026-10-99':{},'2026-10-10T00:00:00Z':{},legacy:{}};
 const result=model.filter(raw,model.create('period','2026-10-24','month'));
 assert.deepEqual(Object.keys(result),['2026-10-01','2026-10-31']);assert.equal(result['2026-10-01'],raw['2026-10-01']);assert.equal(result['2026-10-01'].b,row);assert.equal(row.oficial,'1234.56789');
});
test('no modifica arrays dispersos ni interpreta índices como fechas',()=>{
 const raw=[];raw.length=100;raw[8]={};raw['2026-10-01']={x:{ts:1}};
 const result=model.filter(raw,model.create('period','2026-10-24','month'));
 assert.equal(result.length,100);assert.equal(8 in result,false);assert.equal(result['2026-10-01'],raw['2026-10-01']);assert.equal(raw[8]!==undefined,true);
});
test('350 puntos empatados permanecen completos y con su orden original',()=>{
 const day={};for(let i=0;i<350;i++)day['p'+i]={ts:1,oficial:1000+i/10};
 const raw={'2026-10-01':day},result=model.filter(raw,model.create('period','2026-10-24','month'));
 assert.equal(result['2026-10-01'],day);assert.deepEqual(Object.keys(result['2026-10-01']),Object.keys(day));
});
test('UMD publica la misma API en navegador sin red o DOM',()=>{
 const c={};vm.runInNewContext(fs.readFileSync('js/core/dollar-history-scope.v1.js','utf8'),c);
 assert.deepEqual(Object.keys(c.SVDollarHistoryScope),['create','filter','validDate']);assert.equal(c.SVDollarHistoryScope.create('period','2026-10-24','month').start,'2026-10-01');
});
test('week no permite salir de las claves YYYY-MM-DD soportadas',()=>{
 assert.throws(()=>model.create('period','1000-01-01','week'),RangeError);
 assert.throws(()=>model.create('period','9999-12-31','week'),RangeError);
});
