'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBudgetSaveFixture,settle}=require('./helpers/budget-save-fixture.cjs');

for(const mode of ['hold','fail'])test('borrador duplicado aprobado: el listado refleja el acuse aunque el refresco '+mode,async()=>{
 const f=await createBudgetSaveFixture(),other=f.clone(f.records.otro);f.mode(mode);
 await f.save();
 assert.equal(f.records['budget-ficticio'].estado,'aprobado_int');assert.equal(f.renderedState(),'aprobado_int');
 assert.equal(f.list().find(r=>r.fbKey==='budget-ficticio').autorizacionDescuento.firma,f.records['budget-ficticio'].autorizacionDescuento.firma);
 assert.deepEqual(f.records.otro,other,'El número comercial duplicado no identifica el registro que se actualiza');
 assert.equal(f.list().find(r=>r.fbKey==='otro').estado,'borrador');
 assert.equal(f.calls.complete,1);assert.equal(f.calls.closed,1);
 assert.ok(f.calls.notices.every(n=>n.state==='aprobado_int'));
 assert.equal(f.calls.reads.length,1,'El acuse evita otro GET global cuando la colección inicial ya está completa');
 assert.equal(f.pending.length,0);
});

test('una lectura que comenzó antes del guardado no repone el estado borrador ni su ETag',async()=>{
 const f=await createBudgetSaveFixture();f.mode('hold');const previous=f.c.SVCommercialOwnership.refresh('presupuestos');await settle();
 assert.equal(f.pending[0].snapshot['budget-ficticio'].estado,'borrador');
 await f.save();assert.equal(f.renderedState(),'aprobado_int');
 f.pending[0].resolve();await previous;await settle();
 assert.equal(f.list().find(r=>r.fbKey==='budget-ficticio').estado,'aprobado_int');
 assert.equal(f.pending.length,1,'Guardar no programa una descarga redundante del historial');
 const explicit=f.c.SVCommercialOwnership.refresh('presupuestos');await settle();
 assert.equal(f.pending.length,2);assert.equal(f.calls.reads.at(-1).headers['If-None-Match'],undefined);
 f.pending[1].resolve();await explicit;await settle();assert.equal(f.renderedState(),'aprobado_int');
});

test('acuse reemplaza el snapshot completo y quita campos eliminados, sin conservar el candidato optimista',async()=>{
 const f=await createBudgetSaveFixture();f.mode('fail');
 const tx=f.c.fbRunTransaction;
 f.c.fbRunTransaction=async(...args)=>{const result=await tx(...args),snapshot=result.snapshot.val();delete snapshot.motivo;snapshot.confirmacionFicticia='Valor del servidor';f.records['budget-ficticio']=f.clone(snapshot);return {...result,snapshot:{val:()=>f.clone(snapshot)}};};
 await f.save();const shown=f.list().find(r=>r.fbKey==='budget-ficticio');
 assert.equal(shown.motivo,undefined);assert.equal(shown.confirmacionFicticia,'Valor del servidor');
});

test('al guardar desde Borradores vuelve a Todos y conserva el filtro textual',async()=>{
 const f=await createBudgetSaveFixture({fromDraft:true});f.mode('fail');await f.save();
 assert.equal(f.c._svDraftGrid,false);assert.equal(f.nodes['tab-todos'].style.background,'var(--text)');
 assert.equal(f.nodes['tab-borradores'].style.background,'');assert.equal(f.nodes['filtro-estado-ppto'].value,'');
 assert.equal(f.nodes['ppto-buscar'].value,'Cliente ficticio');assert.equal(f.renderedState(),'aprobado_int');
});

test('un guardado rechazado conserva la edición, el respaldo y la lista original',async()=>{
 const f=await createBudgetSaveFixture({fromDraft:true});f.c.fbRunTransaction=async()=>{throw new Error('Escritura ficticia rechazada');};
 await f.save();assert.equal(f.records['budget-ficticio'].estado,'borrador');assert.equal(f.list().find(r=>r.fbKey==='budget-ficticio').estado,'borrador');
 assert.equal(f.calls.complete,0);assert.equal(f.calls.closed,0);assert.equal(f.c._svDraftGrid,true);
 assert.equal(f.c._pptoEditandoFbKey,'budget-ficticio');assert.ok(f.calls.notices.some(n=>/Escritura ficticia rechazada/.test(n.message)));
 assert.ok(f.calls.notices.every(n=>!/aprobado y guardado|guardado ✓/.test(n.message)));
});

for(const change of ['uid','auth','role','revision','logout'])test('sesión cambia después del commit ('+change+'): no anuncia éxito ni limpia o cierra la sesión nueva',async()=>{
 const f=await createBudgetSaveFixture();f.mode('fail');let release;
 f.hooks.afterCommit=()=>new Promise(resolve=>{release=resolve;});const task=f.save();await settle();assert.equal(f.records['budget-ficticio'].estado,'aprobado_int');
 const next=[{fbKey:'nuevo-contexto',estado:'borrador',cliente:'Otra sesión ficticia'}];
 if(change==='uid')f.c.currentUserUid='otra-cuenta';
 if(change==='auth')f.c.fbAuth.currentUser={uid:'admin-ficticio',getIdToken:async()=>'otro-token-ficticio'};
 if(change==='role')f.c.currentRole='administrativo';
 if(change==='revision')f.c.PERMISOS_ROLES={admin:{indiceRevision:1}};
 if(change==='logout')f.c.SVCommercialOwnership.stop();
 f.c.pptoData=f.clone(next);release();await task;await settle();
 assert.deepEqual(f.list(),next);assert.equal(f.calls.complete,0);assert.equal(f.calls.closed,0);assert.equal(f.calls.notices.length,0);
 assert.equal(f.c._pptoGuardadoEnCurso,false);assert.equal(f.calls.progressFinished,1);
 assert.equal(f.nodes['btn-guardar-principal-ppto'].disabled,false);assert.equal(f.nodes['btn-guardar-principal-ppto']['aria-busy'],undefined);
});

test('el acuse sólo acepta una clave técnica válida y nunca confirma ventas por esta API',async()=>{
 const f=await createBudgetSaveFixture(),api=f.c.SVCommercialOwnership,token=api.captureWriteContext(),before=f.list();
 for(const record of [{id:'PP-FICTICIO'},{fbKey:'ruta/no-valida'},{fbKey:'..'}])assert.throws(()=>api.confirmWrite('presupuestos',record,token),/clave técnica/);
 assert.throws(()=>api.confirmWrite('ventas',{fbKey:'venta-ficticia'},token),/inválido/);assert.deepEqual(f.list(),before);
});

for(const status of [401,403])test('revocación '+status+' antes del acuse impide reponer datos y un GET200 sólo habilita contextos nuevos',async()=>{
 const f=await createBudgetSaveFixture(),api=f.c.SVCommercialOwnership,token=api.captureWriteContext();
 f.mode('hold');let release;f.hooks.afterCommit=()=>new Promise(resolve=>{release=resolve;});
 const task=f.save();await settle();assert.equal(f.records['budget-ficticio'].estado,'aprobado_int');
 const read=api.refresh('presupuestos');await settle();
 f.pending[0].resolve({});
 // La respuesta retenida se convierte en rechazo autorizado del servidor.
 await read;
 // Ejercitar la respuesta 401/403 real a través del mismo transporte.
 const fetch=f.c.fetch;f.c.fetch=async()=>({ok:false,status,json:async()=>({ok:false,mensaje:'Acceso revocado'})});
 await api.refresh('presupuestos');assert.equal(f.list().length,0);assert.equal(api.isWriteContext(token),false);
 f.c.fetch=fetch;f.mode('normal');await api.refresh('presupuestos');
 assert.equal(api.isWriteContext(token),false,'El contexto anterior no revive con un GET autorizado');
 const fresh=api.captureWriteContext();assert.equal(api.isWriteContext(fresh),true);
 // No atribuir el GET200 al acuse de la operación anterior.
 f.c.pptoData=[];release();await task;
 assert.equal(f.list().length,0);assert.equal(f.calls.complete,0);assert.equal(f.calls.closed,0);
 assert.ok(f.calls.notices.every(n=>!/aprobado y guardado|guardado ✓/.test(n.message)));
});

test('revocación posterior al acuse borra el presupuesto confirmado y bloquea su reutilización',async()=>{
 const f=await createBudgetSaveFixture();f.mode('hold');await f.save();
 const token=f.c.SVCommercialOwnership.captureWriteContext();assert.equal(f.renderedState(),'aprobado_int');
 const explicit=f.c.SVCommercialOwnership.refresh('presupuestos');await settle();
 f.pending[0].reject(Object.assign(new Error('Acceso ficticio revocado'),{status:403}));await explicit;await settle();
 assert.equal(f.list().length,0);assert.equal(f.c.SVCommercialOwnership.isWriteContext(token),false);
 assert.throws(()=>f.c.SVCommercialOwnership.confirmWrite('presupuestos',{...f.records['budget-ficticio'],fbKey:'budget-ficticio'},token),/sesión cambió/);
});

test('revocar Ventas no invalida un acuse permitido de Presupuestos',async()=>{
 const f=await createBudgetSaveFixture(),api=f.c.SVCommercialOwnership,token=api.captureWriteContext();
 f.c.fetch=async()=>({ok:false,status:403,json:async()=>({ok:false,mensaje:'Ventas revocadas'})});
 api.onValue('ventas',()=>{});await settle();
 assert.equal(api.isWriteContext(token),true);
});

test('logout libera el botón y la carga; el retorno tardío no termina el guardado de la sesión nueva',async()=>{
 const f=await createBudgetSaveFixture();f.mode('fail');let firstRelease,secondRelease;
 f.hooks.afterCommit=()=>new Promise(resolve=>{firstRelease=resolve;});const first=f.save();await settle();
 assert.equal(f.c._pptoGuardadoEnCurso,true);assert.equal(f.nodes['btn-guardar-principal-ppto'].disabled,true);
 f.dispatch('sisventas:session-ended');
 assert.equal(f.c._pptoGuardadoEnCurso,false);assert.equal(f.calls.progressFinished,1);
 assert.equal(f.nodes['btn-guardar-principal-ppto'].disabled,false);assert.equal(f.nodes['btn-guardar-principal-ppto']['aria-busy'],undefined);
 f.c.fbAuth.currentUser={uid:'admin-ficticio',getIdToken:async()=>'sesion-nueva-ficticia'};
 f.c.pptoData=[{...f.clone(f.records['budget-ficticio']),fbKey:'budget-ficticio'}];
 f.c._pptoEditorBase=f.clone(f.c.pptoData[0]);
 f.hooks.afterCommit=()=>new Promise(resolve=>{secondRelease=resolve;});const second=f.save();await settle();
 assert.equal(f.c._pptoGuardadoEnCurso,true);assert.equal(f.nodes['btn-guardar-principal-ppto'].disabled,true);
 firstRelease();await first;
 assert.equal(f.c._pptoGuardadoEnCurso,true);assert.equal(f.nodes['btn-guardar-principal-ppto'].disabled,true);
 assert.equal(f.calls.progressFinished,1);assert.equal(f.calls.complete,0);assert.equal(f.calls.notices.length,0);
 secondRelease();await second;
 assert.equal(f.c._pptoGuardadoEnCurso,false);assert.equal(f.nodes['btn-guardar-principal-ppto'].disabled,false);
 assert.equal(f.calls.progressFinished,2);assert.equal(f.calls.complete,1);assert.equal(f.renderedState(),'aprobado_int');
});

test('un cambio de rol libera el botón anterior sin reponer su etiqueta de admin',async()=>{
 const f=await createBudgetSaveFixture();let release;
 f.hooks.afterCommit=()=>new Promise(resolve=>{release=resolve;});const task=f.save();await settle();
 f.c.currentRole='administrativo';const button=f.nodes['btn-guardar-principal-ppto'];button.innerHTML='Enviar a revisión';
 f.dispatch('sisventas:role-changed');
 assert.equal(button.disabled,false);assert.equal(button['aria-busy'],undefined);assert.equal(button.innerHTML,'Enviar a revisión');
 assert.equal(f.c._pptoGuardadoEnCurso,false);assert.equal(f.calls.progressFinished,1);
 release();await task;assert.equal(f.calls.complete,0);assert.equal(f.calls.notices.length,0);
});

test('un rechazo de permiso al preparar también invalida acuses de escritura anteriores del mismo dominio',async()=>{
 const f=await createBudgetSaveFixture(),api=f.c.SVCommercialOwnership,token=api.captureWriteContext();
 f.c.fetch=async()=>({ok:false,status:403,json:async()=>({ok:false,mensaje:'Preparación revocada'})});
 await assert.rejects(api.prepare('presupuestos','budget-ficticio'),/Preparación revocada/);
 assert.equal(api.isWriteContext(token),false);
 assert.throws(()=>api.confirmWrite('presupuestos',{...f.records['budget-ficticio'],fbKey:'budget-ficticio'},token),/sesión cambió/);
});
