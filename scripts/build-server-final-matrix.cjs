'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {audit}=require('./audit-server-inventory-current.cjs');
function build(root,{runtimeDir}={}){
 const inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/OPTIMIZACION_SERVIDOR_20261125.json'),'utf8'));
 const diagnostic=audit(root,{runtimeDir}),read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const dirty=execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8'}).trim().length>0;
 const groupEvidence=Object.fromEntries(Object.entries(inventory.groups).map(([group,policy])=>[group,{authority:policy.auth,reads:policy.reads,modules:policy.modules.map(file=>{
  if(!fs.existsSync(path.join(root,file)))return {file,present:false};
  const source=read(file),lines=source.split(/\r?\n/),index=lines.findIndex(s=>/(?:function\s+create\w*\s*\(|async function authorize\(|function project\(|function create\()/.test(s));
  return {file,present:true,sha256:crypto.createHash('sha256').update(source).digest('hex'),anchor:index<0?null:{line:index+1,text:lines[index].trim().slice(0,180)},runtimeComparison:diagnostic.runtime.find(r=>r.file===file)?.equal??'not-recovered'};
 })}]));
 const measured={
  '/usuarios/directorio':'HTTP ficticio antes5transportes/30595B vs después2/12632B en recorrido mixto de proyecciones; scripts/measure-user-directory-reads.cjs. No equivale a medición aislada de esta ruta.',
  '/usuarios/administracion':'Mismo recorrido mixto medido; proyección administrativa separada. scripts/measure-user-directory-reads.cjs.',
  '/usuarios/perfil':'Dos preparaciones concurrentes1GET; siguiente preparación1GET nuevo. Ya deduplicado; sin ahorro nuevo.',
  '/laboral/directorio':'1GET/7reads/2252B, o vínculo faltante3HTTP/23reads/1tx/2409B;40empleados ficticios. scripts/measure-labor-directory.cjs.',
  '/laboral/vinculo-propio':'POST explícito sólo tras409; incluido en recorrido3HTTP/23reads/1tx. No convertir GET en escritura.',
  '/compras/proveedores':'1GET/6reads/5247B;40proveedores ficticios. Revalidación posterior a authorize rechaza revocación: test/supplier-directory.test.cjs.',
  '/laboral/escritura':'Nota vigente438B,0SDKcliente,1commit; OTpadre200183B. scripts/measure-note-command.cjs; fuente guard distinta del snapshot remoto.',
  '/laboral/operacion':'Consulta explícita105B confirma recibo de nota sin nuevo commit; mismo fixture. No reenvía escritura de negocio.',
  '/laboral/capacidades':'Fixtures financieros: reutilización por contexto y cambio de revisión/sesión. test/financial-commands.test.cjs. Sin medición HTTP de producción.'
 };
 const action=(route,group)=>{
  if(group==='media')return 'Firebase directo únicamente para URL autorizada del bucket propio; proveedores externos conservan proxy. Ya integrado/publicado por coordinador; no ahorro nuevo.';
  if(['/usuarios/directorio','/usuarios/administracion'].includes(route))return 'Aplicar49583380: compartir únicamente transporte en vuelo por identidad/contexto, sin caché posterior ni mezcla de proyecciones. Coordinador importa4archivos excluyendo CONTEXTO.';
  if(route==='/laboral/escritura')return 'Candidato backend: reducir lectura del padre sólo con prueba de campos requeridos por summaries/autoridad. No implementado; Guard/Store del coordinador. Mantener original hasta prueba.';
  if(route==='/compras/proveedores')return 'Mantener las dos comprobaciones actuales de rol/permisos: prueba de revocación entre authorize/read impide eliminar la segunda sin contrato equivalente.';
  if(group==='stockot')return 'Dominio excluido deC; E/root implementan ahorro de resolución/lecturas en commits propios. No atribuirlos a esta matriz ni activar cohorte parcial.';
  if(route==='/usuarios/perfil')return 'Sin cambio: preparación compartida ya vigente; ingreso posterior vuelve a validar.';
  if(group==='quoting')return 'Mantener servidor externo/secretos; usar cotizar-lote cuando la acción ya es una tanda. No crear polling ni cachear entradas distintas.';
  return 'Mantener contrato actual: esta revisión no acredita traslado SDK ni ahorro adicional. Sin nueva escritura, caché de autoridad o cambio de permisos.';
 };
 const routerLines=read('cotizador/index.js').split(/\r?\n/);
 const routeAnchor=route=>{const escaped=route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),token=new RegExp('([\x22\x27])'+escaped+'\\1');const index=routerLines.findIndex(line=>token.test(line)&&(route!=='/'||/pathname|requestUrl|req\.url/.test(line)));return index<0?null:{file:'cotizador/index.js',line:index+1,text:routerLines[index].trim().slice(0,200)};};
 const routes=inventory.routes.map((r,i)=>({id:'R'+String(i+1).padStart(3,'0'),method:r.method,route:r.route,group:r.group,routerEvidence:routeAnchor(r.route),
  decision:r.group==='media'?'direccion-firebase-condicional':r.route==='/laboral/escritura'?'optimizable-backend-con-prueba':'mantener-servidor',
  function:inventory.groups[r.group].auth,evidenceGroup:r.group,measurement:measured[r.route]||'No medida: evidencia de función/autoridad en fuente; no atribuir llamadas, bytes o latencia.',
  callers:diagnostic.routes.find(x=>x.route===r.route).callers,action:action(r.route,r.group),runtime:'No verificado contra revisión nueva; comparación opcional sólo con snapshot6b6276dd, no con runtime actual.'}));
 const otherServices=inventory.otherServices.map((r,i)=>({...r,id:'X'+String(i+1).padStart(3,'0'),decision:'mantener-servidor',historicalDecision:r.decision,evidence:fs.existsSync(path.join(root,r.source||''))&&r.source?{file:r.source,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,r.source))).digest('hex')}:null,measurement:'No medida: no se ejecutaron servicios externos, IA, fiscales, correo ni eventos.',runtime:r.runtimeStatus||'No verificado; entrada inventariada no implica servicio habilitado.'}));
 if(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()!==head)throw Error('La fuente cambió durante el diagnóstico: repetir sobre checkout estable');
 return {schema:1,source:{head,trackedChangesPresent:dirty,app:diagnostic.activeApp,historicalInventoryCommit:inventory.sourceCommit},limits:'Matriz funcional completa del inventario histórico90rutas/91métodos+28entradas. No es medición completa ni prueba de despliegue. Sin acceso remoto; no acredita nuevas rutas de routers posteriores.',diagnostic:diagnostic.summary,groupEvidence,routes,otherServices,commandFamilies:inventory.commands,runtimeSnapshot:diagnostic.runtime};
}
function markdown(result){
 const safe=s=>String(s??'').replace(/\|/g,'/').replace(/\r?\n/g,' '),rows=[];
 rows.push('# Matriz final de funciones servidor · 25/11/2026','',`Fuente HEAD ${result.source.head}; aplicación ${result.source.app}; cambios tracked presentes: ${result.source.trackedChangesPresent}.`,'',result.limits,'',
  '## Decisiones y acciones concretas','',
  '- Directorio de usuarios:49583380 reduce recorrido concurrente5→2HTTP y30595→12632B, conservando autoridad servidor. Coordinador lo integra en tanda16; esta matriz no acredita esa publicación.',
  '- Medio propio Firebase: descarga autorizada directa ya implementada/publicada por coordinador; proxy permanece para proveedores. No se cuenta otra vez como ahorro nuevo.',
  '- Nota estrecha ya vigente:438B y0SDKcliente; candidato backend padre200183B comunicado aGuard/Store. **No quitar original sin prueba de summaries/autoridad.**',
  '- Perfil y directorio laboral ya deduplican solicitudes; no hay parche adicional. Proveedores conserva revalidación por prueba concreta de revocación entreetapas.',
  '- Stock/OT/Compras quedan bajo sus dueños. La tanda/backend nuevos anunciados por coordinador no se declaran iguales al snapshot anterior6b6276dd.','',
  '## Evidencia funcional de fuente por familia','',
  '| Familia | Autoridad/función necesaria | Anclas exactas de módulos |','|---|---|---|');
 for(const [name,e]of Object.entries(result.groupEvidence))rows.push(`| ${name} | ${safe(e.authority)} | ${e.modules.map(m=>m.anchor?`[${m.file}:${m.anchor.line}](../${m.file}#L${m.anchor.line})`:`${m.file}:sin ancla`).join('; ')} |`);
 rows.push('','SHA256 de cada módulo y texto de las anclas están en el JSON. Son evidencia de fuente, no pruebas de equivalencia de reglas ni latencia.','',
  '## Matriz por ruta y función','',
  '| ID | Método/ruta | Función | Decisión | Medición / evidencia | Acción |','|---|---|---|---|---|---|');
 for(const r of result.routes)rows.push(`| ${r.id} | ${safe(r.method)} ${r.route} | ${r.group} | ${r.decision} | ${r.routerEvidence?`Router ${r.routerEvidence.file}:${r.routerEvidence.line}. `:'Ruta dinámica: anclas de familia. '}${safe(r.measurement)} | ${safe(r.action)} |`);
 rows.push('','## Otras entradas, servicios y eventos','',
  '| ID | Servicio / operación | Fuente | Decisión y límite |','|---|---|---|---|');
 for(const r of result.otherServices)rows.push(`| ${r.id} | ${safe(r.service)} ${safe(r.method)} ${safe(r.route||r.action)} | ${safe(r.source)} | Mantener servidor: ${safe(r.historicalDecision)}. ${safe(r.runtime)} |`);
 rows.push('','## Funciones dentro de rutas genéricas','',
  'No se ocultan comandos bajo un único POST: cada tipo/propósito listado conserva su validación, original/CAS y autoridad de dominio. Decisión mantener servidor para todos los siguientes; no fueron medidos individualmente en este bloque.','',
  '| Familia | Tipos / propósitos |','|---|---|');
 for(const [name,values]of Object.entries(result.commandFamilies))rows.push(`| ${name} | ${safe(Array.isArray(values)?values.join('; '):JSON.stringify(values))} |`);
 rows.push('','## Repositorio frente a snapshot remoto','',
  'No hubo consulta remota desde este frente. La revisión nueva anunciada por root no se infiere a partir de archivos antiguos. Con snapshot opcional6b6276dd:','',
  '| Módulo | Igualdad exacta | SHA repositorio | SHA snapshot |','|---|---|---|---|');
 for(const r of result.runtimeSnapshot)rows.push(`| ${r.file} | ${r.equal?'Sí':'No'} | ${r.sourceHash} | ${r.runtimeHash} |`);
 rows.push('','## Límites y reproducción','',
  'Generar con `node scripts/build-server-final-matrix.cjs [checkout-fuente] [snapshot-opcional]`; JSON y Markdown se escriben únicamente en docs del checkout de esta herramienta. No modifica el checkout fuente ni shared. El diagnóstico invalida slashgenérico como prueba de llamada y marca inferencias dinámicas/carga no demostrada.','',
  'No se adjudican métricas a rutas no ejecutadas. Financiera/privada/fiscal/secretos permanecen en servidor por la función indicada; no se migran por nombre del botón. Ni inventario ni tests locales acreditan despliegue, reglas remotas o SDK autorizado. La autorización/readiness/sesión/CAS actuales se conservan.');
 return rows.join('\n')+'\n';
}
module.exports={build,markdown};
if(require.main===module){const root=path.resolve(process.argv[2]||path.join(__dirname,'..')),runtimeDir=process.argv[3],result=build(root,{runtimeDir});const target=path.join(__dirname,'../docs/SERVIDOR_MATRIZ_FINAL_20261125');fs.writeFileSync(target+'.json',JSON.stringify(result,null,2)+'\n');fs.writeFileSync(target+'.md',markdown(result));console.log(JSON.stringify({source:result.source,routes:result.routes.length,otherServices:result.otherServices.length,decisions:result.routes.reduce((a,r)=>(a[r.decision]=(a[r.decision]||0)+1,a),{})}));}
