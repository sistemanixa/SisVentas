(function(root,factory){'use strict';const create=factory();if(typeof module==='object'&&module.exports)module.exports={create};else root.SVRecordLists=create(root);})(typeof window==='object'?window:null,function(){
 'use strict';return function create(root){
  const M=root.SVRecordListModel,queries=new WeakMap(),readers=new Set(),details=new Map();let sdk,epoch=0,configuration=null,installed=false,selection=0;
  const copy=M.clone;
  function context(){const user=root.fbAuth?.currentUser,uid=root.currentUserUid,role=root.currentRole,generation=epoch,valid=root.svCapturarContextoOperacion?.();return ()=>!!user&&user.uid===uid&&user===root.fbAuth?.currentUser&&uid===root.currentUserUid&&role===root.currentRole&&generation===epoch&&(!valid||valid());}
  function assert(valid){if(!valid())throw Object.assign(Error('La sesión cambió.'),{name:'AbortError'});}
  function ready(valid){if(!configuration)configuration=sdk.get(sdk.ref(root.fbDB,'sv_record_list_config')).then(s=>{const c=s.val();if(c?.ready!==true||c.schema!==1)throw Error('Los listados todavía no están preparados.');return c;}).catch(e=>{configuration=null;throw e;});return configuration.then(c=>{assert(valid);return c;});}
  function rows(value,filtered){
   if(!filtered)return M.parseIndex(this.domain,value);
   const out={};for(const [id,row]of Object.entries(value||{})){if(id==='_svCoverage')continue;if(!M.key(id)||!row||row._svListSummary!==true||!Number.isSafeInteger(row[M.revision])||row[M.revision]<0)throw Error('El listado está incompleto.');out[id]=copy(row);}return out;
  }
  function view(reader){const out=copy(reader.rows)||{};for(const [id,row]of Object.entries(out)){const detail=details.get(reader.domain+'/'+id);if(detail?.opened&&detail.value&&detail.valid())out[id]=copy(detail.value);}return out;}
  function emit(reader){if(reader.closed||!reader.valid())return;reader.receive({val:()=>view(reader),exists:()=>Object.keys(reader.rows||{}).length>0});}
  function broadcast(domain){for(const r of readers)if(r.domain===domain&&r.ready)emit(r);}
  function query(reference,...constraints){const result=sdk.query(reference,...constraints);queries.set(result,{reference,constraints});return result;}
  async function get(reference){
   const spec=queries.get(reference),p=M.path(spec?.reference||reference),domain=M.domains.find(d=>p==='sisventas/'+d);if(!domain)return sdk.get(reference);
   const valid=context(),readiness=root.SVDataReadiness?.beginSource(domain,'record-list-read/'+domain);try{await ready(valid);const target=sdk.ref(root.fbDB,domain==='gastos'&&spec?M.employeeIndex:M.index+'/'+domain),q=spec?sdk.query(target,...spec.constraints):target;const snap=await sdk.get(q);assert(valid);const data=rows.call({domain},snap.val(),!!spec);readiness?.ready();return {val:()=>copy(data),exists:()=>Object.keys(data).length>0};}catch(e){e.name==='AbortError'?readiness?.cancel():readiness?.error();throw e;}
  }
  function onValue(reference,receive,onError,options){
   const spec=queries.get(reference),p=M.path(spec?.reference||reference),domain=M.domains.find(d=>p==='sisventas/'+d);if(!domain)return sdk.onValue(reference,receive,onError,options);
   const valid=context(),readiness=root.SVDataReadiness?.beginSource(domain,'record-list/'+domain),reader={domain,receive,onError,valid,rows:{},ready:false,closed:false};readers.add(reader);let stop;
   const error=e=>{if(reader.closed||!valid())return;readiness?.error();onError?.(e);};
   reader.stop=()=>{if(reader.closed)return;reader.closed=true;stop?.();readiness?.cancel();readers.delete(reader);};
   ready(valid).then(()=>{if(reader.closed)return;const target=sdk.ref(root.fbDB,domain==='gastos'&&spec?M.employeeIndex:M.index+'/'+domain),q=spec?sdk.query(target,...spec.constraints):target;
    stop=sdk.onValue(q,snapshot=>{if(reader.closed||!valid())return;try{reader.rows=rows.call(reader,snapshot.val(),!!spec);reader.ready=true;emit(reader);readiness?.ready();}catch(e){error(e);}},error,options);
   }).catch(error);
   return reader.stop;
  }
  function close(domain,notify=true){let changed=false;for(const [key,d]of details)if(!domain||d.domain===domain){d.stop?.();details.delete(key);changed=true;}if(domain&&changed&&notify)broadcast(domain);}
  async function detail(domain,id){
   if(!M.domains.includes(domain)||!M.key(id))throw Error('Registro inválido.');const key=domain+'/'+id,old=details.get(key);if(old?.valid()){if(old.error)throw old.error;if(old.value)return copy(old.value);return old.promise;}
   for(const [other,entry]of details)if(entry.domain===domain&&!entry.opened){entry.stop?.();details.delete(other);}
   const valid=context(),seq=++selection;assert(valid);const entry={domain,id,valid,value:null,stop:null,promise:null,seq,opened:false};details.set(key,entry);
   entry.promise=(async()=>{const ref=sdk.ref(root.fbDB,'sisventas/'+key);const snap=await sdk.get(ref);assert(valid);if(details.get(key)!==entry)throw Object.assign(Error('Cambió el registro abierto.'),{name:'AbortError'});const value=snap.val();if(!value)throw Error('El registro ya no está disponible.');M.requireComplete(value);entry.value=copy(value);
    entry.stop=sdk.onValue(ref,s=>{if(!valid()||details.get(key)!==entry)return;const next=s.val();if(!next){entry.value=null;entry.stop?.();details.delete(key);if(entry.opened)broadcast(domain);return;}M.requireComplete(next);entry.value=copy(next);if(entry.opened)broadcast(domain);},error=>{if(!valid()||details.get(key)!==entry)return;entry.error=error;root.notify?.('No se pudo actualizar el detalle. Volvé a abrirlo antes de guardar.');});return copy(value);
   })().catch(e=>{if(details.get(key)===entry){entry.stop?.();details.delete(key);}throw e;});return entry.promise;
  }
  function open(domain,id){const key=domain+'/'+id,entry=details.get(key);if(!entry?.value||!entry.valid())return;for(const [other,d]of details)if(d.domain===domain&&other!==key){d.stop?.();details.delete(other);}entry.opened=true;broadcast(domain);}
  function reset(){epoch++;selection++;configuration=null;for(const r of [...readers])r.stop?.();close();}
  function install(options){if(installed)return;sdk=options.sdk;root.fbOnValue=onValue;root.fbQuery=query;root.fbGet=get;installed=true;root.document?.addEventListener?.('sisventas:session-ended',reset);root.document?.addEventListener?.('sisventas:role-changed',reset);root.document?.addEventListener?.('sisventas:page-changed',()=>close());}
  return Object.freeze({install,get,detail,open,close,reset});
 };
});
