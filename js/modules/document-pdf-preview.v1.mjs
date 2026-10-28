export async function mount(host, url) {
  if (!host || !host.isConnected) return;
  let pdf, task, renderTask, closed = false, pageNumber = 1, busy = false;
  const doc = host.ownerDocument;
  host.style.cssText = 'width:100%;height:100%;min-height:0;display:flex;flex-direction:column;gap:8px';
  const controls = doc.createElement('div'); controls.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;flex:0 0 auto';
  const previous = doc.createElement('button'), next = doc.createElement('button'), status = doc.createElement('span');
  previous.type = next.type = 'button'; previous.className = next.className = 'btn btn-sm'; previous.textContent = 'Anterior'; next.textContent = 'Siguiente';
  status.setAttribute('role','status'); status.style.cssText = 'font-size:13px;min-width:100px;text-align:center'; status.textContent = 'Cargando PDF…';
  controls.append(previous,status,next);
  const scroll = doc.createElement('div'); scroll.style.cssText = 'flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;text-align:center';
  const canvas = doc.createElement('canvas'); canvas.style.cssText = 'display:block;margin:0 auto;max-width:100%;height:auto;background:white'; canvas.setAttribute('aria-label','Página del comprobante PDF'); scroll.append(canvas); host.replaceChildren(controls,scroll);
  const live = () => !closed && host.isConnected;
  function buttons(){previous.disabled = busy || !pdf || pageNumber <= 1; next.disabled = busy || !pdf || pageNumber >= pdf.numPages; previous.style.cursor = next.style.cursor = 'pointer';}
  function error(){if(!live())return;status.textContent = 'No se pudo mostrar el PDF. Podés descargar el original.';busy=false;buttons();}
  function destroy(){if(closed)return;closed=true;observer.disconnect();renderTask?.cancel();Promise.resolve(task?.destroy()).catch(()=>{});canvas.width=canvas.height=0;}
  const observer = new MutationObserver(()=>{if(!host.isConnected)destroy();}); observer.observe(doc.body,{childList:true,subtree:true});
  async function render(number){if(!live()||busy||!pdf)return;busy=true;buttons();status.textContent='Cargando página '+number+'…';
    try {const page=await pdf.getPage(number);if(!live())return;const natural=page.getViewport({scale:1});const width=Math.max(240,Math.min(1100,scroll.clientWidth-8));const scale=Math.min(2,window.devicePixelRatio||1)*width/natural.width;const viewport=page.getViewport({scale});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;if(!live())return;pageNumber=number;status.textContent='Página '+number+' de '+pdf.numPages;canvas.setAttribute('aria-label','Página '+number+' de '+pdf.numPages+' del comprobante PDF');scroll.scrollTop=0;
    }catch(e){if(live()&&e?.name!=='RenderingCancelledException')error();}finally{busy=false;if(live())buttons();}}
  previous.addEventListener('click',()=>{if(!busy&&pageNumber>1)render(pageNumber-1);});next.addEventListener('click',()=>{if(!busy&&pdf&&pageNumber<pdf.numPages)render(pageNumber+1);});buttons();
  try {const pdfjs=await import('../vendor/pdfjs/pdf.min.mjs');if(!live())return;pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;task=pdfjs.getDocument({url,isEvalSupported:false,useSystemFonts:true});pdf=await task.promise;if(!live())return;await render(1);}catch(_){error();}
  return {destroy};
}
