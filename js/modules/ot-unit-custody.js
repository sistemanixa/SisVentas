(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root||!root.document)return;
  root.SVOTUnitCustodyFactory=api;
  const controller=api.create({
    document:root.document,
    context(){
      const session=root.svCapturarContextoOperacion?.(),user=root.fbAuth?.currentUser;
      const route=root.location.hash,otId=root.otActualId;
      return ()=>!!user&&user===root.fbAuth?.currentUser&&!root._impersonacionOriginal&&route===root.location.hash&&otId===root.otActualId&&(!session||session());
    },
    scan:options=>{if(!root.SVSerialCamera)throw Error('El lector no está disponible. Podés escribir la serie.');return root.SVSerialCamera.open(options);},
    closeScanner:()=>root.SVSerialCamera?.close(),
    async request(action,body,signal){
      const valid=root.svCapturarContextoOperacion?.(),user=root.fbAuth?.currentUser,route=root.location.hash,otId=root.otActualId;
      const live=()=>!!user&&user===root.fbAuth?.currentUser&&!root._impersonacionOriginal&&!signal.aborted&&route===root.location.hash&&otId===root.otActualId&&(!valid||valid());
      if(!live())throw Error('La sesión o la OT cambiaron. Volvé a abrir la custodia.');
      const base=root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;
      if(!base||!root.SVServiceAuth?.headers)throw Error('No se pudo conectar con la custodia.');
      const url=new URL(base);url.pathname=url.pathname.replace(/\/$/,'')+'/ot/custodia/'+action;url.search='';url.hash='';
      const headers=await root.SVServiceAuth.headers({'Content-Type':'application/json'});
      if(!live())throw Error('La sesión o la OT cambiaron.');
      const response=await root.fetch(url.href,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(45000)]),cache:'no-store',credentials:'omit',redirect:'error'});
      const data=await response.json();
      if(!live())throw Error('La sesión o la OT cambiaron.');
      if(!response.ok||data.ok===false)throw Error(data.mensaje||'No se pudo registrar la custodia.');
      return data;
    }
  });
  root.SVOTUnitCustody={
    available:()=>root.SV_OT_UNIT_CUSTODY_ENABLED===true,
    open(ot,options){if(root.SV_OT_UNIT_CUSTODY_ENABLED!==true){root.notify?.('La custodia por serie todavía no está habilitada.');return Promise.resolve(null);}return controller.open(ot,options);},
    close:controller.close
  };
})(typeof window==='object'?window:null,function(){
  'use strict';
  const key=v=>typeof v==='string'&&v.length>0&&v.length<=768&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(v);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const labels={entregar:'Entregar unidades al técnico',devolver:'Devolver unidades al depósito',recibir:'Recibir unidades devueltas'};
  const actions={entregar:'Registrar entrega',devolver:'Registrar devolución',recibir:'Confirmar recepción'};
  const serial=value=>String(value||'').trim().toLocaleUpperCase('es-AR');
  function create({document,context,request,scan,closeScanner}){
    let active=null;
    function element(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
    function button(text,cls,handler){const n=element('button',cls,text);n.type='button';n.addEventListener('click',handler);return n;}
    function live(s){return active===s&&s.valid()&&s.dialog.isConnected&&!s.abort.signal.aborted;}
    function status(s,text,error=false){s.status.textContent=text;s.status.className='ot-unit-status'+(error?' is-error':'');s.status.setAttribute('role',error?'alert':'status');}
    function close(s,result){
      if(active!==s)return;active=null;
      if(s.cameraOpen){s.cameraOpen=false;closeScanner?.();}
      s.abort.abort();
      for(const name of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed','visibilitychange'])document.removeEventListener(name,s.retire);
      s.dialog.close();s.dialog.remove();if(s.focus?.isConnected)s.focus.focus({preventScroll:true});s.resolve(result);
    }
    function busy(s,on,saving=false){
      s.busy=on;s.saving=saving;s.dialog.setAttribute('aria-busy',String(on));
      for(const node of s.controls)node.disabled=on;
      s.cancel.disabled=on&&saving;s.confirm.disabled=on||!s.ready;
      s.spinner.hidden=!on;s.confirm.textContent=on&&saving?'Guardando…':actions[s.action];
      if(!on)for(const row of s.rows){if(row.blocked)row.check.disabled=true;if(row.serie)row.serie.disabled=!row.check.checked||row.blocked;if(row.scan)row.scan.disabled=!row.check.checked||row.blocked;}
    }
    function input(s,label,type='text'){
      const wrapper=element('label','',label),field=element('input','search-input');field.type=type;
      if(type==='text'){field.maxLength=120;field.autocomplete='off';field.spellcheck=false;}
      if(type==='checkbox')wrapper.replaceChildren(field,element('span','',label));else wrapper.append(field);s.controls.push(field);return {wrapper,field};
    }
    function duplicate(s,value,except){
      const wanted=serial(value);if(!wanted)return false;
      return Object.entries(s.data.registry).some(([id,u])=>id!==except&&u.estado!=='devuelto'&&serial(u.serie)===wanted)||s.rows.some(row=>row.unit.key!==except&&row.check.checked&&serial(row.serie?.value)===wanted);
    }
    async function scanRow(s,row){
      if(!live(s)||s.busy||!row.check.checked||!row.serie)return;
      if(typeof scan!=='function'){status(s,'El lector no está disponible. Podés escribir la serie.',true);return;}
      s.cameraOpen=true;
      try{
        await scan({label:row.unit.name||row.unit.code||'Unidad',kind:'serie',onRead:value=>{
          s.cameraOpen=false;if(!live(s)||s.busy||!row.check.checked)return;
          const text=String(value||'').trim();
          if(!text||text.length>120||/[\x00-\x1f\x7f]/.test(text)){status(s,'La lectura no contiene una serie válida.',true);return;}
          if(duplicate(s,text,row.unit.key)){status(s,'La serie ya está en otra unidad. Revisá la etiqueta.',true);return;}
          row.serie.value=text;row.serie.focus({preventScroll:true});status(s,'Serie leída. Completá las demás unidades y confirmá la entrega.');
        }});
      }catch(error){s.cameraOpen=false;if(live(s))status(s,error.message||'No se pudo abrir el lector. Podés escribir la serie.',true);}
    }
    function validateData(data,otKey){
      if(!object(data)||data.otKey!==otKey||typeof data.revision!=='string'||!/^[a-f0-9]{64}$/.test(data.revision)||!Array.isArray(data.units)||data.units.length>200||!Array.isArray(data.materials)||!object(data.registry)||!object(data.capabilities))throw Error('No se pudo comprobar la lista de unidades.');
      const seen=new Set();for(const u of data.units){if(!object(u)||!key(u.key)||seen.has(u.key)||!key(u.itemKey)||!Number.isInteger(u.n)||u.n<0)throw Error('La identificación de unidades requiere revisión.');seen.add(u.key);}
      for(const [id,u]of Object.entries(data.registry))if(!key(id)||!object(u)||u.unitKey!==id||typeof u.serie!=='string'||!['en_tecnico','devolucion_pendiente','devuelto','instalado'].includes(u.estado))throw Error('La custodia registrada requiere revisión.');
      for(const m of data.materials)if(!object(m)||!key(m.key))throw Error('Los materiales requieren revisión.');
    }
    function row(s,unit){
      const registered=s.data.registry[unit.key];
      const eligible=s.action==='entregar'?!registered:s.action==='devolver'?registered?.estado==='en_tecnico':registered?.estado==='devolucion_pendiente';
      if(!eligible)return;
      const card=element('section','ot-unit-card ot-custody-card'),heading=element('h3','',unit.name||unit.code||'Producto');
      const select=input(s,'Incluir unidad','checkbox');select.wrapper.className='ot-unit-manual-consent';select.field.checked=s.action==='entregar';
      const r={unit,card,check:select.field};
      card.append(heading,element('p','ot-unit-meta',(unit.code?unit.code+' · ':'')+'Unidad '+(unit.n+1)),select.wrapper);
      if(s.action==='entregar'){
        const series=input(s,'Número de serie');r.serie=series.field;
        const read=button('Escanear serie','btn btn-ghost ot-unit-scan',()=>scanRow(s,r));s.controls.push(read);r.scan=read;
        card.append(series.wrapper,read);
        if(unit.materialKey===undefined){
          if(!s.data.capabilities.historicalMapping){r.blocked=true;card.append(element('p','ot-unit-warning','Administración debe identificar este renglón histórico antes de registrar la entrega.'));r.check.checked=false;r.check.disabled=true;}
          else{
            const label=element('label','','Renglón de materiales'),mapping=element('select','search-input'),blank=element('option','','Elegir renglón');blank.value='';mapping.append(blank);
            for(const material of s.data.materials){const option=element('option','',(material.cod||material.codigo||'Sin código')+' · '+(material.desc||material.descripcion||'Material')+' · '+(material.vendida??0)+' unidades');option.value=material.key;mapping.append(option);}
            label.append(mapping);card.append(label);s.controls.push(mapping);r.mapping=mapping;
            const consent=input(s,'Confirmo que corresponde a esta unidad histórica','checkbox');consent.wrapper.className='ot-unit-manual-consent';r.consent=consent.field;card.append(consent.wrapper);
          }
        }
      }else card.append(element('p','ot-unit-existing','Serie: '+registered.serie));
      r.check.addEventListener('change',()=>{if(r.serie)r.serie.disabled=!r.check.checked;if(r.scan)r.scan.disabled=!r.check.checked;status(s,'Elegí las unidades que querés registrar.');});
      s.rows.push(r);s.body.append(card);
    }
    function render(s,data){
      validateData(data,s.otKey);if(data.capabilities[s.action]!==true)throw Error('Tu rol no permite esta operación.');s.data=data;s.rows=[];
      s.body.replaceChildren();s.body.append(element('p','ot-unit-intro',s.action==='entregar'?'Registrá la serie de cada unidad que entregás al técnico. Esta entrega no inicia la garantía del cliente.':s.action==='devolver'?'Elegí las series que el técnico devuelve. El stock cambia cuando el depósito confirma la recepción.':'Elegí sólo las unidades que recibiste físicamente. Volverán al depósito sin modificar las otras unidades.'));
      for(const unit of data.units)row(s,unit);
      if(!s.rows.length)s.body.append(element('p','ot-unit-meta','No hay unidades pendientes para esta acción.'));
      s.ready=s.rows.some(r=>!r.blocked);busy(s,false);status(s,s.ready?'Revisá las unidades antes de confirmar.':'No hay unidades disponibles para registrar.');
    }
    function selection(s){
      const rows=s.rows.filter(r=>r.check.checked&&!r.blocked);if(!rows.length)throw Error('Elegí al menos una unidad.');
      return rows.map(r=>{
        const chosen={key:r.unit.key};
        if(s.action==='entregar'){
          const value=String(r.serie.value||'').trim();
          if(!value||value.length>120||/[\x00-\x1f\x7f]/.test(value)){r.serie.focus({preventScroll:true});throw Error('Completá una serie válida para cada unidad seleccionada.');}
          if(duplicate(s,value,r.unit.key)){r.serie.focus({preventScroll:true});throw Error('Hay una serie repetida. Revisá las unidades.');}chosen.serie=value;
          if(r.mapping){if(!r.mapping.value||!r.consent.checked){r.mapping.focus({preventScroll:true});throw Error('Elegí y confirmá el renglón histórico de cada unidad.');}chosen.materialKey=r.mapping.value;chosen.confirmLink=true;}
        }
        return chosen;
      });
    }
    async function save(s){
      if(!live(s)||s.busy||!s.ready)return;
      let units;try{units=selection(s);}catch(error){status(s,error.message,true);return;}
      if(s.cameraOpen){s.cameraOpen=false;closeScanner?.();}
      busy(s,true,true);status(s,'Guardando '+units.length+(units.length===1?' unidad…':' unidades…'));
      try{
        const result=await request('confirmar',{otKey:s.otKey,revision:s.data.revision,accion:s.action,units},s.abort.signal);
        if(!live(s)){if(active===s)close(s,null);return;}
        if(!object(result)||result.ok!==true||result.otKey!==s.otKey||result.action!==s.action||!Array.isArray(result.units)||result.units.length!==units.length||result.units.some((key,index)=>key!==units[index].key))throw Error('No se pudo comprobar la confirmación. Volvé a revisar antes de repetir.');
        close(s,result);
      }catch(error){if(live(s)){busy(s,false);status(s,error.message||'No se pudo guardar. Volvé a intentarlo.',true);}}
    }
    async function open(ot,{action='entregar'}={}){
      if(!labels[action]||!key(ot?.fbKey))throw Error('Elegí una OT válida.');
      if(active){active.dialog.focus({preventScroll:true});return active.promise;}
      const s={otKey:ot.fbKey,action,focus:document.activeElement,abort:new AbortController(),valid:context?.()||(()=>true),controls:[],rows:[],ready:false,busy:false,saving:false,cameraOpen:false};
      s.promise=new Promise(resolve=>{s.resolve=resolve;});s.dialog=element('dialog','ot-unit-dialog ot-custody-dialog');s.dialog.setAttribute('aria-label',labels[action]);
      const head=element('header','ot-unit-head');head.append(element('h2','',labels[action]),element('p','ot-unit-meta',ot.id||'OT'));s.body=element('div','ot-unit-body');
      s.status=element('p','ot-unit-status');s.spinner=element('span','ot-unit-spinner');s.spinner.setAttribute('aria-hidden','true');
      s.cancel=button('Cancelar','btn btn-ghost',()=>{if(!s.saving)close(s,null);});s.confirm=button(actions[action],'btn btn-primary',()=>save(s));
      const footer=element('footer','ot-unit-footer'),saveBox=element('div','ot-unit-save');saveBox.append(s.spinner,s.confirm);footer.append(s.cancel,saveBox);s.dialog.append(head,s.body,s.status,footer);
      s.retire=event=>{if(event?.type!=='visibilitychange'||document.visibilityState==='hidden'||!s.valid())close(s,null);};
      for(const name of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed','visibilitychange'])document.addEventListener(name,s.retire);
      s.dialog.addEventListener('cancel',event=>{event.preventDefault();if(!s.saving)close(s,null);});
      s.dialog.addEventListener('keydown',event=>{
        if(event.key!=='Tab')return;const focusable=[...s.controls,s.cancel,s.confirm].filter(n=>!n.disabled&&!n.hidden&&n.isConnected);if(!focusable.length)return;
        if(event.shiftKey&&document.activeElement===focusable[0]){event.preventDefault();focusable.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===focusable.at(-1)){event.preventDefault();focusable[0].focus();}
      });
      document.body.append(s.dialog);active=s;s.dialog.showModal();busy(s,true);status(s,'Cargando unidades…');s.cancel.focus({preventScroll:true});
      try{const data=await request('preparar',{otKey:s.otKey},s.abort.signal);if(live(s))render(s,data);else if(active===s)close(s,null);}
      catch(error){if(live(s)){busy(s,false);status(s,error.message||'No se pudieron cargar las unidades.',true);}}
      return s.promise;
    }
    return Object.freeze({open,close:()=>{if(active&&!active.saving)close(active,null);}});
  }
  return Object.freeze({create});
});
