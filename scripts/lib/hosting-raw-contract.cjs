'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function publicPath(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.startsWith('/') ||
      name.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('.')) ||
      /(^|\/)(tmp|security|docs|drafts|node_modules)(\/|$)/i.test(name)) throw Error('Ruta pública inválida: ' + name);
  if (!/^(?:js\/|css\/)/.test(name) && !/^(?:index\.html|personal-finance\.html|catalogo\.html|sw\.js|push-sw\.js|manifest\.webmanifest|logo_blanco\.jpg|nixa-icon-(?:192|512)\.png)$/.test(name)) throw Error('Ruta fuera del alcance público: ' + name);
  return name;
}
function readRegular(root, name) {
  publicPath(name);
  let current = path.resolve(root);
  for (const part of name.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('No se admiten enlaces: ' + name);
  }
  if (!fs.statSync(current).isFile()) throw Error('No es archivo regular: ' + name);
  return fs.readFileSync(current);
}
// Takes immutable raw snapshots BEFORE credentials, compression or network.
// Only these buffers may subsequently be compressed/uploaded; never reread paths.
function verifyRawArtifact({root, names, manifest, sourceCommit, config}) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit || '') || manifest.schema !== 1 || manifest.kind !== 'hosting-raw-byte-contract' || manifest.sourceCommit !== sourceCommit ||
      manifest.configSha256 !== sha256(Buffer.from(JSON.stringify(config)))) throw Error('Contrato RAW/fuente/configuración incompatible');
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw Error('Contrato RAW sin archivos');
  const expected = new Map();
  for (const row of manifest.files) {
    publicPath(row.path);
    if (expected.has(row.path) || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || !/^[a-f0-9]{64}$/.test(row.sha256)) throw Error('Entrada RAW inválida o duplicada');
    expected.set(row.path, row);
  }
  if (new Set(names).size !== names.length || names.length !== expected.size || names.some(n => !expected.has(n))) throw Error('Selección pública distinta del contrato RAW');
  const buffers = new Map();
  for (const name of names) {
    const bytes = readRegular(root, name), row = expected.get(name);
    if (bytes.length !== row.bytes || sha256(bytes) !== row.sha256) throw Error('Bytes RAW distintos: ' + name);
    buffers.set(name, bytes);
  }
  return buffers;
}
function loadVerifiedRawArtifact({manifestPath, expectedManifestSha256, ...options}) {
  if (!/^[a-f0-9]{64}$/.test(expectedManifestSha256 || '')) throw Error('Indicar --expected-raw-manifest-sha256 revisado');
  const raw = fs.readFileSync(manifestPath);
  if (sha256(raw) !== expectedManifestSha256) throw Error('Hash del contrato RAW distinto');
  return verifyRawArtifact({...options, manifest: JSON.parse(raw.toString('utf8'))});
}
module.exports = {sha256, publicPath, readRegular, verifyRawArtifact, loadVerifiedRawArtifact};
