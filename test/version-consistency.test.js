const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const index = read('index.html');
const versionMatch = index.match(/VERSION:\s*'([^']+)'/);
const appMatch = index.match(/<script src="\.\/js\/(app\.v[\d.]+\.js)(?:\?[^\"]*)?"><\/script>/);
const coreMatch = index.match(/<script src="\.\/js\/core\/(version\.v[\d.]+\.js)(?:\?[^\"]*)?"><\/script>/);

test('la versión activa tiene una única identidad en todos los artefactos', () => {
  assert.ok(versionMatch, 'index.html debe declarar VERSION');
  assert.ok(appMatch, 'index.html debe cargar una aplicación inmutable');
  assert.ok(coreMatch, 'index.html debe cargar un marcador inmutable');

  const fullVersion = versionMatch[1];
  const version = fullVersion.replace(/-firebase$/, '');
  assert.match(appMatch[1], new RegExp(`^app\\.${version.replace(/\./g, '\\.')}\\.js$`));
  assert.match(coreMatch[1], new RegExp(`^version\\.${version.replace(/\./g, '\\.')}\\.js$`));

  const app = read('js', appMatch[1]);
  const core = read('js', 'core', coreMatch[1]);
  const light = read('js', 'core', 'version.js');
  const worker = read('sw.js');

  assert.match(app, new RegExp(`VERSION:\\s*'${fullVersion}'`));
  assert.match(app, new RegExp(`RELEASE_HISTORY[\\s\\S]*?version:\\s*'${version}'`));
  assert.match(core, new RegExp(`SISVENTAS_PWA_VERSION\\s*=\\s*'${version}'`));
  assert.match(light, new RegExp(`SISVENTAS_PWA_VERSION\\s*=\\s*'${version}'`));
  assert.match(worker, new RegExp(`const\\s+CACHE\\s*=\\s*'sisventas-${version}(?:-[^']+)?'`));
  assert.match(worker, new RegExp(`'\\./js/app\\.${version.replace(/\./g, '\\.')}\\.js'`));
  assert.match(worker, new RegExp(`'\\./js/core/version\\.${version.replace(/\./g, '\\.')}\\.js'`));
});
