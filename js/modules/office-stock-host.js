(function(root){'use strict';
let view=null,started=false,readiness=null;
function stop(){readiness?.cancel();readiness=null;view?.destroy();view=null;started=false;}
function active(){return document.getElementById('page-stockoficina')?.classList.contains('active');}
function start(){if(!active()||view||!root.SVOfficeStockAdapter||!root.SVOfficeStock)return;const host=document.getElementById('office-stock-content');if(!host)return;started=true;const adapter=root.SVOfficeStockAdapter.create(),original=adapter.list;adapter.list=async args=>{readiness?.cancel();const current=root.SVDataReadiness?.beginSource('officeStock','office-stock-api');readiness=current;try{const result=await original(args);current?.ready();return result;}catch(e){current?.error(e.message);throw e;}finally{if(!active()||readiness!==current)current?.cancel();}};view=root.SVOfficeStock.mount(host,{adapter,session:adapter.session});}
document.addEventListener('sisventas:page-changed',()=>{if(active())start();else stop();});
for(const event of ['sisventas:session-ended','sisventas:role-changed','sisventas:session-ready'])document.addEventListener(event,()=>{view?.sessionChanged();stop();if(active())start();});
document.addEventListener('DOMContentLoaded',start);root.SVOfficeStockHost=Object.freeze({start,stop,get claimed(){return started;}});
})(window);
