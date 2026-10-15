const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
test('candidato de hosting se importa sin sesión, procesos externos ni red',()=>{
  const {files,config}=require('../scripts/deploy-secure-hosting.cjs');
  const listed=files();assert.ok(listed.includes('index.html'));
  for(const name of listed)assert.ok(!/(^|\/)(?:security|docs|drafts|tmp|\.local|\.git|node_modules)(?:\/|$)/.test(name),name);
  assert.ok(config.headers[0].headers['X-Content-Type-Options']);
});
test('hosting por defecto solo muestra el plan, incluso sin gcloud disponible',()=>{
  const result=spawnSync(process.execPath,['scripts/deploy-secure-hosting.cjs'],{encoding:'utf8',env:{...process.env,PATH:''}});
  assert.equal(result.status,0,result.stderr);const plan=JSON.parse(result.stdout);
  assert.equal(plan.mode,'plan');assert.ok(plan.files>0);
});
test('generador intermedio conserva todos los nodos excepto la lectura padre',()=>{
  const {build}=require('../scripts/prepare-known-role-read.cjs');
  const base=JSON.parse(fs.readFileSync('security/database.domain-write.candidate.json','utf8'));
  const result=build(base);const read=result.rules.sisventas['.read'];
  assert.match(read,/activo/);assert.match(read,/tecnico_vendedor/);
  result.rules.sisventas['.read']=base.rules.sisventas['.read'];assert.deepEqual(result,base);
});
