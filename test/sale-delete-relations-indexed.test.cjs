'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Indexed=require('../cotizador/sale-delete-relations-indexed');
const {child,parts,put}=require('../cotizador/labor-guard');
function fixture(){
 const collections={ventas:{},pagos:{},ordenes_trabajo:{},presupuestos:{},reclamos:{}};
 for(let position=0;position<260;position++){const id='s'+position,number=String(position).padStart(6,'0');collections.ventas[id]={id:'V-'+number};collections.pagos['p'+position]={venta:'PREFIX / '+number};collections.ordenes_trabajo['o'+position]={ventaNumero:'OT '+number};collections.presupuestos['b'+position]={ventaGeneradaId:'#v-'+number};}
 const built=Indexed.prepare(collections,{generation:'fixture-generation'});let state={sisventas:structuredClone(collections)};for(const [path,value]of Object.entries(built.patch))state=put(state,parts(path),value);
 const reads=[],read=async path=>{reads.push(path);return structuredClone(child(state,parts(path)));};
 return {collections,state,reads,read,options:{generation:'fixture-generation',revision:1}};
}
test('260 records discovered with point reads, including numeric legacy and inverse budget normalization',async()=>{const f=fixture(),result=await Indexed.discover(f.read,'s259',f.options);assert.deepEqual(result.links,{pagos:['p259'],ordenes_trabajo:['o259'],presupuestos:['b259']});assert(!f.reads.some(path=>/^sisventas\/(ventas|pagos|ordenes_trabajo|presupuestos|reclamos)$/.test(path)));assert(f.reads.length<30);});
test('ambiguity blocks the entire indexed sale rather than selecting one owner',async()=>{const f=fixture();f.collections.ventas.other={id:'OTHER-000259'};const built=Indexed.prepare(f.collections,{generation:'fixture-generation'});assert.match(built.patch[Indexed.ROOT+'/fixture-generation/sales/s259'].blocked,/ambiguo/);});
test('zeros and technical priority preserve the canonical result',()=>{const f=fixture();f.collections.pagos.zero={venta:'259'};f.collections.pagos.technical={ventaFbKey:'s1',venta:'PREFIX / 000259'};const built=Indexed.prepare(f.collections,{generation:'fixture-generation'}),entry=built.patch[Indexed.ROOT+'/fixture-generation/sales/s259'];assert.deepEqual(entry.links.pagos,['p259']);});
test('missing generation, original mutation and concurrent coverage revision reject',async()=>{for(const scenario of ['generation','original','concurrent']){const f=fixture();if(scenario==='generation')f.options.generation='other-generation';if(scenario==='original')f.state.sisventas.pagos.p259.monto=99;let count=0;const read=async path=>{if(scenario==='concurrent'&&path===Indexed.ROOT+'/coverage'&&++count===2)f.state.sv_sale_delete_relations.v1.coverage.revision++;return f.read(path);};await assert.rejects(Indexed.discover(read,'s259',f.options),{code:'SV_SALE_DELETE_COVERAGE'});}});
