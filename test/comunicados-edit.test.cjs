const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const source=fs.readFileSync('js/app.v3.10.27.js','utf8');
function context(){const c={currentUserUid:'a',currentUserEmail:'',currentUser:'Admin',COMUNICADOS_LECTURAS:{},window:{},Object,String};vm.createContext(c);for(const name of ['_comunicadoKey','_comunicadoRolNormalizado','_comunicadoAplicaUsuario','_comunicadoEditable']){let start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);let body=source.slice(start,end<0?undefined:end);if(name==='_comunicadoAplicaUsuario')body=body.slice(0,body.indexOf('\nvar _comunicados')>=0?body.indexOf('\nvar _comunicados'):undefined);vm.runInContext(body,c);}return c;}
test('La confirmación automática del remitente permite editar; lectura real y apertura bloquean',()=>{const c=context();c.COMUNICADOS_LECTURAS.x={a:{remitente:true}};assert.equal(c._comunicadoEditable({fbKey:'x',activo:true}),true);assert.equal(c._comunicadoEditable({fbKey:'x',vistos:{b:123}}),false);c.COMUNICADOS_LECTURAS.x.b={leidoEn:123};assert.equal(c._comunicadoEditable({fbKey:'x'}),false);assert.equal(c._comunicadoEditable({fbKey:'y',activo:false}),false);});
test('Quitar un participante impide recibir el comunicado sin afectar otros usuarios',()=>{const c=context(),msg={destino:'todos',excluidos:{a:true}};assert.equal(c._comunicadoAplicaUsuario(msg,'admin'),false);assert.equal(c._comunicadoAplicaUsuario(msg,'tecnico',{fbKey:'b'}),true);assert.equal(c._comunicadoAplicaUsuario({destino:'tecnico'},'vendedor',{fbKey:'b'}),false);});

test('Los comunicados Global de SisVentas excluyen roles de Distribuidora',()=>{const c=context();for(const rol of ['distribuidora','compras_paraguay','Distribuidora']) assert.equal(c._comunicadoAplicaUsuario({destino:'todos'},rol,{fbKey:'b'}),false);for(const rol of ['admin','tecnico','administrativo','vendedor']) assert.equal(c._comunicadoAplicaUsuario({destino:'todos'},rol,{fbKey:'b'}),true);});

test('Guardar edición persiste texto y exclusión; una apertura concurrente impide guardar',async()=>{
 const c=context();const start=source.indexOf('async function enviarComunicadoGlobal()'),end=source.indexOf('\nfunction _comunicadoEsCreador',start);
 let saved={titulo:'Antes',activo:true},closed=false;
 c._comunicadoEditando={fbKey:'x'};
 c.document={getElementById:id=>({value:({'comunicado-titulo':'Después','comunicado-mensaje':'Mensaje nuevo','comunicado-destino':'todos'})[id]}),querySelectorAll:()=>[{checked:true,dataset:{comunicadoParticipante:'a'}},{checked:false,dataset:{comunicadoParticipante:'b'}}]};
 c.window={tienePermiso:()=>true,fbRef:(_,path)=>path,fbGet:async()=>({val:()=>({a:{remitente:true}})}),fbRunTransaction:async(_,update)=>{const next=update(saved);if(next)saved=next;return {committed:!!next};}};
 c.notify=()=>{};c.cerrarModalComunicado=()=>{closed=true;};
 vm.runInContext(source.slice(start,end),c);await c.enviarComunicadoGlobal();
 assert.equal(saved.titulo,'Después');assert.equal(saved.excluidos.b,true);assert.equal(saved.excluidos.a,undefined);assert.equal(closed,true);
 saved={titulo:'Antes',activo:true,vistos:{b:123}};closed=false;await c.enviarComunicadoGlobal();assert.equal(saved.titulo,'Antes');assert.equal(closed,false);
});
