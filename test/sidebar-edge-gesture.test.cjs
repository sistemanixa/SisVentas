const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function fixture({desktop=false,modal=false,interactive=false,scroll=false,auth=true}={}){
 const listeners={},resize={};let opened=0,prevented=0;
 const body={classList:{contains:()=>modal}},target={closest:()=>interactive?{}:null,scrollWidth:scroll?500:100,clientWidth:100,parentElement:body};
 const c=load({isAuthenticated:auth,sidebarDesktopActivo:()=>desktop,toggleSidebar:()=>opened++,getComputedStyle:()=>({overflowX:'auto'}),window:{addEventListener:(n,fn)=>resize[n]=fn},document:{body,querySelector:s=>s==='.sidebar'?{classList:{contains:()=>false}}:null,addEventListener:(n,fn)=>listeners[n]=fn}},['inicializarGestoSidebarMobile']);
 c.inicializarGestoSidebarMobile();
 function event(name,x,y,ts=0,count=1){const touch={identifier:1,clientX:x,clientY:y};listeners[name]({target,timeStamp:ts,cancelable:true,touches:name==='touchend'?[]:Array.from({length:count},()=>touch),changedTouches:[touch],preventDefault:()=>prevented++});}
 function swipe(x=6,y=100,dx=90,dy=2,duration=250){event('touchstart',x,y);event('touchmove',x+dx,y+dy,duration/2);event('touchend',x+dx,y+dy,duration);}
 return {event,swipe,resize,get opened(){return opened;},get prevented(){return prevented;}};
}
test('abre una sola vez con un gesto horizontal desde los primeros12px',()=>{for(const x of [0,6,12]){const f=fixture();f.swipe(x);assert.equal(f.opened,1);assert.equal(f.prevented,1);f.event('touchend',100,100,300);assert.equal(f.opened,1);}});
test('no captura gestos iniciados fuera del borde ni arrastres cortos, lentos o hacia la izquierda',()=>{
 for(const [x,dx,ms]of [[13,90,250],[40,100,250],[6,40,250],[6,-90,250],[6,90,900]]){const f=fixture();f.swipe(x,100,dx,0,ms);assert.equal(f.opened,0);}
});
test('scroll vertical o diagonal cancela sin bloquear el desplazamiento',()=>{
 for(const [dx,dy]of [[5,70],[45,50]]){const f=fixture();f.swipe(6,100,dx,dy);assert.equal(f.opened,0);assert.equal(f.prevented,0);}
 const f=fixture();f.event('touchstart',6,100);f.event('touchmove',8,115,30);f.event('touchmove',100,115,90);f.event('touchend',100,115,120);assert.equal(f.opened,0);
});
test('fotos, controles, carruseles y tablas con scroll conservan sus gestos',()=>{for(const options of [{interactive:true},{scroll:true}]){const f=fixture(options);f.swipe();assert.equal(f.opened,0);assert.equal(f.prevented,0);}});
test('no se activa en escritorio, sin sesión ni sobre una ventana modal',()=>{for(const options of [{desktop:true},{auth:false},{modal:true}]){const f=fixture(options);f.swipe();assert.equal(f.opened,0);}});
test('multitáctil, cancelación y rotación descartan el gesto pendiente',()=>{
 for(const cancel of [f=>f.event('touchmove',30,100,40,2),f=>f.event('touchcancel',30,100,40),f=>f.resize.resize()]){const f=fixture();f.event('touchstart',6,100);cancel(f);f.event('touchmove',100,100,120);f.event('touchend',100,100,160);assert.equal(f.opened,0);}
});
