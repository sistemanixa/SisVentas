'use strict';
// Offline only: explicit local JSON + reviewed semantic hash. No authentication,
// provider, remote reads, installation or application of rules.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {isDeepStrictEqual} = require('node:util');
const {metadataRules} = require('../cotizador/labor-fence-policy');
const {DOMAINS, leaseValidation, validationFor, rulesProtectOTUnitConfirmation} = require('../cotizador/ot-unit-confirmation-rules');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const closed = value => value === undefined || value === false || value === 'false';

function build(input, {expectedHash} = {}) {
  if (!object(input) || !object(input.rules) || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash) || hash(input) !== expectedHash) throw Error('Se requiere la base local y su hash semántico revisado');
  const rules = input.rules;
  if (!closed(rules['.write']) || !object(rules.sisventas) || !closed(rules.sisventas['.write'])) throw Error('Concesión de escritura ancestro inesperada');
  if (!isDeepStrictEqual(rules.sv_labor_guard,metadataRules().sv_labor_guard)) throw Error('La coordinación existente requiere revisión');
  for (const domain of DOMAINS) {
    const node = rules.sisventas[domain];
    if (!object(node) || !Object.hasOwn(node,'.write') || !['string','boolean'].includes(typeof node['.write'])) throw Error('Nodo de unidades o permiso existente no reconocido');
    // A literal child takes precedence over a wildcard. Never claim coverage
    // for an unfamiliar subtree or overwrite validations from another change.
    if (Object.hasOwn(node,'.validate') || Object.keys(node).some(name => !name.startsWith('.'))) throw Error('Validación o descendiente de unidades requiere revisión');
  }
  const result = structuredClone(input);
  for (const domain of DOMAINS) result.rules.sisventas[domain].$unidad = {'.validate':validationFor(domain)};
  result.rules.sv_labor_guard.otUnitPolicy = {'.validate':leaseValidation()};
  if (!rulesProtectOTUnitConfirmation(result)) throw Error('La candidata no conserva la protección de unidades');
  return result;
}

if (require.main === module) {
  const [source,target,expectedHash,...rest] = process.argv.slice(2);
  if (!source || !target || rest.length || !target.endsWith('.candidate.json') || path.resolve(source) === path.resolve(target)) throw Error('Uso: node scripts/prepare-ot-unit-confirmation-rules.cjs base-local.json salida.candidate.json hash-base-revisado');
  const candidate = build(JSON.parse(fs.readFileSync(source,'utf8')), {expectedHash});
  fs.writeFileSync(target, JSON.stringify(candidate,null,2) + '\n', {flag:'wx'});
  console.log('Candidata LOCAL sin aplicar. SHA256 ' + hash(candidate));
}

module.exports = {build, hash};
