'use strict';
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9009','Sólo emulador local dedicado');
const dep=require('node:module').createRequire(path.join(process.env.SV_SECURITY_TOOLS,'package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing'),{ref,get,set,update}=dep('firebase/database');
const Model=require('../js/core/survey-summaries.v1'),Rules=require('../scripts/prepare-survey-summary-rules.cjs');
const access="auth != null && root.child('access').child(auth.uid).val() === true";
const rules=process.env.SV_SURVEY_RULES_FILE?JSON.parse(require('node:fs').readFileSync(process.env.SV_SURVEY_RULES_FILE,'utf8')):Rules.prepare({rules:{'.read':false,'.write':false,sisventas:{'.read':false,'.write':false,relevamientos:{'.read':access,'.write':access},ventas:{'.read':false,'.write':false}}}});
const row=()=>({id:'REL-ficticio',cliente:'Cliente ficticio',direccion:'Lugar ficticio',autor:'Técnico ficticio',savedAt:'2026-10-30T12:00:00.000Z',items:{foto:'Imagen ficticia privada'}});
let env;const client=uid=>env.authenticatedContext(uid).database();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-survey-summary-local',database:{host:'127.0.0.1',port:9009,rules:JSON.stringify(rules)}});});
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(async ctx=>set(ref(ctx.database()),{sv_chat_roles:{permitido:{rol:'admin',activo:true},denegado:{rol:'admin',activo:false}},access:{permitido:true},sisventas:{relevamientos_resumen:Model.buildIndex({},'a'.repeat(64)),ventas:{ficticia:{total:100}}}}));});
after(async()=>{await env?.cleanup();});
test('crear y editar confirman detalle y resumen juntos; datos privados quedan fuera del resumen',async()=>{
 const db=client('permitido'),original=row();await assertSucceeds(update(ref(db),Model.savePatch(original)));
 const index=(await get(ref(db,Model.INDEX))).val();assert.equal(index.records[original.id].cliente,original.cliente);assert.equal(index.records[original.id].items,undefined);
 await assertSucceeds(update(ref(db),Model.savePatch({...original,cliente:'Cliente modificado ficticio'})));
 assert.equal((await get(ref(db,Model.DETAIL+'/'+original.id+'/cliente'))).val(),'Cliente modificado ficticio');
});
test('detalle aislado, resumen falso y campos privados se rechazan sin modificar la pareja',async()=>{
 const db=client('permitido'),original=row();await update(ref(db),Model.savePatch(original));
 await assertFails(set(ref(db,Model.DETAIL+'/'+original.id),{...original,cliente:'No confirmado'}));
 const patch=Model.savePatch({...original,cliente:'No confirmado'});patch[Model.INDEX+'/records/'+original.id].cliente='Discrepante';await assertFails(update(ref(db),patch));
 const extra=Model.savePatch(original);extra[Model.INDEX+'/records/'+original.id].items='Privado';await assertFails(update(ref(db),extra));
 assert.deepEqual((await get(ref(db,Model.DETAIL+'/'+original.id))).val(),original);
});
test('eliminar exige borrar ambas partes; la eliminación atómica autorizada conserva otros dominios',async()=>{
 const db=client('permitido'),original=row();await update(ref(db),Model.savePatch(original));
 await assertFails(set(ref(db,Model.DETAIL+'/'+original.id),null));await assertFails(set(ref(db,Model.INDEX+'/records/'+original.id),null));
 await assertSucceeds(update(ref(db),{[Model.DETAIL+'/'+original.id]:null,[Model.INDEX+'/records/'+original.id]:null}));
 await env.withSecurityRulesDisabled(async ctx=>assert.equal((await get(ref(ctx.database(),'sisventas/ventas/ficticia/total'))).val(),100));
});
test('denegación de acceso, metadatos y raíz siguen protegidos',async()=>{
 for(const db of [client('sin-permiso'),env.unauthenticatedContext().database()]){await assertFails(get(ref(db,Model.INDEX)));await assertFails(get(ref(db,Model.DETAIL)));await assertFails(update(ref(db),Model.savePatch(row())));}
 const db=client('permitido');await assertFails(set(ref(db,Model.INDEX+'/meta/ready'),false));await assertFails(get(ref(db,'sisventas')));
});
test('un índice no preparado bloquea nuevos guardados sin inventar cobertura',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>set(ref(ctx.database(),Model.INDEX+'/meta/ready'),false));
 await assertFails(update(ref(client('permitido')),Model.savePatch(row())));
});
