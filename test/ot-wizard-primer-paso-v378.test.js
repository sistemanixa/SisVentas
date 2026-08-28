const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, 'js', 'modules', 'ot-workflow.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('Anterior se oculta en Cliente y reaparece desde el segundo paso', () => {
  assert.match(workflow, /ot-wiz301-ant'\)\.style\.display = idx<=0 \? 'none' : ''/);
  assert.match(workflow, /if\(idx>0\) show\(vis\[idx-1\]\.id\)/);
  assert.match(html, /js\/modules\/ot-workflow\.js\?v=3\.0\.2/);
});
