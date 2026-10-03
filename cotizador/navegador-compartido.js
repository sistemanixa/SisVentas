function crearPool(chromium,{idleMs=30000,contextMs=55000}={}) {
  let navegador=null,iniciando=null,usuarios=0,timer=null;
  async function adquirir() {
    clearTimeout(timer);usuarios++;
    try {
      if(!navegador || !navegador.isConnected()) {
        if(!iniciando)iniciando=chromium.launch({headless:true}).then(b=>{navegador=b;return b;}).finally(()=>{iniciando=null;});
        await iniciando;
      }
    } catch(e){usuarios--;throw e;}
    const browser=navegador,contextos=new Set();let cerrado=false;
    return {
      async newContext(opciones) {
        if(cerrado)throw new Error('Consulta finalizada');
        const ctx=await browser.newContext(opciones);contextos.add(ctx);
        const cerrar=ctx.close.bind(ctx);let cierre=null;
        const limite=setTimeout(()=>ctx.close().catch(()=>{}),contextMs);limite.unref?.();
        ctx.close=()=>{
          if(!cierre){clearTimeout(limite);contextos.delete(ctx);cierre=cerrar();}
          return cierre;
        };
        // Una revisión de precios no necesita descargar fotos, vídeos ni
        // tipografías. Los metadatos y URL de imagen siguen disponibles.
        await ctx.route('**/*',route=>['image','media','font'].includes(route.request().resourceType()) ? route.abort() : route.fallback());
        return ctx;
      },
      async close() {
        if(cerrado)return;cerrado=true;
        await Promise.allSettled([...contextos].map(c=>c.close()));usuarios--;
        if(!usuarios){timer=setTimeout(()=>{if(!usuarios && navegador===browser){navegador=null;browser.close().catch(()=>{});}},idleMs);timer.unref?.();}
      }
    };
  }
  return {adquirir};
}
const {chromium}=require('playwright');
const pool=crearPool(chromium);
module.exports={crearPool,adquirirNavegador:pool.adquirir};
