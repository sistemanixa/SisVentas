const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const current=fs.readFileSync('js/modules/usage-metrics.js','utf8'),previous=fs.readFileSync('js/app.v3.9.30.js','utf8');
function run(source,users,data){const elements={};const c={window:{usuariosData:users},document:{getElementById:id=>elements[id]||(elements[id]={})},escapeHTML:String};vm.createContext(c);const start=source.indexOf('function formatearDuracionUso(');const cut=source.includes('var _usoUsuariosSolicitud =')?source.indexOf('var _usoUsuariosSolicitud ='):source.indexOf('function cargarMetricasUsoUsuarios(');vm.runInContext(source.slice(start,cut),c);c.renderMetricasUsoUsuarios(data,'30');return elements;}
test('informe indexado conserva nombres, prioridades, totales y HTML del informe anterior',()=>{
 const users=Array.from({length:1000},(_,i)=>({uid:'u'+i,mail:'mail'+i+'@x',nombre:'Nombre '+i}));users.push({uid:'u0',mail:'duplicado@x',nombre:'Duplicado'});
 const now=new Date(),day=now.getFullYear()+'_'+String(now.getMonth()+1).padStart(2,'0')+'_'+String(now.getDate()).padStart(2,'0');const data={[day]:{}};
 for(let i=0;i<1000;i++)data[day]['u'+i]={sesion:{email:'MAIL'+(999-i)+'@x',uid:'u'+i,activoMs:60000*(i+1),inactivoMs:30000}};
 data[day].desconocido={s:{nombre:'Histórico',activoMs:1}};
 const before=run(previous,users,data),after=run(current,users,data);assert.deepEqual(after,before);
});
