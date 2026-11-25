'use strict';
// Memory-only full-controller fixtures. No Firebase, production credentials or UI edits.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util');
const rootDir=path.resolve(__dirname,'../..'),clone=value=>structuredClone(value);
const LEGACY_SHA='37e1cbab93eb73b429f1997a28544a22436e4a95';
function legacyModule(){
 const source=cp.execFileSync('git',['show',LEGACY_SHA+':js/modules/purchase-orders.js'],{cwd:rootDir,encoding:'utf8',windowsHide:true});
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'b75745765292f1fa1f29660a1207e5b0bd778172212fd30ff0bed3ccf209cb90','Historical controller must match its pinned published source');
 for(const file of ['js/core/purchase-receipt-costs.v1.js','js/modules/paraguay-planner.js']){
  const old=cp.execFileSync('git',['show',LEGACY_SHA+':'+file],{cwd:rootDir,encoding:'utf8',windowsHide:true}).replace(/\r\n/g,'\n');
  assert.equal(fs.readFileSync(path.join(rootDir,file),'utf8').replace(/\r\n/g,'\n'),old,'Historical dependency changed: '+file);
 }
 return source;
}
function createFixture({records={},source,persist=clone,beforeTransaction=()=>{},onRead=()=>{},onCommit=()=>{}}={}){
 records=clone(records);const notes=[],capabilities=[],writes=[],commits=[],reads=[];
 let before=beforeTransaction;
 const modal={style:{},querySelectorAll:()=>[],setAttribute(){},removeAttribute(){}},document={addEventListener(){},getElementById:id=>id==='oc-order-modal'?modal:null,querySelector:()=>null,querySelectorAll:()=>[]};
 async function transact(kind,p,fn){
  before({kind,path:p,records});const prior=clone(records[p]??null),value=fn(clone(prior));
  if(value===undefined)return {committed:false,snapshot:{val:()=>clone(records[p]??null)}};
  const next=persist(clone(value));records[p]=next;commits.push({kind,path:p});if(!isDeepStrictEqual(prior,next))writes.push({kind,path:p,before:prior,next:clone(next)});onCommit({kind,path:p});
  return {committed:true,value:clone(next),snapshot:{val:()=>clone(next)}};
 }
 function updateChild(value,parts,next){let cursor=value;for(const key of parts.slice(0,-1))cursor=cursor[key]||(cursor[key]={});if(next===null)delete cursor[parts.at(-1)];else cursor[parts.at(-1)]=clone(next);}
 const w={document,currentUserUid:'fixture',currentRole:'admin',currentUser:'Usuario ficticio',fbAuth:{currentUser:{uid:'fixture'}},PERMISOS_ROLES:{admin:{indiceRevision:1}},permisoModulo:()=>true,svCapturarContextoOperacion:()=>()=>true,addEventListener(){},fbDB:{},fbRef:(_,p)=>p,
  SVPurchaseCommandAdapter:require('../../js/modules/purchase-command-adapter.v1'),SVPurchaseCommandForm:require('../../js/modules/purchase-command-form.v1'),SVPurchaseReceiptCosts:require('../../js/core/purchase-receipt-costs.v1'),SVExteriorPreparation:require('../../js/modules/exterior-preparation'),
  SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async()=>({})},fetch:async url=>{assert.equal(url,'https://fixture.invalid/laboral/capacidades');capabilities.push(url);return {ok:true,status:200,json:async()=>({ok:true,inventory:{version:1,installed:false,ready:false,generation:''}})};},
  notify:message=>notes.push(message),
  fbGet:async p=>{reads.push(p);onRead(p);return {val:()=>clone(records[p]??null)};},
  fbRunTransaction:(p,fn)=>transact('sdk',p,fn),
  fbUpdate:async(p,changes)=>{before({kind:'update',path:p,records});const prior=clone(records[p]??{}),next=clone(prior);for(const [key,value]of Object.entries(changes))updateChild(next,key.split('/'),value);records[p]=persist(next);commits.push({kind:'update',path:p});if(!isDeepStrictEqual(prior,records[p]))writes.push({kind:'update',path:p,before:prior,next:clone(records[p])});onCommit({kind:'update',path:p});},
  obtenerCostoItemVenta:item=>Number(item.costoTotalCompra??Number(item.qty||item.cantidad||1)*Number(item.costoUnitarioCompra||0))
 };
 w.SVGuardedWrites={equal:require('../../js/core/guarded-writes').equal,restTransaction:(p,fn)=>transact('rest',p,fn)};
 const text=source??fs.readFileSync(path.join(rootDir,'js/modules/purchase-orders.js'),'utf8'),anchor='  window.SisVentasCompras = {';
 assert.equal(text.split(anchor).length,2,'Full-controller test exposure must be unique');
 const hooked=text.replace(anchor,'  window.__purchaseFocal={savePreparationAndSaleCosts,buildPlannedOrders,finishPlannedPurchase,finishReceipt};\n'+anchor);
 vm.runInNewContext(hooked,{window:w,document,console,TextEncoder,AbortSignal,URL,setTimeout,clearTimeout});
 return {w,records,notes,capabilities,writes,commits,reads,api:w.__purchaseFocal,state:w.SisVentasCompras.state,before:fn=>before=fn};
}
module.exports={createFixture,legacyModule,LEGACY_SHA,clone};
