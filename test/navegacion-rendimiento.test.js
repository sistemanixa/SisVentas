const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = require('./helpers/active-app').readActiveApp().source;

test('índice de clientes conserva precedencia, alias históricos y ausencia de coincidencias', () => {
  const c = {clientesData:[
    {fbKey:'a',id:'0009',nombre:'Ezequiel',apellido:'Muñoz'},
    {fbKey:'b',id:'9',nombre:'Ezequiel'},
    {fbKey:'c',nombre:'Otro',empresa:'Empresa'}
  ],_svTxtClave:v=>String(v||'').trim(),_svTxtNombre:v=>String(v||'').trim().toLowerCase()};
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('function _svClienteClaves('),source.indexOf('// Los documentos comerciales nuevos guardan')), c);
  const indice=c._svCrearIndiceClientes();
  for(const r of [{clienteId:'9'},{clienteId:'0009'},{clienteFbKey:'b',clienteId:'9'},{cliente:'Ezequiel Muñoz'},{cliente:'Empresa'},{clienteFbKey:'ausente',cliente:'Ezequiel'},{}]) {
    for(const permitir of [true,false]) assert.equal(c._svResolverClienteRegistro(r,permitir,indice),c._svResolverClienteRegistro(r,permitir));
  }
  c.clientesData[0].nombre='Actualizado';
  assert.equal(c._svResolverClienteRegistro({cliente:'Actualizado'},true,c._svCrearIndiceClientes()),c.clientesData[0]);
});

test('ordenador ignora cambios ajenos y no mueve filas ya ordenadas', () => {
  let observer, scans=0, moves=0;
  const frames=[];
  const th={dataset:{},textContent:'Fecha',hasAttribute:()=>false,setAttribute(){}};
  const body={rows:[],appendChild(row){moves++;this.rows=this.rows.filter(r=>r!==row);this.rows.push(row);}};
  const table={isConnected:true,dataset:{},tBodies:[body],querySelectorAll(){scans++;return [th];}};
  const row=date=>({cells:[{textContent:date}]});
  body.rows=[row('19/09/2026'),row('18/09/2026')];
  const c={window:{},document:{readyState:'complete',documentElement:{},querySelectorAll:()=>[table]},requestAnimationFrame:fn=>frames.push(fn),MutationObserver:class{constructor(fn){observer=fn;}observe(){}}};
  vm.runInNewContext(fs.readFileSync('js/modules/grid-default-order.js','utf8'),c);
  assert.equal(moves,0);
  const before=scans;
  observer([{target:{nodeType:1,closest:()=>null},addedNodes:[]}]);
  assert.equal(frames.length,0); assert.equal(scans,before);
  body.rows.push(row('20/09/2026'));
  observer([{target:{nodeType:1,closest:()=>table},addedNodes:[]}]);
  frames.shift()();
  assert.deepEqual(body.rows.map(r=>r.cells[0].textContent),['20/09/2026','19/09/2026','18/09/2026']);
  const moved=moves;
  observer([{target:{nodeType:1,closest:()=>table},addedNodes:[]}]); frames.shift()();
  assert.equal(moves,moved);
});

test('alineación lee todos los contenedores antes de modificar estilos', () => {
  const eventos=[];
  const cells=[0,1].map(i=>({style:new Proxy({}, {set(o,k,v){eventos.push('write');o[k]=v;return true;}})}));
  const style={textContent:''};
  const c={document:{getElementById:()=>style},tableHeaders:()=>[{}],physicalIndexForVisibleIndex:()=>0,
    columnCells:()=>cells,actionContainersInCell:()=>{eventos.push('read');return [];},
    isActionsHeader:()=>false,normalizeAlignment:a=>a||'left',alignmentScopeSequence:0};
  vm.createContext(c);
  const s=fs.readFileSync('js/modules/resizable-tables.js','utf8');
  vm.runInContext(s.slice(s.indexOf('  function applyAlignments('),s.indexOf('  function clearAlignments(')),c);
  c.applyAlignments({dataset:{svAlignmentScope:'test'}},{0:'right'});
  assert.deepEqual(eventos,['read','read','write','write']);
  assert.equal(cells[0].style.textAlign,'right');
  assert.match(style.textContent,/text-align:right!important/);
});
