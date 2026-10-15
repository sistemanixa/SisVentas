'use strict';
// Offline composition only. The current production policy or any reviewed
// candidate can be the input. Never removes a restriction or applies rules.
const fs = require('node:fs');
const {GUARD} = require('../cotizador/password-policy');
function build(input) {
  const result = structuredClone(input);
  if (!result.rules || result.rules.sv_access_resets || result.rules.sv_access_control) throw Error('Base de reglas inesperada o ya preparada');
  function walk(node) {
    for (const [name, value] of Object.entries(node)) {
      if (['.read', '.write'].includes(name) && value !== false && value !== 'false') node[name] = '(' + value + ') && ' + GUARD;
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(result.rules);
  // A parent grant would override these private children. Production base and
  // reviewed candidates deny at root; fail instead of pretending a child veto works.
  if (result.rules['.read'] && result.rules['.read'] !== 'false' || result.rules['.write'] && result.rules['.write'] !== 'false') throw Error('La raíz debe denegar; no admite secretos privados con permisos padre');
  result.rules.sv_access_resets = {'.read': false, '.write': false};
  result.rules.sv_access_control = {'.read': false, '.write': false};
  return result;
}
if (require.main === module) {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination || !destination.endsWith('.candidate.json')) throw Error('Uso: node scripts/prepare-password-access.cjs base.json salida.candidate.json');
  fs.writeFileSync(destination, JSON.stringify(build(JSON.parse(fs.readFileSync(source, 'utf8'))), null, 2) + '\n');
}
function buildStorage(source) {
  if (source.includes('passwordReady()') || !source.includes('request.auth != null')) throw Error('Base Storage inesperada');
  const secured = source.replaceAll('request.auth != null','passwordReady()');
  return secured.replace('match /b/{bucket}/o {', "match /b/{bucket}/o {\n    function passwordReady() {\n      return request.auth != null && request.auth.token.get('svPasswordChangeRequired', false) != true;\n    }");
}
module.exports = {build, buildStorage};
