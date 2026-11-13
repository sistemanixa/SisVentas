(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVExpenseCategoriesModel=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const DEFAULTS=Object.freeze(['Inmueble','Servicios','Personal','Transporte','Materiales','Marketing','Mercadería','Impuestos','Otro','Indumentaria']);
  const DEFAULT_IDS=Object.freeze(['default-inmueble','default-servicios','default-personal','default-transporte','default-materiales','default-marketing','default-mercaderia','default-impuestos','default-otro','default-indumentaria']);
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  function fail(message,code='EXPENSE_CATEGORY_INVALID'){throw Object.assign(Error(message),{code});}
  function normalizeName(value){
    if(typeof value!=='string'||/[\u0000-\u001f\u007f-\u009f]/.test(value))fail('Revisá el nombre de la categoría.');
    const name=value.normalize('NFC').trim().replace(/\s+/gu,' ');
    if(!name||[...name].length>80)fail('La categoría debe tener entre 1 y 80 caracteres.');
    const sentinel=name.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es-AR');
    if(sentinel==='__sv_add_expense_category__'||/^(?:\+\s*)?agregar(?:\s+(?:categoria|nueva(?:\s+categoria)?))?(?:\s*[.…]+)?$/u.test(sentinel))fail('Elegí una categoría, no la acción de agregar.');
    return name;
  }
  const identity=value=>normalizeName(value).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es-AR');
  function freeze(v){if(object(v)||Array.isArray(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
  function createState(){return freeze({schema:1,revision:0,entries:[],operations:{}});}
  function check(state){if(!object(state)||state.schema!==1||!Number.isSafeInteger(state.revision)||state.revision<0||!Array.isArray(state.entries)||!object(state.operations))fail('Las categorías necesitan revisión.');}
  function identifier(value){if(typeof value!=='string'||!value||value.length>512||/[\u0000-\u001f\u007f]/.test(value)||['__proto__','prototype','constructor'].includes(value))fail('Revisá la referencia de la categoría.');return value;}
  function records(state){
    const result=DEFAULTS.map((name,i)=>({id:DEFAULT_IDS[i],name,active:true,aliases:[name]}));
    for(const source of state.entries){const entry=typeof source==='string'?{name:source}:source;if(!object(entry))fail('Las categorías necesitan revisión.');const name=normalizeName(entry.name),existing=result.find(r=>identity(r.name)===identity(name)),id=entry.id?identifier(entry.id):existing?.id||'legacy-'+encodeURIComponent(identity(name));
      const aliases=entry.aliases===undefined?[entry.name]:entry.aliases;if(!Array.isArray(aliases)||aliases.some(a=>typeof a!=='string'))fail('Las categorías necesitan revisión.');aliases.forEach(normalizeName);if(entry.active!==undefined&&typeof entry.active!=='boolean')fail('Las categorías necesitan revisión.');
      const normalized={id,name,active:entry.active!==false,aliases:[...new Set([...aliases,entry.name])]};const index=result.findIndex(r=>r.id===id);if(index>=0){normalized.aliases=[...new Set([...result[index].aliases,...normalized.aliases])];result[index]=normalized;}else result.push(normalized);
    }
    const owners=new Map();for(const r of result)for(const a of [...r.aliases,r.name]){const key=identity(a),owner=owners.get(key);if(owner&&owner!==r.id)fail('Hay categorías con nombres superpuestos.');owners.set(key,r.id);}return result;
  }
  function options(state,observed=[],settings={}){
    check(state);if(!Array.isArray(observed))fail('Revisá las categorías históricas.');const kind=settings.kind||'filter';if(!['filter','edit','new','manage'].includes(kind))fail('Revisá el destino de las categorías.');
    const rows=records(state).map(r=>({...r,values:[...new Set([r.name,...r.aliases])],observed:false}));
    for(const raw of observed){const name=normalizeName(raw),id=identity(name);let row=rows.find(r=>r.values.some(v=>identity(v)===id));if(!row){row={id:'observed-'+encodeURIComponent(id),name,active:true,values:[],observed:false};rows.push(row);}row.observed=true;if(!row.values.includes(raw))row.values.push(raw);}
    // An inactive category remains available only to inspect history or retain
    // the exact current value in an old expense. It is never reactivated by a
    // historical observation, nor written back to any financial record.
    return freeze(rows.filter(r=>r.active||kind==='manage'||kind==='filter'&&r.observed||kind==='edit'&&typeof settings.currentValue==='string'&&r.values.some(v=>identity(v)===identity(settings.currentValue))).map(({observed:_,...r})=>r));
  }
  function operation(state,command,type){
    check(state);if(!object(command)||typeof command.operationId!=='string'||!command.operationId||command.operationId.length>128||/[.#$\[\]\/\u0000-\u001f\u007f]/.test(command.operationId)||['__proto__','prototype','constructor'].includes(command.operationId))fail('Revisá la operación.');
    if(!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<0)fail('Revisá la versión de las categorías.');
    const op={type,expectedRevision:command.expectedRevision};if(type!=='create')op.id=identifier(command.id);if(type!=='deactivate')op.name=normalizeName(command.name);
    const previous=Object.hasOwn(state.operations,command.operationId)?state.operations[command.operationId]:null;
    if(previous){if((previous.type||'create')!==type||previous.name!==op.name||previous.id!==op.id||previous.expectedRevision!==op.expectedRevision)fail('La operación ya existe con otros datos.','EXPENSE_CATEGORY_OPERATION_CONFLICT');return {replay:true};}
    if(command.expectedRevision!==state.revision)fail('Las categorías cambiaron. Recargá antes de guardar.','EXPENSE_CATEGORY_REVISION_CONFLICT');if(state.revision===Number.MAX_SAFE_INTEGER)fail('Las categorías necesitan revisión.');return {op};
  }
  function commit(state,command,type){
    const prepared=operation(state,command,type);if(prepared.replay)return state;const op=prepared.op,known=records(state),entries=state.entries.map(e=>typeof e==='string'?e:{...e, ...(e.aliases?{aliases:[...e.aliases]}:{})});let changed;
    if(type==='create'){
      const existing=known.find(r=>[r.name,...r.aliases].some(a=>identity(a)===identity(op.name)));if(existing&&!existing.active)fail('La categoría está desactivada. Revisá las categorías existentes.');
      if(!existing)changed={id:'category-'+command.operationId,name:op.name,active:true,aliases:[op.name]};
    }else{
      const current=known.find(r=>r.id===op.id);if(!current)fail('La categoría no está configurada.');
      if(type==='update'&&known.some(r=>r.id!==op.id&&[r.name,...r.aliases].some(a=>identity(a)===identity(op.name))))fail('Ese nombre ya pertenece a otra categoría.','EXPENSE_CATEGORY_NAME_CONFLICT');
      changed={...current,name:type==='update'?op.name:current.name,active:type==='deactivate'?false:current.active,aliases:[...new Set([...current.aliases,current.name,...(op.name?[op.name]:[])])]};
    }
    if(changed){const index=entries.findIndex(e=>object(e)&&e.id===changed.id||!e.id&&identity(typeof e==='string'?e:e.name)===identity(known.find(r=>r.id===changed.id)?.name||changed.name));if(index>=0)entries[index]=changed;else entries.push(changed);}
    return freeze({schema:1,revision:state.revision+1,entries,operations:{...state.operations,[command.operationId]:op}});
  }
  const create=(state,command)=>commit(state,command,'create'),update=(state,command)=>commit(state,command,'update'),deactivate=(state,command)=>commit(state,command,'deactivate');
  return Object.freeze({DEFAULTS,DEFAULT_IDS,normalizeName,identity,createState,options,create,update,deactivate});
});
