(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else {root.SVDollarRefresh=factory(root);root.SVDollarRefresh.install();}
})(typeof window==='object'?window:null,function(root){
 'use strict';
 const PERIOD=3*60*60*1000,LEASE=120000,PATH='sisventas/config/tipoCambio';
 let timer=null,pending=null,controller=null,retryAt=0,installed=false,stopped=false,lastError='';
 const now=()=>root.Date?.now?.()??Date.now();
 const automatic=c=>c?.actualizacionAuto==='hora'; // Existing saved option now means three hours.
 const last=c=>Math.max(Number(c?.actualizadoApiEn)||0,Number(c?.actualizadoManualEn)||0);
 function identity(){return {user:root.fbAuth?.currentUser,uid:root.currentUserUid,role:root.currentRole,revision:root.PERMISOS_ROLES?.[root.currentRole]?.indiceRevision};}
 function same(c){return !stopped&&!!c.user&&root.fbAuth?.currentUser===c.user&&root.currentUserUid===c.uid&&c.user.uid===c.uid&&root.currentRole===c.role&&root.PERMISOS_ROLES?.[c.role]?.indiceRevision===c.revision&&!root._impersonacionOriginal&&root.tienePermiso?.('configuracion.editar')===true;}
 function visible(){return root.document.hidden!==true&&root.document.visibilityState!=='hidden'&&root.SVForegroundSession?.isVisible?.()!==false;}
 function allowed(){return !stopped&&visible()&&same(identity())&&!!root.fbDB&&typeof root.SVGuardedWrites?.restTransaction==='function';}
 function clear(){if(timer!==null)root.clearTimeout(timer);timer=null;}
 function plan(cfg=root.TIPO_CAMBIO_CONFIG){
  clear();if(!allowed()||!automatic(cfg))return;
  const due=Math.max(last(cfg)+PERIOD,Number(cfg?.autoActualizacion?.hasta)||0,retryAt);
  timer=root.setTimeout(()=>{timer=null;refresh(false,true);},Math.max(1,due-now()));
 }
 function reconcile(){if(!allowed()){clear();if(!visible())controller?.abort();return;}if(!pending)plan();}
 const transact=async update=>{
  let observed;const result=await root.SVGuardedWrites.restTransaction(root.fbRef(root.fbDB,PATH),current=>{observed=current;return update(current);});
  return {committed:result.committed,snapshot:{val:()=>result.committed?result.value:observed}};
 };
 function decode(data){
  if(!Array.isArray(data))throw Error('Respuesta de cotización inválida');
  const result={};for(const [key,casa]of [['oficial','oficial'],['blue','blue'],['mep','bolsa']]){
   const matches=data.filter(d=>d?.casa===casa),value=Number(matches[0]?.venta);
   if(matches.length!==1||!Number.isFinite(value)||value<=0)throw Error('Cotización incompleta');result[key]=Math.round(value);
  }
  result.fuenteFecha=String(data.find(d=>d.casa==='oficial').fechaActualizacion||'');return result;
 }
 function paint(cfg,before,force){
  root.TIPO_CAMBIO_CONFIG=cfg;root.actualizarDolarDashboard?.();
  for(const key of ['oficial','blue','mep']){const el=root.document.getElementById('cfg-dolar-'+key);if(el&&(force||String(el.value)===String(before[key])))el.value=cfg[key];}
  const label=root.document.getElementById('cfg-tc-actualizado');if(label)label.textContent='Actualizado '+new Date(cfg.actualizadoApiEn).toLocaleString('es-AR');
 }
 function refresh(force=false,silent=false){
  if(pending)return pending;
  if(!allowed()){if(!silent)root.notify?.('No se puede actualizar la cotización en esta sesión');return Promise.resolve(false);}
  const context=identity(),token=String(context.uid)+'_'+now()+'_'+Math.random().toString(36).slice(2),button=root.document.getElementById('btn-actualizar-dolar');
  if(button&&!silent){button.disabled=true;button.setAttribute?.('aria-busy','true');}
  const work=async()=>{
   let claimed=false,timeout=null;
   try{
    const claim=await transact(current=>{
     if(!same(context)||!visible())return;if(!current)throw Error('No se encontró la configuración del dólar');if(!force&&!automatic(current))return;
     if(!force&&now()-last(current)<PERIOD)return;
     if(Number(current.autoActualizacion?.hasta)>now())return;
     return {...current,autoActualizacion:{id:token,uid:context.uid,hasta:now()+LEASE}};
    });
    if(!same(context))return false;
    const observed=claim.snapshot?.val?.();if(observed)root.TIPO_CAMBIO_CONFIG=observed;
    if(!claim.committed)return false;
    claimed=true;if(!observed||typeof observed!=='object')throw Error('No se pudo confirmar la actualización');const baseline=observed;
    if(!visible())throw Object.assign(Error('Actualización pausada'),{name:'AbortError'});
    controller=new root.AbortController();timeout=root.setTimeout(()=>controller?.abort(),8000);
    const response=await root.fetch('https://dolarapi.com/v1/dolares',{signal:controller.signal});
    if(!response.ok)throw Error('No se pudo consultar la cotización');const values=decode(await response.json());
    if(!same(context)||!visible())throw Object.assign(Error('Sesión cambiada'),{name:'AbortError'});
    const result=await transact(current=>{
     if(!same(context)||!visible()||current?.autoActualizacion?.id!==token||!force&&!automatic(current))return;
     // A manual edit or newer quote during the request wins.
     if(last(current)!==last(baseline))return;
     const next={...current,...values,actualizadoApiEn:now()};delete next.autoActualizacion;return next;
    });
    if(!result.committed){const latest=result.snapshot?.val?.();if(latest&&same(context))root.TIPO_CAMBIO_CONFIG=latest;return false;}
    claimed=false;const cfg=result.snapshot.val();lastError='';retryAt=0;if(!same(context))return true;
    paint(cfg,baseline,force);
    if(root.SisVentasDolarHistorico?.guardarPunto){try{await root.SisVentasDolarHistorico.guardarPunto(cfg,'api');}catch(_){lastError='Cotización actualizada; no se pudo guardar el histórico';}}
    if(!silent&&same(context))root.notify?.(lastError||'Cotización actualizada');return true;
   }catch(error){
    if(error.name!=='AbortError'){retryAt=now()+PERIOD;lastError=error.message;if(!silent&&same(context))root.notify?.('No se pudo actualizar: '+error.message);}
    return false;
   }finally{
    if(timeout!==null)root.clearTimeout(timeout);controller=null;
    if(claimed&&same(context))try{await transact(current=>{if(!same(context)||current?.autoActualizacion?.id!==token)return;const next={...current};delete next.autoActualizacion;return next;});}catch(_){}
   }
  };
  pending=work().finally(()=>{pending=null;if(button&&!silent&&same(context)){button.disabled=false;button.removeAttribute?.('aria-busy');}plan();});return pending;
 }
 function stop(){stopped=true;clear();controller?.abort();}
 function start(){stopped=false;reconcile();}
 function install(){
  if(installed)return;installed=true;
  const dashboard=root.actualizarDolarDashboard;
  if(typeof dashboard==='function')root.actualizarDolarDashboard=function(...args){const value=dashboard.apply(this,args);reconcile();return value;};
  root.actualizarDolarAPI=silent=>refresh(true,!!silent);
  root.document.addEventListener('sisventas:session-ready',start);root.document.addEventListener('sisventas:session-ended',stop);
  for(const event of ['sisventas:role-changed','sisventas:page-changed','sisventas:foreground-restored','sisventas:foreground-paused','visibilitychange'])root.document.addEventListener(event,reconcile);
  root.addEventListener?.('pagehide',stop);root.addEventListener?.('pageshow',start);start();
 }
 return Object.freeze({install,refresh,reconcile,start,stop,decode,period:PERIOD,status:()=>({busy:!!pending,lastError})});
});
