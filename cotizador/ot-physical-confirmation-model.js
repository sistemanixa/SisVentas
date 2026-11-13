'use strict';
// Pure planner. The caller must supply heldByOthers from a complete, authorized
// read of other OT custody for this product/allocation, then commit every row
// and its OT state in the same atomic patch. No database access occurs here.
const crypto = require('node:crypto');
const Money = require('./commercial-models/commercial-money.v1.js');
const GeneralException = require('./ot-general-consumption-exception');
const add = (...values) => Money.quantitySum(values);
const clone = value => JSON.parse(JSON.stringify(value));
function key(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value) || ['__proto__','prototype','constructor'].includes(value)) throw Error('Identidad de confirmación inválida');
  return value;
}
function qty(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw Error('Cantidad de confirmación inválida');
  return add(value);
}
function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw Error('Registro de inventario inválido');
  for (const id of Object.keys(value)) key(id);
  return value;
}
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function confirm(command) {
  const c = command || {}, actor = c.actor || {};
  if (!['admin','administrativo'].includes(actor.role) || actor.allowed !== true || actor.active === false || actor.viewAs === true) throw Error('Sin permiso para confirmar materiales');
  key(actor.uid);
  const identity = [key(c.otKey), key(c.rowKey), key(c.productKey), key(c.allocation)];
  key(c.operationId);
  if (!['delivery','installation'].includes(c.kind) || !Number.isSafeInteger(c.at) || c.at <= 0) throw Error('Confirmación inválida');
  const bd = qty(c.beforeDelivered), td = qty(c.targetDelivered), bi = qty(c.beforeInstalled), ti = qty(c.targetInstalled), returned = qty(c.returned ?? 0), held = qty(c.heldByOthers);
  if (td < bd || ti < bi || bi > bd || ti > td || add(ti, returned) > td || (c.kind === 'delivery' && ti !== bi) || (c.kind === 'installation' && td !== bd)) throw Error('La confirmación no corresponde al estado del material');
  const revision = c.revision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0) throw Error('Revisión de stock inválida');
  const receipt = c.receipt || hash(identity);
  if (!/^[a-f0-9]{64}$/.test(receipt)) throw Error('Recibo de stock inválido');
  const inv = clone(c.inventory ?? { general:0, reservado:0, consumido:0, asignaciones:{} });
  for (const field of ['general','reservado','consumido']) inv[field] = qty(inv[field]);
  inv.asignaciones ??= {};
  if (!inv.asignaciones || typeof inv.asignaciones !== 'object' || Array.isArray(inv.asignaciones)) throw Error('Reservas inválidas');
  let totalReserved = 0, totalConsumed = 0;
  for (const [id, value] of Object.entries(inv.asignaciones)) {
    key(id); record(value);
    totalReserved = add(totalReserved, qty(value.reservado ?? 0));
    totalConsumed = add(totalConsumed, qty(value.consumido ?? 0));
  }
  const reservedDiscrepancy = totalReserved > inv.reservado;
  if (totalConsumed > inv.consumido) throw Error('El inventario requiere conciliación');
  for (const name of ['confirmacionesOT','regularizacionesOT']) {
    if (inv[name] == null) continue;
    record(inv[name]);
    for (const [operation, storedRows] of Object.entries(inv[name])) {
      // RTDB numeric row maps may return as arrays with null holes.
      const rows = {};
      if (!Array.isArray(storedRows)) record(storedRows);
      for (const [row, audit] of Object.entries(storedRows)) {
        if (Array.isArray(storedRows) && audit === null) continue;
        key(row); const normalized = /^(0|[1-9][0-9]*)$/.test(row) ? 'r'+row : row;
        if (Object.hasOwn(rows,normalized)) throw Error('Auditoría de fila ambigua');
        rows[normalized] = audit;
      }
      inv[name][operation] = rows;
      for (const audit of Object.values(rows)) {
        record(audit);
        if (!/^[a-f0-9]{64}$/.test(audit.signature || '') || !/^[a-f0-9]{64}$/.test(audit.receipt || '') || !Number.isSafeInteger(audit.revision) || audit.revision < 1) throw Error('Auditoría de confirmación inválida');
        qty(audit.regularization);
      }
    }
  }
  const beforeInventory = clone(inv);
  inv.rendicionesOT ??= {}; record(inv.rendicionesOT);
  const receiptTotals = {};
  let receivedTotal = 0, heldTotal = 0;
  for (const [id, item] of Object.entries(inv.rendicionesOT)) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Recibo inválido');
    record(item); key(item.ot); key(item.venta);
    if (!Number.isSafeInteger(item.revision) || item.revision < 1 || add(qty(item.deReserva ?? 0),qty(item.deGeneral ?? 0)) !== qty(item.instalada)) throw Error('El recibo de consumo requiere conciliación');
    const totals = receiptTotals[item.venta] ||= {installed:0,held:0};
    totals.installed = add(totals.installed,item.instalada); totals.held = add(totals.held,qty(item.enReserva ?? 0));
    receivedTotal = add(receivedTotal,item.instalada); heldTotal = add(heldTotal,qty(item.enReserva ?? 0));
  }
  if (receivedTotal > inv.consumido || heldTotal > inv.reservado) throw Error('Los recibos exceden el inventario');
  for (const [allocation, totals] of Object.entries(receiptTotals)) {
    const assigned = inv.asignaciones[allocation];
    if (!assigned || totals.installed > qty(assigned.consumido ?? 0) || totals.held > qty(assigned.reservado ?? 0)) throw Error('Los recibos exceden su reserva');
  }
  const signature = hash([c.kind, identity, bd, td, bi, ti, returned, actor.uid]);
  const auditRowKey = 'r'+c.rowKey;
  const prior = inv.confirmacionesOT?.[c.operationId]?.[auditRowKey] || inv.confirmacionesOT?.[c.operationId]?.[c.rowKey];
  if (prior) {
    const applied = inv.rendicionesOT[prior.receipt];
    if (!applied || applied.ot !== c.otKey || applied.venta !== c.allocation || applied.revision < prior.revision) throw Error('La confirmación no tiene respaldo de inventario');
    if (prior.signature !== signature) throw Error('El intento ya corresponde a otra confirmación');
    return { inventory:inv, receipt:prior.receipt, revision:prior.revision, regularization:prior.regularization, replayed:true };
  }
  if (reservedDiscrepancy && (c.kind === 'installation' ? ti <= bi : td <= bd)) throw Error('El inventario requiere conciliación');
  inv.rendicionesOT ??= {};
  if (typeof inv.rendicionesOT !== 'object' || Array.isArray(inv.rendicionesOT)) throw Error('Recibos inválidos');
  const found = inv.rendicionesOT[receipt];
  if (found && (found.ot !== c.otKey || found.venta !== c.allocation || (found.fila !== undefined && found.fila !== c.rowKey))) throw Error('El recibo pertenece a otro material');
  // A prior client applied consumption but failed to persist the OT row.
  const recovered = c.kind === 'installation' && found && found.revision === revision + 1 && found.instalada === ti && ti > bi;
  if (found && !recovered && (found.revision !== revision || found.instalada !== bi)) throw Error('El stock del material cambió');
  if (!found && bi > 0) throw Error('La instalación histórica no tiene un recibo inequívoco');
  const a = inv.asignaciones[c.allocation] || { reservado:0, consumido:0, liberado:0 };
  a.reservado = qty(a.reservado ?? 0); a.consumido = qty(a.consumido ?? 0);
  if (held > a.reservado) throw Error('La custodia de otras OT requiere conciliación');
  const entry = found ? clone(found) : { revision, instalada:0, deReserva:0, deGeneral:0, enReserva:0, ot:c.otKey, venta:c.allocation, fila:c.rowKey };
  for (const field of ['instalada','deReserva','deGeneral','enReserva']) entry[field] = qty(entry[field] ?? 0);
  if (add(entry.deReserva, entry.deGeneral) !== entry.instalada || entry.instalada > a.consumido || entry.instalada > inv.consumido || entry.enReserva > a.reservado) throw Error('El recibo de consumo requiere conciliación');
  let regularization = 0, ownReservationReleased = 0;
  // An old aggregate deficit is not authority to consume another allocation.
  // Protect every foreign reservation and the verified custody of sibling OTs.
  const foreignReserved = add(totalReserved, -a.reservado);
  const unreceiptedBacking = Math.max(0, add(inv.reservado, -foreignReserved, -held));
  const receiptedBacking = Math.min(entry.enReserva, Math.max(0, add(inv.reservado, -heldTotal, entry.enReserva)));
  const backedReserve = Math.max(unreceiptedBacking, receiptedBacking);
  if (!recovered && c.kind === 'delivery') {
    const required = add(td, -ti, -returned), ownAvailable = Math.max(0, add(a.reservado, -held));
    const available = reservedDiscrepancy ? Math.min(ownAvailable, backedReserve) : ownAvailable;
    const missing = Math.max(0, add(required, -available));
    const transfer = Math.min(missing, inv.general);
    regularization = add(missing, -transfer);
    inv.general = add(inv.general, -transfer);
    inv.reservado = add(inv.reservado, missing); a.reservado = add(a.reservado, missing);
    entry.enReserva = required;
  } else if (!recovered) {
    const delta = add(ti, -bi), ownAvailable = Math.max(0, add(a.reservado, -held));
    const reserve = Math.min(delta, ownAvailable, reservedDiscrepancy ? backedReserve : ownAvailable);
    // Retire only this physically installed row's unbacked own reservation.
    // Never leave those same installed units available for another delivery.
    if (reservedDiscrepancy) ownReservationReleased = Math.min(add(delta, -reserve), add(ownAvailable, -reserve), add(totalReserved, -inv.reservado));
    const generalNeeded = add(delta, -reserve);
    regularization = Math.max(0, add(generalNeeded, -inv.general));
    inv.general = add(inv.general, regularization, -generalNeeded);
    inv.reservado = add(inv.reservado, -reserve); a.reservado = add(a.reservado, -reserve, -ownReservationReleased);
    inv.consumido = add(inv.consumido, delta); a.consumido = add(a.consumido, delta);
    entry.instalada = ti; entry.deReserva = add(entry.deReserva, reserve); entry.deGeneral = add(entry.deGeneral, generalNeeded);
    entry.enReserva = Math.max(0, add(entry.enReserva, -reserve));
  }
  entry.revision = recovered ? found.revision : revision + 1;
  inv.rendicionesOT[receipt] = entry; inv.asignaciones[c.allocation] = a;
  const audit = { signature, receipt, revision:entry.revision, regularization, kind:c.kind, producto:c.productKey, ot:c.otKey, fila:c.rowKey, venta:c.allocation, autor:actor.uid, nombre:String(actor.name || ''), fecha:c.at, motivo:'Confirmación física de materiales por operador autorizado' };
  if (reservedDiscrepancy) audit.stockDiscrepancy = {kind:'reserved-total-existing',assignedReserved:totalReserved,globalReserved:beforeInventory.reservado,difference:add(totalReserved,-beforeInventory.reservado),corrected:false};
  if (ownReservationReleased > 0) Object.assign(audit.stockDiscrepancy,{corrected:true,ownReservationReleased});
  inv.confirmacionesOT ??= {}; inv.confirmacionesOT[c.operationId] ??= {}; inv.confirmacionesOT[c.operationId][auditRowKey] = audit;
  if (regularization > 0) { inv.regularizacionesOT ??= {}; inv.regularizacionesOT[c.operationId] ??= {}; inv.regularizacionesOT[c.operationId][auditRowKey] = clone(audit); }
  if (reservedDiscrepancy) GeneralException.validate({before:beforeInventory,after:inv,productKey:c.productKey,allocation:c.allocation,otKey:c.otKey,receipt,kind:c.kind,beforeDelivered:bd,targetDelivered:td,beforeInstalled:bi,targetInstalled:ti,returned,heldByOthers:held,revision,actor,operationId:c.operationId,rowKey:c.rowKey});
  return { inventory:inv, receipt, revision:entry.revision, regularization, replayed:!!recovered };
}
module.exports = Object.freeze({ confirm });
