const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function readActiveApp() {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const match = index.match(/<script src="\.\/js\/(app\.v[\d.]+\.js)(?:\?[^\"]*)?"/);
  if (!match) throw new Error('index.html no declara una aplicación inmutable activa');
  return {
    index,
    filename: match[1],
    source: fs.readFileSync(path.join(root, 'js', match[1]), 'utf8')
  };
}

module.exports = { readActiveApp };
