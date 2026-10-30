'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const nodes={},paths=[],renders=[],readMarkers=[],user={uid:'u'};let stops=0,restores=0;
 function node(id){return nodes[id]||(nodes[id]={id,value:'',style:{},innerHTML:'',textContent:'',parentNode:{insertBefore(n){nodes[n.id]=n;}},remove(){delete nodes[this.id];},insertAdjacentHTML(_,html){this.innerHTML+=html;}});}
 const headers=Object.fromEntries(Array.from({length:120},(_,i)=>['m'+i,{autor:'Otra',texto:'Texto histórico '+i,ts:i}]));
 const root={document:{getElementById:node,createElement:()=>({style:{},remove(){delete nodes[this.id];}})},_chatCanal:'general',_chatCargaId:0,_chatListener:()=>{stops++;},fbDB:{},fbAuth:{currentUser:user},_chatListaVisible:[{texto:'último cargado'}],chatPuedeAccederCanal:()=>true,chatHeadersSnapshot:()=>headers,escapeHTML:text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),chatRenderMensajes:rows=>renders.push(rows),chatCargarCanal:c=>{assert.equal(c,'general');restores++;},fbRef:(_,p)=>p,fbOnValue:(path,callback)=>{paths.push(path);callback({val:()=>({autor:'Otra',texto:'Texto histórico 0',ts:0})});return ()=>{stops++;};},SVChatReadModel:{paths:(channel,key)=>({body:'sv_chat/'+channel+'/'+key}),markRead:async(channel,keys)=>readMarkers.push({channel,keys})},chatNombreSesion:()=> 'Actual',_chatFueLeido:()=>false,chatEstaLeyendo:()=>true,notify:()=>{}};
 root.window=root;vm.createContext(root);vm.runInContext(fs.readFileSync('js/core/chat-search.js','utf8'),root);return {root,headers,nodes,paths,renders,readMarkers,node,get stops(){return stops;},get restores(){return restores;}};
}
test('search covers older unloaded messages through metadata without fetching bodies',()=>{
 const f=fixture();f.node('chat-buscar').value='histórico';f.root.SVChatSearch.search();assert.equal(f.paths.length,0);assert.equal(f.stops,1);assert.match(f.node('chat-history-controls').innerHTML,/120 coincidencias/);assert.match(f.node('chat-messages').innerHTML,/1–50 de 120/);f.root.SVChatSearch.search(2);assert.match(f.node('chat-messages').innerHTML,/m0/);assert.match(f.node('chat-messages').innerHTML,/101–120 de 120/);
});
test('opening one match subscribes only to that body and acknowledges only that message',async()=>{
 const f=fixture();f.node('chat-buscar').value='histórico 0';f.root.SVChatSearch.search();f.root.SVChatSearch.reveal('m0');await Promise.resolve();assert.deepEqual(f.paths,['sv_chat/general/m0']);assert.equal(f.renders[0][0].fbKey,'m0');assert.equal(f.readMarkers.length,1);assert.equal(f.readMarkers[0].keys.length,1);assert.equal(f.readMarkers[0].keys[0],'m0');f.root.SVChatSearch.restore();assert.equal(f.restores,1);
});
test('author and filename matches stay escaped and result callbacks cannot interpolate database keys',()=>{
 const f=fixture();f.headers.bad={autor:'<script>Persona</script>',texto:'',archivoNombre:'Factura.pdf',ts:999};f.node('chat-buscar').value='factura';f.root.SVChatSearch.search();const html=f.node('chat-messages').innerHTML;assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>'));assert.match(html,/SVChatSearch.reveal\(this.dataset.chatResult\)/);assert.equal(f.paths.length,0);
});

test('revoked channel permission cannot start a body read',()=>{const f=fixture();f.root.chatPuedeAccederCanal=()=>false;f.root.SVChatSearch.reveal('m0');assert.equal(f.paths.length,0);f.root.SVChatSearch.search();assert.equal(f.paths.length,0);});
