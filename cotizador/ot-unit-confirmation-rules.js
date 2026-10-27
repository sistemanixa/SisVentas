'use strict';
const {isDeepStrictEqual} = require('node:util');
const {metadataRules} = require('./labor-fence-policy');
// Restrictions shared by the offline builder and the authenticated endpoint.
// They never grant read/write access and do not replace existing permissions.
// RTDB skips .validate on deletion. These are create/update protections only;
// the dedicated endpoint must never emit a null unit or delete an existing one.
const DOMAINS = Object.freeze(['equipos','garantias']);
const closed = value => value === undefined || value === false || value === 'false';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const api = "(auth != null && auth.token.svLaborService === true && auth.token.svOTUnitConfirmation === true)";

function leaseValidation() {
  return "newData.isNumber() && newData.val() === 1 && auth != null && auth.uid === 'sv-labor-service' && auth.token.svLaborService === true && auth.token.svOTUnitConfirmation === true && auth.token.mode === 'acquire' && newData.parent().child('mode').val() === 'user' && newData.parent().child('actorUid').val() === auth.token.actorUid && newData.parent().child('opId').val().matches(/^ot_units_[a-f0-9]{64}$/)";
}

function validationFor(domain) {
  if (!DOMAINS.includes(domain)) throw Error('Dominio de unidades inválido');
  const opposite = domain === 'equipos' ? 'garantias' : 'equipos';
  // root is the previous committed snapshot. newData's parent is the complete
  // proposed domain, so its parent includes the other side of the same PATCH.
  // Both checks prevent a simultaneous double create or a cross-path move.
  const absent = "(!root.child('sisventas/" + opposite + "').child($unidad).exists() && !newData.parent().parent().child('" + opposite + "').child($unidad).exists())";
  const managed = "($unidad.beginsWith('unidad_') && (newData.child('origen').val() === 'venta_ot' || newData.child('origen').val() === 'venta_ot_v2' || newData.child('origen').val() === 'venta_ot_manual_v1'))";
  return '(!' + api + " || (auth.token.mode === 'commit' && root.child('sv_labor_guard/mode').val() === 'user' && root.child('sv_labor_guard/otUnitPolicy').val() === 1 && !data.exists() && " + absent + ')) && (data.exists() || !' + managed + ' || ' + absent + ')';
}

function protectedNode(node, domain) {
  if (!object(node) || !Object.hasOwn(node,'.write') || !['string','boolean'].includes(typeof node['.write']) || Object.hasOwn(node,'.validate')) return false;
  if (Object.keys(node).some(name => !name.startsWith('.') && name !== '$unidad')) return false;
  return object(node.$unidad) && Object.keys(node.$unidad).length === 1 && node.$unidad['.validate'] === validationFor(domain);
}

function rulesProtectOTUnitConfirmation(input) {
  const rules = object(input) && object(input.rules) ? input.rules : input;
  const guard = metadataRules().sv_labor_guard;
  guard.otUnitPolicy = {'.validate':leaseValidation()};
  return object(rules) && closed(rules['.write']) && object(rules.sisventas) && closed(rules.sisventas['.write']) && isDeepStrictEqual(rules.sv_labor_guard,guard) && DOMAINS.every(domain => protectedNode(rules.sisventas[domain],domain));
}

module.exports = Object.freeze({DOMAINS, leaseValidation, validationFor, rulesProtectOTUnitConfirmation});
