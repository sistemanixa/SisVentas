(function(root){
 'use strict';
 const serial=value=>{const s=String(value??'').trim();return s&&s.length<=120&&!/[\u0000-\u001f\u007f]/.test(s)?s:null;};
 function createSession(env){
  let current=null;
  function release(s){s.stream?.getTracks().forEach(t=>t.stop());s.stream=null;env.clearTimeout(s.timer);}
  function close(){const s=current;if(!s)return;current=null;release(s);s.onClose?.();if(s.audio)env.setTimeout(()=>{try{s.audio.close()?.catch?.(()=>{});}catch(_){}},180);}
  async function open({video,onRead,onStatus,onClose,deviceId,kind}){
   close();const s={onClose,frames:0};const product=kind==='product';current=s;
   const status=t=>{if(current===s)onStatus(t);};
   try{
    if(!env.isSecureContext||!env.navigator?.mediaDevices?.getUserMedia)throw Error('Abrí SisVentas por HTTPS y permití el acceso a la cámara. También podés escribir '+(product?'el código.':'la serie.'));
    // Unlock sound during the explicit camera-button gesture, before asynchronous work.
    try{const Audio=env.AudioContext||env.webkitAudioContext;if(Audio){s.audio=new Audio();s.audio.resume()?.catch?.(()=>{});}}catch(_){}
    status('Abriendo cámara…');
    const pending=env.navigator.mediaDevices.getUserMedia({audio:false,video:deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
    const stream=await pending;if(current!==s){stream.getTracks().forEach(t=>t.stop());return;}s.stream=stream;video.srcObject=stream;await video.play();if(current!==s)return;
    const decode=await env.decoder();if(current!==s)return;
    status(product?'Apuntá al código de barras o QR del producto.':'Apuntá al código de barras o QR que corresponde al número de serie.');
    async function scan(){
     if(current!==s)return;
     s.frames++;if(s.frames===1||s.frames%4===0)status("Buscando código… Cámara activa · "+s.frames+(s.frames===1?" imagen analizada":" imágenes analizadas"));
     try{const result=await decode(video);if(current!==s)return;const value=serial(result);
      if(value){try{if(s.audio){const o=s.audio.createOscillator(),g=s.audio.createGain();o.frequency.value=1800;g.gain.value=.12;o.connect(g);g.connect(s.audio.destination);o.start();o.stop(s.audio.currentTime+.12);}}catch(_){}close();onRead(value);return;}
      if(result)status(product?'El código no es válido. Probá otra etiqueta o escribilo para buscar.':'El código no es una serie válida. Probá con la etiqueta de serie o cargala a mano.');
     }catch(_){} // A frame without a readable code is expected.
     if(current===s)s.timer=env.setTimeout(scan,250);
    }
    scan();
   }catch(e){if(current!==s)return;release(s);const fallback=product?'el código':'la serie';status(e.name==='NotAllowedError'?'No se permitió usar la cámara. Habilitala en el navegador o escribí '+fallback+'.':e.name==='NotFoundError'?'No encontramos una cámara. Conectala o escribí '+fallback+'.':e.name==='NotReadableError'?'La cámara está ocupada. Cerrá la otra aplicación y volvé a intentar.':e.message||'No se pudo abrir el lector. Podés escribir '+fallback+'.');}
  }
  return {open,close};
 }
 let loading;
 const readerURL=root.document?new URL('../vendor/zxing/zxing-browser-0.1.5.min.js',document.currentScript.src).href:'';
 function loadReader(){if(root.ZXingBrowser)return Promise.resolve(root.ZXingBrowser);if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=readerURL;script.onload=()=>root.ZXingBrowser?resolve(root.ZXingBrowser):reject(Error('No se pudo cargar el lector.'));script.onerror=()=>{loading=null;script.remove();reject(Error('No se pudo cargar el lector. Revisá la conexión y volvé a intentar.'));};document.head.append(script);});return loading;}
 function createUI(){
  let dialog=null,returnFocus=null,oldOverflow="";
  const session=createSession({...Object.fromEntries(['navigator','isSecureContext','AudioContext','webkitAudioContext'].map(k=>[k,root[k]])),setTimeout:root.setTimeout.bind(root),clearTimeout:root.clearTimeout.bind(root),decoder:async()=>{
   // Bundled decoder supports browsers without BarcodeDetector and reads locally.
   const lib=await loadReader(),reader=new lib.BrowserMultiFormatReader();return video=>reader.decode(video).getText();
  }});
  function close(){session.close();if(dialog){dialog.close();dialog.remove();dialog=null;document.body.style.overflow=oldOverflow;}if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
  function open({onRead,label,kind}){
   const product=kind==='product';close();returnFocus=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog=document.createElement('dialog');dialog.setAttribute('data-sv-escape-owner','true');dialog.setAttribute('data-sv-camera','true');dialog.setAttribute('aria-label',product?'Escanear código del producto':'Escanear número de serie');dialog.style.cssText='position:fixed;inset:0;margin:auto;box-sizing:border-box;width:min(560px,calc(100% - 24px));max-height:90dvh;overflow:auto;border:1px solid var(--border,#34445c);border-radius:16px;padding:20px;background:var(--bg2,#111e30);color:var(--text,#e5edf7)';
   dialog.innerHTML='<form method="dialog" style="margin:0"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h3 style="margin:0">Escanear serie</h3><button class="btn" aria-label="Cerrar lector">✕</button></div></form><p data-label style="overflow-wrap:anywhere"></p><div data-camera-view style="position:relative;width:100%;aspect-ratio:4/3;max-height:min(48dvh,360px);background:#070e18;border-radius:10px;overflow:hidden"><video autoplay muted playsinline style="position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;background:#070e18"></video><div data-guide aria-hidden="true" style="position:absolute;box-sizing:border-box;left:50%;top:50%;transform:translate(-50%,-50%);width:76%;height:34%;max-width:76%;max-height:76%;border:3px solid #78d99a;border-radius:12px;box-shadow:0 0 0 100vmax #0005;pointer-events:none"></div></div><div role="group" aria-label="Guía de lectura" style="display:flex;gap:10px;margin-top:12px"><button type="button" class="btn" data-guide-mode="bars" aria-pressed="true">Código de barras</button><button type="button" class="btn" data-guide-mode="qr" aria-pressed="false">QR</button></div><p data-guide-help>Ubicá todo el código dentro del rectángulo.</p><p role="status" aria-live="polite" style="line-height:1.6"></p><label>Cámara<select aria-label="Cámara" style="display:block;max-width:100%;margin:10px 0;padding:10px"></select></label><button type="button" class="btn" data-retry>Volver a intentar</button><p style="font-size:12px;color:var(--text3,#aab8c9)">Leé el código de serie, no el código comercial del producto. Revisá el resultado antes de emitir. Las imágenes no se guardan ni se envían.</p>';
   dialog.querySelector('button').style.cssText='min-width:44px;min-height:44px';dialog.querySelector('h3').textContent=product?'Escanear producto':'Escanear serie';if(product)dialog.querySelector('p:last-child').textContent='Leé el código comercial o SKU registrado. El resultado se usa para buscar; revisá el producto antes de agregarlo. Las imágenes no se guardan ni se envían.';dialog.style.overscrollBehavior='contain';document.body.append(dialog);dialog.querySelector('[data-label]').textContent=label||'Número de serie';dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.querySelector('form').onsubmit=e=>{e.preventDefault();close();};dialog.showModal();
   dialog.querySelectorAll('[data-guide-mode]').forEach(button=>button.onclick=()=>{const qr=button.dataset.guideMode==='qr',guide=dialog.querySelector('[data-guide]');guide.style.width=qr?'auto':'76%';guide.style.height=qr?'68%':'34%';guide.style.aspectRatio=qr?'1':'auto';dialog.querySelector('[data-guide-help]').textContent=qr?'Ubicá el QR dentro del cuadrado.':'Ubicá todo el código dentro del rectángulo.';dialog.querySelectorAll('[data-guide-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
   const active=dialog,video=dialog.querySelector('video'),status=dialog.querySelector('[role="status"]'),select=dialog.querySelector('select');
   async function start(deviceId){await session.open({video,deviceId,kind,onStatus:t=>{status.textContent=t;},onClose:()=>{video.pause();video.srcObject=null;},onRead:value=>{if(dialog!==active)return;close();onRead(value);}});if(dialog!==active)return;try{const devices=await root.navigator.mediaDevices.enumerateDevices();if(dialog!==active)return;select.replaceChildren();for(const [n,d]of devices.filter(d=>d.kind==='videoinput').entries()){const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||'Cámara '+(n+1);select.append(o);}const used=video.srcObject?.getVideoTracks()[0]?.getSettings()?.deviceId;if(used)select.value=used;}catch(_){select.disabled=true;}}
   select.onchange=()=>start(select.value);dialog.querySelector('[data-retry]').onclick=()=>start(select.value||undefined);start();
  }
  root.addEventListener('pagehide',close);document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});document.addEventListener('sisventas:session-ended',close);document.addEventListener('sisventas:page-changed',close);
  return {open,close};
 }
 const api={serial,createSession};if(typeof module!=='undefined')module.exports=api;if(root.document)root.SVSerialCamera=createUI();
})(typeof window==='undefined'?{}:window);
