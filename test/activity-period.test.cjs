'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const M=require('../js/core/activity-period.v1.js');
test('defaults to 30 local calendar days and exposes an inclusive UI end date',()=>{
 const result=M.create(undefined,'2026-10-24');
 assert.equal(result.mode,'30d');assert.equal(result.fromLocal,'2026-09-25');assert.equal(result.toLocal,'2026-10-24');assert.equal(Object.isFrozen(result),true);
 assert.equal(new Date(result.fromInclusive).getHours(),0);assert.equal(new Date(result.toExclusive).getHours(),0);
 assert.equal(new Date(result.toExclusive).getDate(),25);
});
for(const [today,from]of [['2027-01-01','2026-12-03'],['2026-03-01','2026-01-31'],['2024-03-01','2024-02-01'],['2024-02-29','2024-01-31'],['2026-05-31','2026-05-02']])test('calendar rollover '+today,()=>{
 const result=M.create('30d',today);assert.equal(result.fromLocal,from);assert.equal(result.toLocal,today);
});
test('Date input uses its local calendar date without changing the input',()=>{
 const date=new Date(2026,9,24,23,59,59,123),before=date.getTime(),result=M.create('30d',date);
 assert.equal(result.toLocal,'2026-10-24');assert.equal(date.getTime(),before);
 assert.deepEqual(result,M.create('30d','2026-10-24'));
});
for(const value of ['','2026-02-29','2024-02-30','2026-04-31','2026-00-03','2026-13-01','2026-1-01','2026-10-24T00:00:00Z','0001-01-01',null,42,{},new Date(NaN)])test('rejects invalid local day '+String(value),()=>assert.throws(()=>M.create('30d',value)));
for(const mode of ['',null,'7d','all-time',0,{}])test('rejects unknown mode '+String(mode),()=>assert.throws(()=>M.create(mode,'2026-10-24')));
test('all is explicit, has no range and does not read an irrelevant clock',()=>{
 assert.deepEqual(M.create('all',new Date(NaN)),{mode:'all',fromInclusive:null,toExclusive:null,fromLocal:null,toLocal:null});
});
const zones=[
 ['America/Argentina/Buenos_Aires','2026-10-24','2026-09-25T03:00:00.000Z','2026-10-25T03:00:00.000Z',720],
 ['UTC','2026-10-24','2026-09-25T00:00:00.000Z','2026-10-25T00:00:00.000Z',720],
 ['America/New_York','2026-03-15','2026-02-14T05:00:00.000Z','2026-03-16T04:00:00.000Z',719],
 ['America/New_York','2026-11-15','2026-10-17T04:00:00.000Z','2026-11-16T05:00:00.000Z',721],
 ['Pacific/Kiritimati','2026-10-24','2026-09-24T10:00:00.000Z','2026-10-24T10:00:00.000Z',720]
];
for(const [zone,today,from,until,hours]of zones)test('local midnight endpoints in '+zone+' at '+today,()=>{
 const code='const M=require('+JSON.stringify(path.resolve(__dirname,'../js/core/activity-period.v1.js'))+');process.stdout.write(JSON.stringify(M.create("30d",'+JSON.stringify(today)+')));';
 const result=JSON.parse(execFileSync(process.execPath,['-e',code],{env:{...process.env,TZ:zone},encoding:'utf8'}));
 assert.equal(result.fromInclusive,from);assert.equal(result.toExclusive,until);assert.equal((Date.parse(until)-Date.parse(from))/3600000,hours);assert.equal(result.toLocal,today);
});
test('canonical date format requires a real UTC calendar date with milliseconds',()=>{
 for(const value of ['2026-10-24T00:00:00.000Z','2024-02-29T23:59:59.999Z'])assert.equal(M.isCanonicalFecha(value),true);
 for(const value of ['2026-10-24','2026-10-24T00:00:00Z','2026-10-24T00:00:00.000+00:00','2026-10-24T03:00:00.000-03:00','2026-02-29T00:00:00.000Z','2026-10-24T24:00:00.000Z','2026-13-01T00:00:00.000Z',42,null,{},new Date()])assert.equal(M.isCanonicalFecha(value),false,String(value));
});
test('range includes its start, excludes next midnight and retains record references',()=>{
 const period=M.create('30d','2026-10-24'),start=period.fromInclusive,end=period.toExclusive;
 const before=new Date(Date.parse(start)-1).toISOString(),last=new Date(Date.parse(end)-1).toISOString();
 const data={before:{fecha:before},start:{fecha:start},last:{fecha:last},end:{fecha:end},future:{fecha:new Date(Date.parse(end)+1).toISOString()},dateOnly:{fecha:'2026-10-24'},offset:{fecha:'2026-10-24T00:00:00.000-03:00'},missing:{},invalid:{fecha:'bad'},empty:null};
 const selected=M.filter(data,period);assert.deepEqual(Object.keys(selected),['start','last']);assert.equal(selected.start,data.start);assert.equal(selected.last,data.last);assert.equal(Object.keys(data).length,10);
});
test('does not sort, cap or break timestamp ties and numeric object keys',()=>{
 const period=M.create('30d','2026-10-24'),data={};
 ['10','2','later','first'].forEach(key=>data[key]={fecha:period.fromInclusive,key});
 for(let i=0;i<350;i++)data['t'+i]={fecha:period.fromInclusive};
 assert.deepEqual(Object.keys(M.filter(data,period)),Object.keys(data));assert.equal(Object.keys(M.filter(data,period)).length,354);
});
test('sparse arrays preserve indexes, length, holes and object identity',()=>{
 const period=M.create('30d','2026-10-24'),data=new Array(12);data[2]={fecha:period.fromInclusive};data[7]={fecha:'legacy'};data[10]={fecha:period.fromInclusive};
 const result=M.filter(data,period);assert.equal(Array.isArray(result),true);assert.equal(result.length,12);assert.deepEqual(Object.keys(result),['2','10']);assert.equal(result[2],data[2]);assert.equal(7 in result,false);
});
test('legacy prototype-looking keys remain data without changing the result prototype',()=>{
 const period=M.create('30d','2026-10-24'),data=JSON.parse('{"__proto__":{"fecha":"'+period.fromInclusive+'"},"constructor":{"fecha":"'+period.fromInclusive+'"}}');
 const result=M.filter(data,period);assert.deepEqual(Object.keys(result),['__proto__','constructor']);assert.equal(Object.getPrototypeOf(result),Object.prototype);assert.equal(result.__proto__,data.__proto__);
});
test('all preserves exact legacy inputs and enumeration without coercing or cloning',()=>{
 const period=M.create('all');
 for(const data of [{2:{fecha:'legacy'},10:null,a:{fecha:42}},[null,{fecha:''}],null,undefined,42,'legacy'])assert.equal(M.filter(data,period),data);
});
test('range distinguishes absent collections from malformed collections or periods',()=>{
 const period=M.create('30d','2026-10-24');assert.equal(M.filter(null,period),null);assert.equal(M.filter(undefined,period),undefined);
 for(const data of [42,'bad',true])assert.throws(()=>M.filter(data,period),/historial/);
 for(const p of [null,{},M.create('all').mode,{...period,fromInclusive:'bad'},{...period,toExclusive:period.fromInclusive}])assert.throws(()=>M.filter({},p),/Período/);
});
test('browser UMD exports the same pure API without DOM, transport or timers',()=>{
 const window={},context={window,Object,Date,Number,String,Error};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../js/core/activity-period.v1.js'),'utf8'),context);
 assert.deepEqual(Object.keys(window.SVActivityPeriod),Object.keys(M));assert.equal(window.SVActivityPeriod.create('30d','2026-10-24').fromLocal,'2026-09-25');
});
