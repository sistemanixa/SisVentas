(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVEmployeeResourcesIntegration=api.install(root);})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function install(root){
  const doc=root.document;let epoch=0,categories=null,closed=false;const mounts=new Map();
  const userId=()=>typeof currentUserUid==='undefined'?root.currentUserUid:currentUserUid,roleId=()=>typeof currentRole==='undefined'?root.currentRole:currentRole,expenses=()=>typeof gastosData==='undefined'?root.gastosData:gastosData,employees=()=>typeof empData==='undefined'?root.empData:empData;
  const route=()=>root._svPaginaDesdeRuta?.()||String(root.location?.hash||'').replace(/^#\//,''),action=name=>!root._impersonacionOriginal&&root.tienePermiso?.(name)===true,module=name=>!root._impersonacionOriginal&&root.permisoModulo?.(name)===true;
  const capture=()=>({uid:userId(),role:roleId(),auth:root.fbAuth?.currentUser,db:root.fbDB,epoch,permissionRevision:root.PERMISOS_ROLES?.[roleId()]?.indiceRevision??null,route:route(),viewing:!!root._impersonacionOriginal,online:root.navigator?.onLine!==false,canClothing:action('empleados.indumentaria'),canCategories:module('gastos'),canManageCategories:action('gastos.categorias')});
  function same(c){const n=capture();return !closed&&n.uid===c.uid&&n.auth===c.auth&&n.auth?.uid===n.uid&&n.db===c.db&&n.epoch===c.epoch&&n.role===c.role&&n.permissionRevision===c.permissionRevision&&n.route===c.route&&!n.viewing&&n.online;}
  async function request(path,options,c){
   if(!same(c))throw Object.assign(Error('La sesión cambió.'),{name:'AbortError'});
   const token=await c.auth.getIdToken();if(!same(c))throw Object.assign(Error('La sesión cambió.'),{name:'AbortError'});
   const base=root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(typeof base!=='string'||!/^https:\/\//.test(base))throw Error('No se pudo conectar la sección.');
   const response=await root.fetch(base+path,{method:options.method,signal:AbortSignal.any([options.signal,AbortSignal.timeout(30000)]),cache:'no-store',headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})}),result=await response.json();
   if(!same(c))throw Object.assign(Error('La sesión cambió.'),{name:'AbortError'});if(!response.ok||result.ok!==true)throw Object.assign(Error(result.mensaje||result.message||'No se pudo confirmar la operación.'),{code:result.code,status:response.status});return result;
  }
  const client=root.SVEmployeeResourcesClient.create({capture,request,readiness:root.SVDataReadiness});
  const categoryRepo=client.repository('categories'),catalog={...categoryRepo,read:async()=>{const result=await categoryRepo.read();categories=result;return result;}};
  for(const method of ['create','update','deactivate'])catalog[method]=async command=>{if(!action('gastos.categorias'))throw Error('No tenés permiso para modificar categorías.');const result=await categoryRepo[method](command);categories=result;doc.dispatchEvent(new CustomEvent('sisventas:expense-categories-changed'));return result;};
  function categoryContext(){const c=capture();return{...c,allowed:c.canCategories,canCreate:c.canManageCategories,impersonating:c.viewing};}
  let expenseFilterSignature='';function refreshExpenseFilter(){const filter=doc.getElementById('gas-f-categoria');if(route()!=='gastos'||!filter)return;const signature=JSON.stringify([categories?.entries||[],filter.value]);if(signature===expenseFilterSignature)return;expenseFilterSignature=signature;if(filter.value)root.filtrarGastos?.(true);}
  function mountCategories(force=false){
   if(!capture().canCategories||!root.SVExpenseCategories)return;
   for(const [element,mount]of mounts)if(!element.isConnected){mount.unmount();mounts.delete(element);}
   for(const [id,kind]of [['gas-f-categoria','filter'],['g-categoria','edit'],['gr-categoria','new'],['ng-cat','new']]){const element=doc.getElementById(id);if(!element||mounts.has(element))continue;const mounted=root.SVExpenseCategories.mount({selects:[{element,kind,...(id==='g-categoria'?{getMode:()=>root._gastoFormVista?.key?'edit':'new',getCurrentValue:()=>Object.values(expenses()||{}).find(g=>g.fbKey===root._gastoFormVista?.key)?.categoria}:{})}],context:categoryContext,repository:catalog,observed:()=>Object.values(expenses()||{}).map(g=>g.categoria).filter(Boolean),onError:message=>root.notify?.(message),...(id==='gas-f-categoria'?{onRender:refreshExpenseFilter}:{})});mounts.set(element,mounted);}
   if(force)for(const mount of mounts.values())void mount.refresh();
  }
  function categoryMatches(actual,selected){if(!selected)return true;const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es');if(norm(actual)===norm(selected))return true;if(!categories)return false;const row=root.SVExpenseCategoriesModel.options(categories,[],{kind:'filter'}).find(x=>norm(x.name)===norm(selected)||x.values.some(v=>norm(v)===norm(selected)));return !!row?.values?.some(x=>norm(x)===norm(actual));}
  function expenseChoices(){return Object.entries(expenses()||{}).map(([key,g])=>({id:g.fbKey||key,label:g.descripcion||'Gasto registrado',dead:g.eliminado||g.anulado})).filter(g=>!g.dead&&/^[A-Za-z0-9_-]{1,128}$/.test(g.id));}
  function open(employeeId){
   if(!action('empleados.indumentaria')){root.notify?.('No tenés permiso para gestionar indumentaria.');return false;}
   const employee=employeeId?Object.values(employees()||{}).find(e=>e.fbKey===employeeId):null;if(employeeId&&(!employee||employee.activo===false)){root.notify?.('Elegí un empleado activo.');return false;}
   return root.SVEmployeeClothing.open({manageStock:!employee,employee:employee?{id:employeeId,name:employee.nombre}:null,expenses:expenseChoices(),context:()=>{const c=capture();return{...c,allowed:c.canClothing,impersonating:c.viewing};},repository:client.repository('clothing')});
  }
  function changed(){client.reset();epoch++;for(const mount of mounts.values())mount.unmount();mounts.clear();root.SVEmployeeClothing?.close();categories=null;expenseFilterSignature='';knownIdentity=capture();}
  let previousRoute=route();function navigate(){const next=route();if(next!==previousRoute){previousRoute=next;changed();}else checkIdentity();knownIdentity=capture();if(['gastos','coberturasalarial'].includes(next))mountCategories();}
  function click(e){const button=e.target.closest?.('[data-employee-clothing]');if(!button)return;e.preventDefault();e.stopPropagation();open(button.dataset.employeeClothing||null);}
  function refreshCategories(){for(const mount of mounts.values())void mount.refresh();}
  let knownIdentity=capture();function checkIdentity(){const next=capture();if(['uid','auth','db','role','permissionRevision','viewing','online','canClothing','canCategories','canManageCategories'].some(k=>next[k]!==knownIdentity[k])){changed();knownIdentity=capture();if(['gastos','coberturasalarial'].includes(route()))mountCategories();}}
  doc.addEventListener('sisventas:data-state-changed',checkIdentity);doc.addEventListener('click',click,true);doc.addEventListener('sisventas:expense-categories-changed',refreshCategories);doc.addEventListener('sisventas:page-changed',navigate);for(const name of ['sisventas:session-ended','sisventas:role-changed'])doc.addEventListener(name,changed);
  const observer=new root.MutationObserver(records=>{if(!['gastos','coberturasalarial'].includes(route()))return;if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.id==='ng-cat'||n.querySelector?.('#ng-cat')))))mountCategories();});observer.observe(doc.body,{childList:true,subtree:true});
  if(['gastos','coberturasalarial'].includes(route()))mountCategories();
  root.abrirIndumentariaEmpleado=open;root.svCategoriaGastoCoincide=categoryMatches;
  return Object.freeze({open,categoryMatches,mountCategories,categoryState:()=>categories,loadCategories:async()=>capture().canCategories?catalog.read():null,close(){closed=true;changed();observer.disconnect();doc.removeEventListener('sisventas:data-state-changed',checkIdentity);doc.removeEventListener('click',click,true);doc.removeEventListener('sisventas:expense-categories-changed',refreshCategories);doc.removeEventListener('sisventas:page-changed',navigate);for(const name of ['sisventas:session-ended','sisventas:role-changed'])doc.removeEventListener(name,changed);}});
 }
 return Object.freeze({install});
});
