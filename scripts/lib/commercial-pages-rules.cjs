'use strict';
const fail=m=>{throw Error(m)};
function prepare(input){const out=structuredClone(input),r=out.rules;if(!r||r.sv_commercial_pages||r.sv_commercial_pages_config)fail('Revisar las rutas de paginación antes de preparar reglas.');if(r['.read']&&r['.read']!==false||r['.write']&&r['.write']!==false)fail('No se admite autoridad global de lectura/escritura.');
const active="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && auth.token.svPasswordChangeRequired !== true && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && (!root.child('sv_access_resets').child(auth.uid).child('version').exists() || auth.token.svAccessVersion === root.child('sv_access_resets').child(auth.uid).child('version').val())",role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()",admin=role+" === 'admin'";
function module(name,defaults){const p="root.child('sv_permisos').child("+role+")";return "((!"+p+".exists() && ("+defaults.map(v=>role+" === '"+v+"'").join(' || ')+")) || ("+p+".child('indiceVersion').val() === 2 && "+p+".child('indiceModulos/"+name+"').val() === true && "+Array.from({length:64},(_,i)=>p+".child('bloqueados/"+i+"').val() !== '"+name+"'").join(' && ')+"))";}
const salesAllowed='('+module('detalle',['admin','administrativo','vendedor','tecnico_vendedor'])+' || '+module('venta',['admin','administrativo','vendedor','tecnico_vendedor'])+')',payAllowed=module('cobranzas',['admin','administrativo','vendedor','tecnico_vendedor']);
const financial=r.sv_labor_indexes?.['.write'];if(typeof financial!=='string'||!financial.includes('svLaborService')||!financial.includes('sv_labor_guard'))fail('No existe autoridad de escritura coordinada verificable.');
// Keep writes on the existing service fence; no client write grant is added.
const own="(("+admin+" && $scope === 'all') || $scope === 'u_' + auth.uid)",scoped=active+' && '+salesAllowed+' && '+own,limited=" && query.orderByKey && query.limitToFirst <= 50 && query.limitToFirst > 0",globalPay=active+' && '+payAllowed+" && $scope === 'all'";
r.sv_commercial_pages_config={'.read':active,'.write':false};
r.sv_commercial_pages={'.read':false,'.write':financial,v1:{collectionTotals:{'.read':active+' && '+payAllowed},coverage:{'.read':active+' && ('+salesAllowed+' || '+payAllowed+')'},totals:{$scope:{'.read':scoped}},lookup:{$scope:{$reference:{'.read':scoped}}},records:{sales:{$record:{'.read':active+' && '+salesAllowed+" && ("+admin+" || data.child('ownerUid').val() === auth.uid)"}},payments:{$record:{'.read':active+' && '+payAllowed}}},pages:{$scope:{sales:{'.read':scoped+limited},payments:{'.read':globalPay+limited},collection:{'.read':globalPay+limited}}}}};

return out;}
module.exports={prepare};
