'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {load,functionSource}=require('./helpers/app-functions.cjs');
const copy=value=>JSON.parse(JSON.stringify(value)),REV='ABCDEFGHIJKLMNOPQRSTUV12';
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function row(item={}){
 const fields={code:{textContent:item.cod||'P-DUP'},desc:{textContent:item.desc||'Producto ficticio'},qty:{value:item.qty??1},price:{value:item.punit??100,dataset:{}},disc:{value:item.disc??0}};
 return {dataset:{svCommercialNew:'1'},fields,querySelector(selector){return selector.includes('prod-sel-cod')?fields.code:selector.includes('desc')?fields.desc:selector.includes('qty')?fields.qty:selector.includes('price')?fields.price:selector.includes('disc')?fields.disc:null;},querySelectorAll(){return [];},closest(){return null;}};
}
function rowsFixture(){
 const body={rows:[],appendChild(r){this.rows.push(r);},set innerHTML(v){this.rows=[];},get innerHTML(){return '';}},c={window:null,document:{getElementById:id=>id==='pp-body'?body:null,querySelectorAll:()=>body.rows},
  pptoNumeroGuardado:v=>Number(v)||0,descripcionVisibleItemDocumento:i=>i.desc||'',crearFilaProducto:(cod,desc,punit,qty,disc)=>row({cod,desc,punit,qty,disc}),_pptoAsegurarFilaVacia(){},calcPpTotales(){},
  _redondearPrecioActual:v=>Math.round(v*100)/100,obtenerProductoPorCodigoVenta:()=>null};c.window=c;
 load(c,['ordenarItemsComerciales','pptoNormalizarItemGuardado','pptoCargarItemsEnEditor','getPpItems']);return {c,body};
}
function preparationFixture(){
 const pending=deferred(),page={},button={tagName:'BUTTON',innerHTML:'Editar',disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}},calls=[],notices=[];
 const state={valid:true,page},c={window:null,location:{href:'https://fixture.invalid/#/ventas'},document:{hidden:false,activeElement:button,querySelector:()=>state.page},
  notify:m=>notices.push(m),SVCommercialOwnership:{captureWriteContext:domain=>({domain}),isWriteContext:()=>state.valid,prepare(domain,id){calls.push({domain,id});return pending.promise;}}};c.window=c;
 load(c,['svPrepararEditorComercial']);return {c,state,page,button,calls,notices,pending};
}
test('normalizador mantiene referencia exacta y dinero sin modificar el original',()=>{
 const f=rowsFixture(),line={cod:'P-DUP',desc:'Primero',qty:2.5,punit:123.45,disc:7,costoUnitarioCompra:88.32,_svLineRef:REV+':4'},before=copy(line),out=f.c.pptoNormalizarItemGuardado(line);
 assert.equal(out._svLineRef,REV+':4');assert.equal(out.qty,2.5);assert.equal(out.punit,123.45);assert.equal(out.costoUnitarioCompra,88.32);assert.deepEqual(line,before);assert.equal(out._svCommercialNew,undefined);
});
test('normalizador no inventa referencias para un SKU ni convierte desconocidos en nuevos',()=>{
 const f=rowsFixture();assert.equal(f.c.pptoNormalizarItemGuardado({cod:'P-DUP'})._svLineRef,undefined);assert.equal(f.c.pptoNormalizarItemGuardado({cod:'P-DUP'})._svCommercialNew,undefined);assert.equal(f.c.pptoNormalizarItemGuardado({_svCommercialNew:true})._svCommercialNew,true);
});
test('editor histórico y getter conservan duplicados/reordenados por token y no por SKU',()=>{
 const f=rowsFixture(),record={items:[{cod:'P-DUP',desc:'Mismo',qty:1,punit:100,orden:2,_svLineRef:REV+':0'},{cod:'P-DUP',desc:'Mismo',qty:2,punit:210,orden:1,_svLineRef:REV+':1'}]},before=copy(record);
 f.c.pptoCargarItemsEnEditor(record,true);const out=f.c.getPpItems();assert.deepEqual(copy(out.map(x=>x._svLineRef)),[REV+':1',REV+':0']);assert.deepEqual(copy(out.map(x=>x.sub)),[420,100]);assert.ok(out.every(x=>x._svCommercialNew===undefined));assert.deepEqual(record,before);
 f.body.rows.reverse();assert.deepEqual(copy(f.c.getPpItems().map(x=>x._svLineRef)),[REV+':0',REV+':1']);f.body.rows.shift();assert.equal(f.c.getPpItems()[0]._svLineRef,REV+':1');
});
for(const label of ['duplicado','propuesta','otro documento'])test(label+': cargar como copia crea renglones nuevos sin token del origen',()=>{
 const f=rowsFixture(),record={items:[{cod:'P-DUP',desc:label,qty:5,punit:35.2,_svLineRef:REV+':9'}]},before=copy(record);f.c.pptoCargarItemsEnEditor(record);const [out]=f.c.getPpItems();assert.equal(out._svLineRef,undefined);assert.equal(out._svCommercialNew,true);assert.equal(out.sub,176);assert.deepEqual(record,before);
});
test('histórico sin token falla cerrado en identidad; no se hace pasar por renglón nuevo',()=>{
 const f=rowsFixture();f.c.pptoCargarItemsEnEditor({items:[{desc:'Legacy sin preparar',punit:30}]},true);const [out]=f.c.getPpItems();assert.equal(out._svLineRef,undefined);assert.equal(out._svCommercialNew,undefined);
});
test('fila agregada expresamente y fila histórica conviven sin inferencia de catálogo',()=>{
 const f=rowsFixture();f.c.pptoCargarItemsEnEditor({items:[{desc:'Guardado',_svLineRef:REV+':0'}]},true);f.body.appendChild(row({desc:'Nuevo'}));const out=f.c.getPpItems();assert.equal(out[0]._svLineRef,REV+':0');assert.equal(out[1]._svCommercialNew,true);assert.equal(out[1]._svLineRef,undefined);
});
test('crearFilaProducto marca nueva desde su creación, sin necesidad de catálogo o SKU único',()=>{
 const tr={dataset:{}};const c={window:null,document:{createElement:()=>tr},obtenerProductoPorCodigoVenta:()=>null,stockBadgeHTML:()=>'',puedeModificarDescripcionItemDocumento:()=>false,escapeHTML:x=>String(x),imagenProductoItemHTML:()=>'',initMoneyInputsEn(){}};c.window=c;load(c,['crearFilaProducto']);assert.equal(c.crearFilaProducto('P-DUP','Producto',100,1,0).dataset.svCommercialNew,'1');assert.equal(tr.dataset.svLineRef,undefined);
});
test('selección explícita de producto retira el token anterior aunque coincida el SKU',()=>{
 const tr=row();tr.dataset.svLineRef=REV+':5';tr.dataset.svCommercialNew=undefined;tr.querySelector=()=>null;
 const c={window:null,document:{getElementById:()=>null},_prodDropTR:tr,prodData:{},advertirStockProveedorFavorito(){},calcPpTotales(){},notify(){},setTimeout(){throw Error('No debe programar nada para fila aislada');}};c.window=c;load(c,['_selProdGlobal']);c._selProdGlobal({dataset:{cod:'P-DUP',desc:'Producto',precio:'100'}});assert.equal(tr.dataset.svLineRef,undefined);assert.equal(tr.dataset.svCommercialNew,'1');
});
test('loader real de venta conserva refs y precios históricos y no muta origen',()=>{
 const body={rows:[],appendChild(r){this.rows.push(r);},set innerHTML(v){this.rows=[];}},c={window:null,document:{getElementById:id=>id==='det-body'?body:null},resolverIdClienteVenta:()=>'',_svResolverClienteRegistro:()=>null,mostrarDomicilioOperacionSeleccionado(){},aplicarEstadoIvaVenta(){},actualizarVisualMonedaVenta(){},crearFilaProducto:(cod,desc,punit,qty,disc)=>row({cod,desc,punit,qty,disc}),descripcionVisibleItemDocumento:i=>i.desc,precioHistoricoItemVenta:i=>i.punit,calcTotals(){},empData:{},ventaComisionadoPrincipalIdentidad:()=>({}),ventaComisionadoSecundarioIdentidad:()=>({})};c.window=c;load(c,['ordenarItemsComerciales','cargarRegistroVentaEnEditor']);
 const sale={fbKey:'sale-demo',items:[{cod:'P-DUP',desc:'Primero',punit:11.12,_svLineRef:REV+':0'},{cod:'P-DUP',desc:'Segundo',punit:99.98,_svLineRef:REV+':1'}]},before=copy(sale);c.cargarRegistroVentaEnEditor(sale);assert.deepEqual(body.rows.map(r=>r.dataset.svLineRef),[REV+':0',REV+':1']);assert.ok(body.rows.every(r=>r.dataset.svCommercialNew===undefined));assert.deepEqual(body.rows.map(r=>r.fields.price.value),[11.12,99.98]);assert.deepEqual(sale,before);assert.equal(c._ventaEditandoOriginal.items[1]._svLineRef,REV+':1');
});
test('colector real de confirmarVenta conserva token o intención nueva sin cambiar importes',()=>{
 const source=functionSource('confirmarVenta'),start=source.indexOf('items: filas.map('),end=source.indexOf('\n    descuentoGeneral:',start);assert.ok(start>0&&end>start);const expression=source.slice(start+'items: '.length,end).replace(/,\s*$/,'');
 const a=row({qty:2,punit:123.45,disc:10}),b=row({qty:3,punit:20}),before=copy([a.dataset,b.dataset]);a.dataset.svLineRef=REV+':2';delete a.dataset.svCommercialNew;
 const c={window:null,filas:[a,b],_ventaMonedaActual:'ARS',_redondearPrecioActual:v=>Math.round(v*100)/100,obtenerProductoPorCodigoVenta:()=>null,obtenerCostoUnitarioVenta:()=>40};c.window=c;vm.createContext(c);vm.runInContext('result='+expression,c);assert.equal(c.result[0]._svLineRef,REV+':2');assert.equal(c.result[0]._svCommercialNew,undefined);assert.equal(c.result[1]._svCommercialNew,true);assert.equal(c.result[0].sub,222.21);assert.equal(c.result[0].costoTotalCompra,80);assert.deepEqual(copy([a.dataset,b.dataset]),[{...before[0],svLineRef:REV+':2',svCommercialNew:undefined},before[1]].map(x=>copy(x)));
});
test('preparación es explícita, devuelve DTO actual completo y restaura el botón',async()=>{
 const f=preparationFixture(),record={fbKey:'record',items:[{qty:1}],projectId:'proyecto-anterior'},before=copy(record);assert.equal(f.calls.length,0);const running=f.c.svPrepararEditorComercial('ventas',record);assert.equal(f.button.disabled,true);assert.equal(f.button.attrs['aria-busy'],'true');assert.deepEqual(f.calls,[{domain:'ventas',id:'record'}]);f.pending.resolve({record:{id:'V-DEMO',projectId:'proyecto-actual',items:[{qty:2,_svLineRef:REV+':0'}],_svCommercial:{schema:1,revision:REV,readOnly:false}}});const result=await running;assert.equal(result.fbKey,'record');assert.equal(result.projectId,'proyecto-actual');assert.equal(result.items[0]._svLineRef,REV+':0');assert.equal(f.button.disabled,false);assert.equal(f.button.innerHTML,'Editar');assert.equal(f.button.attrs['aria-busy'],undefined);assert.deepEqual(record,before);
});
for(const condition of ['session','hidden','route','page'])test('respuesta tardía no abre editor después de retirar '+condition,async()=>{
 const f=preparationFixture(),running=f.c.svPrepararEditorComercial('presupuestos',{fbKey:'record'});if(condition==='session')f.state.valid=false;if(condition==='hidden')f.c.document.hidden=true;if(condition==='route')f.c.location.href='#/otra';if(condition==='page')f.state.page={};f.pending.resolve({record:{items:[]}});assert.equal(await running,null);assert.equal(f.button.disabled,false);
});
test('solicitud sustituida no puede abrir una ficha anterior',async()=>{
 const f=preparationFixture(),second=deferred();f.c.SVCommercialOwnership.prepare=(domain,id)=>id==='primera'?f.pending.promise:second.promise;const first=f.c.svPrepararEditorComercial('ventas',{fbKey:'primera'}),next=f.c.svPrepararEditorComercial('ventas',{fbKey:'segunda'});second.resolve({record:{id:'V-2'}});assert.equal((await next).id,'V-2');f.pending.resolve({record:{id:'V-1'}});assert.equal(await first,null);
});
test('error de preparación conserva formulario previo y no deja botón procesando',async()=>{
 const f=preparationFixture(),running=f.c.svPrepararEditorComercial('ventas',{fbKey:'record'});f.pending.reject(Error('Fallo ficticio'));await assert.rejects(running,/Fallo ficticio/);assert.equal(f.button.disabled,false);assert.equal(f.button.innerHTML,'Editar');
});
test('ficha de sólo lectura no se presenta como edición habilitada',async()=>{
 const f=preparationFixture(),running=f.c.svPrepararEditorComercial('ventas',{fbKey:'record'});f.pending.resolve({record:{_svCommercial:{readOnly:true}}});await assert.rejects(running,/necesita revisión/);
});
for(const kind of ['venta','presupuesto'])test(kind+': wrapper espera preparación antes de pintar y conserva la base preparada',async()=>{
 const f=preparationFixture(),effects=[],prepared={fbKey:'record',id:'DOC-DEMO',items:[{cod:'P',_svLineRef:REV+':0'}],proyectoId:'proyecto-demo'};
 f.c.svPrepararEditorComercial=()=>f.pending.promise;Object.assign(f.c,{ventasList:[{fbKey:'record',items:[]}],ventaEstaAnulada:()=>false,puedeEditarVentaPermiso:()=>true,svNavegarDirecto:(_page,paint)=>{effects.push('navigate');paint();},cargarRegistroVentaEnEditor:r=>{effects.push(copy(r));f.c._ventaEditandoOriginal=copy(r);},buscarPptoPorRef:()=>({fbKey:'record',items:[]}),puedeEditarPresupuestoPermiso:()=>true,toggleImagenComprobante(){},abrirNuevoPresupuesto:()=>effects.push('new'),iaMarcarPresupuesto(){},_svResolverClienteRegistro:()=>null,actualizarAccesoVentasClientePpto(){},mostrarDomicilioOperacionSeleccionado(){},pptoCargarItemsEnEditor:(r,refs)=>effects.push({record:copy(r),refs}),calcPpTotales(){}});
 f.c.document.getElementById=id=>id==='pp-titulo-solucion'?{value:''}:null;f.c.document.querySelector=()=>null;load(f.c,[kind==='venta'?'abrirEditorVenta':'abrirEditorPpto']);const running=f.c[kind==='venta'?'abrirEditorVenta':'abrirEditorPpto']('record');assert.equal(effects.length,0);f.pending.resolve(prepared);await running;assert.ok(effects.length>0);assert.equal((kind==='venta'?f.c._ventaEditandoOriginal:f.c._pptoEditorBase).items[0]._svLineRef,REV+':0');assert.equal((kind==='venta'?f.c._ventaEditandoOriginal:f.c._pptoEditorBase).proyectoId,'proyecto-demo');if(kind==='presupuesto')assert.equal(effects.at(-1).refs,true);
});

for(const event of ['sisventas:page-changed','sisventas:role-changed','visibilitychange'])test('retiro sticky '+event+' impide reapertura aunque el contexto vuelva',async()=>{
 const f=preparationFixture(),listeners=new Map();f.c.document.addEventListener=(name,fn)=>listeners.set(name,fn);f.c.document.removeEventListener=(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);};const running=f.c.svPrepararEditorComercial('ventas',{fbKey:'record'});if(event==='visibilitychange')f.c.document.hidden=true;listeners.get(event)();f.c.document.hidden=false;f.pending.resolve({record:{id:'V-DEMO'}});assert.equal(await running,null);assert.equal(listeners.size,0);
});
