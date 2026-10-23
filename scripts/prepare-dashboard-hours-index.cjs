'use strict';
// Offline index-only candidate. No read grants, Firebase client or deploy.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const BASELINE_HASH = '4a859ae7ac48ff46554dcbc2b35ca9dab3057794630758b4674c1cf8c856c8a7';
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function build(input,{expectedHash=BASELINE_HASH}={}) {
  if (!input || !/^[a-f0-9]{64}$/.test(expectedHash) || hash(input) !== expectedHash) throw Error('Se requiere la base exacta revisada. No se aplicó ninguna regla.');
  const indexes=input.rules?.sisventas?.hsextra_solicitudes?.['.indexOn'];
  if(!Array.isArray(indexes)||!indexes.includes('estado')||!indexes.every(value=>typeof value==='string'&&value.trim()))throw Error('Índices de horas extra inesperados');
  const candidate = structuredClone(input);
  if(!indexes.includes('empFbKey'))candidate.rules.sisventas.hsextra_solicitudes['.indexOn'].push('empFbKey');
  return candidate;
}
if (require.main === module) {
  const [source,target,expectedHash=BASELINE_HASH,...extra] = process.argv.slice(2);
  if (!source || !target || extra.length || !/^[a-f0-9]{64}$/.test(expectedHash)|| !target.endsWith('.candidate.json') || path.resolve(source).toLowerCase() === path.resolve(target).toLowerCase()) throw Error('Uso offline: node scripts/prepare-dashboard-hours-index.cjs base-local.json salida.candidate.json [hash-base-revisado]');
  const candidate = build(JSON.parse(fs.readFileSync(source,'utf8')),{expectedHash});
  fs.writeFileSync(target,JSON.stringify(candidate,null,2)+'\n',{flag:'wx'});
  console.log('Índice empFbKey candidato, sin cambiar permisos ni aplicar reglas. SHA256 '+hash(candidate));
}
module.exports = {BASELINE_HASH,hash,build};
