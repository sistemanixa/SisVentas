'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {build,markdown}=require('../scripts/build-server-final-matrix.cjs');
test('matriz conserva cobertura e identifica evidencia sin convertirla en medición/despliegue',()=>{
 const result=build(path.resolve(__dirname,'..'));
 assert.equal(result.routes.length,91);assert.equal(result.routes.reduce((n,r)=>n+r.method.split('|').length,0),92);assert.equal(result.otherServices.length,28);
 assert.equal(result.routes.find(r=>r.route==='/compras/ordenes/reconciliar-pendiente').decision,'mantener-servidor');
 assert.ok(result.commandFamilies.laborGatewayPurposes.includes('sale-return-to-budget'));
 for(const r of result.routes){assert.ok(result.groupEvidence[r.evidenceGroup].authority);assert.ok(r.action);assert.match(r.runtime,/No verificado/);assert.ok(r.measurement);}
 assert.ok(result.routes.filter(r=>['financial','private','commissions','access'].includes(r.group)).every(r=>r.decision==='mantener-servidor'));
 assert.equal(result.routes.filter(r=>r.decision==='direccion-firebase-condicional').length,1);
 assert.equal(result.routes.find(r=>r.route==='/laboral/escritura').decision,'optimizable-backend-con-prueba');
 assert.match(result.routes.find(r=>r.route==='/laboral/escritura').action,/No implementado/);
 assert.ok(result.routes.find(r=>r.route==='/laboral/directorio').routerEvidence?.line>0);
 assert.ok(result.routes.find(r=>r.route==='/comerciales/ventas/registro/:id').routerEvidence===null);
 assert.ok(result.otherServices.every(r=>r.measurement.startsWith('No medida')));
 assert.match(markdown(result),/No quitar original sin prueba/);
});
