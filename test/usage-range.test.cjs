const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const src=require('fs').readFileSync('js/modules/usage-metrics.js','utf8');
test('métricas consulta rango y descarta respuestas anteriores o de otra sesión',async()=>{
 const calls=[],renders=[];const c={currentUserUid:'a',_usoUsuariosCargando:false,document:{getElementById:()=>null},renderMetricasUsoUsuarios:(data,p)=>renders.push(p),window:{fbDB:{},fbRef:(_,path)=>path,fbOrderByKey:()=> 'key',fbStartAt:x=>({start:x}),fbEndAt:x=>({end:x}),fbQuery:(...args)=>args,fbGet:q=>new Promise(resolve=>calls.push({q,resolve}))}};
 vm.createContext(c);vm.runInContext(src.slice(src.indexOf('var _usoUsuariosSolicitud ='),src.indexOf('window.SVUsageMetrics =')),c);
 const first=c.cargarMetricasUsoUsuarios('30'),second=c.cargarMetricasUsoUsuarios('hoy');
 assert.equal(calls[1].q[2].start,calls[1].q[3].end);assert(calls[0].q[2].start<calls[1].q[2].start);
 calls[1].resolve({val:()=>({})});await second;calls[0].resolve({val:()=>({})});await first;assert.deepEqual(renders,['hoy']);
 const third=c.cargarMetricasUsoUsuarios('7');c.currentUserUid='b';calls[2].resolve({val:()=>({})});await third;assert.deepEqual(renders,['hoy']);
});
