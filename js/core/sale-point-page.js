(function(root){
 'use strict';
 const key=()=>new URL(root.location.href).searchParams.get('ventaPuntual');
 let generation=0,controller;
 const money=v=>Number(v).toLocaleString('es-AR',{style:'currency',currency:'ARS'});
 function matches(){return !!key();}
 function node(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
 function link(id){const u=new URL(root.location.href);u.searchParams.set('ventaPuntual',id);u.hash='/detalle';return u.pathname+u.search+u.hash;}
 function start(){
  if(!matches())return false;
  const selectedKey=key(),route=root.location.href,user=root.fbAuth?.currentUser,epoch=++generation;controller?.abort();controller=new AbortController();
  for(const id of ['screen-app','screen-loading','screen-login']){const e=document.getElementById(id);if(e)e.style.display='none';}
  document.getElementById('sv-sale-point')?.remove();
  const panel=node('main');panel.id='sv-sale-point';panel.style.cssText='position:fixed;inset:0;z-index:100000;background:#0b1220;color:#e8edf6;overflow:auto;padding:clamp(12px,3vw,24px);box-sizing:border-box;font:15px system-ui';
  const back=node('a','Abrir SisVentas completo');const u=new URL(root.location.href);u.searchParams.delete('ventaPuntual');back.href=u.pathname+u.search+'#/detalle';back.style.color='#8cbcff';panel.append(back,node('h1','Consulta de venta'));
  const status=node('p','Consultando únicamente esta venta y sus cobros…');status.setAttribute('role','status');panel.append(status);document.body.append(panel);
  const current=()=>generation===epoch&&root.fbAuth?.currentUser===user&&root.location.href===route&&panel.isConnected;
  async function load(){
   if(!user){status.textContent='Iniciá sesión en SisVentas para consultar la venta.';return;}
   try{
    const token=await user.getIdToken();if(!current())return;
    const response=await fetch(root.SISVENTAS_FUNCTIONS.cotizadorProveedor+'/comerciales/ventas/puntual/'+encodeURIComponent(selectedKey),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)]),cache:'no-store',credentials:'omit',redirect:'error'});
    const result=await response.json();if(!current())return;
    if(!response.ok||!result.ok)throw Error(result.mensaje||'No se pudo consultar esta venta.');
    const v=result.record;status.textContent='Consulta de sólo lectura · sin cargar el historial global';panel.append(node('h2',v.id||v.numero||v.fbKey),node('p',(v.cliente||'Cliente sin nombre')+' · '+(v.fecha||'Fecha no registrada')));
    const a=result.account;panel.append(node('p',a.status==='ready'?'Total '+money(a.total)+' · Cobrado '+money(a.paid)+' · Saldo '+money(a.balance):'Cobros y saldo no disponibles para este acceso.'));
    const tableWrap=node('div');tableWrap.style.cssText='max-width:100%;overflow:auto';tableWrap.tabIndex=0;tableWrap.setAttribute('role','region');tableWrap.setAttribute('aria-label','Productos de la venta');const table=node('table');table.style.cssText='width:100%;min-width:570px;border-collapse:collapse';
    const tr=node('tr');for(const label of ['Código','Producto','Cantidad','Unitario','Subtotal']){const cell=node('th',label);cell.style.cssText='padding:10px 6px;text-align:left;color:#c5d2e7;background:#152138';tr.append(cell);}table.append(tr);
    for(const item of v.items||[]){const row=node('tr');for(const value of [item.cod||item.codigo||'',item.desc||item.descripcion||item.nombre||'',item.qty??item.cantidad??'',item.punit==null?'—':money(item.punit),item.sub==null?'—':money(item.sub)]){const cell=node('td',String(value));cell.style.cssText='padding:12px 6px;border-bottom:1px solid #34415a;overflow-wrap:anywhere;color:#e8edf6';row.append(cell);}table.append(row);}tableWrap.append(table);panel.append(tableWrap);
    if(a.status==='ready'){panel.append(node('h2','Cobros de esta venta'));for(const p of result.payments||[])panel.append(node('p',(p.fecha||'Sin fecha')+' · '+money(p.monto)+' · '+(p.anulado?'Anulado':p.estado||p.medio||'')));}
   }catch(error){if(!current()||error.name==='AbortError')return;status.textContent=error.message;const retry=node('button','Reintentar consulta');retry.onclick=()=>start();panel.append(retry);}
  }
  load();return true;
 }
 root.SVSalePointPage={matches,start,link};
 document.addEventListener('sisventas:role-changed',()=>{if(matches()){generation++;controller?.abort();const panel=document.getElementById('sv-sale-point');if(panel){panel.replaceChildren(node('p','Los permisos cambiaron. Volvé a abrir la consulta.'));}}});
 document.addEventListener('sisventas:session-ended',()=>{generation++;controller?.abort();document.getElementById('sv-sale-point')?.remove();});
})(window);
