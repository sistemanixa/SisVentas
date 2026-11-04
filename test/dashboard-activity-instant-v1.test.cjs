'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),fs=require('node:fs'),vm=require('node:vm');
const Helper=require('../js/core/dashboard-activity-instant.v1');
const zones=['America/Argentina/Buenos_Aires','UTC','America/Havana','America/Sao_Paulo','Pacific/Apia','Asia/Kathmandu'];
const cases=[['2026-11-04',0],['2026-11-04','0'],['2026-11-04','bad'],['2026-11-04','1e3'],['2026-11-04',true],['2026-11-04',-0.25],['2026-11-04',-1],['2026-11-04',1.5],['2026-11-04','Infinity'],['2026-11-04','-Infinity'],['31/02/2026',null],['4/11/26',null],['0001-01-01',null],['0099-01-01',null],['0000-00-00',null],['1/1/0001',null],['1/1/100',null],['2008-10-19',null],['2018-11-04',null],['2020-11-01',null],['2020-03-08',null],['2011-12-30',null],['1986-01-01',null],[' 2026-11-04',null],['2026-1-04',null],['unknown',null],['9999-99-99',null],['2026-11-04T19:05:00Z',null],['4/11/26extra',null],['99/99/9999',null],['2026-11-04',false],['2026-11-04',''],[null,null]];
function child(tz,script){const result=spawnSync(process.execPath,['-e',script],{cwd:__dirname,env:{...process.env,TZ:tz},encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);}
function values(module,zone){return `const Core=require(${JSON.stringify(module)}),cases=${JSON.stringify(cases)};process.stdout.write(JSON.stringify(cases.map(([f,ts])=>String(Core.legacyMs(f,ts,${JSON.stringify(zone)})))));`;}
for(const zone of zones)test('explicit midnight matches legacy Date in '+zone+' independently of host TZ',()=>{
 const expected=child(zone,values('../js/core/dashboard-activity-model.v2',zone));
 for(const host of ['UTC','America/Argentina/Buenos_Aires'])assert.deepEqual(child(host,values('../js/core/dashboard-activity-instant.v1',zone)),expected,host);
});
test('overlap chooses earlier instant and missing midnight/date advances by actual gap',()=>{
 assert.equal(Helper.legacyMs('2020-11-01',null,'America/Havana'),Date.parse('2020-11-01T04:00:00Z'));
 assert.equal(Helper.legacyMs('2018-11-04',null,'America/Sao_Paulo'),Date.parse('2018-11-04T03:00:00Z'));
 assert.equal(Helper.legacyMs('2011-12-30',null,'Pacific/Apia'),Date.parse('2011-12-30T10:00:00Z'));
 assert.equal(Helper.legacyMs('1986-01-01',null,'Asia/Kathmandu'),Date.parse('1985-12-31T18:30:00Z'));
});
test('zone is explicit and validated even when timestamp wins or date is empty',()=>{
 for(const zone of [undefined,null,'','bad/zone','+03:00',3,{}])for(const ts of [0,1])assert.throws(()=>Helper.legacyMs('',ts,zone),RangeError);
 assert.equal(Helper.canonicalZone('utc'),'UTC');
 const canonical=Helper.canonicalZone('America/Argentina/Buenos_Aires');assert.equal(Helper.canonicalZone(canonical),canonical);
 assert.equal(Helper.legacyMs('',Infinity,'UTC'),Infinity);assert.equal(Helper.legacyMs('',NaN,'UTC'),0);assert(Object.is(Helper.legacyMs('',-0,'UTC'),0));
});
test('UMD browser export is synchronous and leaves ambient TZ untouched',()=>{
 const before=process.env.TZ,context={Intl,Date};vm.runInNewContext(fs.readFileSync(require.resolve('../js/core/dashboard-activity-instant.v1'),'utf8'),context);
 assert.equal(context.SVDashboardActivityInstantV1.legacyMs('2026-11-04',0,'UTC'),Date.UTC(2026,10,4));assert.equal(process.env.TZ,before);assert(Object.isFrozen(context.SVDashboardActivityInstantV1));
});
